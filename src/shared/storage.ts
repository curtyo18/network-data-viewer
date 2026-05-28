import type { AnalyserConfig } from "@/shared/types";
import { AnalyserConfigArraySchema } from "@/shared/schema";
import { STORAGE_KEY, STORAGE_KEY_VERSION } from "@/shared/messages";
import { STORAGE_KEY_SETTINGS, mergeSettings, type Settings } from "@/shared/settings";

export const CURRENT_STORAGE_VERSION = 2;

export class Storage {
  constructor(private area: chrome.storage.StorageArea) {}

  // One-shot, intentionally destructive migration. Pre-v2 analysers carried a
  // `source` field that the new pipeline does not recognise. The tool has no
  // users yet, so we wipe rather than rewrap.
  async migrate(): Promise<void> {
    const res = await this.area.get(STORAGE_KEY_VERSION);
    const raw = res[STORAGE_KEY_VERSION];
    const current = typeof raw === "number" ? raw : 1;
    if (current >= CURRENT_STORAGE_VERSION) return;
    await this.area.remove(STORAGE_KEY);
    await this.area.set({ [STORAGE_KEY_VERSION]: CURRENT_STORAGE_VERSION });
  }

  // Validate at the read boundary rather than trusting stored data. A partial
  // migration, buggy import, or sync conflict could leave malformed configs in
  // storage; an invalid entry would otherwise crash compileConfigs/dispatch.
  // We fail closed per entry: valid configs pass through, the rest are dropped.
  async getAnalysers(): Promise<AnalyserConfig[]> {
    const res = await this.area.get(STORAGE_KEY);
    const raw = res[STORAGE_KEY];
    if (!Array.isArray(raw)) return [];
    const out: AnalyserConfig[] = [];
    for (const entry of raw) {
      const parsed = AnalyserConfigArraySchema.element.safeParse(entry);
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  }

  async setAnalysers(configs: AnalyserConfig[]): Promise<void> {
    await this.area.set({ [STORAGE_KEY]: configs });
  }

  async getSettings(): Promise<Settings> {
    const res = await this.area.get(STORAGE_KEY_SETTINGS);
    return mergeSettings(res[STORAGE_KEY_SETTINGS] as Partial<Settings> | undefined);
  }

  async setSettings(partial: Partial<Settings>): Promise<void> {
    const current = await this.getSettings();
    await this.area.set({ [STORAGE_KEY_SETTINGS]: { ...current, ...partial } });
  }
}

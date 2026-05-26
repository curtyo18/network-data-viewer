import type { AnalyserConfig } from "@/shared/types";
import { STORAGE_KEY } from "@/shared/messages";
import { STORAGE_KEY_SETTINGS, DEFAULT_SETTINGS, type Settings } from "@/shared/settings";

export class Storage {
  constructor(private area: chrome.storage.StorageArea) {}

  async getAnalysers(): Promise<AnalyserConfig[]> {
    const res = await this.area.get(STORAGE_KEY);
    return (res[STORAGE_KEY] as AnalyserConfig[] | undefined) ?? [];
  }

  async setAnalysers(configs: AnalyserConfig[]): Promise<void> {
    await this.area.set({ [STORAGE_KEY]: configs });
  }

  async getSettings(): Promise<Settings> {
    const res = await this.area.get(STORAGE_KEY_SETTINGS);
    const stored = res[STORAGE_KEY_SETTINGS] as Partial<Settings> | undefined;
    return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }

  async setSettings(partial: Partial<Settings>): Promise<void> {
    const current = await this.getSettings();
    await this.area.set({ [STORAGE_KEY_SETTINGS]: { ...current, ...partial } });
  }
}

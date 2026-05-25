import type { AnalyserConfig } from "@/shared/types";
import { STORAGE_KEY as KEY } from "@/shared/messages";

export class Storage {
  constructor(private area: chrome.storage.StorageArea) {}

  async getAnalysers(): Promise<AnalyserConfig[]> {
    const res = await this.area.get(KEY);
    return (res[KEY] as AnalyserConfig[] | undefined) ?? [];
  }

  async setAnalysers(configs: AnalyserConfig[]): Promise<void> {
    await this.area.set({ [KEY]: configs });
  }
}

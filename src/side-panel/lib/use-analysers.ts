import { useEffect, useState, useCallback } from "react";
import { Storage } from "@/shared/storage";
import { STORAGE_KEY } from "@/shared/messages";
import type { AnalyserConfig } from "@/shared/types";

const storage = new Storage(chrome.storage.local);

export function useAnalysers(): {
  analysers: AnalyserConfig[];
  setAnalysers: (next: AnalyserConfig[]) => Promise<void>;
  upsert: (cfg: AnalyserConfig) => Promise<void>;
  remove: (id: string) => Promise<void>;
} {
  const [analysers, setLocal] = useState<AnalyserConfig[]>([]);

  useEffect(() => {
    void storage.getAnalysers().then(setLocal);
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && STORAGE_KEY in changes) {
        setLocal((changes[STORAGE_KEY].newValue as AnalyserConfig[] | undefined) ?? []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const setAnalysers = useCallback((next: AnalyserConfig[]) => storage.setAnalysers(next), []);
  const upsert = useCallback(async (cfg: AnalyserConfig) => {
    const current = await storage.getAnalysers();
    const idx = current.findIndex(a => a.id === cfg.id);
    const next = idx >= 0 ? current.map((a, i) => i === idx ? cfg : a) : [...current, cfg];
    await storage.setAnalysers(next);
  }, []);
  const remove = useCallback(async (id: string) => {
    const current = await storage.getAnalysers();
    await storage.setAnalysers(current.filter(a => a.id !== id));
  }, []);

  return { analysers, setAnalysers, upsert, remove };
}

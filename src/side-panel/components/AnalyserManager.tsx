import { useEffect, useState } from "react";
import type { AnalyserConfig } from "@/shared/types";

export function AnalyserManager({ onEdit }: { onEdit: (cfg: AnalyserConfig | null) => void }) {
  const [analysers, setAnalysers] = useState<AnalyserConfig[]>([]);

  useEffect(() => {
    const load = () => chrome.storage.local.get("analyserConfigs").then(r => setAnalysers((r.analyserConfigs as AnalyserConfig[] | undefined) ?? []));
    load();
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && "analyserConfigs" in changes) {
        setAnalysers((changes.analyserConfigs.newValue as AnalyserConfig[] | undefined) ?? []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function toggle(id: string) {
    const next = analysers.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    await chrome.storage.local.set({ analyserConfigs: next });
  }
  async function remove(id: string) {
    const next = analysers.filter(a => a.id !== id);
    await chrome.storage.local.set({ analyserConfigs: next });
  }

  return (
    <div className="p-2 text-xs">
      <div className="flex justify-between items-center mb-2">
        <span className="text-slate-300 font-semibold">Analysers ({analysers.length})</span>
        <button className="px-2 py-1 bg-violet-700 rounded text-white" onClick={() => onEdit(null)}>+ New</button>
      </div>
      <ul>
        {analysers.map(a => (
          <li key={a.id} className="flex items-center justify-between border-b border-slate-800 py-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={a.enabled} onChange={() => toggle(a.id)} />
              <span className={a.enabled ? "text-slate-100" : "text-slate-500"}>{a.name}</span>
            </label>
            <div className="flex gap-2">
              <button className="text-slate-400 hover:text-slate-100" onClick={() => onEdit(a)}>edit</button>
              <button className="text-rose-400 hover:text-rose-300" onClick={() => remove(a.id)}>×</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

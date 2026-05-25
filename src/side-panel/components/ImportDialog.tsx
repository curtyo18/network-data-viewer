import { useState } from "react";
import { decodeConfig } from "@/shared/share";
import type { AnalyserConfig } from "@/shared/types";

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function doImport() {
    try {
      const incoming = decodeConfig(text.trim());
      const r = await chrome.storage.local.get("analyserConfigs");
      const existing = ((r.analyserConfigs as AnalyserConfig[] | undefined) ?? []);
      const byId = new Map(existing.map(a => [a.id, a]));
      for (const a of incoming) byId.set(a.id, a);
      await chrome.storage.local.set({ analyserConfigs: Array.from(byId.values()) });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="p-3 text-xs font-mono space-y-2">
      <label className="block text-slate-400">paste dvw:1:… string</label>
      <textarea className="w-full h-24 bg-slate-900 border border-slate-700 px-2 py-1 rounded" value={text} onChange={e => { setText(e.target.value); setError(null); }} />
      {error && <div className="text-rose-400">{error}</div>}
      <div className="flex gap-2">
        <button className="px-3 py-1 bg-violet-700 rounded text-white" onClick={doImport}>Install</button>
        <button className="px-3 py-1 bg-slate-800 rounded text-slate-200" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

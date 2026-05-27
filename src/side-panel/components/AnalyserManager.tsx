import { useState } from "react";
import type { AnalyserConfig } from "@/shared/types";
import { useAnalysers } from "@/side-panel/lib/use-analysers";
import { useAnalyserErrors } from "@/side-panel/lib/use-analyser-errors";
import { useExport } from "@/side-panel/lib/use-export";

export function AnalyserManager({ onEdit }: { onEdit: (cfg: AnalyserConfig | null) => void }) {
  const { analysers, toggle, remove } = useAnalysers();
  const { errors } = useAnalyserErrors();
  const { copyOne, copiedId } = useExport();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="p-2 text-xs">
      <div className="flex justify-between items-center mb-2">
        <span className="text-slate-300 font-semibold">Analysers ({analysers.length})</span>
        <button className="px-2 py-1 bg-violet-700 rounded text-white" onClick={() => onEdit(null)}>+ New</button>
      </div>
      <ul>
        {analysers.map(a => (
          <li key={a.id} className="border-b border-slate-800">
            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input type="checkbox" checked={a.enabled} onChange={() => toggle(a.id)} />
                <span className={a.enabled ? "text-slate-100" : "text-slate-500"}>{a.name}</span>
              </label>
              <div className="flex gap-2">
                {errors[a.id]?.length ? (
                  <button
                    className="text-rose-400 text-xs"
                    aria-label={`${errors[a.id].length} errors`}
                    onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  >
                    ● {errors[a.id].length}
                  </button>
                ) : null}
                <button
                  className="text-slate-400 hover:text-slate-100"
                  onClick={() => { void copyOne(a); }}
                  title="Copy share string for this analyser"
                  aria-label={`Copy share string for ${a.name}`}
                >
                  {copiedId === a.id ? "Copied!" : "share"}
                </button>
                <button className="text-slate-400 hover:text-slate-100" onClick={() => onEdit(a)}>edit</button>
                <button className="text-rose-400 hover:text-rose-300" onClick={() => remove(a.id)}>×</button>
              </div>
            </div>
            {expanded === a.id && errors[a.id]?.length ? (
              <div className="pl-6 pb-2 text-xs text-rose-300 space-y-1">
                {errors[a.id].slice(-3).reverse().map((e, i) => (
                  <div key={i}>
                    <span className="text-slate-500">{new Date(e.ts).toLocaleTimeString()}</span>{" "}
                    <span className="text-rose-400">[{e.stage}]</span> {e.message}
                  </div>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

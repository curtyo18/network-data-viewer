import { useState } from "react";
import { decodeConfig } from "@/shared/share";
import { useAnalysers } from "@/entrypoints/sidepanel/lib/use-analysers";
import { buildPreview } from "@/entrypoints/sidepanel/lib/import-preview";
import type { DecodedPreview } from "@/entrypoints/sidepanel/lib/import-preview";
import type { AnalyserConfig } from "@/shared/types";

type State =
  | { kind: "input"; decodeError: string | null }
  | { kind: "preview"; incoming: AnalyserConfig[]; preview: DecodedPreview };

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { analysers, setAnalysers } = useAnalysers();
  const [text, setText] = useState("");
  const [state, setState] = useState<State>({ kind: "input", decodeError: null });

  function doDecode() {
    try {
      const incoming = decodeConfig(text.trim());
      const preview = buildPreview(analysers, incoming);
      setState({ kind: "preview", incoming, preview });
    } catch (e) {
      setState({ kind: "input", decodeError: (e as Error).message });
    }
  }

  async function doInstall(incoming: AnalyserConfig[]) {
    const byId = new Map(analysers.map(a => [a.id, a]));
    for (const a of incoming) byId.set(a.id, a);
    await setAnalysers(Array.from(byId.values()));
    onClose();
  }

  return (
    <div className="p-3 text-xs font-mono space-y-2">
      {state.kind === "input" && (
        <>
          <label className="block text-slate-400">paste dvw:2:… string</label>
          <textarea
            className="w-full h-24 bg-slate-900 border border-slate-700 px-2 py-1 rounded"
            value={text}
            onChange={e => { setText(e.target.value); setState({ kind: "input", decodeError: null }); }}
          />
          {state.decodeError && (
            <div className="text-rose-400">{state.decodeError}</div>
          )}
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-violet-700 rounded text-white" onClick={doDecode}>Decode</button>
            <button className="px-3 py-1 bg-slate-800 rounded text-slate-200" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}

      {state.kind === "preview" && (
        <>
          <div className="text-slate-400 text-xs">Preview:</div>
          {state.preview.replace.length > 0 && (
            <div>
              <div className="text-amber-300">Will replace {state.preview.replace.length} existing:</div>
              <ul className="list-disc list-inside text-slate-300">
                {state.preview.replace.map(({ existing, incoming }) => (
                  <li key={incoming.id}>
                    {existing.name}
                    {existing.seedVersion != null && incoming.seedVersion != null && existing.seedVersion !== incoming.seedVersion && (
                      <span className="text-slate-500"> (v{existing.seedVersion} → v{incoming.seedVersion})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {state.preview.add.length > 0 && (
            <div>
              <div className="text-emerald-300">Will add {state.preview.add.length} new:</div>
              <ul className="list-disc list-inside text-slate-300">
                {state.preview.add.map(a => <li key={a.id}>{a.name}</li>)}
              </ul>
            </div>
          )}
          {state.preview.unchanged.length > 0 && (
            <div className="text-slate-500">{state.preview.unchanged.length} unchanged (already installed identically)</div>
          )}
          {state.preview.replace.length === 0 && state.preview.add.length === 0 && (
            <div className="text-slate-500">No changes — the incoming bundle matches your existing analysers.</div>
          )}
          <div className="flex gap-2">
            <button
              className="px-3 py-1 bg-violet-700 rounded text-white disabled:opacity-40"
              onClick={() => void doInstall(state.incoming)}
              disabled={state.preview.replace.length === 0 && state.preview.add.length === 0}
            >
              Install
            </button>
            <button className="px-3 py-1 bg-slate-800 rounded text-slate-200" onClick={() => setState({ kind: "input", decodeError: null })}>Back</button>
          </div>
        </>
      )}
    </div>
  );
}

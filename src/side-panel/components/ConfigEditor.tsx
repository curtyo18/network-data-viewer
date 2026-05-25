import { useState, useEffect } from "react";
import type { AnalyserConfig, DslStep } from "@/shared/types";
import { AnalyserConfigSchema } from "@/shared/schema";
import { useAnalysers } from "@/side-panel/lib/use-analysers";

const EMPTY: AnalyserConfig = {
  id: "", name: "", enabled: true, urlPattern: "", source: "reqBody",
  dsl: [], sandboxCode: "", createdAt: 0
};

export function ConfigEditor({ initial, onClose }: { initial: AnalyserConfig | null; onClose: () => void }) {
  const { upsert } = useAnalysers();
  const [cfg, setCfg] = useState<AnalyserConfig>(initial ?? { ...EMPTY, id: crypto.randomUUID(), createdAt: Date.now() });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCfg(initial ?? { ...EMPTY, id: crypto.randomUUID(), createdAt: Date.now() });
    setError(null);
  }, [initial]);

  function update<K extends keyof AnalyserConfig>(k: K, v: AnalyserConfig[K]) {
    setError(null);
    setCfg(prev => ({ ...prev, [k]: v }));
  }

  function addStep(op: DslStep["op"]) {
    const step: DslStep =
      op === "jsonpath" ? { op, path: "$" } :
      op === "pluck" ? { op, keys: [] } :
      op === "regex-extract" ? { op, pattern: "" } :
      { op } as DslStep;
    update("dsl", [...cfg.dsl, step]);
  }
  function removeStep(i: number) { update("dsl", cfg.dsl.filter((_, idx) => idx !== i)); }
  function updateStep(i: number, patch: Partial<DslStep>) {
    update("dsl", cfg.dsl.map((s, idx) => idx === i ? { ...s, ...patch } as DslStep : s));
  }

  async function save() {
    try {
      new RegExp(cfg.urlPattern);
    } catch {
      setError("invalid regex pattern");
      return;
    }

    const validation = AnalyserConfigSchema.safeParse(cfg);
    if (!validation.success) {
      setError(validation.error.errors[0]?.message ?? "validation failed");
      return;
    }

    await upsert(cfg);
    onClose();
  }

  return (
    <div className="p-3 text-xs font-mono space-y-3">
      <div>
        <label className="block text-slate-400">name</label>
        <input className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded" value={cfg.name} onChange={e => update("name", e.target.value)} />
      </div>
      <div>
        <label className="block text-slate-400">url regex</label>
        <input className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded" value={cfg.urlPattern} onChange={e => update("urlPattern", e.target.value)} />
      </div>
      <div>
        <label className="block text-slate-400">source</label>
        <select className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded" value={cfg.source} onChange={e => update("source", e.target.value as AnalyserConfig["source"])}>
          <option value="reqBody">reqBody</option>
          <option value="url">url</option>
          <option value="resBody">resBody</option>
        </select>
      </div>
      <div>
        <label className="block text-slate-400">dsl chain</label>
        <ol className="border border-slate-800 rounded">
          {cfg.dsl.map((step, i) => (
            <li key={i} className="flex items-center gap-2 p-1 border-b border-slate-800 last:border-b-0">
              <span className="text-violet-300">{step.op}</span>
              {step.op === "jsonpath" && <input className="flex-1 bg-slate-900 border border-slate-700 px-1 rounded" value={step.path} onChange={e => updateStep(i, { path: e.target.value } as Partial<DslStep>)} />}
              {step.op === "pluck" && <input className="flex-1 bg-slate-900 border border-slate-700 px-1 rounded" placeholder="a, b.c" value={step.keys.join(",")} onChange={e => updateStep(i, { keys: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } as Partial<DslStep>)} />}
              {step.op === "regex-extract" && (
                <>
                  <input className="flex-1 bg-slate-900 border border-slate-700 px-1 rounded" placeholder="pattern" value={step.pattern} onChange={e => updateStep(i, { pattern: e.target.value } as Partial<DslStep>)} />
                  <input className="w-12 bg-slate-900 border border-slate-700 px-1 rounded" type="number" value={step.group ?? 0} onChange={e => updateStep(i, { group: Number(e.target.value) } as Partial<DslStep>)} />
                </>
              )}
              <button className="text-rose-400" onClick={() => removeStep(i)}>×</button>
            </li>
          ))}
        </ol>
        <select className="mt-1 bg-slate-900 border border-slate-700 px-2 py-1 rounded" value="" onChange={e => { if (e.target.value) { addStep(e.target.value as DslStep["op"]); e.target.value = ""; } }}>
          <option value="">+ add step…</option>
          {["decode-uri","decode-base64","decode-form","gunzip","json-parse","query-parse","jsonpath","pluck","regex-extract","to-string"].map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-slate-400">sandbox code (optional)</label>
        <textarea className="w-full h-24 bg-slate-900 border border-slate-700 px-2 py-1 rounded font-mono" value={cfg.sandboxCode ?? ""} onChange={e => update("sandboxCode", e.target.value || undefined)} placeholder="return input;" />
      </div>
      {error && <div className="text-rose-400">{error}</div>}
      <div className="flex gap-2">
        <button className="px-3 py-1 bg-violet-700 rounded text-white" onClick={save}>Save</button>
        <button className="px-3 py-1 bg-slate-800 rounded text-slate-200" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

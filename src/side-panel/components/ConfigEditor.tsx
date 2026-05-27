import { useState, useEffect } from "react";
import type { AnalyserConfig, DslStep } from "@/shared/types";
import { AnalyserConfigSchema } from "@/shared/schema";
import { useAnalysers } from "@/side-panel/lib/use-analysers";
import { runDslWithSteps, type PreviewRow } from "@/shared/dsl/preview";
import { lintAnalyser, type LintIssue } from "@/shared/dsl/lint";

function formatPreviewValue(v: unknown): string {
  const MAX = 500;
  if (typeof v === "string") {
    return v.length > MAX ? v.slice(0, MAX) + "…" : v;
  }
  try {
    const s = JSON.stringify(v, null, 2);
    return s.length > MAX ? s.slice(0, MAX) + "…" : s;
  } catch {
    return "[unserializable: " + String(v) + "]";
  }
}

const EMPTY: AnalyserConfig = {
  id: "", name: "", enabled: true, urlPattern: "", source: "reqBody",
  dsl: [], sandboxCode: "", createdAt: 0
};

export function ConfigEditor({ initial, onClose }: { initial: AnalyserConfig | null; onClose: () => void }) {
  const { upsert } = useAnalysers();
  const [cfg, setCfg] = useState<AnalyserConfig>(initial ?? { ...EMPTY, id: crypto.randomUUID(), createdAt: Date.now() });
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<LintIssue[]>([]);
  const [overrideWarnings, setOverrideWarnings] = useState(false);
  const [sample, setSample] = useState<string>("");
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; error: string | null } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    setCfg(initial ?? { ...EMPTY, id: crypto.randomUUID(), createdAt: Date.now() });
    setError(null);
    setWarnings([]);
    setOverrideWarnings(false);
  }, [initial]);

  useEffect(() => { setPreview(null); }, [cfg.dsl]);

  function update<K extends keyof AnalyserConfig>(k: K, v: AnalyserConfig[K]) {
    setError(null);
    setWarnings([]);
    setOverrideWarnings(false);
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

  async function runPreview() {
    setPreviewing(true);
    try {
      const rows = await runDslWithSteps(cfg.dsl, sample);
      setPreview({ rows, error: null });
    } catch (e) {
      setPreview({ rows: [], error: (e as Error).message });
    } finally {
      setPreviewing(false);
    }
  }

  async function save(force = false) {
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

    const lintIssues = lintAnalyser(cfg);
    if (lintIssues.length > 0 && !force && !overrideWarnings) {
      setWarnings(lintIssues);
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
        <label className="block text-slate-400">dsl preview</label>
        <textarea
          className="w-full h-20 bg-slate-900 border border-slate-700 px-2 py-1 rounded font-mono"
          placeholder="paste a sample request body, url, or response — runs through the dsl chain above"
          value={sample}
          onChange={e => setSample(e.target.value)}
          aria-label="DSL preview sample"
        />
        <div className="flex items-center gap-2 mt-1">
          <button
            className="px-2 py-1 bg-slate-800 rounded text-slate-200"
            onClick={runPreview}
            disabled={previewing || sample.length === 0}
          >
            {previewing ? "Running…" : "Run preview"}
          </button>
          <span className="text-slate-500 text-xs">preview shows DSL output only — sandbox runs on real captures</span>
        </div>
        {preview && (
          <div className="mt-1 border border-slate-800 rounded">
            {preview.rows.map((row, i) => (
              <div key={i} className="border-b border-slate-800 last:border-b-0 p-1 text-xs">
                <div className="text-slate-400">
                  {row.step === "input" ? "input" : <span className="text-violet-300">{row.step.op}</span>}
                  {row.error && <span className="text-rose-400 ml-2">err: {row.error}</span>}
                </div>
                <pre className="text-emerald-300 mt-0.5 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                  {formatPreviewValue(row.value)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="block text-slate-400">sandbox code (optional)</label>
        <textarea className="w-full h-24 bg-slate-900 border border-slate-700 px-2 py-1 rounded font-mono" value={cfg.sandboxCode ?? ""} onChange={e => update("sandboxCode", e.target.value || undefined)} placeholder="return input;" />
      </div>
      {error && <div className="text-rose-400">{error}</div>}
      {warnings.length > 0 && !overrideWarnings && (
        <div className="border border-amber-700/50 bg-amber-900/30 text-amber-200 text-xs p-2 rounded space-y-1">
          <div className="font-semibold">Lint warnings ({warnings.length}):</div>
          {warnings.map((w, i) => (
            <div key={i}><span className="text-amber-400">[{w.rule}]</span> {w.message}</div>
          ))}
          <button
            className="mt-1 px-2 py-1 text-xs bg-amber-800 text-amber-100 rounded"
            onClick={() => { setOverrideWarnings(true); setWarnings([]); save(true); }}
          >
            Save anyway
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <button className="px-3 py-1 bg-violet-700 rounded text-white" onClick={() => save()}>Save</button>
        <button className="px-3 py-1 bg-slate-800 rounded text-slate-200" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

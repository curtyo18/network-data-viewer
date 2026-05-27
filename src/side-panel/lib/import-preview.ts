import type { AnalyserConfig } from "@/shared/types";

export type DecodedPreview = {
  replace: { existing: AnalyserConfig; incoming: AnalyserConfig }[];
  add: AnalyserConfig[];
  unchanged: AnalyserConfig[];
};

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object") {
    const aKeys = Object.keys(a as object).sort();
    const bKeys = Object.keys(b as object).sort();
    if (aKeys.length !== bKeys.length) return false;
    if (!aKeys.every((k, i) => k === bKeys[i])) return false;
    return aKeys.every(k => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

export function buildPreview(existing: AnalyserConfig[], incoming: AnalyserConfig[]): DecodedPreview {
  const byId = new Map(existing.map(a => [a.id, a]));
  const replace: DecodedPreview["replace"] = [];
  const add: AnalyserConfig[] = [];
  const unchanged: AnalyserConfig[] = [];
  for (const inc of incoming) {
    const existingCfg = byId.get(inc.id);
    if (!existingCfg) { add.push(inc); continue; }
    if (deepEqual(existingCfg, inc)) unchanged.push(inc);
    else replace.push({ existing: existingCfg, incoming: inc });
  }
  return { replace, add, unchanged };
}

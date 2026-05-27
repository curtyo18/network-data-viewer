import type { AnalyserConfig } from "@/shared/types";

export type DecodedPreview = {
  replace: { existing: AnalyserConfig; incoming: AnalyserConfig }[];
  add: AnalyserConfig[];
  unchanged: AnalyserConfig[];
};

export function buildPreview(existing: AnalyserConfig[], incoming: AnalyserConfig[]): DecodedPreview {
  const byId = new Map(existing.map(a => [a.id, a]));
  const replace: DecodedPreview["replace"] = [];
  const add: AnalyserConfig[] = [];
  const unchanged: AnalyserConfig[] = [];
  for (const i of incoming) {
    const e = byId.get(i.id);
    if (!e) { add.push(i); continue; }
    if (JSON.stringify(e) === JSON.stringify(i)) unchanged.push(i);
    else replace.push({ existing: e, incoming: i });
  }
  return { replace, add, unchanged };
}

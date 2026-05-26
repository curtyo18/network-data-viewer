import type { AnalyserConfig } from "@/shared/types";

export function mergeSeeds(existing: AnalyserConfig[], seeds: AnalyserConfig[]): AnalyserConfig[] {
  const bySeedId = new Map(seeds.map(s => [s.id, s]));
  const out: AnalyserConfig[] = [];
  const seenIds = new Set<string>();
  for (const a of existing) {
    const s = bySeedId.get(a.id);
    if (s && (a.seedVersion ?? 1) < (s.seedVersion ?? 1)) {
      out.push(s);
    } else {
      out.push(a);
    }
    seenIds.add(a.id);
  }
  for (const s of seeds) {
    if (!seenIds.has(s.id)) out.push(s);
  }
  return out;
}

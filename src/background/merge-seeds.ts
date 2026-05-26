import type { AnalyserConfig } from "@/shared/types";

// Legacy bundled seeds (pre-versioning) are treated as v1; newer bundled seeds
// must bump to ≥2 to trigger replacement on update.
const IMPLICIT_SEED_VERSION = 1;

export function mergeSeeds(existing: AnalyserConfig[], seeds: AnalyserConfig[]): AnalyserConfig[] {
  const bySeedId = new Map(seeds.map(s => [s.id, s]));
  const out: AnalyserConfig[] = [];
  const seenIds = new Set<string>();
  for (const a of existing) {
    const s = bySeedId.get(a.id);
    if (s && (a.seedVersion ?? IMPLICIT_SEED_VERSION) < (s.seedVersion ?? IMPLICIT_SEED_VERSION)) {
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

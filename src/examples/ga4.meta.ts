import type { AnalyserMeta } from "@/build/analyser-meta";

export const meta: AnalyserMeta = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "GA4",
  enabled: true,
  // Path-anchored so it catches server-side GTM proxies on first-party domains
  // (e.g. `sgtm.example.com/g/collect`) while still requiring a recognisable
  // GA4 collect path. Covers /g/collect, /j/collect, /r/collect, and legacy
  // /collect (v=1 UA). See research/ga4-wire-format.md §1.4.
  urlPattern: "^https?://[^/?#]+/(?:[gjr]/)?collect(?:[?#]|$)",
  dsl: [],
  seedVersion: 2,
  createdAt: 1737000000000,
};

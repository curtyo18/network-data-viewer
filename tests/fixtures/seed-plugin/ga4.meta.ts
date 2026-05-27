import type { AnalyserMeta } from "@/build/analyser-meta";

export const meta: AnalyserMeta = {
  id: "fixture-ga4",
  name: "GA4",
  enabled: true,
  urlPattern: "google-analytics\\.com",
  dsl: [{ op: "query-parse" }],
  seedVersion: 1,
  createdAt: 0,
};

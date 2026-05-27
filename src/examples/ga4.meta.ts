import type { AnalyserMeta } from "@/build/analyser-meta";

export const meta: AnalyserMeta = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "GA4",
  enabled: true,
  urlPattern: "google-analytics\\.com/g/collect",
  dsl: [
    { op: "query-parse" },
    { op: "pluck", keys: ["v", "tid", "cid", "dl", "dt", "en", "ep.page_location", "ep.page_title"] },
  ],
  seedVersion: 1,
  createdAt: 1737000000000,
};

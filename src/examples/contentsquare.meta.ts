import type { AnalyserMeta } from "@/build/analyser-meta";

export const meta: AnalyserMeta = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "ContentSquare",
  enabled: true,
  urlPattern: "(\\.contentsquare\\.|cs-data\\.|c\\.contentsquare\\.)",
  source: "reqBody",
  dsl: [{ op: "json-parse" }],
  seedVersion: 1,
  createdAt: 1737000000000,
};

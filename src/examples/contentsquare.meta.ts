import type { AnalyserMeta } from "@/build/analyser-meta";

export const meta: AnalyserMeta = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "ContentSquare",
  enabled: true,
  // Path-anchored across the documented endpoint family. The permissive
  // subdomain class `[a-z0-9.-]+` accepts multi-label hosts like
  // `k.eu1.az.contentsquare.net`. Excludes `t.contentsquare.net/uxa/...` (tag
  // script) and `app.contentsquare.com` (platform UI). See
  // research/contentsquare-wire-format.md §1.4.
  urlPattern: "^https?://(?:[a-z0-9.-]+\\.)?contentsquare\\.net/(?:pageview|events|transaction|dvar|pageEvent|display|errors|custom-errors|api-errors|(?:v\\d+/)?recording|quota|exist|putTag)(?:[?#]|$)",
  dsl: [],
  seedVersion: 2,
  createdAt: 1737000000000,
};

import type { AnalyserMeta } from "@/build/analyser-meta";

export const meta: AnalyserMeta = {
  id: "00000000-0000-4000-8000-000000000004",
  name: "Meta",
  enabled: true,
  // Two-branch matcher. (1) The Meta Pixel beacon to `/tr`, path-anchored (not
  // host-anchored) and guarded by `id=`+`ev=` query lookaheads so it also catches
  // first-party Conversions-API-gateway / sGTM proxies that re-front the pixel
  // under a customer domain (e.g. `sgtm.shop.com/tr/?id=...`), while rejecting
  // unrelated `/tr...` paths like `/translate`. (2) The direct client-side
  // Conversions API call to `graph.facebook.com/v<n>/<pixelId>/events`.
  // See research/meta-wire-format.md §1.4.
  urlPattern:
    "^https?://(?:[^/?#]+/tr/?\\?(?=[^#]*\\bid=)(?=[^#]*\\bev=)|graph\\.facebook\\.com/v\\d+(?:\\.\\d+)?/\\d+/events/?(?:[?#]|$))",
  dsl: [],
  seedVersion: 1,
  createdAt: 1737000000000,
};

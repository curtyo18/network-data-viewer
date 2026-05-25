export function queryParse(input: unknown): Record<string, string> {
  if (typeof input !== "string") throw new Error("query-parse expects string input");
  const qIdx = input.indexOf("?");
  const qs = qIdx >= 0 ? input.slice(qIdx + 1) : input;
  if (qIdx < 0 && !qs.includes("=")) return {};
  const out: Record<string, string> = {};
  new URLSearchParams(qs).forEach((v, k) => { out[k] = v; });
  return out;
}

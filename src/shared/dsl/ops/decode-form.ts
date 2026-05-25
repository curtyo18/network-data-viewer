export function decodeForm(input: unknown): Record<string, string> {
  if (typeof input !== "string") throw new Error("decode-form expects string input");
  const out: Record<string, string> = {};
  const params = new URLSearchParams(input);
  params.forEach((v, k) => { out[k] = v; });
  return out;
}

export function pluck(input: unknown, keys: string[]): Record<string, unknown> {
  if (input == null || typeof input !== "object") throw new Error("pluck expects an object");
  const obj = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k.includes(".")) {
      const parts = k.split(".");
      let cur: unknown = obj;
      for (const p of parts) {
        if (cur == null || typeof cur !== "object") { cur = undefined; break; }
        cur = (cur as Record<string, unknown>)[p];
      }
      out[k] = cur;
    } else {
      out[k] = obj[k];
    }
  }
  return out;
}

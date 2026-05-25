export function regexExtract(input: unknown, pattern: string, group = 0): string | null {
  if (typeof input !== "string") throw new Error("regex-extract expects string input");
  const re = new RegExp(pattern);
  const m = input.match(re);
  if (!m) return null;
  return m[group] ?? null;
}

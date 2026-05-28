// User-supplied patterns run against captured (untrusted) bodies in the service
// worker. A catastrophic-backtracking pattern on a large input can hang the
// worker, so we bound the input length the regex is applied to. The linter
// (see lint.ts) separately flags patterns that look prone to backtracking.
const MAX_INPUT_LENGTH = 1 * 1024 * 1024;

export function regexExtract(input: unknown, pattern: string, group = 0): string | null {
  if (typeof input !== "string") throw new Error("regex-extract expects string input");
  if (input.length > MAX_INPUT_LENGTH) {
    throw new Error(`regex-extract: input exceeds ${MAX_INPUT_LENGTH} chars; refusing to run regex on it`);
  }
  const re = new RegExp(pattern);
  const m = input.match(re);
  if (!m) return null;
  return m[group] ?? null;
}

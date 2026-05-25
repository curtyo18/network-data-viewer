export function jsonpath(input: unknown, path: string): unknown {
  if (!path.startsWith("$")) throw new Error("jsonpath must start with $");
  if (path === "$") return input;
  const tokens: string[] = [];
  const re = /\.([a-zA-Z_][a-zA-Z0-9_]*)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  let lastIndex = 1;
  while ((m = re.exec(path)) !== null) {
    if (m.index !== lastIndex) throw new Error(`jsonpath parse error near "${path.slice(lastIndex)}"`);
    tokens.push(m[1] ?? m[2]);
    lastIndex = re.lastIndex;
  }
  if (lastIndex !== path.length) throw new Error(`jsonpath parse error near "${path.slice(lastIndex)}"`);
  let cur: unknown = input;
  for (const t of tokens) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[t];
  }
  return cur;
}

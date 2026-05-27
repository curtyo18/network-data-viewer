import type { ReactNode } from "react";

export function highlight(text: string, needle: string): ReactNode {
  if (!needle) return text;
  const lower = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const out: ReactNode[] = [];
  let i = 0;
  let n = 0;
  while (i < text.length) {
    const idx = lower.indexOf(lowerNeedle, i);
    if (idx < 0) {
      out.push(text.slice(i));
      break;
    }
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark key={n++} className="bg-yellow-500/30 text-yellow-100 rounded-sm">
        {text.slice(idx, idx + needle.length)}
      </mark>
    );
    i = idx + needle.length;
  }
  return out.length === 1 ? out[0] : <>{out}</>;
}

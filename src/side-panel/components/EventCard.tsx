import { JsonTree } from "./JsonTree";
import { highlight } from "../lib/highlight";
import type { MatchResult } from "@/shared/types";

export function EventCard({ r, filter }: { r: MatchResult; filter?: string }) {
  const ts = new Date(r.event.ts).toLocaleTimeString();
  const out = r.sandboxOutput ?? r.dslOutput;
  const needle = filter ?? "";
  return (
    <div className="border border-slate-800 rounded mb-2 p-2 text-xs font-mono">
      <div className="flex items-center justify-between text-slate-400">
        <span>{ts} · <span className="text-violet-300">{highlight(r.analyserName, needle)}</span> · {r.event.source} {highlight(r.event.method, needle)}</span>
        {r.error && <span className="text-rose-400">err:{r.error.stage}</span>}
      </div>
      <div className="text-slate-500 truncate">{highlight(r.event.url, needle)}</div>
      {r.error ? (
        <div className="text-rose-400 mt-1">{r.error.message}</div>
      ) : (
        <div className="mt-1"><JsonTree value={out} /></div>
      )}
    </div>
  );
}

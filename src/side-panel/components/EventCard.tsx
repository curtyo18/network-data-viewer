import { JsonTree } from "./JsonTree";
import type { MatchResult } from "@/shared/types";

export function EventCard({ r }: { r: MatchResult }) {
  const ts = new Date(r.event.ts).toLocaleTimeString();
  const out = r.sandboxOutput ?? r.dslOutput;
  return (
    <div className="border border-slate-800 rounded mb-2 p-2 text-xs font-mono">
      <div className="flex items-center justify-between text-slate-400">
        <span>{ts} · <span className="text-violet-300">{r.analyserName}</span> · {r.event.source} {r.event.method}</span>
        {r.error && <span className="text-rose-400">err:{r.error.stage}</span>}
      </div>
      <div className="text-slate-500 truncate">{r.event.url}</div>
      {r.error ? (
        <div className="text-rose-400 mt-1">{r.error.message}</div>
      ) : (
        <div className="mt-1"><JsonTree value={out} /></div>
      )}
    </div>
  );
}

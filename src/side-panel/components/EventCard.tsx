import { JsonTree } from "./JsonTree";
import { highlight } from "../lib/highlight";
import type { MatchResult } from "@/shared/types";

export function EventCard({ r, filter, onEditAnalyser }: { r: MatchResult; filter?: string; onEditAnalyser?: (id: string) => void }) {
  const ts = new Date(r.event.ts).toLocaleTimeString();
  const out = r.sandboxOutput ?? r.dslOutput;
  const needle = filter ?? "";
  const analyserNameNode = onEditAnalyser ? (
    <button
      className="text-violet-300 hover:text-violet-100 underline-offset-2 hover:underline"
      onClick={() => onEditAnalyser(r.analyserId)}
      aria-label={`Edit analyser ${r.analyserName}`}
      title="Edit this analyser"
    >
      {highlight(r.analyserName, needle)}
    </button>
  ) : (
    <span className="text-violet-300">{highlight(r.analyserName, needle)}</span>
  );
  return (
    <div className="border border-slate-800 rounded mb-2 p-2 text-xs font-mono">
      <div className="flex items-center justify-between text-slate-400">
        <span>{ts} · {analyserNameNode} · {r.event.source} {highlight(r.event.method, needle)}</span>
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

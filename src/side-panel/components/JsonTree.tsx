import { useState } from "react";

// Objects/arrays at a depth below this start expanded; deeper nodes start
// collapsed. 2 means the first two layers (the root and its direct children)
// are open by default.
const DEFAULT_OPEN_DEPTH = 2;

type Props = { value: unknown; depth?: number; rootKey?: string };

export function JsonTree({ value, depth = 0, rootKey }: Props) {
  const pad = { paddingLeft: `${depth * 12}px` };
  if (value === null) return <div style={pad}><span className="text-slate-500">null</span></div>;
  if (typeof value === "string") return <div style={pad} className="break-words">{rootKey && <span className="text-amber-300">{rootKey}:</span>} <span className="text-emerald-300">"{value}"</span></div>;
  if (typeof value === "number" || typeof value === "boolean") return <div style={pad}>{rootKey && <span className="text-amber-300">{rootKey}:</span>} <span className="text-cyan-300">{String(value)}</span></div>;
  if (Array.isArray(value)) return <ArrayNode arr={value} depth={depth} rootKey={rootKey} />;
  if (typeof value === "object") return <ObjectNode obj={value as Record<string, unknown>} depth={depth} rootKey={rootKey} />;
  return <div style={pad}>{String(value)}</div>;
}

function ObjectNode({ obj, depth, rootKey }: { obj: Record<string, unknown>; depth: number; rootKey?: string }) {
  const [open, setOpen] = useState(depth < DEFAULT_OPEN_DEPTH);
  const pad = { paddingLeft: `${depth * 12}px` };
  const entries = Object.entries(obj);
  return (
    <div>
      <div
        style={pad}
        className="cursor-pointer select-none focus:outline-none focus:bg-slate-800 focus:rounded"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } }}
        aria-expanded={open}
      >
        {rootKey && <span className="text-amber-300">{rootKey}:</span>} <span className="text-slate-400">{open ? "▾" : "▸"} {`{${entries.length}}`}</span>
      </div>
      {open && entries.map(([k, v]) => <JsonTree key={k} value={v} depth={depth + 1} rootKey={k} />)}
    </div>
  );
}

function ArrayNode({ arr, depth, rootKey }: { arr: unknown[]; depth: number; rootKey?: string }) {
  const [open, setOpen] = useState(depth < DEFAULT_OPEN_DEPTH);
  const pad = { paddingLeft: `${depth * 12}px` };
  return (
    <div>
      <div
        style={pad}
        className="cursor-pointer select-none focus:outline-none focus:bg-slate-800 focus:rounded"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } }}
        aria-expanded={open}
      >
        {rootKey && <span className="text-amber-300">{rootKey}:</span>} <span className="text-slate-400">{open ? "▾" : "▸"} {`[${arr.length}]`}</span>
      </div>
      {open && arr.map((v, i) => <JsonTree key={i} value={v} depth={depth + 1} rootKey={String(i)} />)}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { ExportButton } from "./ExportButton";

export function ConfigMenu({
  showRaw,
  onToggleShowRaw,
  onImport,
}: {
  showRaw: boolean;
  onToggleShowRaw: () => void;
  onImport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        className="px-2 py-1 text-xs bg-slate-800 rounded text-slate-200"
        onClick={() => setOpen(o => !o)}
        aria-label="Config"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Config"
      >
        ⚙
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 z-20 flex flex-col gap-1 p-1 bg-slate-800 border border-slate-700 rounded shadow-lg"
        >
          <label className="flex items-center gap-1 px-2 py-1 text-xs rounded text-slate-200 cursor-pointer hover:bg-slate-700">
            <input type="checkbox" checked={showRaw} onChange={onToggleShowRaw} />
            show raw
          </label>
          <button
            className="px-2 py-1 text-xs text-left rounded text-slate-200 hover:bg-slate-700"
            onClick={() => {
              onImport();
              setOpen(false);
            }}
          >
            Import
          </button>
          <ExportButton />
        </div>
      )}
    </div>
  );
}

import { useExport } from "@/entrypoints/sidepanel/lib/use-export";

export function ExportButton() {
  const { copy, copied } = useExport();

  return (
    <button
      className="px-2 py-1 text-xs bg-slate-800 rounded text-slate-200"
      onClick={copy}
      title="Export all (Ctrl+E)"
    >
      {copied ? "Copied!" : "Export all"}
    </button>
  );
}

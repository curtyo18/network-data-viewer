import { useState } from "react";
import { encodeConfig } from "@/shared/share";
import { useAnalysers } from "@/side-panel/lib/use-analysers";

export function ExportButton() {
  const { analysers } = useAnalysers();
  const [copied, setCopied] = useState(false);

  async function doExport() {
    const s = encodeConfig(analysers);
    await navigator.clipboard.writeText(s);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button className="px-2 py-1 text-xs bg-slate-800 rounded text-slate-200" onClick={doExport}>
      {copied ? "Copied!" : "Export all"}
    </button>
  );
}

import { useState } from "react";
import { encodeConfig } from "@/shared/share";
import type { AnalyserConfig } from "@/shared/types";

export function ExportButton() {
  const [copied, setCopied] = useState(false);
  async function doExport() {
    const r = await chrome.storage.local.get("analyserConfigs");
    const cfgs = (r.analyserConfigs as AnalyserConfig[] | undefined) ?? [];
    const s = encodeConfig(cfgs);
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

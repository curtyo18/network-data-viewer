import { useState, useCallback } from "react";
import { encodeConfig } from "@/shared/share";
import { useAnalysers } from "./use-analysers";

export function useExport(): { copy: () => Promise<void>; copied: boolean } {
  const { analysers } = useAnalysers();
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    const s = encodeConfig(analysers);
    await navigator.clipboard.writeText(s);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [analysers]);
  return { copy, copied };
}

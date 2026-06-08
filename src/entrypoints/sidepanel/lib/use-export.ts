import { useState, useCallback } from "react";
import type { AnalyserConfig } from "@/shared/types";
import { encodeConfig } from "@/shared/share";
import { useAnalysers } from "./use-analysers";

export function useExport(): {
  copy: () => Promise<void>;
  copyOne: (analyser: AnalyserConfig) => Promise<void>;
  copied: boolean;
  copiedId: string | null;
} {
  const { analysers } = useAnalysers();
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = useCallback(async () => {
    const s = encodeConfig(analysers);
    await navigator.clipboard.writeText(s);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [analysers]);

  const copyOne = useCallback(async (analyser: AnalyserConfig) => {
    const s = encodeConfig([analyser]);
    await navigator.clipboard.writeText(s);
    setCopiedId(analyser.id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  return { copy, copyOne, copied, copiedId };
}

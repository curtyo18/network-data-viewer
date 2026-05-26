import { useEffect, useState, useCallback } from "react";
import { MSG } from "@/shared/messages";
import type { AnalyserError } from "@/shared/types";
export type { AnalyserError };

export function useAnalyserErrors(): {
  errors: Record<string, AnalyserError[]>;
  refresh: () => Promise<void>;
} {
  const [errors, setErrors] = useState<Record<string, AnalyserError[]>>({});

  const refresh = useCallback(async () => {
    try {
      const resp = await chrome.runtime.sendMessage({ type: MSG.GET_ANALYSER_ERRORS });
      if (resp?.errors) setErrors(resp.errors);
    } catch { /* SW asleep — ignore */ }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { errors, refresh };
}

import { useEffect, useRef, useState } from "react";
import type { MatchResult } from "@/shared/types";

const MAX_EVENTS = 1000;

export function useEventStream(): MatchResult[] {
  const [events, setEvents] = useState<MatchResult[]>([]);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "dataviewer-events" });
    portRef.current = port;
    const listener = (msg: { type: string; payload: MatchResult }) => {
      if (msg.type !== "match-result") return;
      setEvents(prev => {
        const next = [msg.payload, ...prev];
        return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
      });
    };
    port.onMessage.addListener(listener);
    return () => { port.disconnect(); portRef.current = null; };
  }, []);

  return events;
}

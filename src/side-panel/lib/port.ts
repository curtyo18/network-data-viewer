import { useEffect, useState } from "react";
import type { MatchResult } from "@/shared/types";

const MAX_EVENTS = 1000;

export function useEventStream(): MatchResult[] {
  const [events, setEvents] = useState<MatchResult[]>([]);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "dataviewer-events" });
    const listener = (msg: { type: string; payload: MatchResult }) => {
      if (msg.type !== "match-result") return;
      setEvents(prev => {
        const next = [msg.payload, ...prev];
        return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
      });
    };
    port.onMessage.addListener(listener);
    return () => { port.disconnect(); };
  }, []);

  return events;
}

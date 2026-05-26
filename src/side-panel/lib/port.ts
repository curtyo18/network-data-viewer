import { useEffect, useState } from "react";
import type { MatchResult } from "@/shared/types";
import { MSG, PORT_NAME } from "@/shared/messages";

const MAX_EVENTS = 1000;

export function useEventStream(): { events: MatchResult[]; clear: () => void } {
  const [events, setEvents] = useState<MatchResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    let currentPort: chrome.runtime.Port | null = null;
    const listener = (msg: { type: string; payload: MatchResult }) => {
      if (msg.type !== MSG.MATCH_RESULT) return;
      setEvents(prev => {
        const next = [msg.payload, ...prev];
        return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
      });
    };
    const connect = () => {
      if (cancelled) return;
      const port = chrome.runtime.connect({ name: PORT_NAME });
      currentPort = port;
      port.onMessage.addListener(listener);
      port.onDisconnect.addListener(() => {
        if (cancelled || currentPort !== port) return;
        setTimeout(connect, 200);
      });
    };
    connect();
    return () => { cancelled = true; currentPort?.disconnect(); };
  }, []);

  return { events, clear: () => setEvents([]) };
}

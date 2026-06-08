import { useEffect, useRef, useState } from "react";
import type { MatchResult } from "@/shared/types";
import { MSG, PORT_NAME } from "@/shared/messages";

const MAX_EVENTS = 1000;

const keyOf = (r: MatchResult) => `${r.event.id}-${r.analyserId}`;

export function useEventStream(): { events: MatchResult[]; clear: () => void } {
  const [events, setEvents] = useState<MatchResult[]>([]);
  // Tracks the keys currently in `events` so re-delivered results (the SW replays
  // its whole buffer to every newly-connected port) aren't added twice. A duplicate
  // key would collide the virtualizer's React key / getItemKey and leave orphaned,
  // overlapping card nodes stacked at the same offset.
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let currentPort: chrome.runtime.Port | null = null;
    const listener = (msg: { type: string; payload: MatchResult }) => {
      if (msg.type !== MSG.MATCH_RESULT) return;
      const key = keyOf(msg.payload);
      if (seenRef.current.has(key)) return;   // already shown — ignore the replayed copy
      seenRef.current.add(key);
      setEvents(prev => {
        const next = [msg.payload, ...prev];
        if (next.length > MAX_EVENTS) {
          const trimmed = next.slice(0, MAX_EVENTS);
          seenRef.current = new Set(trimmed.map(keyOf));   // keep the set in sync with retained rows
          return trimmed;
        }
        return next;
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

  return { events, clear: () => { seenRef.current.clear(); setEvents([]); } };
}

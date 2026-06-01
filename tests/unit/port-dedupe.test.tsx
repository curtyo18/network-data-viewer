import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEventStream } from "@/side-panel/lib/port";
import { MSG } from "@/shared/messages";
import type { MatchResult } from "@/shared/types";

// Minimal MatchResult — the stream only keys on event.id + analyserId.
function result(id: string, analyserId = "a1"): MatchResult {
  return { analyserId, analyserName: "A", event: { id }, dslOutput: {}, latencyMs: 0 } as unknown as MatchResult;
}

type MsgListener = (m: { type: string; payload: MatchResult }) => void;

// Fake chrome.runtime.connect: each connect() returns a fresh port whose
// listeners we can drive. Mirrors the real flow where the SW replays its
// buffer to every newly-connected port (service-worker.ts onConnect).
function installRuntimeMock() {
  const ports: Array<{ msg: MsgListener[]; dis: Array<() => void>; disconnect: () => void }> = [];
  const connect = vi.fn(() => {
    const port = {
      msg: [] as MsgListener[],
      dis: [] as Array<() => void>,
      onMessage: { addListener: (fn: MsgListener) => port.msg.push(fn) },
      onDisconnect: { addListener: (fn: () => void) => port.dis.push(fn) },
      disconnect: () => {},
    };
    ports.push(port);
    return port as unknown as chrome.runtime.Port;
  });
  (globalThis as unknown as { chrome: unknown }).chrome = { runtime: { connect } };
  return {
    ports,
    deliver: (portIdx: number, ...rs: MatchResult[]) => {
      for (const r of rs) for (const fn of ports[portIdx].msg) fn({ type: MSG.MATCH_RESULT, payload: r });
    },
    dropPort: (portIdx: number) => { for (const fn of ports[portIdx].dis) fn(); },
  };
}

describe("useEventStream de-duplication", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ignores results re-delivered on reconnect (buffer replay) instead of duplicating them", () => {
    const mock = installRuntimeMock();
    const { result: hook } = renderHook(() => useEventStream());

    // Initial stream on port 0.
    act(() => mock.deliver(0, result("e1"), result("e2")));
    expect(hook.current.events.map(r => r.event.id)).toEqual(["e2", "e1"]);

    // Port drops; the hook reconnects after 200ms => port 1.
    act(() => { mock.dropPort(0); vi.advanceTimersByTime(200); });
    expect(mock.ports.length).toBe(2);

    // The SW replays the buffer to the fresh port — the SAME two results.
    act(() => mock.deliver(1, result("e1"), result("e2")));

    // Must still be two unique events, not four.
    expect(hook.current.events.map(r => r.event.id).sort()).toEqual(["e1", "e2"]);
  });

  it("clear() resets the de-dupe set so later identical ids can reappear", () => {
    const mock = installRuntimeMock();
    const { result: hook } = renderHook(() => useEventStream());

    act(() => mock.deliver(0, result("e1")));
    expect(hook.current.events).toHaveLength(1);
    act(() => hook.current.clear());
    expect(hook.current.events).toHaveLength(0);
    act(() => mock.deliver(0, result("e1")));
    expect(hook.current.events).toHaveLength(1);
  });
});

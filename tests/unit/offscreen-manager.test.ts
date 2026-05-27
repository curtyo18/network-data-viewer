import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OffscreenManager } from "@/background/offscreen-manager";
import { MSG } from "@/shared/messages";
import type { Settings } from "@/shared/settings";
import { DEFAULT_SETTINGS } from "@/shared/settings";
import type { SandboxInput } from "@/shared/types";

const SETTINGS: Settings = { ...DEFAULT_SETTINGS };
const DUMMY_INPUT: SandboxInput = { url: "https://x.com", method: "POST", body: null, dslOutput: null };

function makeChromeStub() {
  const messageListeners = new Set<(msg: unknown, sender: unknown) => unknown>();
  const sendMessage = vi.fn(async (_msg: unknown) => undefined);
  const createDocument = vi.fn(async () => undefined);
  const closeDocument = vi.fn(async () => undefined);
  const getContexts = vi.fn(async () => []);

  globalThis.chrome = {
    runtime: {
      sendMessage,
      onMessage: {
        addListener: (fn: (msg: unknown, sender: unknown) => unknown) => messageListeners.add(fn),
        removeListener: (fn: (msg: unknown, sender: unknown) => unknown) => messageListeners.delete(fn),
      },
      getContexts,
      ContextType: { OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT" },
    },
    offscreen: {
      createDocument,
      closeDocument,
      Reason: { DOM_PARSER: "DOM_PARSER" },
    },
  } as unknown as typeof chrome;

  // Simulate the offscreen iframe replying to a run-transform message.
  // Polls the mock call log until OFFSCREEN_RUN_TRANSFORM appears (it may not
  // be recorded yet when this helper is called).
  async function reply(payload: unknown) {
    // Flush enough microtask ticks for ensureDocument + sendMessage to settle.
    for (let i = 0; i < 10; i++) await Promise.resolve();

    const calls = sendMessage.mock.calls as Array<[{ type: string; requestId?: string }]>;
    const call = calls.find((c) => c[0]?.type === MSG.OFFSCREEN_RUN_TRANSFORM);
    if (!call) throw new Error("no OFFSCREEN_RUN_TRANSFORM message found yet");
    const { requestId } = call[0] as { requestId: string };
    for (const l of messageListeners) {
      l({ type: MSG.OFFSCREEN_RESULT, requestId, payload }, {});
    }
  }

  return { sendMessage, createDocument, closeDocument, getContexts, reply };
}

describe("OffscreenManager", () => {
  describe("timeout path", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("resolves with { error: 'timeout' } when the iframe never replies", async () => {
      makeChromeStub();
      const manager = new OffscreenManager();

      const resultPromise = manager.run("a1", "return 1;", DUMMY_INPUT, SETTINGS);

      // Advance past the 1000 ms timeout.
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ error: "timeout" });
    });

    it("sends OFFSCREEN_DESTROY_IFRAME after timeout fires", async () => {
      const { sendMessage } = makeChromeStub();
      const manager = new OffscreenManager();

      const resultPromise = manager.run("a1", "return 1;", DUMMY_INPUT, SETTINGS);
      await vi.advanceTimersByTimeAsync(1000);
      await resultPromise;

      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: MSG.OFFSCREEN_DESTROY_IFRAME, analyserId: "a1" })
      );
    });

    it("calls closeDocument after timeout invalidates the last analyser", async () => {
      const { closeDocument, getContexts } = makeChromeStub();
      // Make getContexts return a live document so closeDocument is actually called.
      getContexts.mockResolvedValue([{ contextType: "OFFSCREEN_DOCUMENT" }] as never);
      const manager = new OffscreenManager();

      const resultPromise = manager.run("a1", "return 1;", DUMMY_INPUT, SETTINGS);
      await vi.advanceTimersByTimeAsync(1000);
      await resultPromise;

      // closeDocumentIfOpen is async and called with void — let microtasks flush.
      await vi.runAllTimersAsync();

      expect(closeDocument).toHaveBeenCalled();
    });
  });

  describe("knownAnalysers invalidation", () => {
    it("does NOT re-send OFFSCREEN_CREATE_IFRAME on a second run for the same analyser (cache hit)", async () => {
      const { sendMessage, reply } = makeChromeStub();
      const manager = new OffscreenManager();

      // First run — supply a reply so it resolves cleanly.
      const first = manager.run("a1", "return 1;", DUMMY_INPUT, SETTINGS);
      await reply({ result: 42 });
      await first;

      const createCalls = () =>
        (sendMessage.mock.calls as Array<[{ type: string }]>).filter(
          (c) => c[0]?.type === MSG.OFFSCREEN_CREATE_IFRAME
        );

      expect(createCalls()).toHaveLength(1);

      // Second run for the same analyser — reset the run-transform call index so
      // reply() can find the new one.
      sendMessage.mockClear();
      const second = manager.run("a1", "return 1;", DUMMY_INPUT, SETTINGS);
      await reply({ result: 43 });
      await second;

      // Should still be 0 CREATE_IFRAME calls in this second round.
      expect(createCalls()).toHaveLength(0);
    });

    it("re-sends OFFSCREEN_CREATE_IFRAME after invalidate (cache miss)", async () => {
      const { sendMessage, reply } = makeChromeStub();
      const manager = new OffscreenManager();

      // First run — resolves successfully.
      const first = manager.run("a1", "return 1;", DUMMY_INPUT, SETTINGS);
      await reply({ result: 42 });
      await first;

      // Invalidate clears the cache entry.
      manager.invalidate("a1");

      // Wipe call history so we can count CREATE_IFRAME for the next run alone.
      sendMessage.mockClear();

      const second = manager.run("a1", "return 1;", DUMMY_INPUT, SETTINGS);
      await reply({ result: 43 });
      await second;

      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: MSG.OFFSCREEN_CREATE_IFRAME, analyserId: "a1" })
      );
    });

    it("calls closeDocument when invalidate removes the last known analyser", async () => {
      const { closeDocument, getContexts, reply, sendMessage } = makeChromeStub();
      // Simulate a live offscreen document so closeDocument is triggered.
      getContexts.mockResolvedValue([{ contextType: "OFFSCREEN_DOCUMENT" }] as never);
      const manager = new OffscreenManager();

      // Establish the analyser in the cache with a successful run.
      const first = manager.run("a1", "return 1;", DUMMY_INPUT, SETTINGS);
      await reply({ result: 42 });
      await first;

      sendMessage.mockClear();

      // Invalidate the only known analyser.
      manager.invalidate("a1");

      // closeDocumentIfOpen is async and fire-and-forget — wait until called.
      await vi.waitFor(() => expect(closeDocument).toHaveBeenCalled());
    });
  });

  describe("catch path in run", () => {
    it("returns { error } when offscreen document creation fails", async () => {
      const stub = makeChromeStub();
      stub.createDocument.mockRejectedValueOnce(new Error("Page failed to load"));
      const om = new OffscreenManager();
      const result = await om.run("a", "code", DUMMY_INPUT, { showRaw: false, paused: false });
      expect(result).toEqual({ error: expect.stringMatching(/sandbox setup failed.*Page failed to load/) });
    });
  });
});

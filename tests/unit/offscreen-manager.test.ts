import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OffscreenManager, MANAGER_RUN_TIMEOUT_MS } from "@/background/offscreen-manager";
import { MSG } from "@/shared/messages";
import type { Settings } from "@/shared/settings";
import { DEFAULT_SETTINGS } from "@/shared/settings";
import type { SandboxInput } from "@/shared/types";

const SETTINGS: Settings = { ...DEFAULT_SETTINGS };
const DUMMY_INPUT: SandboxInput = { url: "https://x.com", method: "POST", body: null, bodyEncoding: "text", dslOutput: null };

function makeChromeStub() {
  const messageListeners = new Set<(msg: unknown, sender: unknown) => unknown>();
  // Mirror the offscreen document's responses: CREATE/DESTROY reply { ok: true };
  // run-transform is resolved out-of-band via an OFFSCREEN_RESULT message.
  const sendMessage = vi.fn(async (msg: unknown) => {
    const type = (msg as { type?: string })?.type;
    if (type === MSG.OFFSCREEN_CREATE_IFRAME || type === MSG.OFFSCREEN_DESTROY_IFRAME) {
      return { ok: true };
    }
    return undefined;
  });
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
  // Waits (condition-driven, not a fixed tick budget) until the
  // OFFSCREEN_RUN_TRANSFORM message has been sent, then dispatches its result.
  async function reply(payload: unknown) {
    const findRun = () => {
      const calls = sendMessage.mock.calls as Array<[{ type: string; requestId?: string }]>;
      return calls.find((c) => c[0]?.type === MSG.OFFSCREEN_RUN_TRANSFORM);
    };
    await vi.waitFor(() => {
      if (!findRun()) throw new Error("no OFFSCREEN_RUN_TRANSFORM message yet");
    });
    const { requestId } = findRun()![0] as { requestId: string };
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

      // Advance past the manager's run timeout.
      await vi.advanceTimersByTimeAsync(MANAGER_RUN_TIMEOUT_MS);

      const result = await resultPromise;
      expect(result).toEqual({ error: "timeout" });
    });

    it("sends OFFSCREEN_DESTROY_IFRAME after timeout fires", async () => {
      const { sendMessage } = makeChromeStub();
      const manager = new OffscreenManager();

      const resultPromise = manager.run("a1", "return 1;", DUMMY_INPUT, SETTINGS);
      await vi.advanceTimersByTimeAsync(MANAGER_RUN_TIMEOUT_MS);
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
      await vi.advanceTimersByTimeAsync(MANAGER_RUN_TIMEOUT_MS);
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
      const result = await om.run("a", "code", DUMMY_INPUT, { showRaw: false });
      expect(result).toEqual({ error: expect.stringMatching(/sandbox setup failed.*Page failed to load/) });
    });

    it("surfaces an iframe-init failure and does NOT cache the analyser (retries CREATE on next run)", async () => {
      const { sendMessage, reply } = makeChromeStub();
      // First CREATE_IFRAME fails to init; the second succeeds.
      sendMessage.mockImplementationOnce(async () => ({ ok: false, error: "SyntaxError: bad code" }));
      const om = new OffscreenManager();

      const first = await om.run("a1", "bad code", DUMMY_INPUT, SETTINGS);
      expect(first).toEqual({ error: expect.stringMatching(/sandbox setup failed.*SyntaxError: bad code/) });

      const createCount = () =>
        (sendMessage.mock.calls as Array<[{ type: string }]>).filter(
          (c) => c[0]?.type === MSG.OFFSCREEN_CREATE_IFRAME
        ).length;
      expect(createCount()).toBe(1);

      // The failed analyser must not be cached as "known" — a retry re-sends CREATE.
      const second = om.run("a1", "good code", DUMMY_INPUT, SETTINGS);
      await reply({ result: 7 });
      expect(await second).toEqual({ result: 7 });
      expect(createCount()).toBe(2);
    });
  });
});

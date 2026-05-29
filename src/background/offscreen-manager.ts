import type { SandboxRunner } from "./dispatcher";
import { MSG } from "@/shared/messages";

const OFFSCREEN_URL = "src/offscreen/offscreen.html";

// Must exceed the offscreen document's own per-run timeout (RUN_TIMEOUT_MS in
// offscreen.ts) plus slack, so the inner layer reports a real error/result
// before this outer guard fires — otherwise slow-but-successful transforms
// would be discarded and their iframe needlessly rebuilt.
export const MANAGER_RUN_TIMEOUT_MS = 2500;

// How long to wait for the offscreen document to post OFFSCREEN_READY after we
// create it. createDocument resolves when the page is created, but the
// document's scripts may not yet have registered their message listener; the
// readiness ping closes that race. If it never arrives, we surface a clear
// error rather than letting the next sendMessage reject with "Receiving end
// does not exist".
export const READY_TIMEOUT_MS = 2000;

type Pending = { resolve: (v: { result: unknown } | { error: string }) => void; timer: ReturnType<typeof setTimeout> };

export class OffscreenManager {
  private pending = new Map<string, Pending>();
  private knownAnalysers = new Set<string>();
  private creating: Promise<void> | null = null;

  constructor() {
    chrome.runtime.onMessage.addListener((msg, _sender) => {
      if (msg?.type === MSG.OFFSCREEN_RESULT) {
        const p = this.pending.get(msg.requestId);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(msg.requestId);
          p.resolve(msg.payload);
        }
        return false;
      }
    });
  }

  private async ensureDocument(): Promise<void> {
    const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
    if (contexts.length > 0) return;
    if (this.creating) return this.creating;
    this.creating = this.createAndAwaitReady().finally(() => { this.creating = null; });
    return this.creating;
  }

  private createAndAwaitReady(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const onReady = (msg: { type?: string } | null | undefined) => {
        if (msg?.type !== MSG.OFFSCREEN_READY) return false;
        settle();
        return false;
      };
      const settle = (err?: Error): void => {
        if (settled) return;
        settled = true;
        chrome.runtime.onMessage.removeListener(onReady);
        clearTimeout(timer);
        if (err) reject(err); else resolve();
      };
      const timer = setTimeout(
        () => settle(new Error("offscreen document did not signal ready in time")),
        READY_TIMEOUT_MS,
      );
      // Listener must be registered before createDocument is called: the doc
      // could finish loading and emit OFFSCREEN_READY before this Promise
      // executor returns, and we'd miss it.
      chrome.runtime.onMessage.addListener(onReady);
      chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: "host sandboxed iframes for user transform code"
      }).catch(e => settle(e instanceof Error ? e : new Error(String(e))));
    });
  }

  private async ensureAnalyser(analyserId: string, code: string): Promise<void> {
    if (this.knownAnalysers.has(analyserId)) return;
    await this.ensureDocument();
    const resp = await chrome.runtime.sendMessage({ type: MSG.OFFSCREEN_CREATE_IFRAME, analyserId, code });
    if (!resp?.ok) throw new Error(resp?.error ?? "sandbox iframe init failed");
    this.knownAnalysers.add(analyserId);
  }

  invalidate(analyserId: string): void {
    this.knownAnalysers.delete(analyserId);
    chrome.runtime.sendMessage({ type: MSG.OFFSCREEN_DESTROY_IFRAME, analyserId }).catch(() => {});
    if (this.knownAnalysers.size === 0) {
      void this.closeDocumentIfOpen();
    }
  }

  private async closeDocumentIfOpen(): Promise<void> {
    const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
    if (contexts.length > 0) await chrome.offscreen.closeDocument();
  }

  run: SandboxRunner = async (analyserId, code, input, settings) => {
    try {
      await this.ensureAnalyser(analyserId, code);
    } catch (e) {
      return { error: `sandbox setup failed: ${(e as Error).message}` };
    }
    const requestId = crypto.randomUUID();
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        this.invalidate(analyserId);
        resolve({ error: "timeout" });
      }, MANAGER_RUN_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, timer });
      chrome.runtime.sendMessage({
        type: MSG.OFFSCREEN_RUN_TRANSFORM,
        analyserId,
        requestId,
        input,
        settings,
      }).catch(e => {
        clearTimeout(timer);
        this.pending.delete(requestId);
        resolve({ error: `dispatch failed: ${(e as Error).message}` });
      });
    });
  };
}

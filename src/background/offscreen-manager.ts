import type { SandboxRunner } from "./dispatcher";
import { MSG } from "@/shared/messages";

const OFFSCREEN_URL = "src/offscreen/offscreen.html";

// Must exceed the offscreen document's own per-run timeout (RUN_TIMEOUT_MS in
// offscreen.ts) plus slack, so the inner layer reports a real error/result
// before this outer guard fires — otherwise slow-but-successful transforms
// would be discarded and their iframe needlessly rebuilt.
export const MANAGER_RUN_TIMEOUT_MS = 2500;

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
    this.creating = chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: "host sandboxed iframes for user transform code"
    }).finally(() => { this.creating = null; });
    return this.creating;
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

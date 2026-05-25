import type { SandboxRunner } from "./dispatcher";

const OFFSCREEN_URL = "src/offscreen/offscreen.html";

type Pending = { resolve: (v: { result: unknown } | { error: string }) => void; timer: ReturnType<typeof setTimeout> };

export class OffscreenManager {
  private pending = new Map<string, Pending>();
  private knownAnalysers = new Set<string>();
  private creating: Promise<void> | null = null;

  constructor() {
    chrome.runtime.onMessage.addListener((msg, _sender) => {
      if (msg?.type === "offscreen-result") {
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
    await chrome.runtime.sendMessage({ type: "offscreen-create-iframe", analyserId, code });
    this.knownAnalysers.add(analyserId);
  }

  invalidate(analyserId: string): void {
    this.knownAnalysers.delete(analyserId);
    chrome.runtime.sendMessage({ type: "offscreen-destroy-iframe", analyserId }).catch(() => {});
  }

  run: SandboxRunner = async (analyserId, code, input) => {
    await this.ensureAnalyser(analyserId, code);
    const requestId = crypto.randomUUID();
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        this.invalidate(analyserId);
        resolve({ error: "timeout" });
      }, 1000);
      this.pending.set(requestId, { resolve, timer });
      chrome.runtime.sendMessage({ type: "offscreen-run-transform", analyserId, requestId, input }).catch(e => {
        clearTimeout(timer);
        this.pending.delete(requestId);
        resolve({ error: `dispatch failed: ${(e as Error).message}` });
      });
    });
  };
}

import { MSG } from "@/shared/messages";

const INIT_TIMEOUT_MS = 2000;
const RUN_TIMEOUT_MS = 2000;

const iframes = new Map<string, HTMLIFrameElement>();
const ready = new Map<string, Promise<void>>();

function ensureIframe(analyserId: string, code: string): Promise<void> {
  if (ready.has(analyserId)) return ready.get(analyserId)!;
  const p = new Promise<void>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("src/sandbox/sandbox.html");
    iframe.style.display = "none";
    iframe.onload = () => {
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        window.removeEventListener("message", handler);
        clearTimeout(timer);
      };
      const handler = (ev: MessageEvent) => {
        if (ev.source !== iframe.contentWindow) return;
        if (ev.data?.type === "ready" && ev.data.analyserId === analyserId) {
          cleanup();
          resolve();
        }
        if (ev.data?.type === "init-error" && ev.data.analyserId === analyserId) {
          cleanup();
          iframe.remove();
          iframes.delete(analyserId);
          ready.delete(analyserId);
          reject(new Error(ev.data.message));
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        iframe.remove();
        iframes.delete(analyserId);
        ready.delete(analyserId);
        reject(new Error("sandbox init timeout"));
      }, INIT_TIMEOUT_MS);
      window.addEventListener("message", handler);
      iframe.contentWindow!.postMessage({ type: "init", analyserId, code }, "*");
    };
    iframe.onerror = () => {
      iframe.remove();
      iframes.delete(analyserId);
      ready.delete(analyserId);
      reject(new Error("iframe load error"));
    };
    document.body.appendChild(iframe);
    iframes.set(analyserId, iframe);
  });
  ready.set(analyserId, p);
  return p;
}

function destroyIframe(analyserId: string): void {
  const iframe = iframes.get(analyserId);
  if (iframe) {
    iframe.remove();
    iframes.delete(analyserId);
    ready.delete(analyserId);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === MSG.OFFSCREEN_CREATE_IFRAME) {
    ensureIframe(msg.analyserId, msg.code)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: (e as Error).message }));
    return true;
  }
  if (msg?.type === MSG.OFFSCREEN_DESTROY_IFRAME) {
    destroyIframe(msg.analyserId);
    sendResponse({ ok: true });
    return false;
  }
  if (msg?.type === MSG.OFFSCREEN_RUN_TRANSFORM) {
    const { analyserId, requestId, input, settings } = msg;
    const iframe = iframes.get(analyserId);
    if (!iframe?.contentWindow) {
      chrome.runtime.sendMessage({ type: MSG.OFFSCREEN_RESULT, requestId, payload: { error: "iframe missing" } });
      return false;
    }
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.removeEventListener("message", handler);
      clearTimeout(timer);
    };
    const handler = (ev: MessageEvent) => {
      if (ev.source !== iframe.contentWindow) return;
      if (ev.data?.type !== "result" || ev.data.requestId !== requestId) return;
      cleanup();
      const payload = "error" in ev.data ? { error: ev.data.error } : { result: ev.data.result };
      chrome.runtime.sendMessage({ type: MSG.OFFSCREEN_RESULT, requestId, payload });
    };
    const timer = setTimeout(() => {
      cleanup();
      chrome.runtime.sendMessage({ type: MSG.OFFSCREEN_RESULT, requestId, payload: { error: "offscreen run timeout" } });
    }, RUN_TIMEOUT_MS);
    window.addEventListener("message", handler);
    iframe.contentWindow.postMessage({ type: "run", requestId, input, settings }, "*");
    return false;
  }
  return false;
});

// Signal that this offscreen document is fully loaded and its message listener
// is registered. The service worker's ensureDocument awaits this ping before
// allowing any CREATE_IFRAME sends, so a captured event arriving in the small
// window between createDocument resolving and our scripts evaluating can't
// trigger a "Receiving end does not exist" sendMessage rejection.
chrome.runtime.sendMessage({ type: MSG.OFFSCREEN_READY }).catch(() => { /* no listener yet — ensureDocument's timeout will retry */ });

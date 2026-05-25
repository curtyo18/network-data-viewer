const iframes = new Map<string, HTMLIFrameElement>();
const ready = new Map<string, Promise<void>>();

function ensureIframe(analyserId: string, code: string): Promise<void> {
  if (ready.has(analyserId)) return ready.get(analyserId)!;
  const p = new Promise<void>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("src/sandbox/sandbox.html");
    iframe.style.display = "none";
    iframe.onload = () => {
      const handler = (ev: MessageEvent) => {
        if (ev.source !== iframe.contentWindow) return;
        if (ev.data?.type === "ready" && ev.data.analyserId === analyserId) {
          window.removeEventListener("message", handler);
          resolve();
        }
        if (ev.data?.type === "init-error" && ev.data.analyserId === analyserId) {
          window.removeEventListener("message", handler);
          reject(new Error(ev.data.message));
        }
      };
      window.addEventListener("message", handler);
      iframe.contentWindow!.postMessage({ type: "init", analyserId, code }, "*");
    };
    iframe.onerror = () => reject(new Error("iframe load error"));
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
  if (msg?.type === "offscreen-create-iframe") {
    ensureIframe(msg.analyserId, msg.code)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: (e as Error).message }));
    return true;
  }
  if (msg?.type === "offscreen-destroy-iframe") {
    destroyIframe(msg.analyserId);
    sendResponse({ ok: true });
    return false;
  }
  if (msg?.type === "offscreen-run-transform") {
    const { analyserId, requestId, input } = msg;
    const iframe = iframes.get(analyserId);
    if (!iframe?.contentWindow) {
      chrome.runtime.sendMessage({ type: "offscreen-result", requestId, payload: { error: "iframe missing" } });
      return false;
    }
    const handler = (ev: MessageEvent) => {
      if (ev.source !== iframe.contentWindow) return;
      if (ev.data?.type !== "result" || ev.data.requestId !== requestId) return;
      window.removeEventListener("message", handler);
      const payload = "error" in ev.data ? { error: ev.data.error } : { result: ev.data.result };
      chrome.runtime.sendMessage({ type: "offscreen-result", requestId, payload });
    };
    window.addEventListener("message", handler);
    iframe.contentWindow.postMessage({ type: "run", requestId, input }, "*");
    return false;
  }
  return false;
});

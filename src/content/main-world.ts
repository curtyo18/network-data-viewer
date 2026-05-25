(() => {
  if ((window as unknown as { __DVW_PATCHED__?: boolean }).__DVW_PATCHED__) return;
  (window as unknown as { __DVW_PATCHED__?: boolean }).__DVW_PATCHED__ = true;

  const channel = new MessageChannel();
  window.dispatchEvent(new CustomEvent("__dvw_setup__", { detail: channel.port2 }));

  const MAX_BODY = 5 * 1024 * 1024;

  function clip(s: string | null): { body: string | null; truncated: boolean } {
    if (s === null) return { body: null, truncated: false };
    if (s.length <= MAX_BODY) return { body: s, truncated: false };
    return { body: s.slice(0, MAX_BODY), truncated: true };
  }

  async function readReqBody(init: RequestInit | undefined, req: Request): Promise<string | null> {
    try {
      if (init?.body && typeof init.body === "string") return init.body;
      if (req.bodyUsed) return null;
      const cloned = req.clone();
      return await cloned.text();
    } catch { return null; }
  }

  async function emitFetch(input: RequestInfo | URL, init: RequestInit | undefined, response: Response): Promise<void> {
    try {
      const req = new Request(input as RequestInfo, init);
      const url = req.url;
      const method = req.method;
      const reqHeaders: Record<string, string> = {};
      req.headers.forEach((v, k) => { reqHeaders[k] = v; });
      const reqBody = await readReqBody(init, req);
      const resClone = response.clone();
      const resHeaders: Record<string, string> = {};
      resClone.headers.forEach((v, k) => { resHeaders[k] = v; });
      const resBodyText = await resClone.text().catch(() => null);
      const reqClipped = clip(reqBody);
      const resClipped = clip(resBodyText);
      channel.port1.postMessage({
        id: crypto.randomUUID(),
        ts: Date.now(),
        source: "fetch",
        method,
        url,
        reqHeaders,
        reqBody: reqClipped.body,
        resStatus: response.status,
        resHeaders,
        resBody: resClipped.body,
        truncated: reqClipped.truncated || resClipped.truncated || undefined
      });
    } catch { /* never throw into page */ }
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const response = await origFetch(input, init);
    void emitFetch(input, init, response.clone());
    return response;
  };

  // --- XHR ---
  const XHR = window.XMLHttpRequest;
  const origOpen = XHR.prototype.open;
  const origSend = XHR.prototype.send;
  const xhrMeta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

  XHR.prototype.open = function (this: XMLHttpRequest, method: string, url: string, ...rest: unknown[]) {
    xhrMeta.set(this, { method, url });
    // @ts-expect-error variadic
    return origOpen.call(this, method, url, ...rest);
  };

  XHR.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = xhrMeta.get(this) ?? { method: "GET", url: "" };
    const reqBody = typeof body === "string" ? body : body ? "[non-string body]" : null;
    this.addEventListener("loadend", () => {
      try {
        const reqHeaders: Record<string, string> = {};
        const resHeaders: Record<string, string> = {};
        (this.getAllResponseHeaders() || "").split(/\r?\n/).forEach(line => {
          const idx = line.indexOf(":");
          if (idx > 0) resHeaders[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
        });
        const resBody = typeof this.responseText === "string" ? this.responseText : null;
        const reqClipped = clip(reqBody);
        const resClipped = clip(resBody);
        channel.port1.postMessage({
          id: crypto.randomUUID(),
          ts: Date.now(),
          source: "xhr",
          method: meta.method,
          url: meta.url,
          reqHeaders,
          reqBody: reqClipped.body,
          resStatus: this.status || null,
          resHeaders,
          resBody: resClipped.body,
          truncated: reqClipped.truncated || resClipped.truncated || undefined
        });
      } catch { /* ignore */ }
    });
    return origSend.call(this, body as XMLHttpRequestBodyInit | null | undefined);
  };

  // --- sendBeacon ---
  const origSendBeacon = navigator.sendBeacon.bind(navigator);
  const patchedSendBeacon: typeof navigator.sendBeacon = (url, data) => {
    const ok = origSendBeacon(url, data);
    try {
      const bodyText = typeof data === "string" ? data : data ? "[non-string body]" : null;
      const clipped = clip(bodyText);
      channel.port1.postMessage({
        id: crypto.randomUUID(),
        ts: Date.now(),
        source: "beacon",
        method: "POST",
        url: typeof url === "string" ? url : url.toString(),
        reqHeaders: {},
        reqBody: clipped.body,
        resStatus: null,
        resHeaders: {},
        resBody: null,
        truncated: clipped.truncated || undefined
      });
    } catch { /* ignore */ }
    return ok;
  };
  Object.defineProperty(Navigator.prototype, "sendBeacon", { value: patchedSendBeacon, writable: true, configurable: true });

  // --- WebSocket ---
  const OrigWS = window.WebSocket;
  class PatchedWS extends OrigWS {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      const u = typeof url === "string" ? url : url.toString();
      this.addEventListener("message", (ev: MessageEvent) => {
        const data = typeof ev.data === "string" ? ev.data : null;
        const clipped = clip(data);
        channel.port1.postMessage({
          id: crypto.randomUUID(), ts: Date.now(), source: "ws-recv",
          method: "", url: u, reqHeaders: {}, reqBody: null,
          resStatus: null, resHeaders: {}, resBody: clipped.body,
          truncated: clipped.truncated || undefined
        });
      });
    }
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      const dataStr = typeof data === "string" ? data : "[binary]";
      const clipped = clip(dataStr);
      channel.port1.postMessage({
        id: crypto.randomUUID(), ts: Date.now(), source: "ws-send",
        method: "", url: this.url, reqHeaders: {}, reqBody: clipped.body,
        resStatus: null, resHeaders: {}, resBody: null,
        truncated: clipped.truncated || undefined
      });
      return super.send(data);
    }
  }
  (window as { WebSocket: typeof WebSocket }).WebSocket = PatchedWS as unknown as typeof WebSocket;
})();

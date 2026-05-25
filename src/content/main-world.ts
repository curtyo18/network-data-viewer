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
})();

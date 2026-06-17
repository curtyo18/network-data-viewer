import { encodeBody } from "@/content/encode-body";

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  runAt: 'document_start',
  allFrames: true,
  main() {
    (() => {
      if ((window as unknown as { __DVW_PATCHED__?: boolean }).__DVW_PATCHED__) return;
      (window as unknown as { __DVW_PATCHED__?: boolean }).__DVW_PATCHED__ = true;

      // Cross-world bridge: post directly to window.message; ISOLATED bridge listens.
      // Avoids the MAIN/ISOLATED setup-event race that affects MessageChannel handoff at document_start.
      const send = (event: unknown): void => {
        window.postMessage({ __dvw_event: event }, "*");
      };

      const MAX_BODY = 5 * 1024 * 1024;

      function clip(s: string | null): { body: string | null; truncated: boolean } {
        if (s === null) return { body: null, truncated: false };
        const enc = new TextEncoder().encode(s);
        if (enc.length <= MAX_BODY) return { body: s, truncated: false };
        return { body: new TextDecoder("utf-8").decode(enc.slice(0, MAX_BODY)), truncated: true };
      }

      async function emitFetch(input: RequestInfo | URL, init: RequestInit | undefined, response: Response): Promise<void> {
        try {
          const req = new Request(input as RequestInfo, init);
          const url = req.url;
          const method = req.method;
          const reqHeaders: Record<string, string> = {};
          req.headers.forEach((v, k) => { reqHeaders[k] = v; });

          // Encode the request body with binary support
          const rawBody = init?.body ?? null;
          const encoded = await encodeBody(rawBody, MAX_BODY);
          const reqClipped = clip(encoded.body);

          const resClone = response.clone();
          const resHeaders: Record<string, string> = {};
          resClone.headers.forEach((v, k) => { resHeaders[k] = v; });
          const resBodyText = await resClone.text().catch(() => null);
          const resClipped = clip(resBodyText);
          send({
            id: crypto.randomUUID(),
            ts: Date.now(),
            source: "fetch",
            method,
            url,
            reqHeaders,
            reqBody: reqClipped.body,
            reqBodyEncoding: encoded.encoding,
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

        // Kick off async body encoding; will be resolved inside the loadend listener.
        const bodyEncodeP = encodeBody(body ?? null, MAX_BODY);

        this.addEventListener("loadend", () => {
          bodyEncodeP.then(encoded => {
            try {
              const reqHeaders: Record<string, string> = {};
              const resHeaders: Record<string, string> = {};
              (this.getAllResponseHeaders() || "").split(/\r?\n/).forEach(line => {
                const idx = line.indexOf(":");
                if (idx > 0) resHeaders[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
              });
              const resBody = typeof this.responseText === "string" ? this.responseText : null;
              const reqClipped = clip(encoded.body);
              const resClipped = clip(resBody);
              send({
                id: crypto.randomUUID(),
                ts: Date.now(),
                source: "xhr",
                method: meta.method,
                url: meta.url,
                reqHeaders,
                reqBody: reqClipped.body,
                reqBodyEncoding: encoded.encoding,
                resStatus: this.status || null,
                resHeaders,
                resBody: resClipped.body,
                truncated: reqClipped.truncated || resClipped.truncated || undefined
              });
            } catch { /* ignore */ }
          }).catch(() => { /* ignore encode errors */ });
        });
        return origSend.call(this, body as XMLHttpRequestBodyInit | null | undefined);
      };

      // --- sendBeacon ---
      const origSendBeacon = navigator.sendBeacon.bind(navigator);
      const patchedSendBeacon: typeof navigator.sendBeacon = (url, data) => {
        const ok = origSendBeacon(url, data);
        // Async encode; emit when resolved (page does not wait on us)
        encodeBody(data ?? null, MAX_BODY).then(encoded => {
          try {
            const clipped = clip(encoded.body);
            send({
              id: crypto.randomUUID(),
              ts: Date.now(),
              source: "beacon",
              method: "POST",
              url: typeof url === "string" ? url : url.toString(),
              reqHeaders: {},
              reqBody: clipped.body,
              reqBodyEncoding: encoded.encoding,
              resStatus: null,
              resHeaders: {},
              resBody: null,
              truncated: clipped.truncated || undefined
            });
          } catch { /* ignore */ }
        }).catch(() => { /* ignore */ });
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
            send({
              id: crypto.randomUUID(), ts: Date.now(), source: "ws-recv",
              method: "", url: u, reqHeaders: {}, reqBody: null,
              resStatus: null, resHeaders: {}, resBody: clipped.body,
              truncated: clipped.truncated || undefined
            });
          });
        }
        send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
          // Async encode; emit when resolved
          encodeBody(data, MAX_BODY).then(encoded => {
            try {
              const clipped = clip(encoded.body);
              send({
                id: crypto.randomUUID(), ts: Date.now(), source: "ws-send",
                method: "", url: this.url, reqHeaders: {},
                reqBody: clipped.body,
                reqBodyEncoding: encoded.encoding,
                resStatus: null, resHeaders: {}, resBody: null,
                truncated: clipped.truncated || undefined
              });
            } catch { /* ignore */ }
          }).catch(() => { /* ignore */ });
          return super.send(data);
        }
      }
      (window as { WebSocket: typeof WebSocket }).WebSocket = PatchedWS as unknown as typeof WebSocket;

      // --- Image beacons ---
      // Tracking pixels (Meta's fbevents.js, Google Ads conversion pixels,
      // Pinterest, …) fire GET beacons by assigning to an Image's `src` rather
      // than via fetch/XHR/sendBeacon, so they bypass the patches above. Hook the
      // prototype `src` setter to see the URL. There is no readable response
      // (cross-origin, no-cors) and no request body for a GET — the payload is in
      // the URL. Only http(s) URLs are emitted (skips data:/blob:/empty resets);
      // ordinary <img> content is harmless noise that no analyser pattern matches.
      const imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
      if (imgDesc && typeof imgDesc.set === "function") {
        const origSrcSet = imgDesc.set;
        Object.defineProperty(HTMLImageElement.prototype, "src", {
          ...imgDesc,
          set(this: HTMLImageElement, value: string) {
            try {
              const url = new URL(String(value), document.baseURI).href;
              if (/^https?:/i.test(url)) {
                send({
                  id: crypto.randomUUID(),
                  ts: Date.now(),
                  source: "image",
                  method: "GET",
                  url,
                  reqHeaders: {},
                  reqBody: null,
                  resStatus: null,
                  resHeaders: {},
                  resBody: null,
                });
              }
            } catch { /* relative/invalid/empty src — never throw into the page */ }
            origSrcSet.call(this, value);
          },
        });
      }
    })();
  },
});

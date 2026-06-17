export default function sandbox(input: unknown, settings: unknown): unknown {
  const inp = (input !== null && typeof input === "object" && !Array.isArray(input) ? input : {}) as {
    url?: unknown; method?: unknown; body?: unknown;
  };
  const url = typeof inp.url === "string" ? inp.url : "";
  const method = typeof inp.method === "string" ? inp.method : "GET";
  const body = typeof inp.body === "string" ? inp.body : "";

  // Anchored at the scheme so it only matches when graph.facebook.com is the real
  // host — not when the string appears unencoded inside a /tr param value. Allows
  // an optional trailing slash. Kept identical to the CAPI branch of
  // meta.meta.ts's urlPattern so the gate and this branch agree.
  const CAPI_RE = /^https?:\/\/graph\.facebook\.com\/v\d+(?:\.\d+)?\/\d+\/events\/?(?:[?#]|$)/;

  function parseKV(s: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (!s) return out;
    for (const pair of s.split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const k = eq === -1 ? pair : pair.slice(0, eq);
      const v = eq === -1 ? "" : pair.slice(eq + 1);
      try {
        out[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent(v.replace(/\+/g, " "));
      } catch {
        out[k] = v;
      }
    }
    return out;
  }

  // --- Conversions API branch: graph.facebook.com/v<n>/<pixelId>/events (JSON) ---
  if (CAPI_RE.test(url)) {
    let parsed: unknown = null;
    try { parsed = JSON.parse(body); } catch { return null; }
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as { data?: unknown; access_token?: unknown; test_event_code?: unknown };
    const token = typeof obj.access_token === "string" ? obj.access_token : undefined;
    const testCode = typeof obj.test_event_code === "string" ? obj.test_event_code : undefined;
    const data = Array.isArray(obj.data) ? obj.data : [];
    const events = data.map((ev, idx) => {
      // Plain objects spread their fields; non-objects/arrays surface under `value`
      // rather than producing a phantom empty row (or array-index keys).
      const fields = (ev !== null && typeof ev === "object" && !Array.isArray(ev) ? ev : { value: ev }) as Record<string, unknown>;
      return {
        ...fields,
        // Analyser-controlled labels and the authoritative top-level token are
        // written last so a same-named wire field can't clobber them.
        transport: "capi",
        eventIndex: idx,
        ...(token !== undefined ? { access_token: token } : {}),
        ...(testCode !== undefined ? { test_event_code: testCode } : {}),
      };
    });
    return { fanOut: events };
  }

  // --- Pixel branch: /tr beacon (query + optional form-encoded POST body) ---
  const queryStr = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const fromQuery = parseKV(queryStr);
  const fromBody = method.toUpperCase() === "POST" && body.includes("=") ? parseKV(body) : {};
  const merged = { ...fromQuery, ...fromBody };

  // Split canonical top-level params from cd[]/ud[] custom data. Custom keys are
  // flattened to bare names and surfaced inline, but a custom key (e.g. cd[id])
  // must not clobber a real pixel field — so top-level params and the transport
  // label are written last and win on collision.
  const topLevel: Record<string, string> = {};
  const flattened: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged)) {
    const m = k.match(/^(?:cd|ud)\[(.+)\]$/);
    if (m) flattened[m[1]] = v;
    else topLevel[k] = v;
  }
  return { ...flattened, ...topLevel, transport: "pixel" };
}

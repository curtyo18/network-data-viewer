export default function sandbox(input: unknown, settings: unknown): unknown {
  const inp = (input !== null && typeof input === "object" && !Array.isArray(input) ? input : {}) as {
    url?: unknown; method?: unknown; body?: unknown;
  };
  const url = typeof inp.url === "string" ? inp.url : "";
  const method = typeof inp.method === "string" ? inp.method : "GET";
  const body = typeof inp.body === "string" ? inp.body : "";

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

  // cd[content_name] / ud[em] -> bare `content_name` / `em`, surfaced inline.
  function flattenBrackets(raw: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const m = k.match(/^(?:cd|ud)\[(.+)\]$/);
      out[m ? m[1] : k] = v;
    }
    return out;
  }

  // --- Conversions API branch: graph.facebook.com/v<n>/<pixelId>/events (JSON) ---
  if (/graph\.facebook\.com\/v\d+(?:\.\d+)?\/\d+\/events/.test(url)) {
    let parsed: unknown = null;
    try { parsed = JSON.parse(body); } catch { return null; }
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as { data?: unknown; access_token?: unknown; test_event_code?: unknown };
    const token = typeof obj.access_token === "string" ? obj.access_token : undefined;
    const testCode = typeof obj.test_event_code === "string" ? obj.test_event_code : undefined;
    const data = Array.isArray(obj.data) ? obj.data : [];
    const events = data.map((ev, idx) => {
      const e = (ev && typeof ev === "object" ? ev : {}) as Record<string, unknown>;
      return {
        transport: "capi",
        eventIndex: idx,
        ...e,
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
  return { transport: "pixel", ...flattenBrackets(merged) };
}

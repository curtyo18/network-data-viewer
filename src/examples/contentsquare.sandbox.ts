export default function sandbox(input: unknown, settings: unknown): unknown {
  const inp = (input !== null && typeof input === "object" && !Array.isArray(input) ? input : {}) as {
    url?: unknown; method?: unknown; body?: unknown;
  };
  const url = typeof inp.url === "string" ? inp.url : "";
  const method = typeof inp.method === "string" ? inp.method : "GET";
  const body = typeof inp.body === "string" ? inp.body : "";
  const settingsObj = (settings && typeof settings === "object" ? settings : {}) as { showRaw?: unknown };
  const showRaw = !!settingsObj.showRaw;

  function parseKV(s: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (!s) return out;
    for (const pair of s.split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const k = eq === -1 ? pair : pair.slice(0, eq);
      const v = eq === -1 ? "" : pair.slice(eq + 1);
      try {
        out[decodeURIComponent(k.replace(/\+/g, " "))] =
          decodeURIComponent(v.replace(/\+/g, " "));
      } catch {
        out[k] = v;
      }
    }
    return out;
  }

  const queryStr = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const q = parseKV(queryStr);

  let pathName = "";
  try {
    pathName = new URL(url).pathname;
  } catch {
    const m = url.match(/^https?:\/\/[^/]+(\/[^?#]*)/);
    pathName = m ? m[1] : "";
  }

  const GLOSSARY: Record<string, string> = {
    url: "pageUrl", pid: "projectId", uu: "userId", sn: "sessionNumber",
    pn: "pageNumber", hd: "hitDate", lv: "lastVisitTs", lhd: "lastHitTs",
    r: "cacheBuster", re: "collectionMode", dw: "documentWidth",
    dh: "documentHeight", sw: "screenWidth", sh: "screenHeight",
    ww: "windowWidth", wh: "windowHeight", la: "browserLanguage",
    dr: "referrer", cvarp: "pageCustomVars", cvars: "sessionCustomVars",
    cvaru: "userCustomVars", v: "tagVersion", pvt: "pageviewType",
    ex: "canBeInReplay", uc: "userConsent", uxt: "uxtTests",
    uxtv: "uxtTagVersion",
  };

  const PVT: Record<string, string> = { n: "natural", a: "artificial", r: "renewal" };
  const UC: Record<string, string> = { "0": "not_required", "1": "not_expressed", "2": "granted", "3": "withdrawn" };
  const RE_MAP: Record<string, string> = { "1": "standard", "3": "replay", "5": "triggered_replay" };

  // Hidden when settings.showRaw is false.
  const NOISE_KEYS = new Set([
    "r", "dw", "dh", "sw", "sh", "ww", "wh", "lv", "lhd", "ex", "v", "uxtv",
  ]);

  function decodeJSONField(s: string | undefined): unknown {
    if (s == null) return undefined;
    try { return JSON.parse(s); } catch { return s; }
  }

  function humanize(raw: Record<string, string>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!showRaw && NOISE_KEYS.has(k)) continue;
      const mapped = GLOSSARY[k] ?? k;
      let val: unknown = v;
      if (k === "pvt") val = PVT[v] ?? v;
      else if (k === "uc") val = UC[v] ?? v;
      else if (k === "re") val = RE_MAP[v] ?? v;
      else if (k === "cvarp" || k === "cvars" || k === "cvaru" || k === "uxt") {
        val = decodeJSONField(v);
      }
      out[mapped] = val;
    }
    return out;
  }

  function parseBodyJSON(): unknown {
    try { return JSON.parse(body); } catch { return body; }
  }

  if (pathName === "/pageview") {
    return { endpoint: "pageview", method, ...humanize(q) };
  }
  if (pathName === "/transaction") {
    return { endpoint: "transaction", method, ...humanize(q) };
  }
  if (pathName === "/dvar") {
    return { endpoint: "dvar", method, ...humanize(q) };
  }
  if (pathName === "/pageEvent") {
    const encodedValue = showRaw ? (q.value ?? "<absent>") : "<encoded>";
    return {
      endpoint: "pageEvent",
      method,
      ...humanize(q),
      pageEventEncodedValue: encodedValue,
    };
  }

  if (pathName === "/events") {
    return {
      endpoint: "events",
      method,
      note: "Events batch (≤50 events). Body is encoded; not decoded in default config.",
      projectId: q.pid,
      userId: q.uu,
      sessionNumber: q.sn,
      pageNumber: q.pn,
      bodyBytes: body.length,
    };
  }

  if (pathName.endsWith("/recording")) {
    return {
      endpoint: "session_replay_recording",
      method,
      note: "Compressed binary DOM snapshot/mutations. Opaque by default.",
      projectIdHint: q.pid,
      bodyBytes: body.length,
    };
  }

  if (pathName === "/quota") {
    return { endpoint: "replay_quota_check", method };
  }

  if (pathName === "/display") {
    const parsed = parseBodyJSON();
    if (showRaw) return { endpoint: "emerchandising_display", method, body: parsed };
    const preview = typeof parsed === "string" ? parsed.slice(0, 200) : parsed;
    return { endpoint: "emerchandising_display", method, bodyPreview: preview };
  }

  if (pathName === "/errors" || pathName === "/custom-errors" || pathName === "/api-errors") {
    const parsed = parseBodyJSON();
    const errType = pathName.slice(1);
    if (showRaw) return { endpoint: errType, method, body: parsed };
    const isObj = parsed && typeof parsed === "object" && !Array.isArray(parsed);
    const previewObj = isObj
      ? {
          name: (parsed as { name?: unknown }).name,
          message: typeof (parsed as { message?: unknown }).message === "string"
            ? ((parsed as { message: string }).message).slice(0, 200)
            : "",
        }
      : String(parsed).slice(0, 200);
    return { endpoint: errType, method, bodyPreview: previewObj };
  }

  if (pathName === "/exist" || pathName === "/putTag") {
    return {
      endpoint: "srm_" + pathName.slice(1),
      method,
      note: "Static resource manager — internal asset scraping.",
    };
  }

  return {
    ...humanize(q),
    endpoint: "unknown_contentsquare",
    method,
    path: pathName,
  };
}

export default function sandbox(input: unknown, settings: unknown): unknown {
  const inp = (input && typeof input === "object" ? input : {}) as {
    url?: unknown; body?: unknown;
  };
  const url = typeof inp.url === "string" ? inp.url : "";
  const body = typeof inp.body === "string" ? inp.body : "";
  const settingsObj = (settings && typeof settings === "object" ? settings : {}) as { showRaw?: unknown };
  const showRaw = !!settingsObj.showRaw;
  const queryStr = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";

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

  const CODE_GLOSSARY: Record<string, string> = {
    v: "protocolVersion", tid: "measurementId", cid: "clientId",
    sid: "sessionId", _p: "pageViewId", _s: "hitCount", _z: "cacheBuster",
    sr: "screenResolution", ul: "userLanguage", dl: "documentLocation",
    dr: "documentReferrer", dt: "documentTitle", sct: "sessionCount",
    seg: "sessionEngaged", _fv: "firstVisit", _ss: "sessionStart",
    _nsi: "newSessionId", _et: "engagementTimeMs",
    _ee: "externalEvent", _c: "isConversion", cu: "currency",
    tr: "transactionRevenue", tt: "transactionTax", ts: "transactionShipping",
    gtm: "gtmContainerHash", ds: "dataSource", _dbg: "debug",
    gcs: "consentStatus", gcd: "consentDataV2", dma: "dmaConsent",
    dma_cps: "dmaConsentPolicy", pscdl: "pscdl",
    uaa: "uaArchitecture", uab: "uaBitness", uafvl: "uaFullVersionList",
    uamb: "uaMobile", uam: "uaModel", uap: "uaPlatform",
    uapv: "uaPlatformVersion", uaw: "uaWow64", uid: "userId",
    richsstsse: "serviceWorkerRouted",
  };

  // Hidden when settings.showRaw is false.
  const NOISE_KEYS = new Set([
    "_p", "_z", "_dbg", "gtm", "_s", "sr", "ul",
    "uaa", "uab", "uafvl", "uamb", "uam", "uap", "uapv", "uaw",
    "gcs", "gcd", "dma", "dma_cps", "pscdl", "tfd", "_eu", "_ee",
    "seg", "sct", "_fv", "_ss", "_nsi", "richsstsse",
  ]);
  const NOISE_EVENT_NAMES = new Set([
    "user_engagement", "scroll", "session_start", "first_visit",
  ]);

  function humanize(raw: Record<string, string>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!showRaw && NOISE_KEYS.has(k)) continue;

      // ep.<name>, epn.<name>, up.<name>, upn.<name>
      const m = k.match(/^(ep|epn|up|upn)\.(.+)$/);
      if (m) {
        const scope = { ep: "param", epn: "param", up: "userProp", upn: "userProp" }[m[1] as "ep" | "epn" | "up" | "upn"];
        const isNum = m[1].endsWith("n");
        if (isNum) {
          if (v === "") continue;
          out[`${scope}:${m[2]}`] = Number(v);
        } else {
          out[`${scope}:${m[2]}`] = v;
        }
        continue;
      }

      // pr1, pr2, ... ecommerce item slots — tilde-separated subfields.
      if (/^pr\d+$/.test(k)) {
        const sub: Record<string, string> = {};
        for (const fragment of v.split("~")) {
          if (fragment.length < 2) continue;
          // ca2..ca5 are deeper category levels; match them before the generic letters-only prefix.
          let fm = fragment.match(/^(ca[2-5])(.*)$/);
          if (!fm) fm = fragment.match(/^([a-z]+)(.*)$/);
          if (!fm) continue;
          sub[fm[1]] = fm[2];
        }
        out[`item:${k}`] = sub;
        continue;
      }

      out[CODE_GLOSSARY[k] ?? k] = v;
    }
    return out;
  }

  const reqLevel = parseKV(queryStr);

  // Multi-event POST: body has lines.
  if (body && body.trim().length > 0) {
    const lines = body.split("\n").filter(l => l.length > 0);
    const events = lines.map((line, idx) => {
      const evParams = parseKV(line);
      const merged = { ...reqLevel, ...evParams };
      const name = evParams.en || reqLevel.en || `event_${idx}`;
      const hide = !showRaw && NOISE_EVENT_NAMES.has(name);
      return {
        eventName: name,
        eventIndex: idx,
        protocolVersion: merged.v,
        measurementId: merged.tid,
        ...(hide ? { _filtered: true } : humanize(merged)),
      };
    });
    return { fanOut: events };
  }

  // Single event — everything is in the URL query.
  const single = humanize(reqLevel);
  const name = reqLevel.en || "unknown";
  if (!showRaw && NOISE_EVENT_NAMES.has(name)) {
    return { eventName: name, _filtered: true };
  }
  return {
    eventName: name,
    protocolVersion: reqLevel.v,
    measurementId: reqLevel.tid,
    ...single,
  };
}

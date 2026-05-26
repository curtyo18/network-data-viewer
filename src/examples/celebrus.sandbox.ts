export default function sandbox(input: unknown, settings: unknown): unknown {
  type EventRecord = Record<string, string>;

  const BODY_DELIMITER = "&y=";
  const EVENT_PREFIX = /(?=&ap=)/;
  const PRIORITY_KEYS = ["ap", "wk", "ai", "at"] as const;

  // Telemetry event types that don't represent user actions; filtered out unless showRaw.
  const IGNORED_EVENT_TYPES = new Set([
    "beforeunload",
    "network",
    "contenteventscomplete",
    "SC",
    "resize",
    "imagesLoaded",
    "imagesloaded",
    "loaddocument",
    "error",
  ]);

  // Internal/instrumentation keys (timestamps, viewport metrics, internal coords) stripped in filtered mode.
  const NOISE_KEYS = new Set([
    "aD", "ct", "tz", "xi", "a", "nu",
    "aX", "aY", "al", "am",
    "a1", "a2", "a3", "a4", "a5", "a6",
    "ax", "ay", "aU", "aV",
    "vp", "vr", "xs", "xt", "mh",
  ]);

  function readShowRaw(s: unknown): boolean {
    return !!(s && typeof s === "object" && (s as { showRaw?: unknown }).showRaw);
  }

  function decodeBody(raw: string): string | null {
    const idx = raw.indexOf(BODY_DELIMITER);
    if (idx < 0) return null;
    return raw
      .slice(idx + BODY_DELIMITER.length)
      // Reverse the encoder's per-window character rotations: 5+8 then 2+2.
      .replace(/(.....)(........)/g, "$2$1")
      .replace(/(..)(..)/g, "$2$1")
      .replace(/q/g, "%")
      .replace(/\+/g, "&");
  }

  function splitSegments(body: string): string[] {
    const segments = body.split(EVENT_PREFIX);
    segments.shift(); // first segment is request-level metadata, not an event
    return segments;
  }

  function parseSegment(segment: string): EventRecord {
    const event: EventRecord = {};
    for (const pair of segment.split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      event[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    return event;
  }

  function expandClientPayload(ct: string): unknown {
    const decoded = decodeURIComponent(ct);
    try {
      return JSON.parse(decoded);
    } catch {
      return decoded;
    }
  }

  function shouldDrop(event: EventRecord): boolean {
    if (!event.ap) return true;
    return IGNORED_EVENT_TYPES.has(event.ap);
  }

  function tidy(event: EventRecord): EventRecord {
    const out: EventRecord = {};
    for (const key of PRIORITY_KEYS) {
      if (event[key] != null) out[key] = event[key];
    }
    for (const key of Object.keys(event)) {
      if (NOISE_KEYS.has(key)) continue;
      if (key in out) continue;
      out[key] = event[key];
    }
    return out;
  }

  if (typeof input !== "string") return null;
  const body = decodeBody(input);
  if (body === null) return null;

  const showRaw = readShowRaw(settings);
  const events: Array<EventRecord | unknown> = [];

  for (const segment of splitSegments(body)) {
    const event = parseSegment(segment);

    if (event.ap === "client" && event.ct != null) {
      events.push(expandClientPayload(event.ct));
      continue;
    }
    if (!showRaw && shouldDrop(event)) continue;

    events.push(showRaw ? event : tidy(event));
  }

  return { fanOut: events };
}

import { describe, it, expect, beforeAll } from "vitest";
import * as path from "node:path";
import { extractSandboxBody } from "../../vite/plugins/analyser-seeds";

const SANDBOX_FILE = path.resolve(__dirname, "..", "..", "src", "examples", "contentsquare.sandbox.ts");

const wrap = (url: string, body: string | null = null, method = body === null ? "GET" : "POST") => ({
  url, method, body, dslOutput: null,
});

let sandbox: (input: unknown, settings: unknown) => unknown;

beforeAll(async () => {
  const body = await extractSandboxBody(SANDBOX_FILE);
  sandbox = new Function("input", "settings", body) as (i: unknown, s: unknown) => unknown;
});

describe("contentsquare sandbox", () => {
  it("decodes a /pageview hit with humanised codes + pvt enum", () => {
    const url = "https://c.contentsquare.net/pageview?pid=2887&uu=abc&sn=5&pn=3&pvt=n&uc=2&url=" +
      encodeURIComponent("https://example.com/cart");
    const result = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    expect(result.endpoint).toBe("pageview");
    expect(result.projectId).toBe("2887");
    expect(result.userId).toBe("abc");
    expect(result.sessionNumber).toBe("5");
    expect(result.pageNumber).toBe("3");
    expect(result.pageviewType).toBe("natural");
    expect(result.userConsent).toBe("granted");
    expect(result.pageUrl).toBe("https://example.com/cart");
  });

  it("expands cvarp / cvars / cvaru as JSON when valid", () => {
    const cvarp = encodeURIComponent(JSON.stringify({ step: "cart" }));
    const url = `https://c.contentsquare.net/pageview?pid=2887&cvarp=${cvarp}`;
    const result = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    expect(result.pageCustomVars).toEqual({ step: "cart" });
  });

  it("hides viewport noise (dw/dh/sw/sh/ww/wh) by default; shows it with showRaw", () => {
    const url = "https://c.contentsquare.net/pageview?pid=2887&dw=1280&dh=4200&sw=1920&sh=1080&ww=1280&wh=720";
    const filtered = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    const raw = sandbox(wrap(url), { showRaw: true }) as Record<string, unknown>;
    expect(filtered).not.toHaveProperty("documentWidth");
    expect(filtered).not.toHaveProperty("screenWidth");
    expect(raw.documentWidth).toBe("1280");
    expect(raw.screenWidth).toBe("1920");
  });

  it("surfaces /events as an opaque one-line summary", () => {
    const url = "https://c.contentsquare.net/events?pid=2887&uu=abc&sn=1&pn=2";
    const result = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    expect(result.endpoint).toBe("events");
    expect(result.projectId).toBe("2887");
    expect(typeof result.note).toBe("string");
  });

  it("surfaces /v2/recording as a one-line summary with body size", () => {
    const url = "https://k-aeu1.contentsquare.net/v2/recording";
    const result = sandbox(wrap(url, "binary-payload-here", "POST"), { showRaw: false }) as Record<string, unknown>;
    expect(result.endpoint).toBe("session_replay_recording");
    expect(result.bodyBytes).toBe("binary-payload-here".length);
  });

  it("parses /display POST body as JSON when valid", () => {
    const url = "https://c.contentsquare.net/display";
    const body = JSON.stringify({ impressions: ["a", "b"] });
    const result = sandbox(wrap(url, body, "POST"), { showRaw: true }) as Record<string, unknown>;
    expect(result.endpoint).toBe("emerchandising_display");
    expect(result.body).toEqual({ impressions: ["a", "b"] });
  });

  it("truncates /errors body to {name, message} preview by default", () => {
    const url = "https://c.contentsquare.net/errors";
    const body = JSON.stringify({ name: "TypeError", message: "x is not a function", stack: "long stack..." });
    const result = sandbox(wrap(url, body, "POST"), { showRaw: false }) as Record<string, unknown>;
    expect(result.endpoint).toBe("errors");
    expect(result.bodyPreview).toEqual({ name: "TypeError", message: "x is not a function" });
  });

  it("surfaces an unknown contentsquare path verbatim", () => {
    const url = "https://c.contentsquare.net/futurePath?foo=bar";
    const result = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    expect(result.endpoint).toBe("unknown_contentsquare");
    expect(result.path).toBe("/futurePath");
    expect(result.foo).toBe("bar");
  });

  it("falls back to regex parsing when new URL() throws", () => {
    // Port out of range (>65535) makes `new URL()` throw, but the regex fallback
    // (`^https?:\/\/[^/]+(\/[^?#]*)`) still extracts `/pageview`.
    const result = sandbox(wrap("http://example.com:99999/pageview?pid=999"), { showRaw: false }) as Record<string, unknown>;
    expect(result.endpoint).toBe("pageview");
    expect(result.projectId).toBe("999");
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import * as path from "node:path";
import { extractSandboxBody } from "../../vite/plugins/analyser-seeds";

const SANDBOX_FILE = path.resolve(__dirname, "..", "..", "src", "examples", "ga4.sandbox.ts");

const wrap = (url: string, body: string | null = null, method = body === null ? "GET" : "POST") => ({
  url, method, body, dslOutput: null,
});

let sandbox: (input: unknown, settings: unknown) => unknown;

beforeAll(async () => {
  const body = await extractSandboxBody(SANDBOX_FILE);
  sandbox = new Function("input", "settings", body) as (i: unknown, s: unknown) => unknown;
});

describe("ga4 sandbox", () => {
  it("decodes a single-event GET pageview (data in URL)", () => {
    const url = "https://www.google-analytics.com/g/collect?v=2&tid=G-X&cid=1.2&en=page_view&dl=https%3A%2F%2Fexample.com%2F&dt=Home";
    const result = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    expect(result.eventName).toBe("page_view");
    expect(result.measurementId).toBe("G-X");
    expect(result.clientId).toBe("1.2");
    expect(result.documentLocation).toBe("https://example.com/");
    expect(result.documentTitle).toBe("Home");
  });

  it("fans out a multi-event POST batch (events in newline-separated body)", () => {
    const url = "https://www.google-analytics.com/g/collect?v=2&tid=G-X&cid=1.2";
    const body = "en=click&_et=100\nen=scroll&_et=200\nen=purchase&_et=300&cu=USD&tr=99.99";
    const result = sandbox(wrap(url, body), { showRaw: true }) as { fanOut: Array<Record<string, unknown>> };
    expect(result.fanOut).toHaveLength(3);
    expect(result.fanOut[0].eventName).toBe("click");
    expect(result.fanOut[1].eventName).toBe("scroll");
    expect(result.fanOut[2].eventName).toBe("purchase");
    expect(result.fanOut[2].currency).toBe("USD");
    expect(result.fanOut[2].transactionRevenue).toBe("99.99");
    expect(result.fanOut[0].measurementId).toBe("G-X");
    expect(result.fanOut[0].protocolVersion).toBe("2");
  });

  it("filters noise events (user_engagement, scroll, session_start, first_visit) when showRaw=false", () => {
    const url = "https://www.google-analytics.com/g/collect?v=2&tid=G-X";
    const body = "en=page_view&_et=100\nen=user_engagement&_et=200\nen=click&_et=300";
    const result = sandbox(wrap(url, body), { showRaw: false }) as { fanOut: Array<Record<string, unknown>> };
    expect(result.fanOut).toHaveLength(3);
    expect(result.fanOut[1]._filtered).toBe(true);
  });

  it("expands ep.<name> and epn.<name> custom params", () => {
    const url = "https://www.google-analytics.com/g/collect?v=2&tid=G-X&en=custom&ep.method=Google&epn.value=42";
    const result = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    expect(result["param:method"]).toBe("Google");
    expect(result["param:value"]).toBe(42);
  });

  it("expands pr1 ecommerce item slot tilde-separated subfields", () => {
    const url = "https://www.google-analytics.com/g/collect?v=2&tid=G-X&en=view_item&pr1=" +
      encodeURIComponent("idSKU123~nmShirt~brAcme~caApparel~ca2T-Shirts~vaBlack~pr19.99~qt1");
    const result = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    const item = result["item:pr1"] as Record<string, string>;
    expect(item.id).toBe("SKU123");
    expect(item.nm).toBe("Shirt");
    expect(item.br).toBe("Acme");
    expect(item.ca).toBe("Apparel");
    expect(item.ca2).toBe("T-Shirts");
    expect(item.va).toBe("Black");
    expect(item.pr).toBe("19.99");
    expect(item.qt).toBe("1");
  });

  it("hides UACH and consent telemetry by default but shows them with showRaw=true", () => {
    const url = "https://www.google-analytics.com/g/collect?v=2&tid=G-X&en=page_view&uap=Windows&gcs=G111&_p=12345";
    const filtered = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    const raw = sandbox(wrap(url), { showRaw: true }) as Record<string, unknown>;
    expect(filtered).not.toHaveProperty("uaPlatform");
    expect(filtered).not.toHaveProperty("consentStatus");
    expect(filtered).not.toHaveProperty("pageViewId");
    expect(raw.uaPlatform).toBe("Windows");
    expect(raw.consentStatus).toBe("G111");
    expect(raw.pageViewId).toBe("12345");
  });

  it("falls back gracefully on a malformed URL", () => {
    const result = sandbox(wrap("not a url at all"), { showRaw: false }) as Record<string, unknown>;
    expect(result.eventName).toBe("unknown");
  });

  it("returns a single-row object (not fanOut) for empty body POSTs", () => {
    const url = "https://www.google-analytics.com/g/collect?v=2&tid=G-X&en=page_view";
    const result = sandbox(wrap(url, "", "POST"), { showRaw: false });
    expect(result).not.toHaveProperty("fanOut");
    expect((result as Record<string, unknown>).eventName).toBe("page_view");
  });
});

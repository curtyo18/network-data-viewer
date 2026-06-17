import { describe, it, expect, beforeAll } from "vitest";
import * as path from "node:path";
import { extractSandboxBody } from "../../vite/plugins/analyser-seeds";

const SANDBOX_FILE = path.resolve(__dirname, "..", "..", "src", "examples", "meta.sandbox.ts");

const wrap = (url: string, body: string | null = null, method = body === null ? "GET" : "POST") => ({
  url, method, body, dslOutput: null,
});

let sandbox: (input: unknown, settings: unknown) => unknown;

beforeAll(async () => {
  const body = await extractSandboxBody(SANDBOX_FILE);
  sandbox = new Function("input", "settings", body) as (i: unknown, s: unknown) => unknown;
});

describe("meta sandbox", () => {
  it("decodes a GET pixel beacon (params in URL, brackets flattened)", () => {
    const url =
      "https://www.facebook.com/tr/?id=123&ev=Purchase&dl=https%3A%2F%2Fexample.com%2F&cd[value]=10&cd[currency]=USD&ud[em]=abc123";
    const result = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    expect(result.transport).toBe("pixel");
    expect(result.id).toBe("123");
    expect(result.ev).toBe("Purchase");
    expect(result.dl).toBe("https://example.com/");
    expect(result.value).toBe("10");
    expect(result.currency).toBe("USD");
    expect(result.em).toBe("abc123");
  });

  it("merges a POST pixel form body over the query params", () => {
    const url = "https://www.facebook.com/tr/?id=123&ev=Lead";
    const body = "cd[content_name]=Newsletter&ud[ph]=hashedphone";
    const result = sandbox(wrap(url, body), { showRaw: false }) as Record<string, unknown>;
    expect(result.transport).toBe("pixel");
    expect(result.id).toBe("123");
    expect(result.ev).toBe("Lead");
    expect(result.content_name).toBe("Newsletter");
    expect(result.ph).toBe("hashedphone");
  });

  it("fans out a direct Conversions API batch, surfacing access_token verbatim", () => {
    const url = "https://graph.facebook.com/v18.0/123456789/events";
    const body = JSON.stringify({
      data: [
        { event_name: "PageView", event_time: 1737000000, user_data: { em: ["h1"] } },
        { event_name: "Purchase", custom_data: { value: 99.99, currency: "USD" } },
      ],
      access_token: "EAABsbCS1iHgBO",
      test_event_code: "TEST123",
    });
    const result = sandbox(wrap(url, body), { showRaw: false }) as { fanOut: Array<Record<string, unknown>> };
    expect(result.fanOut).toHaveLength(2);
    expect(result.fanOut[0].transport).toBe("capi");
    expect(result.fanOut[0].eventIndex).toBe(0);
    expect(result.fanOut[0].event_name).toBe("PageView");
    expect(result.fanOut[0].user_data).toEqual({ em: ["h1"] });
    expect(result.fanOut[0].access_token).toBe("EAABsbCS1iHgBO");
    expect(result.fanOut[0].test_event_code).toBe("TEST123");
    expect(result.fanOut[1].event_name).toBe("Purchase");
    expect(result.fanOut[1].custom_data).toEqual({ value: 99.99, currency: "USD" });
  });

  it("returns null for a Conversions API URL with a non-JSON body", () => {
    const url = "https://graph.facebook.com/v18.0/123456789/events";
    const result = sandbox(wrap(url, "not json"), { showRaw: false });
    expect(result).toBeNull();
  });

  it("does not let custom cd[]/ud[] data clobber the canonical id/ev fields", () => {
    const url = "https://www.facebook.com/tr/?id=REAL&ev=Purchase&cd[id]=FAKE&cd[ev]=FAKE_EV";
    const result = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    expect(result.id).toBe("REAL");
    expect(result.ev).toBe("Purchase");
  });

  it("does not let a wire param named transport clobber the pixel label", () => {
    const url = "https://www.facebook.com/tr/?id=1&ev=X&transport=spoofed&cd[transport]=spoofed2";
    const result = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    expect(result.transport).toBe("pixel");
  });

  it("keeps capi labels and the top-level access_token authoritative over wire fields", () => {
    const url = "https://graph.facebook.com/v18.0/123/events";
    const body = JSON.stringify({
      data: [{ event_name: "X", transport: "spoofed", eventIndex: 999, access_token: "EVENT_TOKEN" }],
      access_token: "TOP_TOKEN",
    });
    const result = sandbox(wrap(url, body), { showRaw: false }) as { fanOut: Array<Record<string, unknown>> };
    expect(result.fanOut[0].transport).toBe("capi");
    expect(result.fanOut[0].eventIndex).toBe(0);
    expect(result.fanOut[0].access_token).toBe("TOP_TOKEN");
  });

  it("treats a graph URL inside a /tr param as a pixel hit, not a CAPI call", () => {
    // The CAPI detector is scheme-anchored, so an unencoded graph URL appearing in
    // a param value must NOT divert the pixel beacon into the JSON branch.
    const url = "https://www.facebook.com/tr/?id=123&ev=PageView&dl=graph.facebook.com/v1/1/events";
    const result = sandbox(wrap(url), { showRaw: false }) as Record<string, unknown>;
    expect(result.transport).toBe("pixel");
    expect(result.id).toBe("123");
  });

  it("surfaces a non-object CAPI data item under value instead of a phantom row", () => {
    const url = "https://graph.facebook.com/v18.0/123/events";
    const body = JSON.stringify({ data: [42], access_token: "T" });
    const result = sandbox(wrap(url, body), { showRaw: false }) as { fanOut: Array<Record<string, unknown>> };
    expect(result.fanOut).toHaveLength(1);
    expect(result.fanOut[0].value).toBe(42);
    expect(result.fanOut[0].transport).toBe("capi");
  });
});

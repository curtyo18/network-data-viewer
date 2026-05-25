import { describe, it, expect } from "vitest";
import { CapturedEventSchema, AnalyserConfigSchema } from "@/shared/schema";

describe("schema", () => {
  it("validates a minimal captured event", () => {
    const ev = {
      id: "00000000-0000-0000-0000-000000000000",
      ts: 1000,
      source: "fetch",
      method: "GET",
      url: "https://example.com",
      reqHeaders: {},
      reqBody: null,
      resStatus: 200,
      resHeaders: {},
      resBody: null
    };
    expect(() => CapturedEventSchema.parse(ev)).not.toThrow();
  });

  it("rejects an analyser config missing urlPattern", () => {
    const cfg = { id: "x", name: "n", enabled: true, source: "reqBody", dsl: [], createdAt: 0 };
    expect(() => AnalyserConfigSchema.parse(cfg)).toThrow();
  });
});

import { describe, it, expect } from "vitest";
import { CapturedEventSchema, AnalyserConfigSchema, AnalyserConfigArraySchema } from "@/shared/schema";

const baseEvent = {
  id: "00000000-0000-0000-0000-000000000000",
  ts: 1000,
  source: "fetch" as const,
  method: "GET",
  url: "https://example.com",
  reqHeaders: {},
  reqBody: null,
  resStatus: 200,
  resHeaders: {},
  resBody: null
};

const baseConfig = {
  id: "c1",
  name: "n",
  enabled: true,
  urlPattern: "example",
  source: "reqBody" as const,
  dsl: [],
  createdAt: 0
};

describe("CapturedEventSchema", () => {
  it("validates a minimal captured event", () => {
    expect(() => CapturedEventSchema.parse(baseEvent)).not.toThrow();
  });

  it("accepts optional originTab and truncated when present", () => {
    expect(() => CapturedEventSchema.parse({ ...baseEvent, originTab: { tabId: 5, url: "https://x.com" }, truncated: true })).not.toThrow();
  });

  it("accepts an event with optional fields omitted", () => {
    expect(() => CapturedEventSchema.parse(baseEvent)).not.toThrow();
  });

  it("accepts reqBodyEncoding: \"base64\"", () => {
    expect(() => CapturedEventSchema.parse({ ...baseEvent, reqBodyEncoding: "base64" })).not.toThrow();
  });

  it("rejects reqBodyEncoding: \"invalid\"", () => {
    expect(() => CapturedEventSchema.parse({ ...baseEvent, reqBodyEncoding: "invalid" })).toThrow();
  });
});

describe("AnalyserConfigSchema", () => {
  it("rejects an analyser config missing urlPattern", () => {
    const { urlPattern: _, ...rest } = baseConfig;
    expect(() => AnalyserConfigSchema.parse(rest)).toThrow();
  });

  it("accepts a jsonpath DSL step with path field", () => {
    const cfg = { ...baseConfig, dsl: [{ op: "jsonpath", path: "$.user.id" }] };
    expect(() => AnalyserConfigSchema.parse(cfg)).not.toThrow();
  });

  it("accepts a pluck DSL step with keys array", () => {
    const cfg = { ...baseConfig, dsl: [{ op: "pluck", keys: ["a", "b.c"] }] };
    expect(() => AnalyserConfigSchema.parse(cfg)).not.toThrow();
  });

  it("accepts a regex-extract step with optional group", () => {
    const cfg = { ...baseConfig, dsl: [{ op: "regex-extract", pattern: "id=(\\d+)", group: 1 }] };
    expect(() => AnalyserConfigSchema.parse(cfg)).not.toThrow();
  });

  it("rejects a jsonpath step missing the path field", () => {
    const cfg = { ...baseConfig, dsl: [{ op: "jsonpath" }] };
    expect(() => AnalyserConfigSchema.parse(cfg)).toThrow();
  });
});

describe("AnalyserConfigArraySchema", () => {
  it("accepts an empty array", () => {
    expect(() => AnalyserConfigArraySchema.parse([])).not.toThrow();
  });

  it("accepts an array with one config", () => {
    expect(() => AnalyserConfigArraySchema.parse([baseConfig])).not.toThrow();
  });
});

describe("AnalyserConfigSchema seedVersion", () => {
  it("accepts a non-negative integer seedVersion", () => {
    expect(() =>
      AnalyserConfigSchema.parse({
        id: "1", name: "n", enabled: true, urlPattern: "x", source: "url",
        dsl: [], createdAt: 0, seedVersion: 2,
      })
    ).not.toThrow();
  });

  it("accepts a config with no seedVersion (back-compat)", () => {
    expect(() =>
      AnalyserConfigSchema.parse({
        id: "1", name: "n", enabled: true, urlPattern: "x", source: "url",
        dsl: [], createdAt: 0,
      })
    ).not.toThrow();
  });

  it("rejects a negative seedVersion", () => {
    expect(() =>
      AnalyserConfigSchema.parse({
        id: "1", name: "n", enabled: true, urlPattern: "x", source: "url",
        dsl: [], createdAt: 0, seedVersion: -1,
      })
    ).toThrow();
  });

  it("accepts seedVersion: 0", () => {
    expect(() =>
      AnalyserConfigSchema.parse({
        id: "1", name: "n", enabled: true, urlPattern: "x", source: "url",
        dsl: [], createdAt: 0, seedVersion: 0,
      })
    ).not.toThrow();
  });

  it("rejects a non-integer seedVersion", () => {
    expect(() =>
      AnalyserConfigSchema.parse({
        id: "1", name: "n", enabled: true, urlPattern: "x", source: "url",
        dsl: [], createdAt: 0, seedVersion: 1.5,
      })
    ).toThrow();
  });
});

import { describe, it, expect } from "vitest";
import { encodeConfig, decodeConfig } from "@/shared/share";
import type { AnalyserConfig } from "@/shared/types";

const fixture: AnalyserConfig[] = [{
  id: "a", name: "GA4", enabled: true, urlPattern: "google-analytics",
  dsl: [{ op: "query-parse" }], createdAt: 0
}];

describe("share roundtrip", () => {
  it("encodes with dvw:2: prefix", () => {
    const s = encodeConfig(fixture);
    expect(s.startsWith("dvw:2:")).toBe(true);
  });
  it("decodes back to the original", () => {
    expect(decodeConfig(encodeConfig(fixture))).toEqual(fixture);
  });
  it("rejects unknown version", () => {
    expect(() => decodeConfig("dvw:99:abc")).toThrow(/unsupported config version: 99/);
  });
  it("rejects garbled payload", () => {
    expect(() => decodeConfig("dvw:2:###not-lz###")).toThrow();
  });
  it("rejects string not starting with dvw:", () => {
    expect(() => decodeConfig("not-a-dataviewer-string")).toThrow("not a dataviewer config string");
  });
  it("rejects string not starting with dvw: (another variant)", () => {
    expect(() => decodeConfig("hello:world")).toThrow("not a dataviewer config string");
  });
  it("unknown version error includes the version number", () => {
    expect(() => decodeConfig("dvw:42:abc")).toThrow("42");
  });
});

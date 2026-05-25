import { describe, it, expect } from "vitest";
import { jsonParse } from "@/shared/dsl/ops/json-parse";

describe("json-parse", () => {
  it("parses a JSON string", () => {
    expect(jsonParse('{"a":1}')).toEqual({ a: 1 });
  });
  it("throws on invalid JSON", () => {
    expect(() => jsonParse("{not json}")).toThrow();
  });
});

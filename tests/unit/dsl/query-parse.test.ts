import { describe, it, expect } from "vitest";
import { queryParse } from "@/shared/dsl/ops/query-parse";

describe("query-parse", () => {
  it("extracts query from full URL", () => {
    expect(queryParse("https://x.com/p?a=1&b=2")).toEqual({ a: "1", b: "2" });
  });
  it("handles bare query string", () => {
    expect(queryParse("a=1&b=2")).toEqual({ a: "1", b: "2" });
  });
  it("returns empty object when no query", () => {
    expect(queryParse("https://x.com/p")).toEqual({});
  });
});

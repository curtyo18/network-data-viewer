import { describe, it, expect } from "vitest";
import { jsonpath } from "@/shared/dsl/ops/jsonpath";

describe("jsonpath", () => {
  it("returns the root for $", () => {
    expect(jsonpath({ a: 1 }, "$")).toEqual({ a: 1 });
  });
  it("extracts a nested key", () => {
    expect(jsonpath({ a: { b: { c: 7 } } }, "$.a.b.c")).toBe(7);
  });
  it("returns undefined on missing path", () => {
    expect(jsonpath({ a: 1 }, "$.b")).toBeUndefined();
  });
  it("indexes into arrays", () => {
    expect(jsonpath({ xs: [10, 20, 30] }, "$.xs[1]")).toBe(20);
  });
});

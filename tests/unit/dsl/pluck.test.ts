import { describe, it, expect } from "vitest";
import { pluck } from "@/shared/dsl/ops/pluck";

describe("pluck", () => {
  it("picks top-level keys", () => {
    expect(pluck({ a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });
  it("picks dotted nested keys", () => {
    expect(pluck({ x: { y: 7 } }, ["x.y"])).toEqual({ "x.y": 7 });
  });
  it("returns undefined for missing keys", () => {
    expect(pluck({ a: 1 }, ["a", "b"])).toEqual({ a: 1, b: undefined });
  });
});

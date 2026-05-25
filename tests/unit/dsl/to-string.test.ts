import { describe, it, expect } from "vitest";
import { toString } from "@/shared/dsl/ops/to-string";

describe("to-string", () => {
  it("stringifies an object via JSON.stringify", () => {
    expect(toString({ a: 1 })).toBe('{"a":1}');
  });
  it("returns strings unchanged", () => {
    expect(toString("hello")).toBe("hello");
  });
  it("stringifies numbers, booleans, null", () => {
    expect(toString(42)).toBe("42");
    expect(toString(true)).toBe("true");
    expect(toString(null)).toBe("null");
  });
});

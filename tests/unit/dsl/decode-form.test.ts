import { describe, it, expect } from "vitest";
import { decodeForm } from "@/shared/dsl/ops/decode-form";

describe("decode-form", () => {
  it("parses a=1&b=2", () => {
    expect(decodeForm("a=1&b=2")).toEqual({ a: "1", b: "2" });
  });
  it("URL-decodes values", () => {
    expect(decodeForm("q=hello%20world")).toEqual({ q: "hello world" });
  });
  it("collapses repeats by last-wins", () => {
    expect(decodeForm("a=1&a=2")).toEqual({ a: "2" });
  });
});

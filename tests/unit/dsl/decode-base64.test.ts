import { describe, it, expect } from "vitest";
import { decodeBase64 } from "@/shared/dsl/ops/decode-base64";

describe("decode-base64", () => {
  it("decodes a base64 string to UTF-8", () => {
    expect(decodeBase64("aGVsbG8=")).toBe("hello");
  });
  it("throws on invalid base64", () => {
    expect(() => decodeBase64("!!!")).toThrow();
  });
});

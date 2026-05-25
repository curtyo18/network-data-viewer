import { describe, it, expect } from "vitest";
import { decodeUri } from "@/shared/dsl/ops/decode-uri";

describe("decode-uri", () => {
  it("decodes a URI-encoded string", () => {
    expect(decodeUri("hello%20world")).toBe("hello world");
  });
  it("throws on non-string input", () => {
    expect(() => decodeUri(123 as unknown as string)).toThrow();
  });
});

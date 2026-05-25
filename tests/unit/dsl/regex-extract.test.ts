import { describe, it, expect } from "vitest";
import { regexExtract } from "@/shared/dsl/ops/regex-extract";

describe("regex-extract", () => {
  it("returns full match when group is 0 or omitted", () => {
    expect(regexExtract("user_12345_logged_in", "user_\\d+", 0)).toBe("user_12345");
    expect(regexExtract("user_12345_logged_in", "user_\\d+")).toBe("user_12345");
  });
  it("returns capture group when group >= 1", () => {
    expect(regexExtract("id=42", "id=(\\d+)", 1)).toBe("42");
  });
  it("returns null on no match", () => {
    expect(regexExtract("nope", "id=(\\d+)", 1)).toBe(null);
  });
});

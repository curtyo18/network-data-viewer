import { describe, it, expect } from "vitest";
import { gunzip } from "@/shared/dsl/ops/gunzip";
import { gzipSync } from "node:zlib";

describe("gunzip", () => {
  it("decompresses gzip-compressed string", async () => {
    const compressed = gzipSync(Buffer.from("hello", "utf-8"));
    const b64 = compressed.toString("base64");
    const out = await gunzip(b64);
    expect(out).toBe("hello");
  });
});

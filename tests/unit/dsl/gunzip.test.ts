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

  it("decompresses a larger payload across multiple stream chunks", async () => {
    const payload = "x".repeat(200_000);
    const b64 = gzipSync(Buffer.from(payload, "utf-8")).toString("base64");
    expect(await gunzip(b64)).toBe(payload);
  });

  it("throws an op-namespaced error on invalid base64", async () => {
    await expect(gunzip("!!!not base64!!!")).rejects.toThrow(/gunzip: invalid base64/);
  });

  it("throws an op-namespaced error when input is not gzip", async () => {
    const notGzip = Buffer.from("plain text, not gzip").toString("base64");
    await expect(gunzip(notGzip)).rejects.toThrow(/gunzip: decompression failed/);
  });
});

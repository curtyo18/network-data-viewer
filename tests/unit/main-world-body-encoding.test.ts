import { describe, it, expect } from "vitest";
import { encodeBody } from "@/content/encode-body";

// Helper: decode a base64 string back to the original bytes
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

describe("encodeBody", () => {
  it("returns null/text for null", async () => {
    const r = await encodeBody(null);
    expect(r.body).toBeNull();
    expect(r.encoding).toBe("text");
  });

  it("returns null/text for undefined", async () => {
    const r = await encodeBody(undefined);
    expect(r.body).toBeNull();
    expect(r.encoding).toBe("text");
  });

  it("returns the string as-is with text encoding", async () => {
    const r = await encodeBody("hello world");
    expect(r.body).toBe("hello world");
    expect(r.encoding).toBe("text");
  });

  it("encodes a Blob as base64 and round-trips correctly", async () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    const blob = new Blob([bytes]);
    const r = await encodeBody(blob);
    expect(r.encoding).toBe("base64");
    expect(r.body).toBeTruthy();
    const decoded = base64ToBytes(r.body as string);
    expect(decoded).toEqual(bytes);
  });

  it("encodes a Uint8Array as base64", async () => {
    const bytes = new Uint8Array([1, 2, 3, 255]);
    const r = await encodeBody(bytes);
    expect(r.encoding).toBe("base64");
    const decoded = base64ToBytes(r.body as string);
    expect(decoded).toEqual(bytes);
  });

  it("encodes an ArrayBuffer as base64", async () => {
    const bytes = new Uint8Array([10, 20, 30, 40]);
    const ab = bytes.buffer;
    const r = await encodeBody(ab);
    expect(r.encoding).toBe("base64");
    const decoded = base64ToBytes(r.body as string);
    expect(decoded).toEqual(bytes);
  });

  it("serialises FormData as url-encoded text", async () => {
    const fd = new FormData();
    fd.append("foo", "bar");
    fd.append("hello", "world 42");
    const r = await encodeBody(fd);
    expect(r.encoding).toBe("text");
    expect(r.body).toContain("foo=bar");
    expect(r.body).toContain("hello=world%2042");
  });

  it("serialises URLSearchParams via toString", async () => {
    const usp = new URLSearchParams("a=1&b=2");
    const r = await encodeBody(usp);
    expect(r.encoding).toBe("text");
    expect(r.body).toBe("a=1&b=2");
  });

  it("falls back to [non-string body] / text for an unknown type", async () => {
    const r = await encodeBody(Symbol("x") as unknown);
    expect(r.body).toBe("[non-string body]");
    expect(r.encoding).toBe("text");
  });

  it("truncates an ArrayBuffer larger than maxBytes", async () => {
    const ab = new ArrayBuffer(64);
    const r = await encodeBody(ab, 16);
    expect(r.body).toBe("[body truncated]");
    expect(r.encoding).toBe("text");
  });

  it("truncates a Blob larger than maxBytes", async () => {
    const bytes = new Uint8Array(64).fill(7);
    const blob = new Blob([bytes]);
    const r = await encodeBody(blob, 16);
    expect(r.body).toBe("[body truncated]");
    expect(r.encoding).toBe("text");
  });

  it("truncates a Uint8Array larger than maxBytes", async () => {
    const bytes = new Uint8Array(64).fill(3);
    const r = await encodeBody(bytes, 16);
    expect(r.body).toBe("[body truncated]");
    expect(r.encoding).toBe("text");
  });

  it.skipIf(typeof ReadableStream === "undefined")(
    "encodes a ReadableStream emitting known bytes as base64",
    async () => {
      // Build a stream that emits two chunks
      const chunk1 = new Uint8Array([1, 2, 3]);
      const chunk2 = new Uint8Array([4, 5, 6]);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk1);
          controller.enqueue(chunk2);
          controller.close();
        },
      });
      const r = await encodeBody(stream);
      expect(r.encoding).toBe("base64");
      const decoded = base64ToBytes(r.body as string);
      expect(decoded).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
    },
  );
});

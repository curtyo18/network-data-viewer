export function decodeBase64(input: unknown): string {
  if (typeof input !== "string") throw new Error("decode-base64 expects string input");
  try {
    const bin = atob(input);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    throw new Error("decode-base64: invalid input");
  }
}

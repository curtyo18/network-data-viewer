export function decodeUri(input: unknown): string {
  if (typeof input !== "string") throw new Error("decode-uri expects string input");
  return decodeURIComponent(input);
}

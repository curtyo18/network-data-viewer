export async function gunzip(input: unknown): Promise<string> {
  if (typeof input !== "string") throw new Error("gunzip expects base64 string input");
  const bin = atob(input);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  const stream = new Response(bytes).body!.pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

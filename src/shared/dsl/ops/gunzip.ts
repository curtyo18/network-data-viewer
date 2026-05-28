// Cap on decompressed output. gunzip runs in the service worker on captured
// (untrusted) bodies, so an unbounded read would let a tiny "gzip bomb" expand
// to gigabytes and OOM the worker. We stream-decode and abort past this budget.
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

export async function gunzip(input: unknown): Promise<string> {
  if (typeof input !== "string") throw new Error("gunzip expects base64 string input");
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    const bin = atob(input);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch (e) {
    throw new Error("gunzip: invalid base64 input", { cause: e });
  }
  const body = new Response(bytes).body;
  if (!body) throw new Error("gunzip: could not read input stream");

  const reader = body.pipeThrough(new DecompressionStream("gzip")).getReader();
  const decoder = new TextDecoder();
  let out = "";
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_OUTPUT_BYTES) {
        await reader.cancel();
        throw new Error(`gunzip: decompressed output exceeds ${MAX_OUTPUT_BYTES} bytes (possible decompression bomb)`);
      }
      out += decoder.decode(value, { stream: true });
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("gunzip:")) throw e;
    throw new Error("gunzip: decompression failed", { cause: e });
  }
  return out + decoder.decode();
}

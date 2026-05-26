/**
 * Encodes a request body to a string suitable for capture.
 *
 * Returns { body: string | null, encoding: "text" | "base64" }.
 * Callers should honour the 5 MB cap (MAX_BODY) before calling this helper
 * — or pass it as maxBytes so large blobs are truncated rather than read.
 */

export type EncodeBodyResult = {
  body: string | null;
  encoding: "text" | "base64";
};

const MAX_BODY = 5 * 1024 * 1024;

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function encodeBody(
  body: unknown,
  maxBytes = MAX_BODY,
): Promise<EncodeBodyResult> {
  // null / undefined
  if (body === null || body === undefined) {
    return { body: null, encoding: "text" };
  }

  // plain string
  if (typeof body === "string") {
    return { body, encoding: "text" };
  }

  // URLSearchParams
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return { body: body.toString(), encoding: "text" };
  }

  // FormData
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const parts: string[] = [];
    body.forEach((value, key) => {
      if (typeof File !== "undefined" && value instanceof File) {
        parts.push(`${encodeURIComponent(key)}=[file:${encodeURIComponent(value.name)}:${value.size}]`);
      } else {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`);
      }
    });
    return { body: parts.join("&"), encoding: "text" };
  }

  // ArrayBuffer
  if (body instanceof ArrayBuffer) {
    const bytes = new Uint8Array(body);
    if (bytes.length > maxBytes) {
      return { body: "[body truncated]", encoding: "text" };
    }
    return { body: uint8ToBase64(bytes), encoding: "base64" };
  }

  // Typed array views (ArrayBufferView / DataView)
  if (ArrayBuffer.isView(body)) {
    const view = body as ArrayBufferView;
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    if (bytes.length > maxBytes) {
      return { body: "[body truncated]", encoding: "text" };
    }
    return { body: uint8ToBase64(bytes), encoding: "base64" };
  }

  // Blob / File
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    if (body.size > maxBytes) {
      return { body: "[body truncated]", encoding: "text" };
    }
    const ab = await body.arrayBuffer();
    const bytes = new Uint8Array(ab);
    return { body: uint8ToBase64(bytes), encoding: "base64" };
  }

  // ReadableStream — best-effort drain
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    try {
      const reader = (body as ReadableStream<Uint8Array>).getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.length;
          if (total > maxBytes) {
            reader.releaseLock();
            return { body: "[stream]", encoding: "text" };
          }
          chunks.push(value);
        }
      }
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
      return { body: uint8ToBase64(merged), encoding: "base64" };
    } catch {
      return { body: "[stream]", encoding: "text" };
    }
  }

  // Fallback for unknown types (Document, etc.)
  return { body: "[non-string body]", encoding: "text" };
}

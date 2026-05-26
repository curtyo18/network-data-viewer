export default function sandbox(input: unknown, _settings: unknown): unknown {
  if (input && typeof input === "object" && "payload" in input) {
    try {
      const decoded = atob((input as { payload: string }).payload);
      return { decoded, meta: (input as { meta?: unknown }).meta };
    } catch {
      return { error: "base64 decode failed", raw: input };
    }
  }
  return input;
}

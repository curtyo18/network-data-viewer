export default function sandbox(input: unknown, _settings: unknown): unknown {
  if (typeof input !== "string") return null;
  return { fanOut: [input] };
}

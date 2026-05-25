export function toString(input: unknown): string {
  if (typeof input === "string") return input;
  return JSON.stringify(input);
}

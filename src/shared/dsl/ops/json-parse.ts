export function jsonParse(input: unknown): unknown {
  if (typeof input !== "string") throw new Error("json-parse expects string input");
  return JSON.parse(input);
}

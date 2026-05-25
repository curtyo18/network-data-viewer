import LZString from "lz-string";
import { AnalyserConfigArraySchema } from "@/shared/schema";
import type { AnalyserConfig } from "@/shared/types";

const PREFIX = "dvw:1:";

export function decodeConfig(s: string): AnalyserConfig[] {
  if (!s.startsWith("dvw:")) throw new Error("not a dataviewer config string");
  const versionMatch = /^dvw:(\d+):/.exec(s);
  if (!versionMatch) throw new Error("malformed prefix");
  const version = Number(versionMatch[1]);
  if (version !== 1) throw new Error(`unsupported config version: ${version}`);
  const payload = s.slice(PREFIX.length);
  const json = LZString.decompressFromEncodedURIComponent(payload);
  if (!json) throw new Error("could not decompress config string");
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error("decompressed payload is not JSON"); }
  return AnalyserConfigArraySchema.parse(parsed);
}

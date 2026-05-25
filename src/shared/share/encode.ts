import LZString from "lz-string";
import type { AnalyserConfig } from "@/shared/types";

export function encodeConfig(configs: AnalyserConfig[]): string {
  const json = JSON.stringify(configs);
  const compressed = LZString.compressToEncodedURIComponent(json);
  return `dvw:1:${compressed}`;
}

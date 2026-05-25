import LZString from "lz-string";
import type { AnalyserConfig } from "@/shared/types";
import { SHARE_PREFIX } from "@/shared/messages";

export function encodeConfig(configs: AnalyserConfig[]): string {
  const json = JSON.stringify(configs);
  const compressed = LZString.compressToEncodedURIComponent(json);
  return `${SHARE_PREFIX}${compressed}`;
}

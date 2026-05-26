import type { DslStep } from "@/shared/types";
import { decodeUri } from "./ops/decode-uri";
import { decodeBase64 } from "./ops/decode-base64";
import { decodeForm } from "./ops/decode-form";
import { gunzip } from "./ops/gunzip";
import { jsonParse } from "./ops/json-parse";
import { queryParse } from "./ops/query-parse";
import { jsonpath } from "./ops/jsonpath";
import { pluck } from "./ops/pluck";
import { regexExtract } from "./ops/regex-extract";
import { toString } from "./ops/to-string";

export type PreviewRow = {
  step: DslStep | "input";
  value: unknown;
  error?: string;
};

export async function runDslWithSteps(
  steps: DslStep[],
  input: unknown,
): Promise<PreviewRow[]> {
  const rows: PreviewRow[] = [{ step: "input", value: input }];
  let cur = input;

  for (const step of steps) {
    try {
      switch (step.op) {
        case "decode-uri": cur = decodeUri(cur); break;
        case "decode-base64": cur = decodeBase64(cur); break;
        case "decode-form": cur = decodeForm(cur); break;
        case "gunzip": cur = await gunzip(cur); break;
        case "json-parse": cur = jsonParse(cur); break;
        case "query-parse": cur = queryParse(cur); break;
        case "jsonpath": cur = jsonpath(cur, step.path); break;
        case "pluck": cur = pluck(cur, step.keys); break;
        case "regex-extract": cur = regexExtract(cur, step.pattern, step.group ?? 0); break;
        case "to-string": cur = toString(cur); break;
        default: { const exhaustive: never = step; void exhaustive; throw new Error(`unknown DSL op: ${(step as { op: string }).op}`); }
      }
      rows.push({ step, value: cur });
    } catch (e) {
      rows.push({ step, value: cur, error: (e as Error).message });
      break;
    }
  }

  return rows;
}

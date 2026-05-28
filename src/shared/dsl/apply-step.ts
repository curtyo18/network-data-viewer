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

// Single source of truth for the op→implementation mapping. Both runDsl (chained
// execution) and runDslWithSteps (per-step preview) dispatch through here so a
// new op only has to be wired up once; the exhaustive `never` default makes a
// missing case a compile error.
export async function applyStep(step: DslStep, cur: unknown): Promise<unknown> {
  switch (step.op) {
    case "decode-uri": return decodeUri(cur);
    case "decode-base64": return decodeBase64(cur);
    case "decode-form": return decodeForm(cur);
    case "gunzip": return await gunzip(cur);
    case "json-parse": return jsonParse(cur);
    case "query-parse": return queryParse(cur);
    case "jsonpath": return jsonpath(cur, step.path);
    case "pluck": return pluck(cur, step.keys);
    case "regex-extract": return regexExtract(cur, step.pattern, step.group ?? 0);
    case "to-string": return toString(cur);
    default: { const exhaustive: never = step; void exhaustive; throw new Error(`unknown DSL op: ${(step as { op: string }).op}`); }
  }
}

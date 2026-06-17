import { z } from "zod";

const CaptureSourceSchema = z.enum(["fetch", "xhr", "beacon", "image", "ws-send", "ws-recv"]);

export const CapturedEventSchema = z.object({
  id: z.string(),
  ts: z.number(),
  source: CaptureSourceSchema,
  method: z.string(),
  url: z.string(),
  reqHeaders: z.record(z.string()),
  reqBody: z.string().nullable(),
  reqBodyEncoding: z.enum(["text", "base64"]).optional(),
  resStatus: z.number().nullable(),
  resHeaders: z.record(z.string()),
  resBody: z.string().nullable(),
  originTab: z.object({ tabId: z.number(), url: z.string() }).optional(),
  truncated: z.boolean().optional()
});

const DslStepSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("decode-uri") }),
  z.object({ op: z.literal("decode-base64") }),
  z.object({ op: z.literal("decode-form") }),
  z.object({ op: z.literal("gunzip") }),
  z.object({ op: z.literal("json-parse") }),
  z.object({ op: z.literal("query-parse") }),
  z.object({ op: z.literal("jsonpath"), path: z.string() }),
  z.object({ op: z.literal("pluck"), keys: z.array(z.string()) }),
  z.object({ op: z.literal("regex-extract"), pattern: z.string(), group: z.number().int().min(0).optional() }),
  z.object({ op: z.literal("to-string") })
]);

export const AnalyserConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  urlPattern: z.string(),
  source: z.enum(["reqBody", "url", "resBody"]).optional(),
  dsl: z.array(DslStepSchema),
  sandboxCode: z.string().optional(),
  seedVersion: z.number().int().nonnegative().optional(),
  createdAt: z.number()
}).strict();

export const AnalyserConfigArraySchema = z.array(AnalyserConfigSchema);

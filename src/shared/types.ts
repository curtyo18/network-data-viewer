export type CaptureSource = "fetch" | "xhr" | "beacon" | "ws-send" | "ws-recv";

export type CapturedEvent = {
  id: string;
  ts: number;
  source: CaptureSource;
  method: string;
  url: string;
  reqHeaders: Record<string, string>;
  reqBody: string | null;
  reqBodyEncoding?: "text" | "base64";
  resStatus: number | null;
  resHeaders: Record<string, string>;
  resBody: string | null;
  originTab?: { tabId: number; url: string };
  truncated?: boolean;
};

export type DslStep =
  | { op: "decode-uri" }
  | { op: "decode-base64" }
  | { op: "decode-form" }
  | { op: "gunzip" }
  | { op: "json-parse" }
  | { op: "query-parse" }
  | { op: "jsonpath"; path: string }
  | { op: "pluck"; keys: string[] }
  | { op: "regex-extract"; pattern: string; group?: number }
  | { op: "to-string" };

export type DslOpName = DslStep["op"];

export type AnalyserConfig = {
  id: string;
  name: string;
  enabled: boolean;
  urlPattern: string;
  dsl: DslStep[];
  sandboxCode?: string;
  seedVersion?: number;
  createdAt: number;
};

// The argument shape every sandbox function receives as its first parameter.
// `body` is the raw request body (null for body-less requests).
// `dslOutput` is the result of running the analyser's DSL chain over the body
// (null when body is null or the DSL chain is empty).
export type SandboxInput = {
  url: string;
  method: string;
  body: string | null;
  dslOutput: unknown;
};

export type AnalyserError = {
  ts: number;
  stage: "dsl" | "sandbox";
  message: string;
};

export type MatchResult = {
  analyserId: string;
  analyserName: string;
  event: CapturedEvent;
  dslOutput: unknown;
  sandboxOutput?: unknown;
  error?: { stage: "dsl" | "sandbox"; message: string };
  latencyMs: number;
};

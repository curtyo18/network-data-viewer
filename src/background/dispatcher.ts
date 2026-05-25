import type { AnalyserConfig, CapturedEvent, MatchResult } from "@/shared/types";
import { runDsl } from "@/shared/dsl";

export type SandboxRunner = (
  analyserId: string, code: string, input: unknown
) => Promise<{ result: unknown } | { error: string }>;

function selectInput(ev: CapturedEvent, source: AnalyserConfig["source"]): unknown {
  switch (source) {
    case "reqBody": return ev.reqBody;
    case "url": return ev.url;
    case "resBody": return ev.resBody;
  }
}

export async function dispatch(
  event: CapturedEvent,
  configs: AnalyserConfig[],
  runSandbox: SandboxRunner
): Promise<MatchResult[]> {
  const out: MatchResult[] = [];
  for (const cfg of configs) {
    if (!cfg.enabled) continue;
    let re: RegExp;
    try { re = new RegExp(cfg.urlPattern); } catch { continue; }
    if (!re.test(event.url)) continue;

    const t0 = performance.now();
    const input = selectInput(event, cfg.source);
    let dslOutput: unknown;
    let dslErr: string | undefined;
    try {
      dslOutput = await runDsl(cfg.dsl, input);
    } catch (e) {
      dslErr = (e as Error).message;
    }

    let sandboxOutput: unknown | undefined;
    let sbErr: string | undefined;
    if (!dslErr && cfg.sandboxCode) {
      const r = await runSandbox(cfg.id, cfg.sandboxCode, dslOutput);
      if ("result" in r) sandboxOutput = r.result;
      else sbErr = r.error;
    }

    const latencyMs = performance.now() - t0;
    const result: MatchResult = {
      analyserId: cfg.id,
      analyserName: cfg.name,
      event,
      dslOutput,
      sandboxOutput,
      latencyMs
    };
    if (dslErr) result.error = { stage: "dsl", message: dslErr };
    else if (sbErr) result.error = { stage: "sandbox", message: sbErr };
    out.push(result);
  }
  return out;
}

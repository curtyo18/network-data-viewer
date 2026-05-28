import type { AnalyserConfig, CapturedEvent, MatchResult, SandboxInput } from "@/shared/types";
import type { Settings } from "@/shared/settings";
import { runDsl } from "@/shared/dsl";

export type SandboxRunner = (
  analyserId: string,
  code: string,
  input: SandboxInput,
  settings: Settings,
) => Promise<{ result: unknown } | { error: string }>;

/** A compiled entry in the config cache — `re` is null when urlPattern is invalid. */
export interface CompiledConfig {
  cfg: AnalyserConfig;
  re: RegExp | null;
}

/** Compile a list of raw AnalyserConfigs into the cache shape used by dispatch. */
export function compileConfigs(configs: AnalyserConfig[]): CompiledConfig[] {
  return configs.map(cfg => {
    let re: RegExp | null = null;
    try { re = new RegExp(cfg.urlPattern); } catch { /* invalid pattern — re stays null */ }
    return { cfg, re };
  });
}

export async function dispatch(
  event: CapturedEvent,
  configs: CompiledConfig[],
  settings: Settings,
  runSandbox: SandboxRunner,
): Promise<MatchResult[]> {
  const out: MatchResult[] = [];
  for (const { cfg, re } of configs) {
    if (!cfg.enabled) continue;
    if (re === null || !re.test(event.url)) continue;

    const t0 = performance.now();
    let dslOutput: unknown = null;
    let dslErr: string | undefined;
    if (event.reqBody !== null && cfg.dsl.length > 0) {
      try {
        dslOutput = await runDsl(cfg.dsl, event.reqBody);
      } catch (e) {
        dslErr = (e as Error).message;
      }
    }

    const sandboxInput: SandboxInput = {
      url: event.url,
      method: event.method,
      body: event.reqBody,
      bodyEncoding: event.reqBodyEncoding ?? "text",
      dslOutput,
    };

    let sandboxOutput: unknown | undefined;
    let sbErr: string | undefined;
    if (!dslErr && cfg.sandboxCode) {
      const r = await runSandbox(cfg.id, cfg.sandboxCode, sandboxInput, settings);
      if ("result" in r) sandboxOutput = r.result;
      else sbErr = r.error;
    }

    const latencyMs = performance.now() - t0;
    const base: Omit<MatchResult, "sandboxOutput"> = {
      analyserId: cfg.id,
      analyserName: cfg.name,
      event,
      dslOutput,
      latencyMs,
    };

    if (dslErr) {
      out.push({ ...base, sandboxOutput: undefined, error: { stage: "dsl", message: dslErr } });
      continue;
    }
    if (sbErr) {
      out.push({ ...base, sandboxOutput: undefined, error: { stage: "sandbox", message: sbErr } });
      continue;
    }
    if (isFanOut(sandboxOutput)) {
      for (const row of sandboxOutput.fanOut) {
        out.push({ ...base, sandboxOutput: row });
      }
    } else {
      out.push({ ...base, sandboxOutput });
    }
  }
  return out;
}

function isFanOut(v: unknown): v is { fanOut: unknown[] } {
  return (
    !!v &&
    typeof v === "object" &&
    "fanOut" in v &&
    Array.isArray((v as { fanOut: unknown }).fanOut)
  );
}

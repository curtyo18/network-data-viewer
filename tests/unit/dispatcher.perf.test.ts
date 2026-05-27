import { describe, it, expect, vi } from "vitest";
import { dispatch, compileConfigs } from "@/background/dispatcher";
import { DEFAULT_SETTINGS } from "@/shared/settings";
import type { AnalyserConfig, CapturedEvent } from "@/shared/types";

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

describe("dispatcher performance budget", () => {
  it("median dispatch with 10 analysers stays under 5ms", async () => {
    const configs: AnalyserConfig[] = Array.from({ length: 10 }, (_, i) => ({
      id: `a${i}`,
      name: `Analyser ${i}`,
      enabled: true,
      urlPattern: i === 0 ? "google-analytics\\.com" : `not-this-${i}\\.com`,
      dsl: [{ op: "query-parse" }, { op: "pluck", keys: ["v", "tid", "cid"] }],
      createdAt: 0,
    }));
    const compiled = compileConfigs(configs);
    const event: CapturedEvent = {
      id: "e",
      ts: 0,
      source: "fetch",
      method: "POST",
      url: "https://www.google-analytics.com/g/collect?v=2&tid=G-X&cid=abc",
      reqHeaders: {},
      reqBody: null,
      resStatus: 200,
      resHeaders: {},
      resBody: null,
    };
    const runSandbox = vi.fn(async () => ({ result: undefined as unknown }));

    const N = 500;
    const timings: number[] = [];
    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      await dispatch(event, compiled, DEFAULT_SETTINGS, runSandbox);
      timings.push(performance.now() - t0);
    }
    const med = median(timings);
    console.log(`[perf] median=${med.toFixed(3)}ms over ${N} dispatches`);
    expect(med).toBeLessThan(5);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch } from "@/background/dispatcher";
import type { AnalyserConfig, CapturedEvent } from "@/shared/types";

const makeEvent = (over: Partial<CapturedEvent> = {}): CapturedEvent => ({
  id: "e1", ts: 1, source: "fetch", method: "POST",
  url: "https://x.com/a", reqHeaders: {}, reqBody: '{"a":1}',
  resStatus: 200, resHeaders: {}, resBody: null, ...over
});

const cfg = (over: Partial<AnalyserConfig>): AnalyserConfig => ({
  id: "c1", name: "C", enabled: true, urlPattern: "x\\.com", source: "reqBody",
  dsl: [{ op: "json-parse" }], createdAt: 0, ...over
});

let noSandbox: ReturnType<typeof vi.fn>;

beforeEach(() => {
  noSandbox = vi.fn(async () => ({ result: undefined as unknown }));
});

describe("dispatch", () => {
  it("returns [] when no analyser matches", async () => {
    const res = await dispatch(makeEvent({ url: "https://other.com" }), [cfg({})], noSandbox);
    expect(res).toEqual([]);
  });

  it("runs DSL chain on reqBody for matching analyser", async () => {
    const res = await dispatch(makeEvent(), [cfg({})], noSandbox);
    expect(res).toHaveLength(1);
    expect(res[0].dslOutput).toEqual({ a: 1 });
    expect(res[0].error).toBeUndefined();
  });

  it("reports DSL error in MatchResult", async () => {
    const res = await dispatch(makeEvent({ reqBody: "not json" }), [cfg({})], noSandbox);
    expect(res).toHaveLength(1);
    expect(res[0].error?.stage).toBe("dsl");
  });

  it("invokes sandbox when sandboxCode present", async () => {
    const sandbox = vi.fn(async () => ({ result: { transformed: true } }));
    const c = cfg({ sandboxCode: "return { transformed: true };" });
    const res = await dispatch(makeEvent(), [c], sandbox);
    expect(sandbox).toHaveBeenCalledOnce();
    expect(res[0].sandboxOutput).toEqual({ transformed: true });
  });

  it("returns sandbox timeout error", async () => {
    const sandbox = vi.fn(async () => ({ error: "timeout" }));
    const c = cfg({ sandboxCode: "..." });
    const res = await dispatch(makeEvent(), [c], sandbox);
    expect(res[0].error?.stage).toBe("sandbox");
  });

  it("skips disabled analysers", async () => {
    const c = cfg({ enabled: false });
    const res = await dispatch(makeEvent(), [c], noSandbox);
    expect(res).toEqual([]);
  });

  it("uses url as DSL input when source is 'url'", async () => {
    const c = cfg({ source: "url", dsl: [{ op: "query-parse" }] });
    const res = await dispatch(makeEvent({ url: "https://x.com/a?k=v" }), [c], noSandbox);
    expect(res[0].dslOutput).toEqual({ k: "v" });
  });
});

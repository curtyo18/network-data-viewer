import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch } from "@/background/dispatcher";
import type { AnalyserConfig, CapturedEvent } from "@/shared/types";
import { DEFAULT_SETTINGS, type Settings } from "@/shared/settings";

const SETTINGS: Settings = { ...DEFAULT_SETTINGS };

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
  noSandbox = vi.fn(async (_id, _code, _input, _settings) => ({ result: undefined as unknown }));
});

describe("dispatch", () => {
  it("returns [] when no analyser matches", async () => {
    const res = await dispatch(makeEvent({ url: "https://other.com" }), [cfg({})], SETTINGS, noSandbox);
    expect(res).toEqual([]);
  });

  it("runs DSL chain on reqBody for matching analyser", async () => {
    const res = await dispatch(makeEvent(), [cfg({})], SETTINGS, noSandbox);
    expect(res).toHaveLength(1);
    expect(res[0].dslOutput).toEqual({ a: 1 });
    expect(res[0].error).toBeUndefined();
  });

  it("reports DSL error in MatchResult", async () => {
    const res = await dispatch(makeEvent({ reqBody: "not json" }), [cfg({})], SETTINGS, noSandbox);
    expect(res).toHaveLength(1);
    expect(res[0].error?.stage).toBe("dsl");
  });

  it("invokes sandbox when sandboxCode present", async () => {
    const sandbox = vi.fn(async () => ({ result: { transformed: true } }));
    const c = cfg({ sandboxCode: "return { transformed: true };" });
    const res = await dispatch(makeEvent(), [c], SETTINGS, sandbox);
    expect(sandbox).toHaveBeenCalledOnce();
    expect(res[0].sandboxOutput).toEqual({ transformed: true });
  });

  it("returns sandbox timeout error", async () => {
    const sandbox = vi.fn(async () => ({ error: "timeout" }));
    const c = cfg({ sandboxCode: "..." });
    const res = await dispatch(makeEvent(), [c], SETTINGS, sandbox);
    expect(res[0].error?.stage).toBe("sandbox");
  });

  it("skips disabled analysers", async () => {
    const c = cfg({ enabled: false });
    const res = await dispatch(makeEvent(), [c], SETTINGS, noSandbox);
    expect(res).toEqual([]);
  });

  it("uses url as DSL input when source is 'url'", async () => {
    const c = cfg({ source: "url", dsl: [{ op: "query-parse" }] });
    const res = await dispatch(makeEvent({ url: "https://x.com/a?k=v" }), [c], SETTINGS, noSandbox);
    expect(res[0].dslOutput).toEqual({ k: "v" });
  });

  it("passes settings to the sandbox runner", async () => {
    const sandbox = vi.fn(async () => ({ result: 1 }));
    const c = cfg({ sandboxCode: "return 1;" });
    const customSettings: Settings = { showRaw: true };
    await dispatch(makeEvent(), [c], customSettings, sandbox);
    expect(sandbox).toHaveBeenCalledWith(c.id, c.sandboxCode, { a: 1 }, customSettings);
  });
});

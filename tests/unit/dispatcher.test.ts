import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch, compileConfigs } from "@/background/dispatcher";
import type { AnalyserConfig, CapturedEvent } from "@/shared/types";
import { DEFAULT_SETTINGS, type Settings } from "@/shared/settings";

const SETTINGS: Settings = { ...DEFAULT_SETTINGS };

const makeEvent = (over: Partial<CapturedEvent> = {}): CapturedEvent => ({
  id: "e1", ts: 1, source: "fetch", method: "POST",
  url: "https://x.com/a", reqHeaders: {}, reqBody: '{"a":1}',
  resStatus: 200, resHeaders: {}, resBody: null, ...over
});

const cfg = (over: Partial<AnalyserConfig>): AnalyserConfig => ({
  id: "c1", name: "C", enabled: true, urlPattern: "x\\.com",
  dsl: [{ op: "json-parse" }], createdAt: 0, ...over
});

let noSandbox: ReturnType<typeof vi.fn>;

beforeEach(() => {
  noSandbox = vi.fn(async (_id, _code, _input, _settings) => ({ result: undefined as unknown }));
});

describe("dispatch", () => {
  it("returns [] when no analyser matches", async () => {
    const res = await dispatch(makeEvent({ url: "https://other.com" }), compileConfigs([cfg({})]), SETTINGS, noSandbox);
    expect(res).toEqual([]);
  });

  it("runs DSL chain on body for matching analyser", async () => {
    const res = await dispatch(makeEvent(), compileConfigs([cfg({})]), SETTINGS, noSandbox);
    expect(res).toHaveLength(1);
    expect(res[0].dslOutput).toEqual({ a: 1 });
    expect(res[0].error).toBeUndefined();
  });

  it("reports DSL error in MatchResult", async () => {
    const res = await dispatch(makeEvent({ reqBody: "not json" }), compileConfigs([cfg({})]), SETTINGS, noSandbox);
    expect(res).toHaveLength(1);
    expect(res[0].error?.stage).toBe("dsl");
  });

  it("invokes sandbox when sandboxCode present", async () => {
    const sandbox = vi.fn(async () => ({ result: { transformed: true } }));
    const c = cfg({ sandboxCode: "return { transformed: true };" });
    const res = await dispatch(makeEvent(), compileConfigs([c]), SETTINGS, sandbox);
    expect(sandbox).toHaveBeenCalledOnce();
    expect(res[0].sandboxOutput).toEqual({ transformed: true });
  });

  it("returns sandbox timeout error", async () => {
    const sandbox = vi.fn(async () => ({ error: "timeout" }));
    const c = cfg({ sandboxCode: "..." });
    const res = await dispatch(makeEvent(), compileConfigs([c]), SETTINGS, sandbox);
    expect(res[0].error?.stage).toBe("sandbox");
  });

  it("skips disabled analysers", async () => {
    const c = cfg({ enabled: false });
    const res = await dispatch(makeEvent(), compileConfigs([c]), SETTINGS, noSandbox);
    expect(res).toEqual([]);
  });

  it("passes SandboxInput and settings to the sandbox runner", async () => {
    const sandbox = vi.fn(async () => ({ result: 1 }));
    const c = cfg({ sandboxCode: "return 1;" });
    const customSettings: Settings = { showRaw: true };
    const ev = makeEvent();
    await dispatch(ev, compileConfigs([c]), customSettings, sandbox);
    expect(sandbox).toHaveBeenCalledWith(
      c.id,
      c.sandboxCode,
      { url: ev.url, method: ev.method, body: ev.reqBody, bodyEncoding: "text", dslOutput: { a: 1 } },
      customSettings,
    );
  });

  it("passes body: null and dslOutput: null when reqBody is null", async () => {
    const sandbox = vi.fn(async () => ({ result: 1 }));
    const c = cfg({ sandboxCode: "return 1;", dsl: [] });
    const ev = makeEvent({ method: "GET", reqBody: null });
    await dispatch(ev, compileConfigs([c]), SETTINGS, sandbox);
    expect(sandbox).toHaveBeenCalledWith(
      c.id,
      c.sandboxCode,
      { url: ev.url, method: "GET", body: null, bodyEncoding: "text", dslOutput: null },
      SETTINGS,
    );
  });

  it("runs DSL chain on empty-string body without crashing", async () => {
    const sandbox = vi.fn(async () => ({ result: "ok" }));
    const c = cfg({ sandboxCode: "return ...;", dsl: [{ op: "to-string" }] });
    const ev = makeEvent({ method: "POST", reqBody: "" });
    const res = await dispatch(ev, compileConfigs([c]), SETTINGS, sandbox);
    // Empty string is non-null, so DSL runs; `to-string` on "" yields "".
    expect(res).toHaveLength(1);
    expect(res[0].dslOutput).toBe("");
    expect(res[0].error).toBeUndefined();
  });

  it("unwraps { fanOut: [...] } into N MatchResults", async () => {
    const sandbox = vi.fn(async () => ({ result: { fanOut: [{ a: 1 }, { a: 2 }, { a: 3 }] } }));
    const c = cfg({ sandboxCode: "return ...;" });
    const res = await dispatch(makeEvent(), compileConfigs([c]), SETTINGS, sandbox);
    expect(res).toHaveLength(3);
    expect(res.map(r => r.sandboxOutput)).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it("emits zero MatchResults for { fanOut: [] }", async () => {
    const sandbox = vi.fn(async () => ({ result: { fanOut: [] } }));
    const c = cfg({ sandboxCode: "return ...;" });
    const res = await dispatch(makeEvent(), compileConfigs([c]), SETTINGS, sandbox);
    expect(res).toHaveLength(0);
  });

  it("treats { fanOut: 'not-array' } as a single non-fan-out row", async () => {
    const sandbox = vi.fn(async () => ({ result: { fanOut: "nope" } }));
    const c = cfg({ sandboxCode: "return ...;" });
    const res = await dispatch(makeEvent(), compileConfigs([c]), SETTINGS, sandbox);
    expect(res).toHaveLength(1);
    expect(res[0].sandboxOutput).toEqual({ fanOut: "nope" });
  });

  it("treats a bare array sandbox result as a single row (NOT fan-out)", async () => {
    const sandbox = vi.fn(async () => ({ result: [1, 2, 3] }));
    const c = cfg({ sandboxCode: "return ...;" });
    const res = await dispatch(makeEvent(), compileConfigs([c]), SETTINGS, sandbox);
    expect(res).toHaveLength(1);
    expect(res[0].sandboxOutput).toEqual([1, 2, 3]);
  });

  it("does not fan out on sandbox error", async () => {
    const sandbox = vi.fn(async () => ({ error: "boom" }));
    const c = cfg({ sandboxCode: "return ...;" });
    const res = await dispatch(makeEvent(), compileConfigs([c]), SETTINGS, sandbox);
    expect(res).toHaveLength(1);
    expect(res[0].error?.stage).toBe("sandbox");
  });

  it("skips (no throw) when urlPattern compiles to an invalid regex", async () => {
    // compileConfigs stores re: null for invalid patterns; dispatch must skip, not throw
    const c = cfg({ urlPattern: "[invalid(" });
    const res = await dispatch(makeEvent(), compileConfigs([c]), SETTINGS, noSandbox);
    expect(res).toEqual([]);
  });
});

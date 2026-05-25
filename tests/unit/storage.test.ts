import { describe, it, expect, vi, beforeEach } from "vitest";
import { Storage } from "@/shared/storage";
import type { AnalyserConfig } from "@/shared/types";

const fakeStorage = (() => {
  let state: Record<string, unknown> = {};
  return {
    get: vi.fn(async (k: string) => ({ [k]: state[k] })),
    set: vi.fn(async (kv: Record<string, unknown>) => { Object.assign(state, kv); }),
    _reset: () => { state = {}; }
  };
})();

beforeEach(() => fakeStorage._reset());

describe("Storage", () => {
  it("returns [] when no analyser configs stored", async () => {
    const s = new Storage(fakeStorage as unknown as chrome.storage.StorageArea);
    expect(await s.getAnalysers()).toEqual([]);
  });
  it("writes and reads analyser configs", async () => {
    const cfg: AnalyserConfig = { id: "x", name: "n", enabled: true, urlPattern: "p", source: "reqBody", dsl: [], createdAt: 0 };
    const s = new Storage(fakeStorage as unknown as chrome.storage.StorageArea);
    await s.setAnalysers([cfg]);
    expect(await s.getAnalysers()).toEqual([cfg]);
  });
});

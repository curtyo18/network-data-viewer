import { describe, it, expect, vi, beforeEach } from "vitest";
import { Storage } from "@/shared/storage";
import { DEFAULT_SETTINGS } from "@/shared/settings";
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

describe("settings storage", () => {
  it("returns DEFAULT_SETTINGS when nothing stored", async () => {
    const s = new Storage(fakeStorage as unknown as chrome.storage.StorageArea);
    expect(await s.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips a setSettings write", async () => {
    const s = new Storage(fakeStorage as unknown as chrome.storage.StorageArea);
    await s.setSettings({ showRaw: true });
    expect(await s.getSettings()).toEqual({ ...DEFAULT_SETTINGS, showRaw: true });
  });

  it("setSettings is a partial merge over existing", async () => {
    const s = new Storage(fakeStorage as unknown as chrome.storage.StorageArea);
    await s.setSettings({ showRaw: true });
    await s.setSettings({});
    expect(await s.getSettings()).toEqual({ ...DEFAULT_SETTINGS, showRaw: true });
  });
});

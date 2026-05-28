import { describe, it, expect, vi, beforeEach } from "vitest";
import { Storage } from "@/shared/storage";
import { STORAGE_KEY } from "@/shared/messages";
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
    const cfg: AnalyserConfig = { id: "x", name: "n", enabled: true, urlPattern: "p", dsl: [], createdAt: 0 };
    const s = new Storage(fakeStorage as unknown as chrome.storage.StorageArea);
    await s.setAnalysers([cfg]);
    expect(await s.getAnalysers()).toEqual([cfg]);
  });

  it("drops malformed stored entries and keeps valid ones (fail-closed read)", async () => {
    const valid: AnalyserConfig = { id: "x", name: "n", enabled: true, urlPattern: "p", dsl: [], createdAt: 0 };
    // Bypass setAnalysers (which only accepts typed configs) to simulate corrupt
    // or legacy storage: a missing-fields entry and an entry with an unknown field.
    await fakeStorage.set({ [STORAGE_KEY]: [valid, { id: "bad", name: "incomplete" }, { ...valid, id: "y", source: "reqBody" }] });
    const s = new Storage(fakeStorage as unknown as chrome.storage.StorageArea);
    expect(await s.getAnalysers()).toEqual([valid]);
  });

  it("returns [] when stored analysers value is not an array", async () => {
    await fakeStorage.set({ [STORAGE_KEY]: { not: "an array" } });
    const s = new Storage(fakeStorage as unknown as chrome.storage.StorageArea);
    expect(await s.getAnalysers()).toEqual([]);
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

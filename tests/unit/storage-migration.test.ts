import { describe, it, expect } from "vitest";
import { Storage, CURRENT_STORAGE_VERSION } from "@/shared/storage";
import { STORAGE_KEY, STORAGE_KEY_VERSION } from "@/shared/messages";

function makeArea(initial: Record<string, unknown> = {}): chrome.storage.StorageArea {
  const data: Record<string, unknown> = { ...initial };
  return {
    get: async (keys: string | string[] | null) => {
      if (keys === null || keys === undefined) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in data) out[k] = data[k];
      return out;
    },
    set: async (items: Record<string, unknown>) => { Object.assign(data, items); },
    remove: async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) delete data[k];
    },
    clear: async () => { for (const k of Object.keys(data)) delete data[k]; },
  } as unknown as chrome.storage.StorageArea;
}

describe("Storage.migrate", () => {
  it("wipes pre-existing analysers and writes version 2 when storageVersion is absent", async () => {
    const area = makeArea({
      [STORAGE_KEY]: [{ id: "x", name: "old", source: "reqBody" }],
    });
    const storage = new Storage(area);
    await storage.migrate();
    expect(await storage.getAnalysers()).toEqual([]);
    const versionRes = await area.get(STORAGE_KEY_VERSION);
    expect(versionRes[STORAGE_KEY_VERSION]).toBe(CURRENT_STORAGE_VERSION);
  });

  it("does nothing when storageVersion is already 2", async () => {
    const keep = {
      id: "user-created", name: "keep", enabled: true,
      urlPattern: "example\\.com", dsl: [], createdAt: 0,
    };
    const area = makeArea({
      [STORAGE_KEY_VERSION]: CURRENT_STORAGE_VERSION,
      [STORAGE_KEY]: [keep],
    });
    const storage = new Storage(area);
    await storage.migrate();
    expect(await storage.getAnalysers()).toEqual([keep]);
  });

  it("is idempotent (running twice from v1 leaves only v2 state)", async () => {
    const area = makeArea({ [STORAGE_KEY]: [{ id: "x" }] });
    const storage = new Storage(area);
    await storage.migrate();
    await storage.migrate();
    expect(await storage.getAnalysers()).toEqual([]);
    const v = await area.get(STORAGE_KEY_VERSION);
    expect(v[STORAGE_KEY_VERSION]).toBe(CURRENT_STORAGE_VERSION);
  });

  it("treats a non-numeric storageVersion as v1 and wipes", async () => {
    const area = makeArea({
      [STORAGE_KEY_VERSION]: "two",
      [STORAGE_KEY]: [{ id: "x" }],
    });
    const storage = new Storage(area);
    await storage.migrate();
    expect(await storage.getAnalysers()).toEqual([]);
    const v = await area.get(STORAGE_KEY_VERSION);
    expect(v[STORAGE_KEY_VERSION]).toBe(CURRENT_STORAGE_VERSION);
  });
});

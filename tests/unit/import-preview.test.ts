import { describe, it, expect } from "vitest";
import { buildPreview } from "@/side-panel/lib/import-preview";
import type { AnalyserConfig } from "@/shared/types";

function makeAnalyser(overrides: Partial<AnalyserConfig> & { id: string; name: string }): AnalyserConfig {
  return {
    enabled: true,
    urlPattern: "example\\.com",
    dsl: [],
    createdAt: 1000,
    ...overrides,
  };
}

describe("buildPreview", () => {
  it("empty existing + 2 incoming → 2 add, 0 replace, 0 unchanged", () => {
    const incoming = [
      makeAnalyser({ id: "a", name: "A" }),
      makeAnalyser({ id: "b", name: "B" }),
    ];
    const result = buildPreview([], incoming);
    expect(result.add).toHaveLength(2);
    expect(result.replace).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
    expect(result.add.map(a => a.id)).toEqual(["a", "b"]);
  });

  it("existing has [A v1, B], incoming has [A v2] → 1 replace, 0 add, 0 unchanged, B not touched", () => {
    const existing = [
      makeAnalyser({ id: "a", name: "A", seedVersion: 1 }),
      makeAnalyser({ id: "b", name: "B" }),
    ];
    const incoming = [makeAnalyser({ id: "a", name: "A", seedVersion: 2 })];
    const result = buildPreview(existing, incoming);
    expect(result.replace).toHaveLength(1);
    expect(result.add).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
    expect(result.replace[0].existing.seedVersion).toBe(1);
    expect(result.replace[0].incoming.seedVersion).toBe(2);
  });

  it("existing has [A v1], incoming has [A v1] (identical) → 1 unchanged, 0 replace, 0 add", () => {
    const analyser = makeAnalyser({ id: "a", name: "A", seedVersion: 1 });
    const result = buildPreview([analyser], [{ ...analyser }]);
    expect(result.unchanged).toHaveLength(1);
    expect(result.replace).toHaveLength(0);
    expect(result.add).toHaveLength(0);
  });

  it("existing has [A], incoming has [B] (different id) → 1 add, 0 replace", () => {
    const existing = [makeAnalyser({ id: "a", name: "A" })];
    const incoming = [makeAnalyser({ id: "b", name: "B" })];
    const result = buildPreview(existing, incoming);
    expect(result.add).toHaveLength(1);
    expect(result.add[0].id).toBe("b");
    expect(result.replace).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it("edge: empty incoming → all arrays empty", () => {
    const existing = [makeAnalyser({ id: "a", name: "A" })];
    const result = buildPreview(existing, []);
    expect(result.add).toHaveLength(0);
    expect(result.replace).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it("same field values but different key insertion order → unchanged, not replace", () => {
    // Construct two objects with the same data but deliberately different key order
    const base = makeAnalyser({ id: "a", name: "A", seedVersion: 1 });
    // Build a copy with keys inserted in a different order
    const { id, name, enabled, urlPattern, dsl, createdAt, seedVersion } = base;
    const reordered = { name, id, urlPattern, enabled, createdAt, dsl, seedVersion } as AnalyserConfig;
    const result = buildPreview([base], [reordered]);
    expect(result.unchanged).toHaveLength(1);
    expect(result.replace).toHaveLength(0);
    expect(result.add).toHaveLength(0);
  });
});

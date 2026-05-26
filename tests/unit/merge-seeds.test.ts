import { describe, it, expect } from "vitest";
import { mergeSeeds } from "@/background/merge-seeds";
import type { AnalyserConfig } from "@/shared/types";

const seed = (over: Partial<AnalyserConfig>): AnalyserConfig => ({
  id: "x",
  name: "n",
  enabled: true,
  urlPattern: "x",
  source: "url",
  dsl: [],
  createdAt: 0,
  ...over,
});

describe("mergeSeeds", () => {
  it("inserts all seeds when nothing exists", () => {
    const seeds = [seed({ id: "a", seedVersion: 1 }), seed({ id: "b", seedVersion: 1 })];
    expect(mergeSeeds([], seeds)).toEqual(seeds);
  });

  it("replaces an older-version seed with the bundled one", () => {
    const existing = [seed({ id: "celebrus", name: "Old", seedVersion: 1 })];
    const seeds = [seed({ id: "celebrus", name: "New", seedVersion: 2 })];
    const merged = mergeSeeds(existing, seeds);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("New");
  });

  it("treats missing seedVersion on existing as version 1", () => {
    const existing = [seed({ id: "celebrus", name: "Old" })]; // no seedVersion
    const seeds = [seed({ id: "celebrus", name: "New", seedVersion: 2 })];
    const merged = mergeSeeds(existing, seeds);
    expect(merged[0].name).toBe("New");
  });

  it("leaves user-created analysers untouched", () => {
    const existing = [seed({ id: "user-custom", name: "Mine" })];
    const seeds = [seed({ id: "celebrus", seedVersion: 2 })];
    const merged = mergeSeeds(existing, seeds);
    expect(merged).toHaveLength(2);
    expect(merged.map(a => a.id).sort()).toEqual(["celebrus", "user-custom"]);
  });

  it("does not replace when versions are equal", () => {
    const existing = [seed({ id: "celebrus", name: "Old", seedVersion: 2 })];
    const seeds = [seed({ id: "celebrus", name: "New", seedVersion: 2 })];
    const merged = mergeSeeds(existing, seeds);
    expect(merged[0].name).toBe("Old");
  });

  it("does not replace when existing is newer than bundled", () => {
    const existing = [seed({ id: "celebrus", name: "Future", seedVersion: 5 })];
    const seeds = [seed({ id: "celebrus", name: "Old", seedVersion: 2 })];
    const merged = mergeSeeds(existing, seeds);
    expect(merged[0].name).toBe("Future");
  });

  it("preserves order: existing entries first, then new seeds", () => {
    const existing = [seed({ id: "user", name: "U" }), seed({ id: "celebrus", seedVersion: 1 })];
    const seeds = [seed({ id: "celebrus", seedVersion: 2 }), seed({ id: "ga4", seedVersion: 1 })];
    const merged = mergeSeeds(existing, seeds);
    expect(merged.map(a => a.id)).toEqual(["user", "celebrus", "ga4"]);
  });

  it("adds both duplicate ids from bundled seeds (defensive: not expected in practice)", () => {
    // Defensive documentation: if bundled seeds contain duplicates, both are added
    // since seenIds tracks only existing, not seeds. The Map ensures the second
    // overwrites the first when merging with existing, but new seeds bypass that.
    const existing: AnalyserConfig[] = [];
    const seeds = [seed({ id: "dup", name: "First" }), seed({ id: "dup", name: "Second" })];
    const merged = mergeSeeds(existing, seeds);
    expect(merged).toHaveLength(2);
    expect(merged[0].name).toBe("First");
    expect(merged[1].name).toBe("Second");
  });
});

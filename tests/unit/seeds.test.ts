import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { AnalyserConfigArraySchema } from "@/shared/schema";
import { buildAllSeeds } from "../../vite/plugins/analyser-seeds";

const EXAMPLES_DIR = path.resolve(__dirname, "..", "..", "src", "examples");

describe("seed analysers", () => {
  it("all parse against AnalyserConfigArraySchema", async () => {
    const seeds = await buildAllSeeds(EXAMPLES_DIR);
    expect(() => AnalyserConfigArraySchema.parse(seeds)).not.toThrow();
  });

  it("includes the four bundled analysers", async () => {
    const seeds = await buildAllSeeds(EXAMPLES_DIR);
    const names = seeds.map(s => s.name).sort();
    expect(names).toEqual(["Celebrus", "ContentSquare", "GA4", "Meta"]);
  });

  it("no seed carries the dropped `source` field", async () => {
    const seeds = await buildAllSeeds(EXAMPLES_DIR);
    for (const seed of seeds) {
      expect(seed).not.toHaveProperty("source");
    }
  });

  it("every seed declares a seedVersion", async () => {
    const seeds = await buildAllSeeds(EXAMPLES_DIR);
    for (const seed of seeds) {
      expect(typeof seed.seedVersion).toBe("number");
      expect(seed.seedVersion).toBeGreaterThanOrEqual(1);
    }
  });
});

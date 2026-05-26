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

  it("includes the three bundled analysers", async () => {
    const seeds = await buildAllSeeds(EXAMPLES_DIR);
    const names = seeds.map(s => s.name).sort();
    expect(names).toEqual(["Celebrus", "ContentSquare", "GA4"]);
  });
});

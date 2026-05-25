import { describe, it, expect } from "vitest";
import { AnalyserConfigArraySchema } from "@/shared/schema";
import ga4 from "@/examples/ga4.json";
import contentsquare from "@/examples/contentsquare.json";
import celebrus from "@/examples/celebrus.json";

describe("seed analysers", () => {
  it("all parse against AnalyserConfigArraySchema", () => {
    expect(() => AnalyserConfigArraySchema.parse([ga4, contentsquare, celebrus])).not.toThrow();
  });
});

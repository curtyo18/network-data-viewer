import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { buildAllSeeds, extractSandboxBody } from "../../vite/plugins/analyser-seeds";

const FIXTURE_DIR = path.resolve(__dirname, "..", "fixtures", "seed-plugin");

describe("analyser-seeds plugin", () => {
  it("extracts a sandbox body verbatim", async () => {
    const body = await extractSandboxBody(path.join(FIXTURE_DIR, "celebrus.sandbox.ts"));
    expect(body).toContain("return { fanOut:");
    expect(body).not.toContain("function sandbox");
  });

  it("builds seeds with sandboxCode for files that have a sibling sandbox", async () => {
    const seeds = await buildAllSeeds(FIXTURE_DIR);
    const celebrus = seeds.find(s => s.name === "Celebrus");
    expect(celebrus).toBeDefined();
    expect(typeof celebrus!.sandboxCode).toBe("string");
    expect((celebrus!.sandboxCode as string).length).toBeGreaterThan(20);
  });

  it("omits sandboxCode when no sibling sandbox file exists", async () => {
    const seeds = await buildAllSeeds(FIXTURE_DIR);
    const ga4 = seeds.find(s => s.name === "GA4");
    expect(ga4).toBeDefined();
    expect("sandboxCode" in ga4!).toBe(false);
  });

  it("throws a named error when default export is not a function named 'sandbox'", async () => {
    await expect(
      extractSandboxBody(path.join(FIXTURE_DIR, "bad-name.sandbox.ts"))
    ).rejects.toThrow(/must be a function named 'sandbox'/);
  });

  it("throws when default export is an arrow function (not a function declaration)", async () => {
    await expect(
      extractSandboxBody(path.join(FIXTURE_DIR, "arrow.sandbox.ts"))
    ).rejects.toThrow(/must be a function declaration/);
  });

  it("extracts the body correctly when the signature contains a brace (default object param)", async () => {
    const body = await extractSandboxBody(path.join(FIXTURE_DIR, "default-param.sandbox.ts"));
    // The body — not the param default — must be what we captured.
    expect(body).toContain('marker: "extracted-body"');
    // The parameter default's contents must not leak into the extracted body.
    expect(body).not.toContain("showRaw: false");
    expect(body).not.toContain("function sandbox");
  });
});

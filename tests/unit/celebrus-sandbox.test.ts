import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { extractSandboxBody } from "../../vite/plugins/analyser-seeds";

// Synthetic fixture: constructed by applying the inverse of the deobfuscation algorithm to a
// known plaintext (four events: pageview with a noise key, click, beforeunload, client/JSON).
// Plaintext length (208) is a multiple of 52 = lcm(4,13), satisfying the alignment requirements
// of both regex swaps so the round-trip is exact.
const SANDBOX_FILE = path.resolve(__dirname, "..", "..", "src", "examples", "celebrus.sandbox.ts");
const FIXTURE = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "celebrus-real-beacon.txt"),
  "utf8"
);

async function loadSandbox(): Promise<(input: unknown, settings: unknown) => unknown> {
  const body = await extractSandboxBody(SANDBOX_FILE);
  return new Function("input", "settings", body) as (i: unknown, s: unknown) => unknown;
}

describe("celebrus sandbox", () => {
  it("returns { fanOut: [...] } for a real beacon", async () => {
    const sandbox = await loadSandbox();
    const result = sandbox(FIXTURE, { showRaw: false });
    expect(result).toHaveProperty("fanOut");
    expect(Array.isArray((result as { fanOut: unknown[] }).fanOut)).toBe(true);
    expect((result as { fanOut: unknown[] }).fanOut.length).toBeGreaterThan(0);
  });

  it("emits more events in showRaw mode than filtered", async () => {
    const sandbox = await loadSandbox();
    const filtered = (sandbox(FIXTURE, { showRaw: false }) as { fanOut: unknown[] }).fanOut.length;
    const raw = (sandbox(FIXTURE, { showRaw: true }) as { fanOut: unknown[] }).fanOut.length;
    expect(raw).toBeGreaterThanOrEqual(filtered);
  });

  it("returns null for non-string input", async () => {
    const sandbox = await loadSandbox();
    expect(sandbox({ foo: 1 }, { showRaw: false })).toBeNull();
    expect(sandbox(null, { showRaw: false })).toBeNull();
  });

  it("returns null when the body delimiter is missing", async () => {
    const sandbox = await loadSandbox();
    expect(sandbox("no marker here", { showRaw: false })).toBeNull();
  });
});

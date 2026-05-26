import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const DIST = resolve(__dirname, "..", "..", "dist");

// These assertions catch a class of bug where a runtime-only HTML entrypoint
// (one not referenced statically in the manifest) stops being included in the
// build output. Without this, `chrome.offscreen.createDocument({ url })` fails
// silently with "Page failed to load" and the sandbox pipeline hangs.
describe("dist contains all runtime HTML entry points", () => {
  it.skipIf(!existsSync(DIST))("dist/ exists (run `npm run build` first to exercise this suite)", () => {
    expect(existsSync(DIST)).toBe(true);
  });

  it.skipIf(!existsSync(DIST))("src/offscreen/offscreen.html is bundled", () => {
    expect(existsSync(resolve(DIST, "src/offscreen/offscreen.html"))).toBe(true);
  });

  it.skipIf(!existsSync(DIST))("src/sandbox/sandbox.html is bundled", () => {
    expect(existsSync(resolve(DIST, "src/sandbox/sandbox.html"))).toBe(true);
  });

  it.skipIf(!existsSync(DIST))("src/side-panel/index.html is bundled", () => {
    expect(existsSync(resolve(DIST, "src/side-panel/index.html"))).toBe(true);
  });
});

// Requires `unzip` on the host (available on Linux CI runners).
// Finds the most-recently-built zip matching network-data-viewer-vX.Y.Z.zip
// at the repo root and asserts it contains all runtime HTML entrypoints.
const ROOT = resolve(__dirname, "..", "..");

function findZip(): string | null {
  const matches = readdirSync(ROOT).filter(f => /^network-data-viewer-v[\d.]+\.zip$/.test(f));
  if (matches.length === 0) return null;
  matches.sort();
  return resolve(ROOT, matches[matches.length - 1]);
}

function unzipAvailable(): boolean {
  try { execSync("unzip -v", { stdio: "ignore" }); return true; } catch { return false; }
}

const zip = findZip();
const ready = zip !== null && unzipAvailable();

describe("package output contains all runtime entries", () => {
  it.skipIf(!ready)("manifest.json is in the zip", () => {
    const out = execSync(`unzip -l "${zip}"`, { encoding: "utf8" });
    expect(out).toContain("manifest.json");
  });

  it.skipIf(!ready)("src/offscreen/offscreen.html is in the zip", () => {
    const out = execSync(`unzip -l "${zip}"`, { encoding: "utf8" });
    expect(out).toContain("src/offscreen/offscreen.html");
  });

  it.skipIf(!ready)("src/sandbox/sandbox.html is in the zip", () => {
    const out = execSync(`unzip -l "${zip}"`, { encoding: "utf8" });
    expect(out).toContain("src/sandbox/sandbox.html");
  });

  it.skipIf(!ready)("src/side-panel/index.html is in the zip", () => {
    const out = execSync(`unzip -l "${zip}"`, { encoding: "utf8" });
    expect(out).toContain("src/side-panel/index.html");
  });
});

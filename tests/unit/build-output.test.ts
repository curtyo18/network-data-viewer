import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const OUT = resolve(__dirname, "..", "..", ".output", "chrome-mv3");

// These assertions catch a class of bug where a runtime-only HTML entrypoint
// (one not referenced statically in the manifest) stops being included in the
// build output. Without this, `chrome.offscreen.createDocument({ url })` fails
// silently with "Page failed to load" and the sandbox pipeline hangs.
describe(".output/chrome-mv3 contains all runtime HTML entry points", () => {
  it.skipIf(!existsSync(OUT))(".output/chrome-mv3 exists (run `npm run build` first to exercise this suite)", () => {
    expect(existsSync(OUT)).toBe(true);
  });

  it.skipIf(!existsSync(OUT))("offscreen.html is bundled", () => {
    expect(existsSync(resolve(OUT, "offscreen.html"))).toBe(true);
  });

  it.skipIf(!existsSync(OUT))("sandbox.html is bundled", () => {
    expect(existsSync(resolve(OUT, "sandbox.html"))).toBe(true);
  });

  it.skipIf(!existsSync(OUT))("sidepanel.html is bundled", () => {
    expect(existsSync(resolve(OUT, "sidepanel.html"))).toBe(true);
  });

  it.skipIf(!existsSync(OUT))("content scripts are bundled", () => {
    expect(existsSync(resolve(OUT, "content-scripts", "bridge.js"))).toBe(true);
    expect(existsSync(resolve(OUT, "content-scripts", "main-world.js"))).toBe(true);
  });

  it.skipIf(!existsSync(OUT))("manifest declares the sandbox page and no web_accessible_resources", () => {
    const manifest = JSON.parse(readFileSync(resolve(OUT, "manifest.json"), "utf8"));
    expect(manifest.sandbox?.pages).toContain("sandbox.html");
    expect(manifest.web_accessible_resources).toBeUndefined();
  });

  // The privacy policy and store listing promise sandbox code has no network
  // access. Chrome's default sandbox CSP does NOT restrict connect-src, so the
  // manifest must pin a CSP that does; this guards against it being dropped.
  it.skipIf(!existsSync(OUT))("sandbox CSP blocks network egress", () => {
    const manifest = JSON.parse(readFileSync(resolve(OUT, "manifest.json"), "utf8"));
    const csp: string = manifest.content_security_policy?.sandbox ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toMatch(/sandbox allow-scripts[;\s]/);
    expect(csp).not.toContain("allow-popups");
    expect(csp).not.toContain("allow-forms");
  });
});

// Requires `unzip` on the host (available on Linux CI runners).
// Finds the most-recently-built zip matching network-data-viewer-X.Y.Z-chrome.zip
// under .output/ and asserts it contains all runtime HTML entrypoints.
const ZIP_ROOT = resolve(__dirname, "..", "..", ".output");

function findZip(): string | null {
  if (!existsSync(ZIP_ROOT)) return null;
  const matches = readdirSync(ZIP_ROOT).filter(f => /^network-data-viewer-[\d.]+-chrome\.zip$/.test(f));
  if (matches.length === 0) return null;
  matches.sort();
  return resolve(ZIP_ROOT, matches[matches.length - 1]);
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

  it.skipIf(!ready)("offscreen.html is in the zip", () => {
    const out = execSync(`unzip -l "${zip}"`, { encoding: "utf8" });
    expect(out).toContain("offscreen.html");
  });

  it.skipIf(!ready)("sandbox.html is in the zip", () => {
    const out = execSync(`unzip -l "${zip}"`, { encoding: "utf8" });
    expect(out).toContain("sandbox.html");
  });

  it.skipIf(!ready)("sidepanel.html is in the zip", () => {
    const out = execSync(`unzip -l "${zip}"`, { encoding: "utf8" });
    expect(out).toContain("sidepanel.html");
  });
});

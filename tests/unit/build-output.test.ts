import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

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

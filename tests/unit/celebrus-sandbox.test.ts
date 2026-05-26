import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { extractSandboxBody } from "../../vite/plugins/analyser-seeds";

const SANDBOX_FILE = path.resolve(__dirname, "..", "..", "src", "examples", "celebrus.sandbox.ts");
// Synthetic Celebrus beacon. Encodes (in order): pageview, click, beforeunload, client/JSON.
// Constructed by applying the inverse of the decoder's transforms to a known plaintext;
// the file is padded so its length aligns with the 5+8 and 2+2 swap windows (LCM=52).
const FIXTURE = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "celebrus-real-beacon.txt"),
  "utf8"
);

let sandbox: (input: unknown, settings: unknown) => unknown;

beforeAll(async () => {
  const body = await extractSandboxBody(SANDBOX_FILE);
  sandbox = new Function("input", "settings", body) as (i: unknown, s: unknown) => unknown;
});

describe("celebrus sandbox", () => {
  it("returns { fanOut: [...] } for a real beacon", () => {
    const result = sandbox(FIXTURE, { showRaw: false }) as { fanOut: unknown[] };
    expect(result).toHaveProperty("fanOut");
    expect(Array.isArray(result.fanOut)).toBe(true);
    // Filtered mode drops `beforeunload` from the fixture's 4 events.
    expect(result.fanOut).toHaveLength(3);
    // First event should be the pageview, with priority keys first.
    expect(result.fanOut[0]).toMatchObject({ ap: "pageview" });
  });

  it("emits exactly one more event in showRaw mode (beforeunload is the only filtered one)", () => {
    const filtered = (sandbox(FIXTURE, { showRaw: false }) as { fanOut: unknown[] }).fanOut.length;
    const raw = (sandbox(FIXTURE, { showRaw: true }) as { fanOut: unknown[] }).fanOut.length;
    expect(raw - filtered).toBe(1);
  });

  it("falls back to decoded string when ap=client ct isn't JSON", () => {
    const fixture = fs.readFileSync(
      path.resolve(__dirname, "..", "fixtures", "celebrus-client-badjson.txt"),
      "utf8"
    );
    const result = sandbox(fixture, { showRaw: false }) as { fanOut: unknown[] };
    // The client event should be present as the decoded string (not parsed).
    expect(result.fanOut).toContain("{broken json");
  });

  it("decodes URI-encoded ct on ap=client events", () => {
    const fixture = fs.readFileSync(
      path.resolve(__dirname, "..", "fixtures", "celebrus-client-nonjson.txt"),
      "utf8"
    );
    const result = sandbox(fixture, { showRaw: false }) as { fanOut: unknown[] };
    expect(result.fanOut).toContain("plain text");
  });

  it("returns null for non-string input", () => {
    expect(sandbox({ foo: 1 }, { showRaw: false })).toBeNull();
    expect(sandbox(null, { showRaw: false })).toBeNull();
  });

  it("returns null when the body delimiter is missing", () => {
    expect(sandbox("no marker here", { showRaw: false })).toBeNull();
  });
});

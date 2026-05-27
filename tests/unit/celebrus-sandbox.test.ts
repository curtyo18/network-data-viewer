import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { extractSandboxBody } from "../../vite/plugins/analyser-seeds";

const SANDBOX_FILE = path.resolve(__dirname, "..", "..", "src", "examples", "celebrus.sandbox.ts");
const FIXTURE = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "celebrus-real-beacon.txt"),
  "utf8"
);

const wrap = (body: string | null) => ({
  url: "https://celebrus.example.com/cap",
  method: "POST",
  body,
  dslOutput: null,
});

let sandbox: (input: unknown, settings: unknown) => unknown;

beforeAll(async () => {
  const body = await extractSandboxBody(SANDBOX_FILE);
  sandbox = new Function("input", "settings", body) as (i: unknown, s: unknown) => unknown;
});

describe("celebrus sandbox", () => {
  it("returns { fanOut: [...] } for a real beacon", () => {
    const result = sandbox(wrap(FIXTURE), { showRaw: false }) as { fanOut: unknown[] };
    expect(result).toHaveProperty("fanOut");
    expect(Array.isArray(result.fanOut)).toBe(true);
    expect(result.fanOut).toHaveLength(3);
    expect(result.fanOut[0]).toMatchObject({ ap: "pageview" });
  });

  it("emits exactly one more event in showRaw mode (beforeunload is the only filtered one)", () => {
    const filtered = (sandbox(wrap(FIXTURE), { showRaw: false }) as { fanOut: unknown[] }).fanOut.length;
    const raw = (sandbox(wrap(FIXTURE), { showRaw: true }) as { fanOut: unknown[] }).fanOut.length;
    expect(raw - filtered).toBe(1);
  });

  it("falls back to decoded string when ap=client ct isn't JSON", () => {
    const fixture = fs.readFileSync(
      path.resolve(__dirname, "..", "fixtures", "celebrus-client-badjson.txt"),
      "utf8"
    );
    const result = sandbox(wrap(fixture), { showRaw: false }) as { fanOut: unknown[] };
    expect(result.fanOut).toContain("{broken json");
  });

  it("decodes URI-encoded ct on ap=client events", () => {
    const fixture = fs.readFileSync(
      path.resolve(__dirname, "..", "fixtures", "celebrus-client-nonjson.txt"),
      "utf8"
    );
    const result = sandbox(wrap(fixture), { showRaw: false }) as { fanOut: unknown[] };
    expect(result.fanOut).toContain("plain text");
  });

  it("returns null for non-object input", () => {
    expect(sandbox("a string", { showRaw: false })).toBeNull();
    expect(sandbox(null, { showRaw: false })).toBeNull();
  });

  it("returns null when input.body is not a string", () => {
    expect(sandbox(wrap(null), { showRaw: false })).toBeNull();
    expect(sandbox({ url: "x", method: "POST", body: 123, dslOutput: null }, { showRaw: false })).toBeNull();
  });

  it("returns null when the body delimiter is missing", () => {
    expect(sandbox(wrap("no marker here"), { showRaw: false })).toBeNull();
  });
});

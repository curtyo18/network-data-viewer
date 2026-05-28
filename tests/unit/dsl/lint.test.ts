import { describe, it, expect } from "vitest";
import { lintAnalyser } from "@/shared/dsl/lint";
import type { AnalyserConfig } from "@/shared/types";

const BASE: AnalyserConfig = {
  id: "lint-test",
  name: "Lint Test",
  enabled: true,
  urlPattern: "example\\.com",
  dsl: [],
  createdAt: 1000,
};

describe("lint rule: empty-dsl-on-typed-source", () => {
  it("fires when dsl is empty and sandbox accesses input as an object", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [], sandboxCode: "return input.value;" };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "empty-dsl-on-typed-source")).toBe(true);
  });

  it("fires when sandbox uses bracket access on input", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [], sandboxCode: 'return input["key"];' };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "empty-dsl-on-typed-source")).toBe(true);
  });

  it("does not fire when dsl is empty but sandbox has no object access", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [], sandboxCode: "return input;" };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "empty-dsl-on-typed-source")).toBe(false);
  });

  it("does not fire on an identifier that merely ends in 'input' (word boundary)", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [], sandboxCode: "return myinput.value;" };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "empty-dsl-on-typed-source")).toBe(false);
  });

  it("does not fire when dsl is empty and there is no sandbox code", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [] };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "empty-dsl-on-typed-source")).toBe(false);
  });

  it("does not fire when dsl is non-empty even if sandbox accesses input as object", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [{ op: "json-parse" }], sandboxCode: "return input.foo;" };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "empty-dsl-on-typed-source")).toBe(false);
  });
});

describe("lint rule: pluck-keys-look-like-jsonpath", () => {
  it("fires when a pluck key starts with $.", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [{ op: "pluck", keys: ["$.data"] }] };
    const issues = lintAnalyser(cfg);
    const issue = issues.find(i => i.rule === "pluck-keys-look-like-jsonpath");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("$.data");
  });

  it("fires when a pluck key starts with $[", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [{ op: "pluck", keys: ['$["user"]'] }] };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "pluck-keys-look-like-jsonpath")).toBe(true);
  });

  it("does not fire when pluck keys are plain dot-paths", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [{ op: "pluck", keys: ["data.user.id"] }] };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "pluck-keys-look-like-jsonpath")).toBe(false);
  });

  it("does not fire when there are no pluck steps", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [{ op: "json-parse" }] };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "pluck-keys-look-like-jsonpath")).toBe(false);
  });
});

describe("lint rule: regex-likely-backtracking", () => {
  it("fires on nested quantifiers like (a+)+", () => {
    const cfg: AnalyserConfig = { ...BASE, urlPattern: "(a+)+" };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "regex-likely-backtracking")).toBe(true);
  });

  it("fires on nested quantifiers like (a*)*", () => {
    const cfg: AnalyserConfig = { ...BASE, urlPattern: "(a*)* " };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "regex-likely-backtracking")).toBe(true);
  });

  it("does not fire on a normal domain pattern", () => {
    const cfg: AnalyserConfig = { ...BASE, urlPattern: "celebrus[a-z0-9-]*\\." };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "regex-likely-backtracking")).toBe(false);
  });

  it("does not fire on a simple escaped-dot pattern", () => {
    const cfg: AnalyserConfig = { ...BASE, urlPattern: "example\\.com\\/api" };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "regex-likely-backtracking")).toBe(false);
  });
});

describe("lint rule: regex-extract-likely-backtracking", () => {
  it("fires when a regex-extract step pattern has nested quantifiers", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [{ op: "regex-extract", pattern: "(a+)+$" }] };
    const issues = lintAnalyser(cfg);
    const issue = issues.find(i => i.rule === "regex-extract-likely-backtracking");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("(a+)+$");
  });

  it("does not fire on a safe regex-extract pattern", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [{ op: "regex-extract", pattern: "id=(\\d+)" }] };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "regex-extract-likely-backtracking")).toBe(false);
  });

  it("does not fire when there are no regex-extract steps", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [{ op: "json-parse" }] };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "regex-extract-likely-backtracking")).toBe(false);
  });
});

describe("lint rule: sandbox-references-globals", () => {
  it("fires when sandbox references chrome", () => {
    const cfg: AnalyserConfig = { ...BASE, sandboxCode: "chrome.runtime.sendMessage({})" };
    const issues = lintAnalyser(cfg);
    const issue = issues.find(i => i.rule === "sandbox-references-globals");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("chrome");
  });

  it("fires when sandbox references window", () => {
    const cfg: AnalyserConfig = { ...BASE, sandboxCode: "return window.bar;" };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "sandbox-references-globals")).toBe(true);
  });

  it("fires when sandbox references fetch", () => {
    const cfg: AnalyserConfig = { ...BASE, sandboxCode: "fetch('https://example.com')" };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "sandbox-references-globals")).toBe(true);
  });

  it("does not fire for clean sandbox code", () => {
    const cfg: AnalyserConfig = { ...BASE, sandboxCode: "return input;" };
    const issues = lintAnalyser(cfg);
    expect(issues.some(i => i.rule === "sandbox-references-globals")).toBe(false);
  });

  it("does not fire when sandboxCode is absent", () => {
    const { sandboxCode: _unused, ...cfgNoSandbox } = { ...BASE };
    const issues = lintAnalyser(cfgNoSandbox as AnalyserConfig);
    expect(issues.some(i => i.rule === "sandbox-references-globals")).toBe(false);
  });
});

describe("lintAnalyser — collects all matching rules", () => {
  it("returns empty array when no rules fire", () => {
    const cfg: AnalyserConfig = { ...BASE, dsl: [{ op: "json-parse" }], sandboxCode: "return input;" };
    expect(lintAnalyser(cfg)).toEqual([]);
  });

  it("returns multiple issues when multiple rules fire", () => {
    const cfg: AnalyserConfig = {
      ...BASE,
      urlPattern: "(a+)+",
      dsl: [{ op: "pluck", keys: ["$.foo"] }],
      sandboxCode: "return window.x;",
    };
    const issues = lintAnalyser(cfg);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    const rules = issues.map(i => i.rule);
    expect(rules).toContain("pluck-keys-look-like-jsonpath");
    expect(rules).toContain("regex-likely-backtracking");
    expect(rules).toContain("sandbox-references-globals");
  });
});

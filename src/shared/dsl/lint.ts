import type { AnalyserConfig } from "@/shared/types";

export type LintIssue = {
  rule: string;
  message: string;
};

export function lintAnalyser(cfg: AnalyserConfig): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const rule of RULES) {
    const found = rule(cfg);
    if (found) issues.push(found);
  }
  return issues;
}

type Rule = (cfg: AnalyserConfig) => LintIssue | null;

const RULES: Rule[] = [
  ruleEmptyDslOnNonStringSource,
  rulePluckLooksLikeJsonpath,
  ruleRegexBacktracking,
  ruleSandboxReferencesGlobals,
];

// ------ Individual rules ------

const RULE_EMPTY_DSL = "empty-dsl-on-typed-source";
function ruleEmptyDslOnNonStringSource(cfg: AnalyserConfig): LintIssue | null {
  // reqBody / resBody can legitimately be strings; only flag if the user has a sandbox that
  // probably expects a parsed value. Best heuristic: empty DSL AND sandbox code that references
  // properties on `input` (input.foo / input["foo"]).
  if (cfg.dsl.length > 0) return null;
  if (!cfg.sandboxCode) return null;
  const looksObjectAccess = /input\s*[.[]/.test(cfg.sandboxCode);
  if (!looksObjectAccess) return null;
  return {
    rule: RULE_EMPTY_DSL,
    message: `DSL chain is empty but sandbox accesses input as an object. If the source is reqBody/resBody (string), you probably want a json-parse step first.`,
  };
}

const RULE_PLUCK_PATH = "pluck-keys-look-like-jsonpath";
function rulePluckLooksLikeJsonpath(cfg: AnalyserConfig): LintIssue | null {
  for (const step of cfg.dsl) {
    if (step.op !== "pluck") continue;
    const bad = step.keys.find(k => k.startsWith("$.") || k.startsWith("$["));
    if (bad) {
      return {
        rule: RULE_PLUCK_PATH,
        message: `pluck key "${bad}" starts with "$" — that's jsonpath syntax. Use the jsonpath op, or drop the "$" prefix for dot-path access.`,
      };
    }
  }
  return null;
}

const RULE_REGEX_BACKTRACKING = "regex-likely-backtracking";
function ruleRegexBacktracking(cfg: AnalyserConfig): LintIssue | null {
  // Heuristic: detect nested quantifiers on overlapping groups, e.g. (a+)+, (a*)*, (a+)*.
  if (/\([^)]*[+*][^)]*\)[+*]/.test(cfg.urlPattern)) {
    return {
      rule: RULE_REGEX_BACKTRACKING,
      message: `urlPattern contains nested quantifiers like (x+)+ — this can cause catastrophic backtracking on long inputs. Refactor or anchor the pattern.`,
    };
  }
  return null;
}

const RULE_SANDBOX_GLOBALS = "sandbox-references-globals";
function ruleSandboxReferencesGlobals(cfg: AnalyserConfig): LintIssue | null {
  if (!cfg.sandboxCode) return null;
  const refs = ["window", "document", "chrome", "fetch", "XMLHttpRequest", "localStorage", "sessionStorage"];
  const found = refs.find(g => new RegExp(`\\b${g}\\b`).test(cfg.sandboxCode!));
  if (!found) return null;
  return {
    rule: RULE_SANDBOX_GLOBALS,
    message: `sandbox references "${found}" — the sandbox iframe has CSP isolation, no DOM, no chrome.* APIs, no network. The reference will throw at runtime.`,
  };
}

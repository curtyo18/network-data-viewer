import { describe, it, expect, beforeAll } from "vitest";
import * as path from "node:path";
import { buildAllSeeds } from "../../vite/plugins/analyser-seeds";
import type { AnalyserConfig } from "@/shared/types";

const EXAMPLES_DIR = path.resolve(__dirname, "..", "..", "src", "examples");

let celebrus: AnalyserConfig;
let urlRe: RegExp;

beforeAll(async () => {
  const seeds = await buildAllSeeds(EXAMPLES_DIR);
  const found = seeds.find(s => s.name === "Celebrus");
  if (!found) throw new Error("Celebrus seed not present");
  celebrus = found;
  urlRe = new RegExp(celebrus.urlPattern);
});

describe("celebrus meta", () => {
  it("urlPattern matches dotted celebrus subdomain", () => {
    expect(urlRe.test("https://celebrus.example.com/events")).toBe(true);
  });

  it("urlPattern matches versioned celebrus subdomain (no dash)", () => {
    expect(urlRe.test("https://prod-celebrusv9.example.com/events/v10/jsEvent.json")).toBe(true);
  });

  it("urlPattern matches versioned celebrus subdomain (with dash)", () => {
    expect(urlRe.test("https://celebrus-v10.example.com/x")).toBe(true);
  });

  it("urlPattern does not match arbitrary URLs that just contain 'celebrus' without a subdomain dot", () => {
    expect(urlRe.test("https://example.com/blog/about-celebrus")).toBe(false);
    expect(urlRe.test("https://example.com/celebrus-overview")).toBe(false);
  });

  it("dsl is empty so the raw request body flows straight to the sandbox", () => {
    expect(celebrus.dsl).toEqual([]);
    expect(celebrus.source).toBe("reqBody");
  });

  it("seedVersion bumped to 3 so existing v2 installs receive the fix on update", () => {
    expect(celebrus.seedVersion).toBe(3);
  });
});

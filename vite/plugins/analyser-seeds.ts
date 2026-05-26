import * as path from "node:path";
import * as fs from "node:fs/promises";
import { transform } from "esbuild";
import vm from "node:vm";
import type { ModuleNode, Plugin } from "vite";
import type { AnalyserConfig } from "@/shared/types";
import { AnalyserConfigSchema } from "@/shared/schema";

const VIRTUAL_ID = "virtual:analyser-seeds";
const RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_ID;

export type AnalyserSeedsOptions = {
  examplesDir: string;
};

export function analyserSeeds(opts: AnalyserSeedsOptions): Plugin {
  return {
    name: "analyser-seeds",
    enforce: "pre",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
      return null;
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;
      const seeds = await buildAllSeeds(opts.examplesDir);
      return `export default ${JSON.stringify(seeds)};`;
    },
    handleHotUpdate(ctx) {
      if (ctx.file.startsWith(opts.examplesDir) && /\.(meta|sandbox)\.ts$/.test(ctx.file)) {
        const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
        if (mod) ctx.server.moduleGraph.invalidateModule(mod);
        return [mod].filter(Boolean) as ModuleNode[];
      }
    },
  };
}

export async function buildAllSeeds(examplesDir: string): Promise<AnalyserConfig[]> {
  const entries = await fs.readdir(examplesDir);
  const metaFiles = entries.filter(e => e.endsWith(".meta.ts"));
  const out: AnalyserConfig[] = [];
  for (const metaFile of metaFiles.sort()) {
    const prefix = metaFile.slice(0, -".meta.ts".length);
    const metaPath = path.join(examplesDir, metaFile);
    const sandboxPath = path.join(examplesDir, `${prefix}.sandbox.ts`);
    const meta = await loadMeta(metaPath);
    const hasSandbox = await fileExists(sandboxPath);
    const seed: AnalyserConfig = { ...(meta as AnalyserConfig) };
    if (hasSandbox) seed.sandboxCode = await extractSandboxBody(sandboxPath);
    const parsed = AnalyserConfigSchema.safeParse(seed);
    if (!parsed.success) {
      throw new Error(
        `analyser-seeds: ${metaPath} does not match AnalyserConfigSchema — ${parsed.error.message}`
      );
    }
    out.push(parsed.data);
  }
  return out;
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.stat(p); return true; } catch { return false; }
}

async function loadMeta(metaPath: string): Promise<Record<string, unknown>> {
  const src = await fs.readFile(metaPath, "utf8");
  const transformed = await transform(src, { loader: "ts", target: "es2022", format: "cjs" });
  const ns = await loadModule(transformed.code, metaPath);
  if (!ns.meta || typeof ns.meta !== "object") {
    throw new Error(`analyser-seeds: ${metaPath} must export a 'meta' object`);
  }
  return ns.meta as Record<string, unknown>;
}

export async function extractSandboxBody(sandboxPath: string): Promise<string> {
  const src = await fs.readFile(sandboxPath, "utf8");
  const transformed = await transform(src, { loader: "ts", target: "es2022", format: "cjs" });
  const ns = await loadModule(transformed.code, sandboxPath);
  const fn = ns.default;
  if (typeof fn !== "function") {
    throw new Error(`analyser-seeds: ${sandboxPath} must 'export default function sandbox(input, settings) {...}'`);
  }
  if (fn.name !== "sandbox") {
    throw new Error(`analyser-seeds: ${sandboxPath} default export must be a function named 'sandbox' (got '${fn.name}')`);
  }
  const source = fn.toString();
  if (!source.trimStart().startsWith("function")) {
    throw new Error(
      `analyser-seeds: ${sandboxPath} default export must be a function declaration (function sandbox(...) { ... }), not an arrow function or method shorthand`
    );
  }
  const openIdx = source.indexOf("{");
  const closeIdx = source.lastIndexOf("}");
  if (openIdx < 0 || closeIdx < 0 || closeIdx < openIdx) {
    throw new Error(`analyser-seeds: could not extract function body from ${sandboxPath}`);
  }
  return source.slice(openIdx + 1, closeIdx);
}

async function loadModule(transpiled: string, sourcePath: string): Promise<Record<string, unknown>> {
  const wrapped = `(function (module, exports) {\n${transpiled}\nreturn module.exports;\n})`;
  const moduleObj = { exports: {} as Record<string, unknown> };
  const fn = vm.runInNewContext(wrapped, {}, { filename: sourcePath });
  const result = fn(moduleObj, moduleObj.exports);
  return result as Record<string, unknown>;
}

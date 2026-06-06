import { createWriteStream, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
const distDir = resolve(root, "dist");
if (!existsSync(distDir)) {
  console.error("dist/ does not exist — run `npm run build` first");
  process.exit(1);
}
// Guard against zipping a stale build: dist/ is gitignored and only the build
// regenerates it, so a forgotten rebuild after `npm version` would ship the old
// version. manifest.config.ts derives its version from package.json, so any
// mismatch here means dist/ predates the current version.
const distManifest = JSON.parse(readFileSync(resolve(distDir, "manifest.json"), "utf-8"));
if (distManifest.version !== pkg.version) {
  console.error(
    `dist/ is stale: manifest.json is v${distManifest.version} but package.json is v${pkg.version} — run \`npm run build\` first`,
  );
  process.exit(1);
}
const outFile = resolve(root, `${pkg.name}-v${pkg.version}.zip`);
const output = createWriteStream(outFile);
const archive = archiver("zip", { zlib: { level: 9 } });
output.on("close", () => console.log(`wrote ${outFile} (${archive.pointer()} bytes)`));
archive.on("error", err => { throw err; });
archive.pipe(output);
archive.directory(distDir, false);
await archive.finalize();

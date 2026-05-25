import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, "../src/icons/icon.svg");
const outDir = resolve(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });
const svg = readFileSync(svgPath);
for (const size of [16, 48, 128]) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  const png = resvg.render().asPng();
  writeFileSync(resolve(outDir, `icon${size}.png`), png);
  console.log(`wrote icons/icon${size}.png`);
}

import { chromium, BrowserContext } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function launchWithExtension(): Promise<BrowserContext> {
  const ext = path.resolve(__dirname, "../../dist");
  const ctx = await chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "--no-sandbox"]
  });
  return ctx;
}

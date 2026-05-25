import { test, expect } from "@playwright/test";
import { launchWithExtension } from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("captures fetch to GA4 and renders in side panel", async () => {
  const ctx = await launchWithExtension();
  try {
    const fixture = "file://" + path.resolve(__dirname, "fixtures/test-page.html");
    const page = await ctx.newPage();
    await page.goto(fixture);

    await page.click("#fire-fetch");
    await page.waitForTimeout(500);

    const extId = await getExtensionId(ctx);
    const panel = await ctx.newPage();
    await panel.goto(`chrome-extension://${extId}/src/side-panel/index.html`);

    await expect(panel.locator("text=GA4")).toBeVisible({ timeout: 5000 });
    await expect(panel.locator("text=G-TEST")).toBeVisible();
  } finally {
    await ctx.close();
  }
});

async function getExtensionId(ctx: import("@playwright/test").BrowserContext): Promise<string> {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 5000 });
  return new URL(sw.url()).host;
}

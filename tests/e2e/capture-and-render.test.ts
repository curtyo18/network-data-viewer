import { test, expect } from "@playwright/test";
import { launchWithExtension } from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("captures fetch to GA4 and renders in side panel", async () => {
  const ctx = await launchWithExtension();
  try {
    const extId = await getExtensionId(ctx);

    // Open the side panel FIRST so its port is connected before events fire.
    // Events are session-scoped and dropped when no port is attached.
    const panel = await ctx.newPage();
    await panel.goto(`chrome-extension://${extId}/src/side-panel/index.html`);
    // "Export all" button is unique to the panel header — proves React mounted.
    await expect(panel.getByRole("button", { name: "Export all" })).toBeVisible({ timeout: 5000 });

    // Now load the fixture and fire the captured fetch.
    const fixture = "file://" + path.resolve(__dirname, "fixtures/test-page.html");
    const page = await ctx.newPage();
    await page.goto(fixture);
    await page.click("#fire-fetch");

    // Panel should render the captured event. GA4 appears in the analyser badge.
    await expect(panel.locator("text=GA4").first()).toBeVisible({ timeout: 10000 });
    await expect(panel.locator("text=G-TEST").first()).toBeVisible();
  } finally {
    await ctx.close();
  }
});

async function getExtensionId(ctx: import("@playwright/test").BrowserContext): Promise<string> {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 5000 });
  return new URL(sw.url()).host;
}

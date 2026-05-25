import { test, expect } from "@playwright/test";
import { launchWithExtension } from "./helpers";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(path.resolve(__dirname, "fixtures/test-page.html"), "utf-8");

test("captures fetch to GA4 and renders in side panel", async () => {
  const ctx = await launchWithExtension();
  try {
    // Serve the fixture over HTTPS — content scripts don't run on file:// without
    // an extension-specific opt-in that isn't available via launch flags.
    await ctx.route("**/test-fixture.local/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    // Mock GA4 endpoint so the captured fetch doesn't depend on real network.
    await ctx.route("**/google-analytics.com/g/collect**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
    });

    const extId = await getExtensionId(ctx);

    // Open the side panel FIRST so its port is connected before events fire.
    // Events are session-scoped and dropped when no port is attached.
    const panel = await ctx.newPage();
    await panel.goto(`chrome-extension://${extId}/src/side-panel/index.html`);
    // "Export all" button is unique to the panel header — proves React mounted.
    await expect(panel.getByRole("button", { name: "Export all" })).toBeVisible({ timeout: 5000 });

    // Load fixture over HTTPS so the MAIN-world content script runs, then fire.
    const page = await ctx.newPage();
    await page.goto("https://test-fixture.local/");
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

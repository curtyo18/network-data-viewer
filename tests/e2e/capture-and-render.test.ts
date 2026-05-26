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
    await ctx.route(/test-fixture\.local/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    await ctx.route(/google-analytics\.com\/g\/collect/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
    });

    const sw = await getServiceWorker(ctx);
    sw.on("console", (msg) => console.log("[sw]", msg.text()));
    const extId = new URL(sw.url()).host;

    // Explicit seed via SW context — removes the onInstalled timing variable.
    await sw.evaluate(async () => {
      await chrome.storage.local.set({
        analyserConfigs: [{
          id: "test-ga4",
          name: "GA4",
          enabled: true,
          urlPattern: "google-analytics\\.com/g/collect",
          source: "url",
          dsl: [{ op: "query-parse" }],
          createdAt: 0
        }]
      });
    });

    const panel = await ctx.newPage();
    panel.on("console", (msg) => console.log("[panel]", msg.text()));
    panel.on("pageerror", (err) => console.log("[panel error]", err.message));
    await panel.goto(`chrome-extension://${extId}/src/side-panel/index.html`);
    await expect(panel.getByRole("button", { name: "Export all" })).toBeVisible({ timeout: 5000 });
    // Give the port-connect handshake a moment to register on the SW.
    await panel.waitForTimeout(500);

    const page = await ctx.newPage();
    page.on("console", (msg) => console.log("[page]", msg.text()));
    page.on("pageerror", (err) => console.log("[page error]", err.message));
    await page.goto("https://test-fixture.local/");
    await page.click("#fire-fetch");

    await expect(panel.locator("text=GA4").first()).toBeVisible({ timeout: 10000 });
    await expect(panel.locator("text=G-TEST").first()).toBeVisible();
  } finally {
    await ctx.close();
  }
});

test("sandbox path: analyser with sandboxCode produces a row via the offscreen iframe", async () => {
  // Regression guard: when src/offscreen/offscreen.html wasn't bundled, chrome.offscreen.createDocument
  // failed silently and any analyser with sandboxCode produced no output. This exercises that path.
  const ctx = await launchWithExtension();
  try {
    await ctx.route(/test-fixture\.local/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    await ctx.route(/google-analytics\.com\/g\/collect/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
    });

    const sw = await getServiceWorker(ctx);
    sw.on("console", (msg) => console.log("[sw]", msg.text()));
    const extId = new URL(sw.url()).host;

    // Wait briefly for the install-time migration to settle so it doesn't race with our seed.
    await sw.evaluate(() => new Promise<void>(r => setTimeout(r, 200)));

    await sw.evaluate(async () => {
      await chrome.storage.local.set({
        analyserConfigs: [{
          id: "test-sandbox",
          name: "Sandboxed",
          enabled: true,
          urlPattern: "google-analytics\\.com/g/collect",
          source: "url",
          dsl: [],
          sandboxCode: 'return { fanOut: ["sandbox-marker-row"] };',
          createdAt: 0
        }]
      });
    });

    const panel = await ctx.newPage();
    panel.on("console", (msg) => console.log("[panel]", msg.text()));
    panel.on("pageerror", (err) => console.log("[panel error]", err.message));
    await panel.goto(`chrome-extension://${extId}/src/side-panel/index.html`);
    await expect(panel.getByRole("button", { name: "Export all" })).toBeVisible({ timeout: 5000 });
    await panel.waitForTimeout(500);

    const page = await ctx.newPage();
    await page.goto("https://test-fixture.local/");
    await page.click("#fire-fetch");

    // If offscreen.html is missing, the sandbox setup fails and "sandbox-marker-row" never appears.
    await expect(panel.locator("text=sandbox-marker-row").first()).toBeVisible({ timeout: 15000 });
  } finally {
    await ctx.close();
  }
});

async function getServiceWorker(ctx: import("@playwright/test").BrowserContext) {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 5000 });
  return sw;
}

import { test, expect } from "@playwright/test";
import {
  launchWithExtension,
  setupHarness,
  waitForInstallMigration,
  waitForPanelPortReady,
  POST_DISPATCH_SLACK_MS,
} from "./helpers";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(path.resolve(__dirname, "fixtures/test-page.html"), "utf-8");

test("captures fetch to GA4 and renders in side panel", async () => {
  const { ctx, panel, page } = await setupHarness({
    seed: [{
      id: "test-ga4",
      name: "GA4",
      enabled: true,
      urlPattern: "google-analytics\\.com/g/collect",
      source: "url",
      dsl: [{ op: "query-parse" }],
      createdAt: 0
    }]
  });
  try {
    await ctx.route(/test-fixture\.local/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    await ctx.route(/google-analytics\.com\/g\/collect/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
    });

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
  const { ctx, panel, page } = await setupHarness({
    seed: [{
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
  try {
    await ctx.route(/test-fixture\.local/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    await ctx.route(/google-analytics\.com\/g\/collect/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
    });

    await page.goto("https://test-fixture.local/");
    await page.click("#fire-fetch");

    // If offscreen.html is missing, the sandbox setup fails and "sandbox-marker-row" never appears.
    await expect(panel.locator("text=sandbox-marker-row").first()).toBeVisible({ timeout: 15000 });
  } finally {
    await ctx.close();
  }
});

test("captures XHR to a JSON endpoint and renders in side panel", async () => {
  const { ctx, panel, page } = await setupHarness({
    seed: [{
      id: "test-xhr",
      name: "XhrAnalyser",
      enabled: true,
      urlPattern: "__test/analytics",
      source: "reqBody",
      dsl: [{ op: "json-parse" }],
      createdAt: 0
    }]
  });
  try {
    await ctx.route(/test-fixture\.local/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    await ctx.route(/test-fixture\.local\/__test/, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

    await page.goto("https://test-fixture.local/");
    await page.click("#fire-xhr");

    await expect(panel.locator("text=XhrAnalyser").first()).toBeVisible({ timeout: 10000 });
    await expect(panel.locator("text=hello").first()).toBeVisible();
    await expect(panel.locator("text=world").first()).toBeVisible();
  } finally {
    await ctx.close();
  }
});

test("captures sendBeacon to GA4 and renders in side panel", async () => {
  const { ctx, panel, page } = await setupHarness({
    seed: [{
      id: "test-beacon",
      name: "BeaconAnalyser",
      enabled: true,
      urlPattern: "google-analytics\\.com/g/collect",
      source: "url",
      dsl: [{ op: "query-parse" }],
      createdAt: 0
    }]
  });
  try {
    await ctx.route(/test-fixture\.local/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    await ctx.route(/google-analytics\.com\/g\/collect/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
    });

    await page.goto("https://test-fixture.local/");
    await page.click("#fire-beacon");

    await expect(panel.locator("text=BeaconAnalyser").first()).toBeVisible({ timeout: 10000 });
    await expect(panel.locator("text=G-BEACON").first()).toBeVisible();
  } finally {
    await ctx.close();
  }
});

test("settings showRaw toggle is reflected in sandbox analyser output", async () => {
  const { ctx, panel, page } = await setupHarness({
    seed: [{
      id: "test-showraw",
      name: "ShowRawAnalyser",
      enabled: true,
      urlPattern: "google-analytics\\.com/g/collect",
      source: "url",
      dsl: [],
      sandboxCode: 'return { fanOut: [settings && settings.showRaw ? "raw-output" : "filtered-output"] };',
      createdAt: 0
    }]
  });
  try {
    await ctx.route(/test-fixture\.local/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    await ctx.route(/google-analytics\.com\/g\/collect/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
    });

    await page.goto("https://test-fixture.local/");

    // First fire: showRaw is false (default) → expect filtered-output
    await page.click("#fire-fetch");
    await expect(panel.locator("text=filtered-output").first()).toBeVisible({ timeout: 15000 });

    // Toggle "show raw" in the panel header
    await panel.getByLabel("show raw").click();
    // Wait for chrome.storage.onChanged to propagate to the SW's settings cache
    await panel.waitForTimeout(300);

    // Second fire: showRaw is now true → expect raw-output
    await page.click("#fire-fetch");
    await expect(panel.locator("text=raw-output").first()).toBeVisible({ timeout: 15000 });
  } finally {
    await ctx.close();
  }
});

// Documents buffered-replay behaviour: MatchResults are held in the SW's ResultBuffer
// (up to 100 entries) regardless of whether a panel port is connected. When a panel
// connects it receives a snapshot of buffered results, so events fired before the panel
// opens are still visible.
test("panel-not-open: results are buffered and replayed when the panel connects", async () => {
  // This test deliberately fires the fetch BEFORE opening the panel, so we cannot use
  // setupHarness (which opens the panel first). We keep setup explicit but use the
  // named wait helpers instead of bare setTimeout / waitForTimeout calls.
  const ctx = await launchWithExtension();
  try {
    await ctx.route(/test-fixture\.local/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    await ctx.route(/google-analytics\.com\/g\/collect/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
    });

    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 5000 });
    sw.on("console", (msg) => console.log("[sw]", msg.text()));
    const extId = new URL(sw.url()).host;

    await waitForInstallMigration(sw);

    await sw.evaluate(async (seed: unknown) => {
      await chrome.storage.local.set({ analyserConfigs: seed });
    }, [{
      id: "test-drop",
      name: "GA4",
      enabled: true,
      urlPattern: "google-analytics\\.com/g/collect",
      source: "url",
      dsl: [{ op: "query-parse" }],
      createdAt: 0
    }]);

    // Fire the fetch BEFORE opening the panel — no port is connected yet
    const page = await ctx.newPage();
    page.on("console", (msg) => console.log("[page]", msg.text()));
    page.on("pageerror", (err) => console.log("[page error]", err.message));
    await page.goto("https://test-fixture.local/");

    // Wait for the GA4 response to confirm the fetch was dispatched through the SW,
    // then allow a small slack for any post-dispatch SW work before the panel connects.
    const responseReady = page.waitForResponse(/google-analytics\.com\/g\/collect/);
    await page.click("#fire-fetch");
    await responseReady;
    // we've already waited for the response; dispatch happens after that on the SW side.
    await page.waitForTimeout(POST_DISPATCH_SLACK_MS);

    // NOW open the panel — the buffered result should be replayed on connect
    const panel = await ctx.newPage();
    panel.on("console", (msg) => console.log("[panel]", msg.text()));
    panel.on("pageerror", (err) => console.log("[panel error]", err.message));
    await panel.goto(`chrome-extension://${extId}/src/side-panel/index.html`);
    await expect(panel.getByRole("button", { name: "Export all" })).toBeVisible({ timeout: 5000 });
    await waitForPanelPortReady(panel);

    await expect(panel.locator("text=GA4").first()).toBeVisible({ timeout: 5000 });
  } finally {
    await ctx.close();
  }
});

test("filter bar narrows visible rows by analyser name", async () => {
  // Two analysers both match the same GA4 URL. One fetch fires — both produce a row.
  // Typing one analyser's name into the filter leaves only that row visible.
  const { ctx, panel, page } = await setupHarness({
    seed: [
      {
        id: "test-filter-a",
        name: "FilterAlpha",
        enabled: true,
        urlPattern: "google-analytics\\.com/g/collect",
        source: "url",
        dsl: [{ op: "query-parse" }],
        createdAt: 0
      },
      {
        id: "test-filter-b",
        name: "FilterBeta",
        enabled: true,
        urlPattern: "google-analytics\\.com/g/collect",
        source: "url",
        dsl: [{ op: "query-parse" }],
        createdAt: 0
      }
    ]
  });
  try {
    await ctx.route(/test-fixture\.local/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    await ctx.route(/google-analytics\.com\/g\/collect/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
    });

    await page.goto("https://test-fixture.local/");
    await page.click("#fire-fetch");

    // Both analyser rows should appear before filtering
    await expect(panel.locator("text=FilterAlpha").first()).toBeVisible({ timeout: 10000 });
    await expect(panel.locator("text=FilterBeta").first()).toBeVisible();

    // Type into the filter — only FilterAlpha rows should remain
    await panel.getByPlaceholder("filter url / method / analyser…").fill("FilterAlpha");
    await expect(panel.locator("text=FilterAlpha").first()).toBeVisible();
    await expect(panel.locator("text=FilterBeta")).toHaveCount(0, { timeout: 3000 });
  } finally {
    await ctx.close();
  }
});

test("pause suppresses new captures; resume restores them", async () => {
  const { ctx, sw, panel, page } = await setupHarness({
    seed: [{
      id: "test-pause",
      name: "PauseTest",
      enabled: true,
      urlPattern: "google-analytics\\.com/g/collect",
      source: "url",
      dsl: [{ op: "query-parse" }],
      createdAt: 0
    }]
  });
  try {
    await ctx.route(/test-fixture\.local/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    await ctx.route(/google-analytics\.com\/g\/collect/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
    });

    await page.goto("https://test-fixture.local/");

    // Pause via storage (avoids flakiness from button timing)
    await sw.evaluate(async () => {
      await chrome.storage.local.set({ settings: { showRaw: false, paused: true } });
    });
    // Allow the SW's onChanged listener to invalidate settingsCache
    await panel.waitForTimeout(300);

    // Fire a fetch — should be dropped by the SW early-return
    const responseReady1 = page.waitForResponse(/google-analytics\.com\/g\/collect/);
    await page.click("#fire-fetch");
    await responseReady1;
    await page.waitForTimeout(POST_DISPATCH_SLACK_MS);

    // No PauseTest row should appear
    await expect(panel.locator("text=PauseTest")).toHaveCount(0, { timeout: 3000 });

    // Unpause
    await sw.evaluate(async () => {
      await chrome.storage.local.set({ settings: { showRaw: false, paused: false } });
    });
    await panel.waitForTimeout(300);

    // Fire another fetch — should now be captured
    const responseReady2 = page.waitForResponse(/google-analytics\.com\/g\/collect/);
    await page.click("#fire-fetch");
    await responseReady2;

    await expect(panel.locator("text=PauseTest").first()).toBeVisible({ timeout: 10000 });
  } finally {
    await ctx.close();
  }
});

test("clear button removes all rows from the events list", async () => {
  const { ctx, panel, page } = await setupHarness({
    seed: [{
      id: "test-cleartest",
      name: "ClearTest",
      enabled: true,
      urlPattern: "google-analytics\\.com/g/collect",
      source: "url",
      dsl: [{ op: "query-parse" }],
      createdAt: 0
    }]
  });
  try {
    await ctx.route(/test-fixture\.local/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
    });
    await ctx.route(/google-analytics\.com\/g\/collect/, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
    });

    await page.goto("https://test-fixture.local/");
    await page.click("#fire-fetch");

    await expect(panel.locator("text=ClearTest").first()).toBeVisible({ timeout: 5000 });

    await panel.getByRole("button", { name: "Clear events" }).click();

    await expect(panel.locator("text=ClearTest")).toHaveCount(0, { timeout: 3000 });
  } finally {
    await ctx.close();
  }
});

import { chromium, BrowserContext, expect, Page } from "@playwright/test";
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

// Wait helpers expose the real reason behind the time we spend waiting.
// Centralising lets future deterministic-signal replacements live in one place.
const MIGRATION_SETTLE_MS = 200;   // chrome.runtime.onInstalled migration writes to storage; no public completion signal
const PORT_HANDSHAKE_MS = 500;     // chrome.runtime.connect from panel to SW; SW adds the port to its Set asynchronously

// POST_DISPATCH_SLACK_MS: we've already waited for the response; dispatch happens after that on the SW side.
export const POST_DISPATCH_SLACK_MS = 300;

export async function waitForInstallMigration(sw: import("@playwright/test").Worker): Promise<void> {
  await sw.evaluate((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)), MIGRATION_SETTLE_MS);
}

export async function waitForPanelPortReady(panel: Page): Promise<void> {
  await panel.waitForTimeout(PORT_HANDSHAKE_MS);
}

export type LaunchedHarness = {
  ctx: import("@playwright/test").BrowserContext;
  sw: import("@playwright/test").Worker;
  panel: Page;
  page: Page;
  extId: string;
};

/**
 * Boot the extension and prepare the three contexts every test needs: service worker,
 * side panel page (panel port already established with PORT_HANDSHAKE_MS slack), and
 * a fresh content tab pointed at the test fixture host.
 *
 * Call BEFORE seeding storage if you want a clean install; pass `{ seed }` to apply
 * an analyser config before the panel connects. The migration settle wait is always
 * applied; without it the bundled-seed migration races test setup and overwrites it.
 */
export async function setupHarness(opts?: { seed?: unknown }): Promise<LaunchedHarness> {
  const ctx = await launchWithExtension();
  const sw = await getServiceWorker(ctx);
  sw.on("console", (msg) => console.log("[sw]", msg.text()));
  const extId = new URL(sw.url()).host;
  await waitForInstallMigration(sw);

  if (opts?.seed !== undefined) {
    await sw.evaluate(async (seed: unknown) => {
      await chrome.storage.local.set({ analyserConfigs: seed });
    }, opts.seed);
  }

  const panel = await ctx.newPage();
  panel.on("console", (msg) => console.log("[panel]", msg.text()));
  panel.on("pageerror", (err) => console.log("[panel error]", err.message));
  await panel.goto(`chrome-extension://${extId}/src/side-panel/index.html`);
  await expect(panel.getByRole("button", { name: "Export all" })).toBeVisible({ timeout: 5000 });
  await waitForPanelPortReady(panel);

  const page = await ctx.newPage();
  page.on("console", (msg) => console.log("[page]", msg.text()));
  page.on("pageerror", (err) => console.log("[page error]", err.message));

  return { ctx, sw, panel, page, extId };
}

async function getServiceWorker(ctx: import("@playwright/test").BrowserContext) {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 5000 });
  return sw;
}

import { defineManifest } from "@crxjs/vite-plugin";
import { readFileSync } from "node:fs";

// Single source of version truth: `npm version` bumps package.json (+lockfile),
// and the build reads it from here. Keeps the manifest, the zip filename, and
// the npm version from ever drifting apart.
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { version: string };

export default defineManifest({
  manifest_version: 3,
  name: "Network Data Viewer",
  version,
  minimum_chrome_version: "116",
  description: "Configurable network-data capture and analysis.",
  permissions: ["storage", "sidePanel", "offscreen"],
  host_permissions: ["<all_urls>"],
  background: { service_worker: "src/background/service-worker.ts", type: "module" },
  side_panel: { default_path: "src/side-panel/index.html" },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/main-world.ts"],
      run_at: "document_start",
      world: "MAIN",
      all_frames: true
    },
    {
      matches: ["<all_urls>"],
      js: ["src/content/bridge.ts"],
      run_at: "document_start",
      world: "ISOLATED",
      all_frames: true
    }
  ],
  sandbox: { pages: ["src/sandbox/sandbox.html"] },
  // No web_accessible_resources: the sandbox page is loaded only by our own
  // offscreen document via chrome.runtime.getURL(), which does not require the
  // resource to be web-accessible. Exposing it to <all_urls> would let any page
  // embed it, so we keep it private.
  icons: { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
  action: {
    default_title: "Network Data Viewer",
    default_icon: { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  }
});

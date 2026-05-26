import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Network Data Viewer",
  version: "0.2.1",
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
  web_accessible_resources: [
    { resources: ["src/sandbox/sandbox.html"], matches: ["<all_urls>"] }
  ],
  icons: { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
  action: {
    default_title: "Network Data Viewer",
    default_icon: { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  }
});

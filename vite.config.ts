import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";
import path from "node:path";
import { analyserSeeds } from "./vite/plugins/analyser-seeds";

export default defineConfig({
  plugins: [react(), crx({ manifest }), analyserSeeds({ examplesDir: path.resolve(__dirname, "src/examples") })],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: { offscreen: path.resolve(__dirname, "src/offscreen/offscreen.html") },
    },
  },
  server: { port: 8001, strictPort: true, hmr: { port: 8001 } }
});

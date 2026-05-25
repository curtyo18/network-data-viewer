import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: { viewport: { width: 1280, height: 720 } }
});

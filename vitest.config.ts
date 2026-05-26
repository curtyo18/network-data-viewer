import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup-rtl.ts"],
    coverage: { reporter: ["text", "html"] }
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } }
});

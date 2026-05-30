import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@opengraph-creator/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@opengraph-creator/render": fileURLToPath(new URL("./packages/render/src/index.ts", import.meta.url)),
      "@opengraph-creator/render/browser": fileURLToPath(new URL("./packages/render/src/browser.ts", import.meta.url))
    }
  }
});

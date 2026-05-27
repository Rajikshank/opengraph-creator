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
      "@graphforge/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@graphforge/render": fileURLToPath(new URL("./packages/render/src/index.ts", import.meta.url)),
      "@graphforge/render/browser": fileURLToPath(new URL("./packages/render/src/browser.ts", import.meta.url))
    }
  }
});

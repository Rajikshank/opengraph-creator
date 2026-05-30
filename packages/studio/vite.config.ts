import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: [
      {
        find: "@opengraph-creator/render/browser",
        replacement: fileURLToPath(new URL("../render/src/browser.ts", import.meta.url))
      },
      {
        find: "@opengraph-creator/render",
        replacement: fileURLToPath(new URL("../render/src/index.ts", import.meta.url))
      },
      {
        find: "@opengraph-creator/core",
        replacement: fileURLToPath(new URL("../core/src/index.ts", import.meta.url))
      }
    ]
  }
});

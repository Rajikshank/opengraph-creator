import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const studioRoot = join(repoRoot, "packages", "studio");

describe("studio design system setup", () => {
  it("wires Tailwind v4 and shadcn-compatible primitives into the studio package", () => {
    const packageJson = JSON.parse(readFileSync(join(studioRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const styles = readFileSync(join(studioRoot, "src", "styles.css"), "utf8");
    const viteConfig = readFileSync(join(studioRoot, "vite.config.ts"), "utf8");

    expect(packageJson.devDependencies).toMatchObject({
      "@tailwindcss/vite": expect.any(String),
      tailwindcss: expect.any(String)
    });
    expect(packageJson.dependencies).toMatchObject({
      "@radix-ui/react-slot": expect.any(String),
      "class-variance-authority": expect.any(String),
      "tailwind-merge": expect.any(String)
    });
    expect(viteConfig).toContain("@tailwindcss/vite");
    expect(styles).toContain('@import "tailwindcss"');
    expect(styles).toContain("@theme inline");
    expect(styles).toContain("--color-background: var(--background)");
    expect(styles).toContain("--color-primary: var(--primary)");
    expect(existsSync(join(studioRoot, "src", "components", "ui", "button.tsx"))).toBe(true);
  });
});

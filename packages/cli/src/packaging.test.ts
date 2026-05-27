import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cliPackage = JSON.parse(readFileSync(join(process.cwd(), "packages", "cli", "package.json"), "utf8")) as {
  files: string[];
  scripts: Record<string, string>;
};
const rootPackage = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("CLI package layout", () => {
  it("bundles the built studio assets for npx usage", () => {
    expect(cliPackage.files).toContain("studio-dist");
    expect(cliPackage.files).toContain("codex-skill");
    expect(cliPackage.scripts.build).toContain("copy-studio-dist");
  });

  it("exposes a packed-install smoke so npx-style usage is verified", () => {
    expect(rootPackage.scripts["smoke:package"]).toBe("node scripts/package-install-smoke.mjs");
  });
});

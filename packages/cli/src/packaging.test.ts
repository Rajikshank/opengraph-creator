import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cliPackage = JSON.parse(readFileSync(join(process.cwd(), "packages", "cli", "package.json"), "utf8")) as {
  name: string;
  bin: Record<string, string>;
  bundledDependencies?: string[];
  bundleDependencies?: string[];
  dependencies: Record<string, string>;
  files: string[];
  scripts: Record<string, string>;
};
const cliReadme = readFileSync(join(process.cwd(), "packages", "cli", "README.md"), "utf8");
const rootPackage = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("CLI package layout", () => {
  it("bundles the built studio assets for npx usage", () => {
    expect(cliPackage.name).toBe("opengraph-creator");
    expect(cliPackage.bin["opengraph-creator"]).toBe("dist/index.js");
    expect(Object.keys(cliPackage.bin)).toEqual(["opengraph-creator"]);
    expect(cliPackage.files).toContain("dist");
    expect(cliPackage.files).toContain("studio-dist");
    expect(cliPackage.files).toContain("bundled-skill");
    expect(cliPackage.files).not.toContain("codex-skill");
    expect(cliPackage.bundledDependencies).toEqual(expect.arrayContaining(["@opengraph-creator/core", "@opengraph-creator/render"]));
    expect(cliPackage.bundleDependencies).toEqual(expect.arrayContaining(["@opengraph-creator/core", "@opengraph-creator/render"]));
    expect(cliPackage.dependencies.sharp).toBeTruthy();
    expect(cliPackage.scripts.build).toContain("copy-studio-dist");
  });

  it("exposes a packed-install smoke so npx-style usage is verified", () => {
    expect(rootPackage.scripts["smoke:package"]).toBe("node scripts/package-install-smoke.mjs");
  });

  it("documents the public npx skill and runtime flow in the npm README", () => {
    expect(cliReadme).toContain("## Install Skill");
    expect(cliReadme).toContain("### Install For All Supported Agents");
    expect(cliReadme).toContain('npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent "*" -y');
    expect(cliReadme).toContain("### Install For One Agent");
    expect(cliReadme).toContain("npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent codex -y");
    expect(cliReadme).toContain("npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent claude-code -y");
    expect(cliReadme).toContain("npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent opencode -y");
    expect(cliReadme).toContain("### Install For Selected Agents");
    expect(cliReadme).toContain("npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator -a codex -a opencode -y");
    expect(cliReadme).toContain('`--agent "*"` targets every supported detected agent');
    expect(cliReadme).toContain("`opengraph-creator install-skill` is a fallback repair command");
    expect(cliReadme).toContain("opengraph-creator install-skill --agent all --scope global");
    expect(cliReadme).toContain("npx -y opengraph-creator@latest doctor --json");
    expect(cliReadme).toContain("npx -y opengraph-creator@latest studio --repo .");
    expect(cliReadme).toContain("## Agent Workflow");
    expect(cliReadme).toContain("## Update Skill And Runtime");
    expect(cliReadme).toContain("## Troubleshooting");
  });
});

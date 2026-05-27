import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("workflow smoke command", () => {
  it("is exposed as a package script and backed by a local workflow verifier", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["smoke:workflow"]).toBe("node scripts/workflow-smoke.mjs");
    expect(packageJson.scripts["smoke:agent-handoff"]).toBe("node scripts/agent-handoff-smoke.mjs");
    expect(packageJson.scripts["smoke:ai-live"]).toBeUndefined();
    expect(existsSync(join(root, "scripts", "workflow-smoke.mjs"))).toBe(true);
    expect(existsSync(join(root, "scripts", "agent-handoff-smoke.mjs"))).toBe(true);
  });
});

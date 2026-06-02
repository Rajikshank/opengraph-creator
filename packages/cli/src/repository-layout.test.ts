import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function trackedFiles(path: string): string[] {
  const result = spawnSync("git", ["ls-files", path], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ls-files failed for ${path}`);
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

describe("repository layout", () => {
  it("keeps one authored skill source and leaves package copies as build output", () => {
    expect(readFileSync(join(process.cwd(), "skills", "opengraph-creator", "SKILL.md"), "utf8")).toContain("name: opengraph-creator");
    expect(trackedFiles("packages/codex-skill")).toEqual([]);
    expect(trackedFiles("packages/cli/codex-skill")).toEqual([]);
  });

  it("keeps generated Studio bundle assets out of source control", () => {
    expect(trackedFiles("packages/cli/studio-dist")).toEqual([]);
  });
});

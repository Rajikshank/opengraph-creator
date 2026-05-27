import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { installCodexSkill } from "./skill-install";

describe("skill installer", () => {
  it("copies the GraphForge skill into a target skills directory", async () => {
    const target = await mkdtemp(join(tmpdir(), "graphforge-skill-"));

    const result = await installCodexSkill({ targetSkillsDir: target });
    const installed = await readFile(join(target, "graphforge-og-studio", "SKILL.md"), "utf8");

    expect(result.skillDir).toBe(join(target, "graphforge-og-studio"));
    expect(installed).toContain(".ogdoc");
    expect(installed).toContain("session launch");
    expect(installed).toContain("preview before applying metadata");
    await expect(stat(join(target, "graphforge-og-studio", "agents", "openai.yaml"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(join(target, "graphforge-og-studio", "references", "agent-handoff.md"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(join(target, "graphforge-og-studio", "scripts", "ensure-graphforge.mjs"))).resolves.toMatchObject({ size: expect.any(Number) });
  });

  it("installs the same lightweight skill for Codex, Claude, and OpenCode", async () => {
    const home = await mkdtemp(join(tmpdir(), "graphforge-skill-agents-"));

    const result = await installCodexSkill({ home, agent: "all" });

    expect(result.installs.map((install) => install.agent)).toEqual(["codex", "claude", "opencode"]);
    await expect(stat(join(home, ".codex", "skills", "graphforge-og-studio", "SKILL.md"))).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(join(home, ".claude", "skills", "graphforge-og-studio", "SKILL.md"))).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(join(home, ".opencode", "skills", "graphforge-og-studio", "SKILL.md"))).resolves.toMatchObject({
      size: expect.any(Number)
    });
  });
});

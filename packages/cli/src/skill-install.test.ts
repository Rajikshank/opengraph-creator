import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { installCodexSkill } from "./skill-install";

describe("skill installer", () => {
  it("copies the OpenGraph Creator skill into a target skills directory", async () => {
    const target = await mkdtemp(join(tmpdir(), "OpenGraphCreator-skill-"));

    const result = await installCodexSkill({ targetSkillsDir: target });
    const installed = await readFile(join(target, "opengraph-creator", "SKILL.md"), "utf8");

    expect(result.skillDir).toBe(join(target, "opengraph-creator"));
    expect(installed).toContain("name: opengraph-creator");
    expect(installed).toContain(".ogdoc");
    expect(installed).toContain("Non-Negotiable Editable Master Rule");
    expect(installed).toContain("A vague prompt such as \"create me an electrifying OG image\" is not permission to generate immediately");
    expect(installed).toContain("assetStrategy");
    expect(installed).toContain("opengraph-creator brief lint");
    expect(installed).toContain("session launch");
    expect(installed).toContain("--until next-action");
    expect(installed).toContain("agent-request.json");
    expect(installed).toContain("publish-request.json");
    expect(installed).toContain("preview before applying metadata");
    expect(installed).toContain("npx skills check");
    expect(installed).toContain("npx skills update");
    await expect(stat(join(target, "opengraph-creator", "agents", "openai.yaml"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(join(target, "opengraph-creator", "references", "agent-handoff.md"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(join(target, "opengraph-creator", "references", "workflow.md"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(join(target, "opengraph-creator", "scripts", "ensure-opengraph-creator.mjs"))).resolves.toMatchObject({ size: expect.any(Number) });
  });

  it("installs the same lightweight skill for Codex, Claude, and OpenCode", async () => {
    const home = await mkdtemp(join(tmpdir(), "OpenGraphCreator-skill-agents-"));

    const result = await installCodexSkill({ home, agent: "all" });

    expect(result.installs.map((install) => install.agent)).toEqual(["codex", "claude", "opencode", "opencode"]);
    await expect(stat(join(home, ".codex", "skills", "opengraph-creator", "SKILL.md"))).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(join(home, ".claude", "skills", "opengraph-creator", "SKILL.md"))).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(join(home, ".config", "opencode", "skill", "opengraph-creator", "SKILL.md"))).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(join(home, ".config", "opencode", "skills", "opengraph-creator", "SKILL.md"))).resolves.toMatchObject({
      size: expect.any(Number)
    });
  });

  it("supports project fallback paths for Codex and OpenCode", async () => {
    const project = await mkdtemp(join(tmpdir(), "opengraph-skill-project-"));

    const opencode = await installCodexSkill({ project, agent: "opencode", scope: "project" });
    const codex = await installCodexSkill({ project, agent: "codex", scope: "project" });

    expect(opencode.skillDir).toBe(join(project, ".opencode", "skill", "opengraph-creator"));
    await expect(stat(join(project, ".opencode", "skill", "opengraph-creator", "SKILL.md"))).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(join(project, ".agents", "skills", "opengraph-creator", "SKILL.md"))).resolves.toMatchObject({
      size: expect.any(Number)
    });
    expect(codex.skillDir).toBe(join(project, ".codex", "skills", "opengraph-creator"));
    await expect(stat(join(project, ".codex", "skills", "opengraph-creator", "SKILL.md"))).resolves.toMatchObject({
      size: expect.any(Number)
    });
  });
});

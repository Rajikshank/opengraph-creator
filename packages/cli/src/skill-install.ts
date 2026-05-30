import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface InstallSkillInput {
  targetSkillsDir?: string;
  agent?: "codex" | "claude" | "claude-code" | "opencode" | "all";
  home?: string;
  project?: string;
  scope?: "global" | "project";
}

export interface InstallSkillResult {
  skillDir: string;
  skillFile: string;
  installs: Array<{ agent: "codex" | "claude" | "opencode" | "custom"; skillDir: string; skillFile: string }>;
}

export const OPEN_GRAPH_CREATOR_SKILL_SLUG = "opengraph-creator";

export async function installCodexSkill(input: InstallSkillInput): Promise<InstallSkillResult> {
  const targetDirs = getTargetDirs(input);
  const installs: InstallSkillResult["installs"] = [];
  for (const target of targetDirs) {
    const skillDir = join(target.dir, OPEN_GRAPH_CREATOR_SKILL_SLUG);
    const skillFile = join(skillDir, "SKILL.md");
    await mkdir(target.dir, { recursive: true });
    await cp(await getBundledSkillDir(), skillDir, { recursive: true, force: true });
    installs.push({ agent: target.agent, skillDir, skillFile });
  }
  const first = installs[0];
  return { skillDir: first.skillDir, skillFile: first.skillFile, installs };
}

function getTargetDirs(input: InstallSkillInput): Array<{ agent: "codex" | "claude" | "opencode" | "custom"; dir: string }> {
  if (input.targetSkillsDir) return [{ agent: "custom", dir: input.targetSkillsDir }];
  const home = input.home ?? process.env.USERPROFILE ?? process.env.HOME ?? process.cwd();
  const agent = input.agent === "claude-code" ? "claude" : input.agent ?? "codex";
  const scope = input.scope ?? "global";
  const project = input.project ?? process.cwd();
  if (scope === "project") {
    const projectTargets = {
      codex: [join(project, ".codex", "skills"), join(project, ".agents", "skills")],
      claude: join(project, ".claude", "skills"),
      opencode: [join(project, ".opencode", "skill"), join(project, ".agents", "skills")]
    };
    if (agent === "all") {
      return [
        ...projectTargets.codex.map((dir) => ({ agent: "codex" as const, dir })),
        { agent: "claude", dir: projectTargets.claude },
        ...projectTargets.opencode.map((dir) => ({ agent: "opencode" as const, dir }))
      ];
    }
    const dirs = projectTargets[agent];
    return Array.isArray(dirs) ? dirs.map((dir) => ({ agent, dir })) : [{ agent, dir: dirs }];
  }
  const targets = {
    codex: join(home, ".codex", "skills"),
    claude: join(home, ".claude", "skills"),
    opencode: [join(home, ".config", "opencode", "skill"), join(home, ".config", "opencode", "skills")]
  };
  if (agent === "all") {
    return [
      { agent: "codex", dir: targets.codex },
      { agent: "claude", dir: targets.claude },
      ...targets.opencode.map((dir) => ({ agent: "opencode" as const, dir }))
    ];
  }
  const dirs = targets[agent];
  return Array.isArray(dirs) ? dirs.map((dir) => ({ agent, dir })) : [{ agent, dir: dirs }];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function getBundledSkillDir(): Promise<string> {
  const current = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(current, "..", "..", "codex-skill"),
    resolve(current, "..", "codex-skill")
  ];

  for (const candidate of candidates) {
    if (await fileExists(join(candidate, "SKILL.md"))) {
      return candidate;
    }
  }

  return candidates[0];
}

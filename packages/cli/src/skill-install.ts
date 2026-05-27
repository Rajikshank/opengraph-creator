import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface InstallSkillInput {
  targetSkillsDir?: string;
  agent?: "codex" | "claude" | "opencode" | "all";
  home?: string;
}

export interface InstallSkillResult {
  skillDir: string;
  skillFile: string;
  installs: Array<{ agent: "codex" | "claude" | "opencode" | "custom"; skillDir: string; skillFile: string }>;
}

export async function installCodexSkill(input: InstallSkillInput): Promise<InstallSkillResult> {
  const targetDirs = getTargetDirs(input);
  const installs: InstallSkillResult["installs"] = [];
  for (const target of targetDirs) {
    const skillDir = join(target.dir, "graphforge-og-studio");
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
  const agent = input.agent ?? "codex";
  const targets = {
    codex: join(home, ".codex", "skills"),
    claude: join(home, ".claude", "skills"),
    opencode: join(home, ".opencode", "skills")
  };
  if (agent === "all") {
    return [
      { agent: "codex", dir: targets.codex },
      { agent: "claude", dir: targets.claude },
      { agent: "opencode", dir: targets.opencode }
    ];
  }
  return [{ agent, dir: targets[agent] }];
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

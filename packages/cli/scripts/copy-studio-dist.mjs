import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(cliRoot, "..", "..");
const source = resolve(repoRoot, "packages", "studio", "dist");
const target = resolve(cliRoot, "studio-dist");
const skillSource = resolve(repoRoot, "skills", "opengraph-creator");
const skillTarget = resolve(cliRoot, "bundled-skill");
const legacySkillTarget = resolve(cliRoot, "codex-skill");

try {
  const info = await stat(source);
  if (!info.isDirectory()) throw new Error(`${source} is not a directory`);
} catch {
  throw new Error("Studio dist is missing. Build @opengraph-creator/studio before opengraph-creator.");
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

await rm(skillTarget, { recursive: true, force: true });
await rm(legacySkillTarget, { recursive: true, force: true });
await mkdir(skillTarget, { recursive: true });
await cp(skillSource, skillTarget, { recursive: true });

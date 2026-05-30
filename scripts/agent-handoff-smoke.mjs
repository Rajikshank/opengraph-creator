import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = await mkdtemp(join(tmpdir(), "OpenGraphCreator-agent-handoff-"));
const projectPath = join(workspace, "agent.og.json");
const planPath = join(workspace, "agent-handoff.json");
const cli = ["packages/cli/dist/index.js"];

await mkdir(workspace, { recursive: true });
await runOpenGraphCreator([
  "new",
  "--name",
  "Agent Handoff Smoke",
  "--strategy",
  "hybrid",
  "--mode",
  "pure-image",
  "--preset",
  "agent-canvas",
  "--pages",
  "/,/pricing",
  "--out",
  projectPath
]);
await runOpenGraphCreator([
  "agent-handoff",
  "--project",
  projectPath,
  "--prompt",
  "Create a premium unique social card and return it to Studio.",
  "--out",
  join(workspace, "public", "og-agent.png"),
  "--plan",
  planPath
]);

const plan = JSON.parse(await readFile(planPath, "utf8"));
const project = JSON.parse(await readFile(projectPath, "utf8"));
const serialized = JSON.stringify(plan);

assert(project.generationMode === "pure-image", "project did not preserve pure-image generation mode");
assert(project.layers.some((layer) => layer.kind === "screenshot"), "agent-canvas direction should include a generated preview layer");
assert(plan.mode === "agent-handoff", "plan did not use agent-handoff mode");
assert(plan.agent === "codex-claude-or-opencode", "plan did not target coding agents");
assert(plan.prompt.includes("Codex, Claude, or OpenCode"), "plan prompt did not name the coding agent path");
assert(plan.prompt.includes("Agent Handoff Smoke"), "plan prompt did not include project context");
assert(plan.expectedArtifact.width === 1200 && plan.expectedArtifact.height === 630, "plan did not preserve OG dimensions");
assert(!serialized.includes("OPENAI_API_KEY"), "plan should not require provider credentials");
assert(!serialized.toLowerCase().includes("https://api.openai.com"), "plan should not call a provider endpoint");

console.log(JSON.stringify({ ok: true, workspace, project: projectPath, plan: planPath }, null, 2));

async function runOpenGraphCreator(args) {
  return run(process.execPath, [...cli, ...args], { cwd: root });
}

function run(command, args, options) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { ...options, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) resolveRun({ stdout, stderr });
      else rejectRun(new Error(`${command} ${args.join(" ")} failed with ${code}\n${stdout}\n${stderr}`));
    });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

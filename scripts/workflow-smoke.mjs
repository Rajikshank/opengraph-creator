import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = await mkdtemp(join(tmpdir(), "graphforge-workflow-"));
const appRepo = join(workspace, "app");
const home = join(workspace, "home");
const cli = ["packages/cli/dist/index.js"];

await mkdir(appRepo, { recursive: true });
await writeFile(
  join(appRepo, "index.html"),
  [
    "<!doctype html>",
    "<html>",
    "  <head><title>Workflow App</title></head>",
    "  <body><main id=\"root\">Workflow App</main></body>",
    "</html>"
  ].join("\n"),
  "utf8"
);

const briefPath = join(workspace, "brief.json");
const pureBriefPath = join(workspace, "brief-pure-image.json");
const projectPath = join(workspace, "workflow.og.json");
const documentPath = join(workspace, "workflow.ogdoc");
const variantsDir = join(workspace, "variants");
const renderPath = join(appRepo, "public", "og.svg");
const exportPath = join(appRepo, "public", "og.webp");
const agentPlanPath = join(workspace, "agent-plan.json");
const sessionId = "workflow-session";

await mkdir(dirname(exportPath), { recursive: true });
await runGraphForge(["doctor", "--home", home, "--json"]);
await runGraphForge(["session", "create", "--repo", appRepo, "--id", sessionId, "--agent", "codex", "--strategy", "hybrid"]);
await runGraphForge(["brief", "--repo", appRepo, "--name", "Workflow App", "--strategy", "hybrid", "--mode", "template", "--out", briefPath]);
await runGraphForge(["brief", "--repo", appRepo, "--name", "Workflow App", "--strategy", "common", "--mode", "pure-image", "--out", pureBriefPath]);
await runGraphForge(["new", "--name", "Workflow App", "--strategy", "pages", "--mode", "pure-image", "--repo", appRepo, "--pages", "/,/pricing", "--out", projectPath, "--library", "true", "--home", home]);
await runGraphForge(["document", "pack", "--project", projectPath, "--out", documentPath]);
await runGraphForge(["document", "validate", "--source", documentPath]);
await runGraphForge(["variants", "--project", projectPath, "--outDir", variantsDir, "--library", "true", "--home", home]);
await runGraphForge(["render", "--project", projectPath, "--out", renderPath]);
await runGraphForge(["export", "--project", projectPath, "--format", "webp", "--quality", "82", "--out", exportPath, "--session", sessionId, "--repo", appRepo]);
await runGraphForge(["agent-handoff", "--project", projectPath, "--prompt", "premium local workflow smoke", "--out", join(appRepo, "public", "og-agent.png"), "--plan", agentPlanPath]);
const preview = await runGraphForge(["publish", "--preview", "--repo", appRepo, "--session", sessionId, "--framework", "vite", "--image", "public/og.webp"]);
await runGraphForge(["publish", "--confirm", "--repo", appRepo, "--session", sessionId, "--framework", "vite", "--image", "public/og.webp"]);

const brief = JSON.parse(await readFile(briefPath, "utf8"));
const pureBrief = JSON.parse(await readFile(pureBriefPath, "utf8"));
const project = JSON.parse(await readFile(projectPath, "utf8"));
const document = await stat(documentPath);
const html = await readFile(join(appRepo, "index.html"), "utf8");
const renderedSvg = await readFile(renderPath, "utf8");
const image = await stat(exportPath);
const plan = JSON.parse(await readFile(agentPlanPath, "utf8"));
const previewPlan = JSON.parse(preview.stdout);
const session = JSON.parse(await readFile(join(appRepo, ".graphforge", "sessions", sessionId, "session.json"), "utf8"));

assert(brief.codexPrompt.includes("Workflow App"), "brief did not include Codex prompt context");
assert(brief.generationMode === "template", "template brief did not preserve generation mode");
assert(pureBrief.generationMode === "pure-image", "pure-image brief did not preserve generation mode");
assert(pureBrief.codexPrompt.includes("agent image handoff"), "pure-image brief did not describe the agent handoff path");
assert(project.targetPages.length === 2, "project did not preserve requested page targets");
assert(project.generationMode === "pure-image", "project did not preserve requested generation mode");
assert(document.size > 1_000, `Studio document package is unexpectedly small: ${document.size}`);
assert(renderedSvg.includes("Workflow App"), "render --project did not use the editable project file");
assert(image.size > 10_000, `exported webp is unexpectedly small: ${image.size}`);
assert(html.includes('<meta property="og:image" content="/og.webp">'), "metadata apply did not upsert og:image");
assert(html.includes('<meta name="twitter:image" content="/og.webp">'), "metadata apply did not upsert twitter:image");
assert(plan.mode === "agent-handoff", "agent handoff plan did not preserve handoff mode");
assert(plan.prompt.includes("premium local workflow smoke"), "agent handoff plan did not include art direction");
assert(!JSON.stringify(plan).includes("OPENAI_API_KEY"), "agent handoff plan should not require provider credentials");
assert(previewPlan.request.status === "preview" && previewPlan.plan.mode === "preview", "publish preview was not mutation-free");
assert(session.exports.some((item) => item.path === exportPath && item.format === "webp"), "session did not record workflow export");
assert(session.publishRequests.some((item) => item.status === "confirmed"), "session did not record confirmed publish request");

console.log(
  JSON.stringify(
    {
      ok: true,
      workspace,
      brief: briefPath,
      pureBrief: pureBriefPath,
      project: projectPath,
      document: documentPath,
      render: renderPath,
      export: exportPath,
      exportBytes: image.size,
      agentPlan: agentPlanPath
    },
    null,
    2
  )
);

async function runGraphForge(args) {
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

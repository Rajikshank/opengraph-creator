import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = await mkdtemp(join(tmpdir(), "OpenGraphCreator-workflow-"));
const appRepo = join(workspace, "app");
const home = join(workspace, "home");
const cli = ["packages/cli/dist/index.js"];

await mkdir(appRepo, { recursive: true });
await mkdir(join(appRepo, "app", "pricing"), { recursive: true });
await mkdir(join(appRepo, "public"), { recursive: true });
await writeFile(join(appRepo, "next.config.js"), "module.exports = {}\n", "utf8");
await writeFile(
  join(appRepo, "app", "layout.tsx"),
  "export default function RootLayout({ children }) { return <html><body>{children}</body></html> }\n",
  "utf8"
);
await writeFile(
  join(appRepo, "app", "page.tsx"),
  'export const metadata = { title: "Workflow App Home", description: "A practical workflow test app." }; export default function Page() { return <main>Workflow App</main> }\n',
  "utf8"
);
await writeFile(
  join(appRepo, "app", "pricing", "page.tsx"),
  'export const metadata = { title: "Workflow Pricing", description: "Clear page-specific pricing context." }; export default function Pricing() { return <main>Pricing</main> }\n',
  "utf8"
);

const briefPath = join(workspace, "brief.json");
const pureBriefPath = join(workspace, "brief-pure-image.json");
const projectPath = join(workspace, "workflow.og.json");
const documentPath = join(workspace, "workflow.ogdoc");
const variantsDir = join(workspace, "variants");
const renderPath = join(appRepo, "public", "og.svg");
const exportPath = join(appRepo, "public", "og.webp");
const pageExportHomePath = join(appRepo, "public", "og", "home.webp");
const pageExportPricingPath = join(appRepo, "public", "og", "pricing.webp");
const agentPlanPath = join(workspace, "agent-plan.json");
const sessionId = "workflow-session";

await mkdir(dirname(exportPath), { recursive: true });
await runOpenGraphCreator(["doctor", "--home", home, "--json"]);
await runOpenGraphCreator(["session", "create", "--repo", appRepo, "--id", sessionId, "--agent", "codex", "--strategy", "hybrid"]);
await runOpenGraphCreator(["brief", "--repo", appRepo, "--name", "Workflow App", "--strategy", "hybrid", "--mode", "template", "--out", briefPath]);
await runOpenGraphCreator(["brief", "--repo", appRepo, "--name", "Workflow App", "--strategy", "common", "--mode", "pure-image", "--out", pureBriefPath]);
await runOpenGraphCreator(["new", "--name", "Workflow App", "--strategy", "pages", "--mode", "pure-image", "--repo", appRepo, "--pages", "/,/pricing", "--out", projectPath, "--library", "true", "--home", home]);
await runOpenGraphCreator(["document", "pack", "--project", projectPath, "--out", documentPath]);
await runOpenGraphCreator(["document", "validate", "--source", documentPath]);
await runOpenGraphCreator(["variants", "--project", projectPath, "--outDir", variantsDir, "--library", "true", "--home", home]);
await runOpenGraphCreator(["render", "--project", projectPath, "--out", renderPath]);
await runOpenGraphCreator(["export", "--project", projectPath, "--format", "webp", "--quality", "82", "--out", exportPath, "--session", sessionId, "--repo", appRepo]);
await runOpenGraphCreator(["export", "--project", projectPath, "--format", "webp", "--quality", "82", "--allPages", "true", "--outDir", "public/og", "--session", sessionId, "--repo", appRepo]);
await runOpenGraphCreator(["agent-handoff", "--project", projectPath, "--prompt", "premium local workflow smoke", "--out", join(appRepo, "public", "og-agent.png"), "--plan", agentPlanPath]);
const preview = await runOpenGraphCreator(["publish", "--preview", "--repo", appRepo, "--session", sessionId, "--framework", "next", "--allPages", "true"]);
await runOpenGraphCreator(["publish", "--confirm", "--repo", appRepo, "--session", sessionId, "--framework", "next", "--allPages", "true"]);

const brief = JSON.parse(await readFile(briefPath, "utf8"));
const pureBrief = JSON.parse(await readFile(pureBriefPath, "utf8"));
const project = JSON.parse(await readFile(projectPath, "utf8"));
const document = await stat(documentPath);
const layout = await readFile(join(appRepo, "app", "layout.tsx"), "utf8");
const pricingPage = await readFile(join(appRepo, "app", "pricing", "page.tsx"), "utf8");
const renderedSvg = await readFile(renderPath, "utf8");
const image = await stat(exportPath);
const pageHomeImage = await stat(pageExportHomePath);
const pagePricingImage = await stat(pageExportPricingPath);
const plan = JSON.parse(await readFile(agentPlanPath, "utf8"));
const previewPlan = JSON.parse(preview.stdout);
const session = JSON.parse(await readFile(join(appRepo, ".opengraph-creator", "sessions", sessionId, "session.json"), "utf8"));
const publishRequest = JSON.parse(await readFile(join(appRepo, ".opengraph-creator", "sessions", sessionId, "publish-request.json"), "utf8"));

assert(brief.codexPrompt.includes("Workflow App"), "brief did not include Codex prompt context");
assert(brief.codexPrompt.includes("Route context:"), "brief did not include route context");
assert(brief.generationMode === "template", "template brief did not preserve generation mode");
assert(pureBrief.generationMode === "pure-image", "pure-image brief did not preserve generation mode");
assert(pureBrief.codexPrompt.includes("agent image handoff"), "pure-image brief did not describe the agent handoff path");
assert(project.targetPages.length === 2, "project did not preserve requested page targets");
assert(project.generationMode === "pure-image", "project did not preserve requested generation mode");
assert(document.size > 1_000, `Studio document package is unexpectedly small: ${document.size}`);
assert(renderedSvg.includes("Workflow App"), "render --project did not use the editable project file");
assert(image.size > 5_000, `exported webp is unexpectedly small: ${image.size}`);
assert(pageHomeImage.size > 5_000, `home page export is unexpectedly small: ${pageHomeImage.size}`);
assert(pagePricingImage.size > 5_000, `pricing page export is unexpectedly small: ${pagePricingImage.size}`);
assert(layout.includes("/og/home.webp"), "home metadata apply did not upsert page-specific og:image");
assert(pricingPage.includes("/og/pricing.webp"), "pricing metadata apply did not upsert page-specific og:image");
assert(plan.mode === "agent-handoff", "agent handoff plan did not preserve handoff mode");
assert(plan.prompt.includes("premium local workflow smoke"), "agent handoff plan did not include art direction");
assert(!JSON.stringify(plan).includes("OPENAI_API_KEY"), "agent handoff plan should not require provider credentials");
assert(previewPlan.request.status === "preview" && previewPlan.plan.mode === "preview", "publish preview was not mutation-free");
assert(previewPlan.request.pageImages?.length === 2, "publish preview did not include page image mappings");
assert(publishRequest.pageImages?.some((item) => item.page === "/pricing" && item.imagePath === "public/og/pricing.webp"), "confirmed publish request did not preserve pricing page mapping");
assert(session.exports.some((item) => item.path === exportPath && item.format === "webp"), "session did not record workflow export");
assert(session.exports.some((item) => item.path === "public/og/pricing.webp" && item.page === "/pricing"), "session did not record page-specific export");
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
      pageExports: [pageExportHomePath, pageExportPricingPath],
      exportBytes: image.size,
      agentPlan: agentPlanPath
    },
    null,
    2
  )
);

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

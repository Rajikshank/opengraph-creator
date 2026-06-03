import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCli = process.env.npm_execpath;
const workspace = await mkdtemp(join(tmpdir(), "OpenGraphCreator-package-"));
const coreTarball = await packWorkspace("@opengraph-creator/core");
const renderTarball = await packWorkspace("@opengraph-creator/render");
const cliTarball = await packWorkspace("opengraph-creator");
const appDir = join(workspace, "app");
const cliOnlyAppDir = join(workspace, "cli-only-app");
const homeDir = join(workspace, "home");
const sessionId = "packed-session";
const projectPath = join(workspace, "installed.og.json");
const documentPath = join(workspace, "installed.ogdoc");
const svgPath = join(workspace, "public", "og.svg");
const jpgPath = join(appDir, "public", "og.jpg");
const cliOnlyProjectPath = join(cliOnlyAppDir, "cli-only.og.json");
const cliOnlyDocumentPath = join(cliOnlyAppDir, "cli-only.ogdoc");
const cliOnlyPngPath = join(cliOnlyAppDir, "public", "og.png");

await mkdir(appDir, { recursive: true });
await mkdir(cliOnlyAppDir, { recursive: true });
await writeFile(join(appDir, "package.json"), JSON.stringify({ type: "module", private: true }), "utf8");
await writeFile(join(cliOnlyAppDir, "package.json"), JSON.stringify({ type: "module", private: true }), "utf8");
await writeFile(
  join(appDir, "index.html"),
  "<!doctype html><html><head><title>Packed App</title></head><body><main>Packed App</main></body></html>",
  "utf8"
);
await runNpm(["install", cliTarball, "--no-audit", "--no-fund"], { cwd: cliOnlyAppDir });
await runCommand(["doctor", "--json"], cliOnlyAppDir);
await runCommand(["new", "--name", "CliOnly", "--strategy", "common", "--mode", "template", "--out", cliOnlyProjectPath], cliOnlyAppDir);
await runCommand(["document", "pack", "--project", cliOnlyProjectPath, "--out", cliOnlyDocumentPath], cliOnlyAppDir);
await runCommand(["document", "validate", "--source", cliOnlyDocumentPath], cliOnlyAppDir);
await runCommand(["export", "--project", cliOnlyProjectPath, "--format", "png", "--out", cliOnlyPngPath], cliOnlyAppDir);
await runNpm(["install", coreTarball, renderTarball, cliTarball, "--no-audit", "--no-fund"], { cwd: appDir });
await runCommand(["doctor", "--json"]);
await runCommand(["install-skill", "--agent", "all", "--home", homeDir]);
await runCommand(["session", "create", "--repo", appDir, "--id", sessionId, "--agent", "codex", "--home", homeDir]);
await runCommand(["new", "--name", "PackedApp", "--strategy", "hybrid", "--mode", "template", "--out", projectPath]);
await runCommand(["document", "pack", "--project", projectPath, "--out", documentPath]);
await runCommand(["document", "validate", "--source", documentPath]);
await runCommand(["render", "--project", projectPath, "--out", svgPath]);
await runCommand(["export", "--project", projectPath, "--format", "jpg", "--quality", "82", "--out", jpgPath, "--session", sessionId, "--repo", appDir]);
await runCommand(["publish", "--preview", "--repo", appDir, "--session", sessionId, "--framework", "vite", "--image", "public/og.jpg"]);

const project = JSON.parse(await readFile(projectPath, "utf8"));
const documentBytes = await stat(documentPath);
const svg = await readFile(svgPath, "utf8");
const svgInfo = await stat(svgPath);
const jpgInfo = await stat(jpgPath);
const jpgMetadata = await sharp(jpgPath).metadata();
const jpgPixels = await sharp(jpgPath).raw().toBuffer();
const cliOnlyPngInfo = await stat(cliOnlyPngPath);
const cliOnlyPngMetadata = await sharp(cliOnlyPngPath).metadata();
const cliOnlyPngPixels = await sharp(cliOnlyPngPath).raw().toBuffer();
const session = JSON.parse(await readFile(join(appDir, ".opengraph-creator", "sessions", sessionId, "session.json"), "utf8"));
const publishRequest = JSON.parse(await readFile(join(appDir, ".opengraph-creator", "sessions", sessionId, "publish-request.json"), "utf8"));
const html = await readFile(join(appDir, "index.html"), "utf8");
const packages = [coreTarball, renderTarball, cliTarball];

assert(project.name === "PackedApp", "installed opengraph-creator binary did not create the expected project");
assert(project.generationMode === "template", "installed opengraph-creator binary did not preserve generation mode");
assert(documentBytes.size > 1_000, `packed Studio document is unexpectedly small: ${documentBytes.size}`);
assert(svg.includes("PackedApp"), "installed opengraph-creator binary did not render the project SVG");
assert(svgInfo.size > 1_000, `rendered SVG is unexpectedly small: ${svgInfo.size}`);
assert((await stat(join(homeDir, ".codex", "skills", "opengraph-creator", "SKILL.md"))).isFile(), "Codex skill was not installed from the packed CLI");
assert((await stat(join(homeDir, ".claude", "skills", "opengraph-creator", "SKILL.md"))).isFile(), "Claude skill was not installed from the packed CLI");
assert((await stat(join(homeDir, ".config", "opencode", "skills", "opengraph-creator", "SKILL.md"))).isFile(), "OpenCode skill was not installed from the packed CLI");
assert(jpgMetadata.width === 1200 && jpgMetadata.height === 630 && jpgMetadata.format === "jpeg", "JPEG export did not preserve exact OG dimensions");
assert(jpgInfo.size > 10_000 && jpgInfo.size < 1_000_000, `JPEG export size is outside the expected compressed range: ${jpgInfo.size}`);
assert(new Set(jpgPixels.subarray(0, Math.min(jpgPixels.length, 5000))).size > 1, "JPEG export appears blank");
assert(cliOnlyPngMetadata.width === 1200 && cliOnlyPngMetadata.height === 630 && cliOnlyPngMetadata.format === "png", "CLI-only PNG export did not preserve exact OG dimensions");
assert(cliOnlyPngInfo.size > 10_000 && cliOnlyPngInfo.size < 1_000_000, `CLI-only PNG export size is outside the expected compressed range: ${cliOnlyPngInfo.size}`);
assert(new Set(cliOnlyPngPixels.subarray(0, Math.min(cliOnlyPngPixels.length, 5000))).size > 1, "CLI-only PNG export appears blank");
assert(session.exports.some((item) => item.path === jpgPath && item.format === "jpg"), "session did not record the JPEG export");
assert(publishRequest.status === "preview", "publish preview request was not recorded");
assert(!html.includes("og:image"), "publish preview mutated app metadata");

await Promise.all(packages.map((packagePath) => rm(packagePath, { force: true })));

console.log(
  JSON.stringify(
    {
      ok: true,
      workspace,
      packages,
      project: projectPath,
      document: documentPath,
      cliOnlyDocument: cliOnlyDocumentPath,
      render: svgPath,
      renderBytes: svgInfo.size,
      jpeg: jpgPath,
      jpegBytes: jpgInfo.size,
      cliOnlyPng: cliOnlyPngPath,
      cliOnlyPngBytes: cliOnlyPngInfo.size,
      publishStatus: publishRequest.status
    },
    null,
    2
  )
);

async function packWorkspace(name) {
  const packed = await runNpm(["pack", "-w", name, "--json"], { cwd: root });
  const [packInfo] = JSON.parse(packed.stdout);
  return join(root, packInfo.filename);
}

async function runCommand(args, cwd = appDir) {
  const bin = join(cwd, "node_modules", ".bin", process.platform === "win32" ? "opengraph-creator.cmd" : "opengraph-creator");
  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/c", [bin, ...args].join(" ")], { cwd });
  }
  return run(bin, args, { cwd });
}

function runNpm(args, options) {
  if (npmCli) {
    return run(process.execPath, [npmCli, ...args], options);
  }
  return run(process.platform === "win32" ? "npm.cmd" : "npm", args, options);
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

import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentRequest, getSessionPaths, restartGraphForgeSession } from "../packages/cli/dist/session.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = join(root, "packages", "cli", "dist", "index.js");
const repo = await mkdtemp(join(tmpdir(), "graphforge-next-action-"));

await runCli(["session", "create", "--repo", repo, "--id", "agent-loop", "--agent", "codex", "--strategy", "hybrid"]);
const agentWait = waitCli(["session", "wait", "--repo", repo, "--id", "agent-loop", "--until", "next-action", "--timeout", "30000"]);
await delay(250);
await createAgentRequest({
  repo,
  sessionId: "agent-loop",
  prompt: "Revise contrast and keep headline editable.",
  documentPath: getSessionPaths(repo, "agent-loop").documentFile
});
const agentWaitOutput = await agentWait;
if (!agentWaitOutput.includes('"status": "agent-requested"')) {
  throw new Error(`Expected agent-requested next action, got:\n${agentWaitOutput}`);
}

await runCli(["session", "create", "--repo", repo, "--id", "publish-loop", "--agent", "claude", "--strategy", "common"]);
const publishWait = waitCli(["session", "wait", "--repo", repo, "--id", "publish-loop", "--until", "next-action", "--timeout", "30000"]);
await delay(250);
await runCli(["publish", "--confirm", "--repo", repo, "--session", "publish-loop", "--framework", "vite", "--image", "public/og.png"]);
const publishWaitOutput = await publishWait;
if (!publishWaitOutput.includes('"status": "published"') || !publishWaitOutput.includes('"status": "confirmed"')) {
  throw new Error(`Expected published next action, got:\n${publishWaitOutput}`);
}

await runCli(["session", "create", "--repo", repo, "--id", "restart-loop", "--agent", "opencode", "--strategy", "hybrid"]);
const restartWait = waitCli(["session", "wait", "--repo", repo, "--id", "restart-loop", "--until", "next-action", "--timeout", "30000"]);
await delay(250);
await restartGraphForgeSession(repo, "restart-loop", "Smoke test restart");
const restartWaitOutput = await restartWait;
if (!restartWaitOutput.includes('"status": "agent-requested"') || !restartWaitOutput.includes('"pendingAction": "agent-restart-from-question-gate"')) {
  throw new Error(`Expected restart next action, got:\n${restartWaitOutput}`);
}

const request = await readFile(join(repo, ".graphforge", "sessions", "agent-loop", "agent-request.json"), "utf8");
const publish = await readFile(join(repo, ".graphforge", "sessions", "publish-loop", "publish-request.json"), "utf8");
const restart = await readFile(join(repo, ".graphforge", "sessions", "restart-loop", "agent-request.json"), "utf8");
const restartRequest = JSON.parse(restart);
if (!restartRequest.prompt.includes("Generate a fresh editable .ogdoc master") || !restartRequest.prompt.includes("wait again with graphforge session wait --until next-action --timeout 0")) {
  throw new Error(`Restart request did not preserve the regenerate-and-wait loop:\n${restart}`);
}

console.log(JSON.stringify({
  ok: true,
  repo,
  agentRequest: JSON.parse(request).status,
  publishRequest: JSON.parse(publish).status,
  restartRequest: restartRequest.status
}, null, 2));

function runCli(args) {
  return waitCli(args).then((output) => {
    if (/^Error:/m.test(output)) throw new Error(output);
    return output;
  });
}

function waitCli(args) {
  return new Promise((resolveOutput, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: root, windowsHide: true });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolveOutput(output);
      else reject(new Error(output || `graphforge exited with ${code}`));
    });
  });
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

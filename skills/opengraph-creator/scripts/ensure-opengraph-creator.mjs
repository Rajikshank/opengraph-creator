import { spawnSync } from "node:child_process";

const local = spawnSync("opengraph-creator doctor --json", {
  shell: true,
  encoding: "utf8",
  windowsHide: true
});

if (local.status === 0) {
  process.stdout.write(local.stdout);
  process.exit(0);
}

const npx = spawnSync("npx -y opengraph-creator@latest doctor --json", {
  shell: true,
  encoding: "utf8",
  windowsHide: true
});

if (npx.status === 0) {
  process.stdout.write(npx.stdout);
  process.exit(0);
}

process.stdout.write(
  [
    "OpenGraph Creator CLI was not found as a local opengraph-creator command.",
    "The public npx runtime package was also unavailable from this environment.",
    "",
    "After opengraph-creator is published, use:",
    "npx -y opengraph-creator@latest doctor --json",
    "",
    "During local development from the OpenGraph Creator repo, use:",
    "npm run build",
    "npm install -g ./packages/cli",
    "opengraph-creator doctor --json",
    "",
    "Normal users should install the skill with:",
    "npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent \"*\" -y"
  ].join("\n")
);

import { rm } from "node:fs/promises";
import { join } from "node:path";

const targets = [
  ...["core", "render", "cli", "studio"].map((name) => join("packages", name, "dist")),
  join("packages", "cli", "bundled-skill"),
  join("packages", "cli", "codex-skill"),
  join("packages", "cli", "studio-dist"),
  join("packages", "cli", "node_modules", "@opengraph-creator", "core"),
  join("packages", "cli", "node_modules", "@opengraph-creator", "render")
];

await Promise.all(targets.map((target) => rm(target, { recursive: true, force: true })));

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(cliRoot, "..", "..");
const packages = ["core", "render"];

for (const packageName of packages) {
  const sourceRoot = resolve(repoRoot, "packages", packageName);
  const targetRoot = resolve(cliRoot, "node_modules", "@opengraph-creator", packageName);
  await rm(targetRoot, { recursive: true, force: true });
  await mkdir(targetRoot, { recursive: true });
  await cp(resolve(sourceRoot, "dist"), resolve(targetRoot, "dist"), { recursive: true });
  await writeFile(
    resolve(targetRoot, "package.json"),
    JSON.stringify(
      {
        name: `@opengraph-creator/${packageName}`,
        version: "0.0.0",
        type: "module",
        main: "dist/index.js",
        types: "dist/index.d.ts"
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

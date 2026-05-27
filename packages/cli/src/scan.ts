import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { detectFramework, type Framework } from "@graphforge/core";

export interface RepoScanResult {
  root: string;
  framework: Framework;
  files: string[];
  routes: string[];
  metadataFiles: string[];
  brandAssets: string[];
}

export async function scanRepo(root: string): Promise<RepoScanResult> {
  const files = await walkFiles(root);
  return {
    root,
    framework: detectFramework(files),
    files,
    routes: detectRoutes(files),
    metadataFiles: files.filter(isMetadataFile),
    brandAssets: files.filter(isBrandAsset)
  };
}

async function walkFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => !["node_modules", ".git", "dist", ".next", ".nuxt"].includes(entry.name))
      .map(async (entry) => {
        const fullPath = join(current, entry.name);
        if (entry.isDirectory()) return walkFiles(root, fullPath);
        if (!(await stat(fullPath)).isFile()) return [];
        return [normalizePath(relative(root, fullPath))];
      })
  );
  return files.flat().sort();
}

function detectRoutes(files: string[]): string[] {
  const routes = new Set<string>();
  for (const file of files) {
    if (file === "app/page.tsx" || file === "app/page.jsx") routes.add("/");
    const appMatch = file.match(/^app\/(.+)\/page\.[tj]sx$/);
    if (appMatch) routes.add(`/${appMatch[1]}`);
    const pagesMatch = file.match(/^pages\/(.+)\.[tj]sx$/);
    if (pagesMatch && !pagesMatch[1].startsWith("_")) {
      routes.add(pagesMatch[1] === "index" ? "/" : `/${pagesMatch[1].replace(/\/index$/, "")}`);
    }
    const astroMatch = file.match(/^src\/pages\/(.+)\.astro$/);
    if (astroMatch) routes.add(astroMatch[1] === "index" ? "/" : `/${astroMatch[1].replace(/\/index$/, "")}`);
  }
  return [...routes].sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)));
}

function isMetadataFile(file: string): boolean {
  return [
    "app/layout.tsx",
    "app/layout.jsx",
    "app.vue",
    "app/root.tsx",
    "index.html",
    "src/layouts/Layout.astro"
  ].includes(file);
}

function isBrandAsset(file: string): boolean {
  return /(^|\/)(logo|brand|icon|favicon|mark)[^/]*\.(svg|png|jpg|jpeg|webp)$/i.test(file);
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

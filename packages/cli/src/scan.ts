import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { detectFramework, type Framework } from "@opengraph-creator/core";

export interface RepoScanResult {
  root: string;
  framework: Framework;
  files: string[];
  routes: string[];
  routeContexts: RouteContext[];
  metadataFiles: string[];
  brandAssets: string[];
}

export interface RouteContext {
  route: string;
  routeFile: string;
  detectedTitle?: string;
  detectedDescription?: string;
  confidence: "high" | "medium" | "low";
}

export async function scanRepo(root: string): Promise<RepoScanResult> {
  const files = await walkFiles(root);
  const routes = detectRoutes(files);
  return {
    root,
    framework: detectFramework(files),
    files,
    routes,
    routeContexts: await detectRouteContexts(root, files, routes),
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

async function detectRouteContexts(root: string, files: string[], routes: string[]): Promise<RouteContext[]> {
  const contexts = await Promise.all(
    routes.map(async (route) => {
      const routeFile = findRouteFile(files, route) ?? "";
      const source = routeFile ? await readTextFile(join(root, routeFile)) : "";
      const detectedTitle = extractTitle(source) ?? routeToTitle(route);
      const detectedDescription = extractDescription(source);
      return {
        route,
        routeFile,
        detectedTitle,
        detectedDescription,
        confidence: source ? "high" : "low"
      } satisfies RouteContext;
    })
  );
  return contexts;
}

function findRouteFile(files: string[], route: string): string | undefined {
  if (route === "/") {
    return files.find((file) => file === "app/page.tsx" || file === "app/page.jsx" || file === "pages/index.tsx" || file === "pages/index.jsx" || file === "src/pages/index.astro");
  }
  const clean = route.replace(/^\/+/, "");
  return files.find((file) =>
    file === `app/${clean}/page.tsx` ||
    file === `app/${clean}/page.jsx` ||
    file === `pages/${clean}.tsx` ||
    file === `pages/${clean}.jsx` ||
    file === `pages/${clean}/index.tsx` ||
    file === `pages/${clean}/index.jsx` ||
    file === `src/pages/${clean}.astro` ||
    file === `src/pages/${clean}/index.astro`
  );
}

async function readTextFile(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

function extractTitle(source: string): string | undefined {
  return firstMatch(source, /title\s*[:=]\s*["'`]([^"'`{]+)["'`]/i) ?? firstMatch(source, /<h1[^>]*>([^<>{]+)<\/h1>/i);
}

function extractDescription(source: string): string | undefined {
  return firstMatch(source, /description\s*[:=]\s*["'`]([^"'`{]+)["'`]/i) ?? firstMatch(source, /<p[^>]*>([^<>{]{20,180})<\/p>/i);
}

function firstMatch(source: string, pattern: RegExp): string | undefined {
  const match = source.match(pattern)?.[1]?.trim();
  return match || undefined;
}

function routeToTitle(route: string): string {
  if (route === "/") return "Home";
  const segment = route.split("/").filter(Boolean).at(-1) ?? "Page";
  return segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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

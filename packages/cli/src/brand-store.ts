import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Framework } from "@opengraph-creator/core";
import type { RepoScanResult } from "./scan.js";

export interface BrandStorePaths {
  brandDir: string;
  referencesDir: string;
  approvedAssetsDir: string;
  brandJson: string;
  styleNotesMd: string;
  compositionHistoryJson: string;
}

export interface BrandStore {
  version: 1;
  appName: string;
  framework: Framework;
  assets: Array<{ path: string; role: "brand-asset" | "metadata" | "reference"; note?: string }>;
  routes: Array<{ route: string; title: string; description?: string; sourceFile?: string; confidence: string }>;
  references: Array<{ source: string; note: string; kind: "local" | "user" | "web-note" }>;
  rules: {
    paletteRoles: string[];
    blockedMotifs: string[];
    requiredLayerPolicies: string[];
  };
  updatedAt: string;
}

export interface CompositionHistoryItem {
  sessionId: string;
  archetypeId: string;
  conceptThesis: string;
  createdAt: string;
}

export interface CompositionHistory {
  version: 1;
  items: CompositionHistoryItem[];
}

export function getBrandStorePaths(repo: string): BrandStorePaths {
  const brandDir = join(repo, ".opengraph-creator", "brand");
  return {
    brandDir,
    referencesDir: join(brandDir, "references"),
    approvedAssetsDir: join(brandDir, "approved-assets"),
    brandJson: join(brandDir, "brand.json"),
    styleNotesMd: join(brandDir, "style-notes.md"),
    compositionHistoryJson: join(brandDir, "composition-history.json")
  };
}

export async function createBrandStoreFromScan(scan: RepoScanResult): Promise<BrandStore> {
  const paths = getBrandStorePaths(scan.root);
  await mkdir(paths.referencesDir, { recursive: true });
  await mkdir(paths.approvedAssetsDir, { recursive: true });
  const store: BrandStore = {
    version: 1,
    appName: inferAppName(scan),
    framework: scan.framework,
    assets: [
      ...scan.brandAssets.map((path) => ({ path, role: "brand-asset" as const })),
      ...scan.metadataFiles.map((path) => ({ path, role: "metadata" as const, note: "Metadata file may contain existing title, description, or social tags." }))
    ],
    routes: scan.routeContexts.map((route) => ({
      route: route.route,
      title: route.detectedTitle ?? route.route,
      description: route.detectedDescription,
      sourceFile: route.routeFile,
      confidence: route.confidence
    })),
    references: scan.brandAssets.map((path) => ({
      source: path,
      note: "Local brand asset; use as evidence for palette, geometry, or mark placement.",
      kind: "local" as const
    })),
    rules: {
      paletteRoles: ["brand-anchor", "readability-surface", "action-highlight", "depth-shadow"],
      blockedMotifs: ["left-text-right-image", "generic-dashboard-card", "meaningless-blob-field", "sparkle-orbit-filler"],
      requiredLayerPolicies: [
        "headline/subtitle/badge/CTA/route-label text stays editable",
        "generated images are supporting non-text assets",
        "noise and texture are opt-in only"
      ]
    },
    updatedAt: new Date().toISOString()
  };
  await writeJson(paths.brandJson, store);
  await ensureCompositionHistory(scan.root);
  await writeFile(paths.styleNotesMd, createStyleNotes(store), "utf8");
  return store;
}

export async function readBrandStore(repo: string): Promise<BrandStore | undefined> {
  try {
    return JSON.parse(await readFile(getBrandStorePaths(repo).brandJson, "utf8")) as BrandStore;
  } catch {
    return undefined;
  }
}

export async function ensureCompositionHistory(repo: string): Promise<CompositionHistory> {
  const paths = getBrandStorePaths(repo);
  try {
    return JSON.parse(await readFile(paths.compositionHistoryJson, "utf8")) as CompositionHistory;
  } catch {
    const history: CompositionHistory = { version: 1, items: [] };
    await writeJson(paths.compositionHistoryJson, history);
    return history;
  }
}

export async function recordCompositionHistory(repo: string, item: CompositionHistoryItem): Promise<CompositionHistory> {
  const history = await ensureCompositionHistory(repo);
  const next: CompositionHistory = {
    version: 1,
    items: [item, ...history.items.filter((existing) => existing.sessionId !== item.sessionId)].slice(0, 24)
  };
  await writeJson(getBrandStorePaths(repo).compositionHistoryJson, next);
  return next;
}

export async function getRecentCompositionArchetypes(repo: string, limit = 5): Promise<string[]> {
  const history = await ensureCompositionHistory(repo);
  return history.items.slice(0, limit).map((item) => item.archetypeId);
}

function inferAppName(scan: RepoScanResult): string {
  const title = scan.routeContexts.find((route) => route.route === "/")?.detectedTitle ?? scan.routeContexts[0]?.detectedTitle;
  if (title) return title.replace(/\s+(home|homepage)$/i, "").trim();
  const root = scan.root.replaceAll("\\", "/").split("/").filter(Boolean).at(-1);
  return root || "Untitled App";
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createStyleNotes(store: BrandStore): string {
  return [
    `# ${store.appName} OpenGraph Creator Brand Notes`,
    "",
    "Use this file as local evidence for agent-generated OG direction. Do not copy protected remote assets.",
    "",
    "## Assets",
    ...store.assets.map((asset) => `- ${asset.path}: ${asset.role}${asset.note ? ` (${asset.note})` : ""}`),
    "",
    "## Routes",
    ...store.routes.map((route) => `- ${route.route}: ${route.title}${route.description ? ` - ${route.description}` : ""}`),
    "",
    "## Rules",
    ...store.rules.requiredLayerPolicies.map((rule) => `- ${rule}`)
  ].join("\n");
}

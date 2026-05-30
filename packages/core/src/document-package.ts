import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { ImageLayer, OgLayer, OgProject } from "./index.js";

export const STUDIO_DOCUMENT_EXTENSION = ".ogdoc";
export const STUDIO_DOCUMENT_FORMAT = "og-studio-document";
export const STUDIO_DOCUMENT_VERSION = "1.0";

export interface StudioDocumentAssetManifest {
  path: string;
  mediaType: string;
  bytes: number;
  hash: string;
}

export interface StudioDocumentManifest {
  format: typeof STUDIO_DOCUMENT_FORMAT;
  formatVersion: typeof STUDIO_DOCUMENT_VERSION;
  projectId: string;
  name: string;
  document: "document.json";
  assets: StudioDocumentAssetManifest[];
  previews: StudioDocumentAssetManifest[];
  createdAt: string;
  updatedAt: string;
}

export interface StudioDocumentPackage {
  manifest: StudioDocumentManifest;
  project: OgProject;
  assets: Record<string, Uint8Array>;
  previews: Record<string, Uint8Array>;
}

export interface PackStudioDocumentInput {
  project: OgProject;
  assets?: Record<string, Uint8Array>;
  previews?: Record<string, Uint8Array>;
}

export interface StudioDocumentValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const BUILT_IN_INTERNAL_ASSET_URLS = new Set([
  "ogcreator://logo-placeholder",
  "ogcreator://image-placeholder",
  "ogcreator://html-source"
]);

export async function packStudioDocument(input: PackStudioDocumentInput): Promise<Uint8Array> {
  const assets = normalizePackageEntries(input.assets ?? {});
  const previews = normalizePackageEntries(input.previews ?? {});
  const manifest = await createStudioDocumentManifest(input.project, assets, previews);
  const files: Record<string, Uint8Array> = {
    "manifest.json": strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
    "document.json": strToU8(`${JSON.stringify(input.project, null, 2)}\n`)
  };

  for (const [path, bytes] of Object.entries(assets)) files[path] = bytes;
  for (const [path, bytes] of Object.entries(previews)) files[path] = bytes;

  return zipSync(files, { level: 6 });
}

export async function unpackStudioDocument(bytes: Uint8Array): Promise<StudioDocumentPackage> {
  const files = unzipSync(bytes);
  const manifestBytes = files["manifest.json"];
  const documentBytes = files["document.json"];
  if (!manifestBytes) throw new Error("Studio document is missing manifest.json.");
  if (!documentBytes) throw new Error("Studio document is missing document.json.");

  const manifest = JSON.parse(strFromU8(manifestBytes)) as StudioDocumentManifest;
  const project = JSON.parse(strFromU8(documentBytes)) as OgProject;
  if (manifest.format !== STUDIO_DOCUMENT_FORMAT) throw new Error("Unsupported Studio document format.");
  if (manifest.formatVersion !== STUDIO_DOCUMENT_VERSION) throw new Error(`Unsupported Studio document version: ${manifest.formatVersion}.`);

  const assets: Record<string, Uint8Array> = {};
  const previews: Record<string, Uint8Array> = {};
  for (const asset of manifest.assets) {
    const file = files[asset.path];
    if (!file) throw new Error(`Studio document is missing asset: ${asset.path}.`);
    assets[asset.path] = file;
  }
  for (const preview of manifest.previews) {
    const file = files[preview.path];
    if (!file) throw new Error(`Studio document is missing preview: ${preview.path}.`);
    previews[preview.path] = file;
  }

  return { manifest, project, assets, previews };
}

export async function createStudioDocumentManifest(
  project: OgProject,
  assets: Record<string, Uint8Array>,
  previews: Record<string, Uint8Array> = {}
): Promise<StudioDocumentManifest> {
  return {
    format: STUDIO_DOCUMENT_FORMAT,
    formatVersion: STUDIO_DOCUMENT_VERSION,
    projectId: project.projectId,
    name: project.name,
    document: "document.json",
    assets: await Promise.all(
      Object.entries(normalizePackageEntries(assets)).map(async ([path, bytes]) => ({
        path,
        mediaType: mediaTypeFromPath(path),
        bytes: bytes.byteLength,
        hash: await createContentHash(bytes)
      }))
    ),
    previews: await Promise.all(
      Object.entries(normalizePackageEntries(previews)).map(async ([path, bytes]) => ({
        path,
        mediaType: mediaTypeFromPath(path),
        bytes: bytes.byteLength,
        hash: await createContentHash(bytes)
      }))
    ),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

export function validateStudioDocument(
  project: OgProject,
  assets: Record<string, Uint8Array> = {}
): StudioDocumentValidationResult {
  const errors = validateProjectBasics(project);
  const warnings: string[] = [];
  const packageAssetPaths = new Set(Object.keys(normalizePackageEntries(assets)));
  const visibleLayers = project.layers.filter((layer) => !layer.hidden);
  const visibleTextLayers = visibleLayers.filter((layer) => layer.kind === "text" || layer.kind === "badge");

  if (project.generationMode === "template" && visibleTextLayers.length === 0) {
    errors.push("Template documents must include at least one editable text or badge layer.");
  }

  if (project.generationMode === "template" && isSingleFullCanvasImageDocument(project.layers)) {
    errors.push("Template documents cannot be a single full-canvas imported image/SVG layer.");
  }

  for (const layer of getAllProjectLayers(project)) {
    const assetPath = isImageLikeLayer(layer) ? layer.assetPath ?? (layer.src.startsWith("assets/") ? layer.src : undefined) : undefined;
    if (assetPath && !packageAssetPaths.has(assetPath)) {
      errors.push(`Missing package asset: ${assetPath}.`);
    }
    if (isImageLikeLayer(layer) && layer.src.startsWith("ogcreator://") && !BUILT_IN_INTERNAL_ASSET_URLS.has(layer.src)) {
      errors.push(`Unknown internal asset URL on layer ${layer.name}: ${layer.src}. Use a packaged assets/* file, a data URL, or a built-in placeholder.`);
    }
    if (layer.width <= 0 || layer.height <= 0) {
      errors.push(`Layer ${layer.name} must have positive dimensions.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function validateProjectBasics(project: OgProject): string[] {
  const errors: string[] = [];
  if (!project.name.trim()) errors.push("Project name is required.");
  if (project.canvas.width !== 1200 || project.canvas.height !== 630) {
    errors.push("Default OG canvas must be 1200x630.");
  }
  if (!project.layers.length) errors.push("Project must include at least one editable layer.");
  if (!project.targetPages.length) errors.push("Project must target at least one page.");
  if (project.pages?.length) {
    for (const page of project.pages) {
      if (!page.route) errors.push(`Page variant ${page.id} must include a route.`);
      if (!page.layers.length) errors.push(`Page variant ${page.route} must include at least one editable layer.`);
    }
  }
  return errors;
}

function getAllProjectLayers(project: OgProject): OgLayer[] {
  return [
    ...project.layers,
    ...(project.pages ?? []).flatMap((page) => page.layers)
  ];
}

export function createAssetPath(fileName: string, existing: Iterable<string> = []): string {
  const normalizedName = fileName.trim().toLowerCase().replace(/\\/g, "/").split("/").pop() ?? "asset.bin";
  const dotIndex = normalizedName.lastIndexOf(".");
  const base = dotIndex > 0 ? normalizedName.slice(0, dotIndex) : normalizedName || "asset";
  const extension = dotIndex > 0 ? normalizedName.slice(dotIndex).replace(/[^a-z0-9.]/g, "") : ".bin";
  const slug = base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";
  const paths = new Set(existing);
  let candidate = `assets/${slug}${extension}`;
  let suffix = 2;
  while (paths.has(candidate)) {
    candidate = `assets/${slug}-${suffix}${extension}`;
    suffix += 1;
  }
  return candidate;
}

export function mediaTypeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function normalizePackageEntries(entries: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const normalized: Record<string, Uint8Array> = {};
  for (const [path, bytes] of Object.entries(entries)) {
    normalized[normalizePackagePath(path)] = bytes;
  }
  return normalized;
}

function normalizePackagePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

async function createContentHash(bytes: Uint8Array): Promise<string> {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.subtle) {
    const digestInput = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const digest = await cryptoApi.subtle.digest("SHA-256", digestInput);
    return `sha256:${toHex(new Uint8Array(digest))}`;
  }
  return `fnv1a:${fallbackHash(bytes)}`;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fallbackHash(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isImageLikeLayer(layer: OgLayer): layer is ImageLayer {
  return layer.kind === "image" || layer.kind === "logo" || layer.kind === "screenshot";
}

function isSingleFullCanvasImageDocument(layers: OgLayer[]): boolean {
  const editable = layers.filter((layer) => layer.kind !== "background" && !layer.hidden);
  if (editable.length !== 1) return false;
  const [layer] = editable;
  return isImageLikeLayer(layer) && layer.x <= 0 && layer.y <= 0 && layer.width >= 1200 && layer.height >= 630;
}

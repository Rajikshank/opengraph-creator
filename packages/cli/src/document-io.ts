import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createAssetPath,
  normalizeProjectEffects,
  packStudioDocument,
  unpackStudioDocument,
  validateStudioDocument,
  type OgProject,
  type StudioDocumentPackage
} from "@opengraph-creator/core";

export async function readStudioDocumentFile(path: string): Promise<StudioDocumentPackage> {
  const document = await unpackStudioDocument(await readFile(path));
  const normalized = normalizeProjectEffects(document.project);
  return normalized.changed ? { ...document, project: normalized.project } : document;
}

export async function writeStudioDocumentFile(
  path: string,
  project: OgProject,
  assets: Record<string, Uint8Array> = {},
  previews: Record<string, Uint8Array> = {}
): Promise<void> {
  const normalized = normalizeProjectEffects(project);
  const validation = validateStudioDocument(normalized.project, assets);
  if (!validation.ok) throw new Error(`Invalid Studio document: ${validation.errors.join(" ")}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, await packStudioDocument({ project: normalized.project, assets, previews }));
}

export function getNextAssetPath(fileName: string, assets: Record<string, Uint8Array>): string {
  return createAssetPath(fileName, Object.keys(assets));
}

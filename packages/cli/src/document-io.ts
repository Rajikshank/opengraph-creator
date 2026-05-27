import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createAssetPath,
  packStudioDocument,
  unpackStudioDocument,
  validateStudioDocument,
  type OgProject,
  type StudioDocumentPackage
} from "@graphforge/core";

export async function readStudioDocumentFile(path: string): Promise<StudioDocumentPackage> {
  return unpackStudioDocument(await readFile(path));
}

export async function writeStudioDocumentFile(
  path: string,
  project: OgProject,
  assets: Record<string, Uint8Array> = {},
  previews: Record<string, Uint8Array> = {}
): Promise<void> {
  const validation = validateStudioDocument(project, assets);
  if (!validation.ok) throw new Error(`Invalid Studio document: ${validation.errors.join(" ")}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, await packStudioDocument({ project, assets, previews }));
}

export function getNextAssetPath(fileName: string, assets: Record<string, Uint8Array>): string {
  return createAssetPath(fileName, Object.keys(assets));
}

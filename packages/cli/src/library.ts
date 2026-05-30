import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { ExportFormat, GenerationStrategy, OgProject } from "@opengraph-creator/core";
import { exportProject, type ExportResult } from "@opengraph-creator/render";

export interface OpenGraphCreatorLibrary {
  root: string;
  projectsDir: string;
}

export interface LibraryProjectSummary {
  projectId: string;
  name: string;
  strategy: GenerationStrategy;
  updatedAt: string;
  path: string;
}

export interface SavedProject {
  projectId: string;
  path: string;
}

export interface ExportLibraryProjectInput {
  projectId: string;
  format: ExportFormat;
  target: string;
  quality?: number;
  repo?: string;
}

export function createLibrary(options: { root?: string } = {}): OpenGraphCreatorLibrary {
  const root = options.root ?? process.env.OPENGRAPH_CREATOR_HOME ?? join(homedir(), ".opengraph-creator");
  return {
    root,
    projectsDir: join(root, "projects")
  };
}

export async function ensureLibrary(library = createLibrary()): Promise<OpenGraphCreatorLibrary> {
  await mkdir(library.projectsDir, { recursive: true });
  return library;
}

export async function saveLibraryProject(library: OpenGraphCreatorLibrary, project: OgProject): Promise<SavedProject> {
  await ensureLibrary(library);
  const path = getProjectPath(library, project.projectId);
  await writeFile(path, `${JSON.stringify({ ...project, updatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
  return { projectId: project.projectId, path };
}

export async function readLibraryProject(library: OpenGraphCreatorLibrary, projectId: string): Promise<OgProject> {
  const content = await readFile(getProjectPath(library, projectId), "utf8");
  return JSON.parse(content) as OgProject;
}

export async function listLibraryProjects(library: OpenGraphCreatorLibrary): Promise<LibraryProjectSummary[]> {
  await ensureLibrary(library);
  const files = (await readdir(library.projectsDir)).filter((file) => file.endsWith(".og.json"));
  const summaries = await Promise.all(
    files.map(async (file) => {
      const path = join(library.projectsDir, file);
      const project = JSON.parse(await readFile(path, "utf8")) as OgProject;
      const info = await stat(path);
      return {
        projectId: project.projectId,
        name: project.name,
        strategy: project.strategy,
        updatedAt: project.updatedAt ?? info.mtime.toISOString(),
        path
      };
    })
  );
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function exportLibraryProject(
  library: OpenGraphCreatorLibrary,
  input: ExportLibraryProjectInput
): Promise<ExportResult> {
  const project = await readLibraryProject(library, input.projectId);
  const target = resolveExportTarget(input.target, input.repo);
  const result = await exportProject(project, { format: input.format, target, quality: input.quality });
  return { ...result, target: input.target };
}

export function getProjectPath(library: OpenGraphCreatorLibrary, projectId: string): string {
  return join(library.projectsDir, `${projectId}.og.json`);
}

function resolveExportTarget(target: string, repo?: string): string {
  if (!repo || isAbsolute(target)) return target;

  const repoRoot = resolve(repo);
  const resolvedTarget = resolve(repoRoot, target);
  const relativeTarget = relative(repoRoot, resolvedTarget);
  if (relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
    throw new Error("Export target must stay inside the session repo");
  }
  return resolvedTarget;
}

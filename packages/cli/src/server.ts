import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import {
  createAssetPath,
  mediaTypeFromPath,
  validateStudioDocument,
  type ExportFormat,
  type OgProject,
  type SourceArtifactKind,
  type SourceArtifactOrigin
} from "@graphforge/core";
import { createAiImagePlan, type AgentImageOutputFormat } from "./ai-image.js";
import { createImportedSourceProject } from "./import-source.js";
import { readStudioDocumentFile, writeStudioDocumentFile } from "./document-io.js";
import {
  createLibrary,
  ensureLibrary,
  exportLibraryProject,
  listLibraryProjects,
  readLibraryProject,
  saveLibraryProject,
  type GraphForgeLibrary
} from "./library.js";
import {
  appendSessionEvent,
  createGraphForgeSession,
  createAgentRequest,
  createPublishRequest,
  readGraphForgeSession,
  recordSessionExport
} from "./session.js";

export interface CreateStudioServerOptions {
  library?: GraphForgeLibrary;
  staticDir?: string;
  port?: number;
  host?: string;
  sessionRepo?: string;
}

export interface StudioServerHandle {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

interface ExportBody {
  projectId: string;
  format: ExportFormat;
  target: string;
  quality?: number;
  repo?: string;
}

interface AgentHandoffBody {
  project: OgProject;
  prompt?: string;
  target?: string;
  format?: AgentImageOutputFormat;
  referenceImage?: string;
}

interface ImportBody {
  source: string;
  kind?: SourceArtifactKind;
  name?: string;
  origin?: SourceArtifactOrigin;
}

interface SessionBody {
  repo?: string;
  id?: string;
  agent?: "codex" | "claude" | "opencode" | "manual" | "unknown";
  strategy?: "common" | "pages" | "hybrid";
  mode?: "template" | "pure-image";
}

interface SessionEventBody {
  repo?: string;
  sessionId: string;
  type: string;
  message?: string;
  data?: Record<string, unknown>;
}

interface SessionExportBody {
  repo?: string;
  sessionId: string;
  path: string;
  format: ExportFormat;
  width: number;
  height: number;
  fileSizeBytes?: number;
}

interface PublishRequestBody {
  repo?: string;
  sessionId: string;
  imagePath: string;
  framework?: "next" | "astro" | "nuxt" | "remix" | "vite" | "html" | "unknown";
  page?: string;
  confirmed?: boolean;
}

interface AgentRequestBody {
  repo?: string;
  sessionId: string;
  prompt: string;
  documentPath?: string;
  expectedOutput?: string;
}

interface SessionDocumentBody {
  repo?: string;
  sessionId: string;
  project: OgProject;
}

interface SessionAssetBody {
  repo?: string;
  sessionId: string;
  fileName: string;
  dataUrl: string;
}

export async function createStudioServer(options: CreateStudioServerOptions = {}): Promise<StudioServerHandle> {
  const library = await ensureLibrary(options.library ?? createLibrary());
  const staticDir = options.staticDir ?? getDefaultStudioStaticDir();
  const host = options.host ?? "127.0.0.1";

  const server = createServer((request, response) => {
    handleRequest({ request, response, library, staticDir, sessionRepo: options.sessionRepo }).catch((error: unknown) => {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    });
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, host, resolve));
  const address = server.address() as AddressInfo;
  return {
    server,
    url: `http://${host}:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  };
}

export function getDefaultStudioStaticDir(): string {
  return fileURLToPath(new URL("../studio-dist", import.meta.url));
}

async function handleRequest(input: {
  request: IncomingMessage;
  response: ServerResponse;
  library: GraphForgeLibrary;
  staticDir: string;
  sessionRepo?: string;
}): Promise<void> {
  const url = new URL(input.request.url ?? "/", "http://localhost");

  if (url.pathname === "/api/projects" && input.request.method === "GET") {
    sendJson(input.response, 200, { projects: await listLibraryProjects(input.library) });
    return;
  }

  if (url.pathname === "/api/session" && input.request.method === "GET") {
    const id = url.searchParams.get("id");
    if (!id) {
      sendJson(input.response, 400, { error: "id is required" });
      return;
    }
    const repo = url.searchParams.get("repo") ?? input.sessionRepo ?? input.library.root;
    let project: OgProject | undefined;
    let documentPath: string | undefined;
    try {
      const { getSessionPaths } = await import("./session.js");
      const paths = getSessionPaths(repo, id);
      documentPath = paths.documentFile;
      const document = await readStudioDocumentFile(paths.documentFile);
      project = hydrateProjectAssetSources(document.project, document.assets);
    } catch {
      try {
        const { getSessionPaths } = await import("./session.js");
        project = JSON.parse(await readFile(getSessionPaths(repo, id).projectJson, "utf8")) as OgProject;
      } catch {
        project = undefined;
      }
    }
    sendJson(input.response, 200, {
      session: await readGraphForgeSession(repo, id),
      project,
      documentPath
    });
    return;
  }

  if (url.pathname === "/api/session/document" && input.request.method === "POST") {
    const body = (await readJson(input.request)) as SessionDocumentBody;
    const repo = body.repo ?? input.sessionRepo ?? input.library.root;
    const { getSessionPaths } = await import("./session.js");
    const paths = getSessionPaths(repo, body.sessionId);
    let assets: Record<string, Uint8Array> = {};
    try {
      assets = (await readStudioDocumentFile(paths.documentFile)).assets;
    } catch {
      assets = {};
    }
    const project = dehydrateProjectAssetSources(body.project);
    const validation = validateStudioDocument(project, assets);
    if (!validation.ok) {
      sendJson(input.response, 400, { error: validation.errors.join(" "), validation });
      return;
    }
    await writeStudioDocumentFile(paths.documentFile, project, assets);
    await appendSessionEvent(repo, body.sessionId, {
      type: "document.saved",
      message: "Studio document saved",
      data: { documentPath: paths.documentFile, projectId: project.projectId }
    });
    sendJson(input.response, 200, { path: paths.documentFile, projectId: project.projectId });
    return;
  }

  if (url.pathname === "/api/session/asset" && input.request.method === "POST") {
    const body = (await readJson(input.request)) as SessionAssetBody;
    const repo = body.repo ?? input.sessionRepo ?? input.library.root;
    const { getSessionPaths } = await import("./session.js");
    const paths = getSessionPaths(repo, body.sessionId);
    const document = await readStudioDocumentFile(paths.documentFile);
    const assetPath = createAssetPath(body.fileName, Object.keys(document.assets));
    const bytes = dataUrlToBytes(body.dataUrl);
    const assets = { ...document.assets, [assetPath]: bytes };
    await writeStudioDocumentFile(paths.documentFile, document.project, assets, document.previews);
    await appendSessionEvent(repo, body.sessionId, {
      type: "document.asset.imported",
      message: `Imported ${assetPath}`,
      data: { assetPath }
    });
    sendJson(input.response, 200, { assetPath });
    return;
  }

  if (url.pathname === "/api/session" && input.request.method === "POST") {
    const body = (await readJson(input.request)) as SessionBody;
    const session = await createGraphForgeSession({
      repo: body.repo ?? input.sessionRepo ?? input.library.root,
      id: body.id,
      agent: body.agent,
      strategy: body.strategy,
      mode: body.mode
    });
    sendJson(input.response, 200, { session });
    return;
  }

  if (url.pathname === "/api/session/event" && input.request.method === "POST") {
    const body = (await readJson(input.request)) as SessionEventBody;
    const event = await appendSessionEvent(body.repo ?? input.sessionRepo ?? input.library.root, body.sessionId, {
      type: body.type,
      message: body.message,
      data: body.data
    });
    sendJson(input.response, 200, { event });
    return;
  }

  if (url.pathname === "/api/session/export" && input.request.method === "POST") {
    const body = (await readJson(input.request)) as SessionExportBody;
    const session = await recordSessionExport(body.repo ?? input.sessionRepo ?? input.library.root, body.sessionId, {
      path: body.path,
      format: body.format,
      width: body.width,
      height: body.height,
      fileSizeBytes: body.fileSizeBytes,
      createdAt: new Date().toISOString()
    });
    sendJson(input.response, 200, { session });
    return;
  }

  if (url.pathname === "/api/session/publish-request" && input.request.method === "POST") {
    const body = (await readJson(input.request)) as PublishRequestBody;
    const request = await createPublishRequest({
      repo: body.repo ?? input.sessionRepo ?? input.library.root,
      sessionId: body.sessionId,
      imagePath: body.imagePath,
      framework: body.framework,
      page: body.page,
      confirmed: body.confirmed ?? false
    });
    sendJson(input.response, 200, { request });
    return;
  }

  if (url.pathname === "/api/session/agent-request" && input.request.method === "POST") {
    const body = (await readJson(input.request)) as AgentRequestBody;
    const repo = body.repo ?? input.sessionRepo ?? input.library.root;
    const { getSessionPaths } = await import("./session.js");
    const paths = getSessionPaths(repo, body.sessionId);
    const request = await createAgentRequest({
      repo,
      sessionId: body.sessionId,
      prompt: body.prompt,
      documentPath: body.documentPath ?? paths.documentFile,
      expectedOutput: body.expectedOutput ?? paths.documentFile
    });
    sendJson(input.response, 200, { request });
    return;
  }

  if (url.pathname.startsWith("/api/projects/")) {
    const projectId = decodeURIComponent(url.pathname.replace("/api/projects/", ""));
    if (input.request.method === "GET") {
      sendJson(input.response, 200, { project: await readLibraryProject(input.library, projectId) });
      return;
    }
    if (input.request.method === "PUT") {
      const project = (await readJson(input.request)) as OgProject;
      if (project.projectId !== projectId) {
        sendJson(input.response, 400, { error: "Project id in URL and body must match." });
        return;
      }
      sendJson(input.response, 200, await saveLibraryProject(input.library, project));
      return;
    }
  }

  if (url.pathname === "/api/export" && input.request.method === "POST") {
    const body = (await readJson(input.request)) as ExportBody;
    const result = await exportLibraryProject(input.library, body);
    sendJson(input.response, 200, { result });
    return;
  }

  if (url.pathname === "/api/agent-handoff" && input.request.method === "POST") {
    const body = (await readJson(input.request)) as AgentHandoffBody;
    const project = body.project;
    const output = body.target ?? "public/og-agent.png";
    const plan = createAiImagePlan({
      project,
      out: output,
      extraPrompt: body.prompt,
      referenceImage: body.referenceImage,
      format: body.format
    });
    const target = join(input.library.root, "agent-handoffs", `${project.projectId}.json`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    sendJson(input.response, 200, { path: target, plan });
    return;
  }

  if (url.pathname === "/api/import" && input.request.method === "POST") {
    const body = (await readJson(input.request)) as ImportBody;
    if (!body.source) {
      sendJson(input.response, 400, { error: "source is required" });
      return;
    }
    if (body.source.toLowerCase().endsWith(".ogdoc")) {
      const document = await readStudioDocumentFile(body.source);
      await saveLibraryProject(input.library, document.project);
      sendJson(input.response, 200, { project: hydrateProjectAssetSources(document.project, document.assets) });
      return;
    }
    const kind = normalizeImportKind(body.kind, body.source);
    if (kind === "graphforge-json") {
      const project = JSON.parse(await readFile(body.source, "utf8")) as OgProject;
      await saveLibraryProject(input.library, project);
      sendJson(input.response, 200, { project });
      return;
    }
    const project = await createImportedSourceProject({
      name: body.name ?? "Imported OG Asset",
      source: body.source,
      kind,
      origin: normalizeOrigin(body.origin),
      createdAt: new Date().toISOString()
    });
    await saveLibraryProject(input.library, project);
    sendJson(input.response, 200, { project });
    return;
  }

  await serveStatic(input.response, input.staticDir, url.pathname);
}

function normalizeImportKind(kind: SourceArtifactKind | undefined, source: string): SourceArtifactKind {
  if (kind === "graphforge-json" || kind === "svg" || kind === "html" || kind === "image") return kind;
  const normalized = source.toLowerCase();
  if (normalized.endsWith(".json")) return "graphforge-json";
  if (normalized.endsWith(".svg")) return "svg";
  if (normalized.endsWith(".html") || normalized.endsWith(".htm")) return "html";
  return "image";
}

function normalizeOrigin(origin: SourceArtifactOrigin | undefined): SourceArtifactOrigin {
  if (origin === "claude" || origin === "manual" || origin === "library") return origin;
  return "codex";
}

async function serveStatic(response: ServerResponse, staticDir: string, pathname: string): Promise<void> {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = normalize(join(staticDir, relative));
  if (!target.startsWith(normalize(staticDir))) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "content-type": contentType(target) });
    createReadStream(target).pipe(response);
  } catch {
    const fallback = join(staticDir, "index.html");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    createReadStream(fallback).pipe(response);
  }
}

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const [, payload] = /^data:[^;]+;base64,(.*)$/.exec(dataUrl) ?? [];
  if (!payload) throw new Error("Asset upload must be a base64 data URL.");
  return Uint8Array.from(Buffer.from(payload, "base64"));
}

function hydrateProjectAssetSources(project: OgProject, assets: Record<string, Uint8Array>): OgProject {
  return {
    ...project,
    layers: project.layers.map((layer) => {
      if (!("src" in layer) || !layer.assetPath) return layer;
      const bytes = assets[layer.assetPath];
      if (!bytes) return layer;
      return {
        ...layer,
        src: `data:${mediaTypeFromPath(layer.assetPath)};base64,${Buffer.from(bytes).toString("base64")}`
      };
    })
  };
}

function dehydrateProjectAssetSources(project: OgProject): OgProject {
  return {
    ...project,
    layers: project.layers.map((layer) => {
      if (!("src" in layer) || !layer.assetPath) return layer;
      return { ...layer, src: layer.assetPath };
    })
  };
}

function contentType(path: string): string {
  const extension = extname(path);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  return "application/octet-stream";
}

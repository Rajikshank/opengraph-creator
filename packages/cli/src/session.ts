import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  packStudioDocument,
  type AgentKind,
  type ExportFormat,
  type Framework,
  type GenerationMode,
  type GenerationStrategy,
  type GraphForgePublishRequest,
  type GraphForgeSession,
  type GraphForgeSessionEvent,
  type OgProject
} from "@graphforge/core";

export interface SessionPaths {
  root: string;
  sessionDir: string;
  incomingDir: string;
  sessionJson: string;
  eventsJsonl: string;
  documentFile: string;
  projectJson: string;
  exportJson: string;
  publishRequestJson: string;
}

export interface CreateSessionInput {
  repo: string;
  id?: string;
  agent?: AgentKind;
  strategy?: GenerationStrategy;
  mode?: GenerationMode;
  project?: OgProject;
}

export interface SessionExportRecord {
  path: string;
  format: ExportFormat;
  width: number;
  height: number;
  fileSizeBytes?: number;
  createdAt: string;
}

export interface CreatePublishRequestInput {
  repo: string;
  sessionId: string;
  imagePath: string;
  framework?: Framework;
  page?: string;
  confirmed: boolean;
}

export function getSessionPaths(repo: string, sessionId: string): SessionPaths {
  const root = join(repo, ".graphforge", "sessions");
  const sessionDir = join(root, sessionId);
  return {
    root,
    sessionDir,
    incomingDir: join(sessionDir, "incoming"),
    sessionJson: join(sessionDir, "session.json"),
    eventsJsonl: join(sessionDir, "events.jsonl"),
    documentFile: join(sessionDir, "document.ogdoc"),
    projectJson: join(sessionDir, "project.og.json"),
    exportJson: join(sessionDir, "export.json"),
    publishRequestJson: join(sessionDir, "publish-request.json")
  };
}

export async function createGraphForgeSession(input: CreateSessionInput): Promise<GraphForgeSession> {
  const id = input.id ?? `gf-${Date.now().toString(36)}`;
  const paths = getSessionPaths(input.repo, id);
  const now = new Date().toISOString();
  const project = input.project;
  const session: GraphForgeSession = {
    id,
    repo: input.repo,
    agent: input.agent ?? "unknown",
    strategy: input.strategy ?? project?.strategy ?? "common",
    mode: input.mode ?? project?.generationMode ?? "template",
    status: "waiting-for-agent",
    activeProjectId: project?.projectId,
    activeDocumentPath: project ? paths.documentFile : undefined,
    incomingArtifacts: [],
    exports: [],
    publishRequests: [],
    lastHeartbeatAt: now,
    pendingAction: "agent-generate-og-source",
    recoverInstructions: [
      `Read ${paths.sessionJson}.`,
      `Place generated assets in ${paths.incomingDir}.`,
      `Create or update the Studio document package at ${paths.documentFile}.`,
      "Open Studio with ?session=<id> and wait for the user to export or publish."
    ]
  };
  await mkdir(paths.incomingDir, { recursive: true });
  await atomicWriteJson(paths.sessionJson, session);
  if (project) {
    project.sessionId = id;
    await writeFile(paths.documentFile, await packStudioDocument({ project }));
  }
  await writeFile(paths.eventsJsonl, `${JSON.stringify(createSessionEvent(id, "session.created", "Session created"))}\n`, "utf8");
  return session;
}

export async function readGraphForgeSession(repo: string, sessionId: string): Promise<GraphForgeSession> {
  const paths = getSessionPaths(repo, sessionId);
  const session = JSON.parse(await readFile(paths.sessionJson, "utf8")) as GraphForgeSession;
  if (isStale(session)) {
    return { ...session, status: "stale" };
  }
  return session;
}

export async function writeGraphForgeSession(session: GraphForgeSession): Promise<GraphForgeSession> {
  const paths = getSessionPaths(session.repo, session.id);
  await mkdir(paths.sessionDir, { recursive: true });
  await atomicWriteJson(paths.sessionJson, session);
  return session;
}

export async function appendSessionEvent(
  repo: string,
  sessionId: string,
  event: Pick<GraphForgeSessionEvent, "type" | "message" | "data">
): Promise<GraphForgeSessionEvent> {
  const paths = getSessionPaths(repo, sessionId);
  const next = createSessionEvent(sessionId, event.type, event.message, event.data);
  await mkdir(paths.sessionDir, { recursive: true });
  await writeFile(paths.eventsJsonl, `${JSON.stringify(next)}\n`, { encoding: "utf8", flag: "a" });
  return next;
}

export async function recordSessionExport(
  repo: string,
  sessionId: string,
  exportRecord: SessionExportRecord
): Promise<GraphForgeSession> {
  const paths = getSessionPaths(repo, sessionId);
  const session = await readGraphForgeSession(repo, sessionId);
  const next: GraphForgeSession = {
    ...session,
    status: "exported",
    exports: [...session.exports, exportRecord],
    lastHeartbeatAt: new Date().toISOString(),
    pendingAction: "publish-preview"
  };
  await atomicWriteJson(paths.exportJson, exportRecord);
  await writeGraphForgeSession(next);
  await appendSessionEvent(repo, sessionId, {
    type: "session.exported",
    message: `Exported ${exportRecord.path}`,
    data: exportRecord as unknown as Record<string, unknown>
  });
  return next;
}

export async function createPublishRequest(input: CreatePublishRequestInput): Promise<GraphForgePublishRequest> {
  const paths = getSessionPaths(input.repo, input.sessionId);
  const session = await readGraphForgeSession(input.repo, input.sessionId);
  const request: GraphForgePublishRequest = {
    path: paths.publishRequestJson,
    imagePath: input.imagePath,
    framework: input.framework,
    page: input.page ?? "/",
    status: input.confirmed ? "confirmed" : "preview",
    createdAt: new Date().toISOString()
  };
  const next: GraphForgeSession = {
    ...session,
    status: input.confirmed ? "published" : "publish-requested",
    publishRequests: [...session.publishRequests, request],
    lastHeartbeatAt: new Date().toISOString(),
    pendingAction: input.confirmed ? undefined : "agent-preview-metadata"
  };
  await atomicWriteJson(paths.publishRequestJson, request);
  await writeGraphForgeSession(next);
  await appendSessionEvent(input.repo, input.sessionId, {
    type: input.confirmed ? "session.publish.confirmed" : "session.publish.preview",
    message: input.confirmed ? "Publish confirmed" : "Publish preview requested",
    data: request as unknown as Record<string, unknown>
  });
  return request;
}

export async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${Date.now().toString(36)}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

function createSessionEvent(
  sessionId: string,
  type: string,
  message?: string,
  data?: Record<string, unknown>
): GraphForgeSessionEvent {
  return {
    id: `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    type,
    createdAt: new Date().toISOString(),
    message,
    data
  };
}

function isStale(session: GraphForgeSession): boolean {
  const last = Date.parse(session.lastHeartbeatAt);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last > 30 * 60 * 1000;
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

import { copyFile, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  packStudioDocument,
  normalizeProjectEffects,
  type AgentKind,
  type ExportFormat,
  type Framework,
  type OpenGraphCreatorAgentRequest,
  type GenerationMode,
  type GenerationStrategy,
  type OpenGraphCreatorPublishRequest,
  type OpenGraphCreatorSession,
  type OpenGraphCreatorSessionEvent,
  type OgProject
} from "@opengraph-creator/core";

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
  agentRequestJson: string;
  generationBriefJson: string;
  restartsDir: string;
}

export interface CreateSessionInput {
  repo: string;
  id?: string;
  agent?: AgentKind;
  strategy?: GenerationStrategy;
  mode?: GenerationMode;
  project?: OgProject;
}

export interface AttachSessionInput {
  repo: string;
  id?: string;
  agent?: AgentKind;
  project: OgProject;
  assets?: Record<string, Uint8Array>;
  previews?: Record<string, Uint8Array>;
  source?: string;
}

export interface SessionExportRecord {
  path: string;
  format: ExportFormat;
  width: number;
  height: number;
  page?: string;
  fileSizeBytes?: number;
  createdAt: string;
}

export interface CreatePublishRequestInput {
  repo: string;
  sessionId: string;
  imagePath: string;
  pageImages?: Array<{ page: string; imagePath: string }>;
  framework?: Framework;
  page?: string;
  confirmed: boolean;
}

export interface CreateAgentRequestInput {
  repo: string;
  sessionId: string;
  prompt: string;
  documentPath: string;
  expectedOutput?: string;
}

export function getSessionPaths(repo: string, sessionId: string): SessionPaths {
  const root = join(repo, ".opengraph-creator", "sessions");
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
    publishRequestJson: join(sessionDir, "publish-request.json"),
    agentRequestJson: join(sessionDir, "agent-request.json"),
    generationBriefJson: join(sessionDir, "generation-brief.json"),
    restartsDir: join(sessionDir, "restarts")
  };
}

export async function createOpenGraphCreatorSession(input: CreateSessionInput): Promise<OpenGraphCreatorSession> {
  const id = input.id ?? `gf-${Date.now().toString(36)}`;
  const paths = getSessionPaths(input.repo, id);
  const now = new Date().toISOString();
  const project = input.project;
  const session: OpenGraphCreatorSession = {
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
    agentRequests: [],
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
    await writeFile(paths.documentFile, await packStudioDocument({ project: normalizeProjectEffects(project).project }));
  }
  await writeFile(paths.eventsJsonl, `${JSON.stringify(createSessionEvent(id, "session.created", "Session created"))}\n`, "utf8");
  return session;
}

export async function attachOpenGraphCreatorSession(input: AttachSessionInput): Promise<OpenGraphCreatorSession> {
  const id = input.id ?? `ogc-${Date.now().toString(36)}`;
  const paths = getSessionPaths(input.repo, id);
  const now = new Date().toISOString();
  const project: OgProject = { ...input.project, sessionId: id };
  const session: OpenGraphCreatorSession = {
    id,
    repo: input.repo,
    agent: input.agent ?? "unknown",
    strategy: project.strategy,
    mode: project.generationMode ?? "template",
    status: "editing",
    activeProjectId: project.projectId,
    activeDocumentPath: paths.documentFile,
    incomingArtifacts: [],
    exports: [],
    publishRequests: [],
    agentRequests: [],
    lastHeartbeatAt: now,
    pendingAction: "studio-editing",
    recoverInstructions: [
      `Read ${paths.sessionJson}.`,
      `Continue editing the attached Studio document at ${paths.documentFile}.`,
      `Launch or reuse Studio with opengraph-creator session launch --repo "${input.repo}" --id "${id}" --open true --waitReady true --json.`,
      `Wait for Studio with opengraph-creator session wait --until next-action --timeout 0 --repo "${input.repo}" --id "${id}".`,
      "On confirmed publish, read publish-request.json and wire metadata only after preview and user confirmation."
    ]
  };
  await mkdir(paths.incomingDir, { recursive: true });
  await atomicWriteJson(paths.sessionJson, session);
  await writeFile(paths.documentFile, await packStudioDocument({
    project: normalizeProjectEffects(project).project,
    assets: input.assets ?? {},
    previews: input.previews ?? {}
  }));
  await writeFile(paths.eventsJsonl, `${JSON.stringify(createSessionEvent(id, "session.attached", "Manual Studio work attached to durable session", { source: input.source }))}\n`, "utf8");
  return session;
}

export async function readOpenGraphCreatorSession(repo: string, sessionId: string): Promise<OpenGraphCreatorSession> {
  const paths = getSessionPaths(repo, sessionId);
  const session = normalizeSession(JSON.parse(await readFile(paths.sessionJson, "utf8")) as OpenGraphCreatorSession);
  if (isStale(session)) {
    return { ...session, status: "stale" };
  }
  return session;
}

export async function writeOpenGraphCreatorSession(session: OpenGraphCreatorSession, repoOverride?: string): Promise<OpenGraphCreatorSession> {
  const repo = repoOverride ?? session.repo;
  const sessionToWrite = repoOverride ? { ...session, repo: repoOverride } : session;
  const paths = getSessionPaths(repo, session.id);
  await mkdir(paths.sessionDir, { recursive: true });
  await atomicWriteJson(paths.sessionJson, sessionToWrite);
  return sessionToWrite;
}

export async function appendSessionEvent(
  repo: string,
  sessionId: string,
  event: Pick<OpenGraphCreatorSessionEvent, "type" | "message" | "data">
): Promise<OpenGraphCreatorSessionEvent> {
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
): Promise<OpenGraphCreatorSession> {
  const paths = getSessionPaths(repo, sessionId);
  const session = await readOpenGraphCreatorSession(repo, sessionId);
  const previousExports = session.exports ?? [];
  const next: OpenGraphCreatorSession = {
    ...session,
    status: "exported",
    exports: [...previousExports, exportRecord],
    lastHeartbeatAt: new Date().toISOString(),
    pendingAction: "publish-preview"
  };
  await atomicWriteJson(paths.exportJson, {
    exports: [...previousExports, exportRecord],
    latest: exportRecord
  });
  await writeOpenGraphCreatorSession(next, repo);
  await appendSessionEvent(repo, sessionId, {
    type: "session.exported",
    message: `Exported ${exportRecord.path}`,
    data: exportRecord as unknown as Record<string, unknown>
  });
  return next;
}

export async function createPublishRequest(input: CreatePublishRequestInput): Promise<OpenGraphCreatorPublishRequest> {
  const paths = getSessionPaths(input.repo, input.sessionId);
  const session = await readOpenGraphCreatorSession(input.repo, input.sessionId);
  const request: OpenGraphCreatorPublishRequest = {
    path: paths.publishRequestJson,
    imagePath: input.imagePath,
    pageImages: input.pageImages,
    framework: input.framework,
    page: input.page ?? "/",
    status: input.confirmed ? "confirmed" : "preview",
    createdAt: new Date().toISOString()
  };
  const next: OpenGraphCreatorSession = {
    ...session,
    status: input.confirmed ? "published" : "publish-requested",
    publishRequests: [...(session.publishRequests ?? []), request],
    lastHeartbeatAt: new Date().toISOString(),
    pendingAction: input.confirmed ? undefined : "agent-preview-metadata"
  };
  await atomicWriteJson(paths.publishRequestJson, request);
  await writeOpenGraphCreatorSession(next, input.repo);
  await appendSessionEvent(input.repo, input.sessionId, {
    type: input.confirmed ? "session.publish.confirmed" : "session.publish.preview",
    message: input.confirmed ? "Publish confirmed" : "Publish preview requested",
    data: request as unknown as Record<string, unknown>
  });
  return request;
}

export async function createAgentRequest(input: CreateAgentRequestInput): Promise<OpenGraphCreatorAgentRequest> {
  const paths = getSessionPaths(input.repo, input.sessionId);
  const session = await readOpenGraphCreatorSession(input.repo, input.sessionId);
  const request: OpenGraphCreatorAgentRequest = {
    path: paths.agentRequestJson,
    prompt: input.prompt,
    documentPath: input.documentPath,
    expectedOutput: input.expectedOutput ?? paths.documentFile,
    status: "requested",
    createdAt: new Date().toISOString()
  };
  const next: OpenGraphCreatorSession = {
    ...session,
    status: "agent-requested",
    agentRequests: [...(session.agentRequests ?? []), request],
    lastHeartbeatAt: new Date().toISOString(),
    pendingAction: "agent-revise-document"
  };
  await atomicWriteJson(paths.agentRequestJson, request);
  await writeOpenGraphCreatorSession(next, input.repo);
  await appendSessionEvent(input.repo, input.sessionId, {
    type: "agent.requested",
    message: "Agent revision requested",
    data: request as unknown as Record<string, unknown>
  });
  return request;
}

export async function cancelOpenGraphCreatorSession(repo: string, sessionId: string, reason: string): Promise<OpenGraphCreatorSession> {
  const session = await readOpenGraphCreatorSession(repo, sessionId);
  const next: OpenGraphCreatorSession = {
    ...session,
    status: "cancelled",
    lastHeartbeatAt: new Date().toISOString(),
    pendingAction: undefined
  };
  await writeOpenGraphCreatorSession(next, repo);
  await appendSessionEvent(repo, sessionId, {
    type: "session.cancelled",
    message: reason
  });
  return next;
}

export async function restartOpenGraphCreatorSession(
  repo: string,
  sessionId: string,
  reason = "User requested a fresh OG generation"
): Promise<OpenGraphCreatorSession> {
  const paths = getSessionPaths(repo, sessionId);
  const session = await readOpenGraphCreatorSession(repo, sessionId);
  const archiveDir = join(paths.restartsDir, new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(archiveDir, { recursive: true });
  await archiveSessionFile(paths.documentFile, join(archiveDir, "document.ogdoc"), { removeOriginal: true });
  await archiveSessionFile(paths.exportJson, join(archiveDir, "export.json"), { removeOriginal: true });
  await archiveSessionFile(paths.publishRequestJson, join(archiveDir, "publish-request.json"), { removeOriginal: true });
  await archiveSessionFile(paths.agentRequestJson, join(archiveDir, "agent-request.json"), { removeOriginal: false });
  await archiveSessionFile(paths.generationBriefJson, join(archiveDir, "generation-brief.json"), { removeOriginal: true });

  const request: OpenGraphCreatorAgentRequest = {
    path: paths.agentRequestJson,
    prompt:
      "Restart OG generation from the Question Gate while keeping this session alive. Ask fresh coverage, visual build style, asset permission, visual direction, reference, route, and export questions before creating a new document. Generate a fresh editable .ogdoc master; use generated image/SVG/HTML only as editable document assets, and keep headline/subtitle/badge/route text editable. Validate, relaunch Studio, then wait again with opengraph-creator session wait --until next-action --timeout 0. Do not reuse the previous visual brief unless the user explicitly chooses to keep it.",
    documentPath: paths.documentFile,
    expectedOutput: paths.documentFile,
    status: "requested",
    createdAt: new Date().toISOString()
  };
  const next: OpenGraphCreatorSession = {
    ...session,
    status: "agent-requested",
    activeProjectId: undefined,
    activeDocumentPath: undefined,
    exports: [],
    publishRequests: [],
    agentRequests: [...(session.agentRequests ?? []), request],
    lastHeartbeatAt: new Date().toISOString(),
    pendingAction: "agent-restart-from-question-gate",
    recoverInstructions: [
      `Read ${paths.sessionJson}.`,
      `Review restart archive ${archiveDir} only if the user asks to recover old work.`,
      "Ask the OpenGraph Creator Question Gate setup questions again; restart is not terminal.",
      `Generate a fresh editable .ogdoc master at ${paths.documentFile}; keep text and key layout layers editable.`,
      "Validate, launch Studio, and run opengraph-creator session wait --until next-action --timeout 0 again."
    ]
  };
  await atomicWriteJson(paths.agentRequestJson, request);
  await writeOpenGraphCreatorSession(next, repo);
  await appendSessionEvent(repo, sessionId, {
    type: "session.restart.requested",
    message: reason,
    data: { archiveDir, request } as unknown as Record<string, unknown>
  });
  return next;
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
): OpenGraphCreatorSessionEvent {
  return {
    id: `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    type,
    createdAt: new Date().toISOString(),
    message,
    data
  };
}

function isStale(session: OpenGraphCreatorSession): boolean {
  const last = Date.parse(session.lastHeartbeatAt);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last > 30 * 60 * 1000;
}

function normalizeSession(session: OpenGraphCreatorSession): OpenGraphCreatorSession {
  return {
    ...session,
    incomingArtifacts: session.incomingArtifacts ?? [],
    exports: session.exports ?? [],
    publishRequests: session.publishRequests ?? [],
    agentRequests: session.agentRequests ?? [],
    recoverInstructions: session.recoverInstructions ?? []
  };
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function archiveSessionFile(source: string, target: string, options: { removeOriginal: boolean }): Promise<void> {
  if (!(await fileExists(source))) return;
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  if (options.removeOriginal) {
    await unlink(source);
  }
}

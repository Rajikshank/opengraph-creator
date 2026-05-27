import type {
  AgentKind,
  ExportFormat,
  Framework,
  GraphForgeAgentRequest,
  GenerationMode,
  GenerationStrategy,
  GraphForgePublishRequest,
  GraphForgeSession,
  GraphForgeSessionEvent,
  OgProject,
  SourceArtifactKind,
  SourceArtifactOrigin
} from "@graphforge/core";

export interface ProjectSummary {
  projectId: string;
  name: string;
  strategy?: string;
  updatedAt?: string;
  path?: string;
}

export interface SavedProjectResponse {
  projectId: string;
  path: string;
}

export interface SessionDocumentSaveResponse {
  projectId: string;
  path: string;
}

export interface ExportProjectRequest {
  projectId: string;
  format: ExportFormat;
  target: string;
  quality?: number;
  repo?: string;
}

export interface ExportProjectResponse {
  format: ExportFormat;
  target: string;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
}

export interface AgentHandoffRequest {
  project: OgProject;
  prompt?: string;
  target?: string;
  format?: "png" | "webp" | "jpeg" | "svg";
  referenceImage?: string;
}

export interface AgentHandoffResponse {
  path: string;
  plan: {
    mode: "agent-handoff";
    output: string;
    prompt: string;
  };
}

export interface ImportSourceRequest {
  source: string;
  kind?: SourceArtifactKind;
  name?: string;
  origin?: SourceArtifactOrigin;
}

export interface UploadSessionAssetRequest {
  repo?: string;
  sessionId: string;
  fileName: string;
  dataUrl: string;
}

export interface UploadSessionAssetResponse {
  assetPath: string;
}

export interface CreateSessionRequest {
  repo?: string;
  id?: string;
  agent?: AgentKind;
  strategy?: GenerationStrategy;
  mode?: GenerationMode;
}

export interface SessionEventRequest {
  repo?: string;
  sessionId: string;
  type: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface SessionExportRequest {
  repo?: string;
  sessionId: string;
  path: string;
  format: ExportFormat;
  width: number;
  height: number;
  fileSizeBytes?: number;
}

export interface PublishRequestInput {
  repo?: string;
  sessionId: string;
  imagePath: string;
  framework?: Framework;
  page?: string;
  confirmed?: boolean;
}

export interface AgentRevisionRequestInput {
  repo?: string;
  sessionId: string;
  prompt: string;
  documentPath?: string;
  expectedOutput?: string;
}

type FetchLike = typeof fetch;
const maxApiAttempts = 3;

export async function listProjectsViaApi(fetcher: FetchLike = fetch): Promise<ProjectSummary[]> {
  const body = await requestJson<{ projects: ProjectSummary[] }>(fetcher, {
    url: "/api/projects",
    label: "Could not list projects"
  });
  return body.projects;
}

export async function readProjectViaApi(fetcher: FetchLike = fetch, projectId: string): Promise<OgProject> {
  const body = await requestJson<{ project: OgProject }>(fetcher, {
    url: `/api/projects/${projectId}`,
    label: "Could not read project"
  });
  return body.project;
}

export async function saveProjectViaApi(
  fetcher: FetchLike = fetch,
  project: OgProject
): Promise<SavedProjectResponse> {
  return requestJson<SavedProjectResponse>(fetcher, {
    url: `/api/projects/${project.projectId}`,
    label: "Could not save project",
    init: {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(project)
    }
  });
}

export async function exportProjectViaApi(
  fetcher: FetchLike = fetch,
  request: ExportProjectRequest
): Promise<ExportProjectResponse> {
  const body = await requestJson<{ result: ExportProjectResponse }>(fetcher, {
    url: "/api/export",
    label: "Could not export project",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    }
  });
  return body.result;
}

export async function createAgentHandoffViaApi(
  fetcher: FetchLike = fetch,
  request: AgentHandoffRequest
): Promise<AgentHandoffResponse> {
  return requestJson<AgentHandoffResponse>(fetcher, {
    url: "/api/agent-handoff",
    label: "Could not create agent handoff",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    }
  });
}

export async function importSourceViaApi(
  fetcher: FetchLike = fetch,
  request: ImportSourceRequest
): Promise<OgProject> {
  const body = await requestJson<{ project: OgProject }>(fetcher, {
    url: "/api/import",
    label: "Could not import source",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    }
  });
  return body.project;
}

export async function createSessionViaApi(
  fetcher: FetchLike = fetch,
  request: CreateSessionRequest
): Promise<GraphForgeSession> {
  const body = await requestJson<{ session: GraphForgeSession }>(fetcher, {
    url: "/api/session",
    label: "Could not create session",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    }
  });
  return body.session;
}

export async function readSessionViaApi(
  fetcher: FetchLike = fetch,
  request: { id: string; repo?: string }
): Promise<GraphForgeSession> {
  return (await readSessionBundleViaApi(fetcher, request)).session;
}

export async function readSessionBundleViaApi(
  fetcher: FetchLike = fetch,
  request: { id: string; repo?: string }
): Promise<{ session: GraphForgeSession; project?: OgProject; documentPath?: string }> {
  const params = new URLSearchParams({ id: request.id });
  if (request.repo) params.set("repo", request.repo);
  return requestJson<{ session: GraphForgeSession; project?: OgProject; documentPath?: string }>(fetcher, {
    url: `/api/session?${params.toString()}`,
    label: "Could not read session"
  });
}

export async function saveSessionDocumentViaApi(
  fetcher: FetchLike = fetch,
  request: { repo?: string; sessionId: string; project: OgProject }
): Promise<SessionDocumentSaveResponse> {
  return requestJson<SessionDocumentSaveResponse>(fetcher, {
    url: "/api/session/document",
    label: "Could not save Studio document",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    }
  });
}

export async function uploadSessionAssetViaApi(
  fetcher: FetchLike = fetch,
  request: UploadSessionAssetRequest
): Promise<UploadSessionAssetResponse> {
  return requestJson<UploadSessionAssetResponse>(fetcher, {
    url: "/api/session/asset",
    label: "Could not import asset into Studio document",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    }
  });
}

export async function appendSessionEventViaApi(
  fetcher: FetchLike = fetch,
  request: SessionEventRequest
): Promise<GraphForgeSessionEvent> {
  const body = await requestJson<{ event: GraphForgeSessionEvent }>(fetcher, {
    url: "/api/session/event",
    label: "Could not append session event",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    }
  });
  return body.event;
}

export async function recordSessionExportViaApi(
  fetcher: FetchLike = fetch,
  request: SessionExportRequest
): Promise<GraphForgeSession> {
  const body = await requestJson<{ session: GraphForgeSession }>(fetcher, {
    url: "/api/session/export",
    label: "Could not record session export",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    }
  });
  return body.session;
}

export async function createPublishRequestViaApi(
  fetcher: FetchLike = fetch,
  request: PublishRequestInput
): Promise<GraphForgePublishRequest> {
  const body = await requestJson<{ request: GraphForgePublishRequest }>(fetcher, {
    url: "/api/session/publish-request",
    label: "Could not create publish request",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    }
  });
  return body.request;
}

export async function createSessionAgentRequestViaApi(
  fetcher: FetchLike = fetch,
  request: AgentRevisionRequestInput
): Promise<GraphForgeAgentRequest> {
  const body = await requestJson<{ request: GraphForgeAgentRequest }>(fetcher, {
    url: "/api/session/agent-request",
    label: "Could not create agent revision request",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    }
  });
  return body.request;
}

async function requestJson<T>(
  fetcher: FetchLike,
  input: { url: string; label: string; init?: RequestInit }
): Promise<T> {
  let lastNetworkError: unknown;

  for (let attempt = 1; attempt <= maxApiAttempts; attempt += 1) {
    try {
      const response = await fetcher(input.url, input.init);
      if (response.ok) return (await response.json()) as T;
      if (!isRetryableStatus(response.status) || attempt === maxApiAttempts) {
        throw new Error(`${input.label}: ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(`${input.label}:`)) throw error;
      lastNetworkError = error;
      if (attempt === maxApiAttempts) break;
    }
  }

  const detail = lastNetworkError instanceof Error ? lastNetworkError.message : String(lastNetworkError);
  throw new Error(`${input.label}: ${detail}`);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

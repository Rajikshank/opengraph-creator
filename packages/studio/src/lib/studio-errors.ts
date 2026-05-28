export type StudioErrorKind =
  | "api-unavailable"
  | "network"
  | "validation"
  | "session-missing"
  | "document-save"
  | "export"
  | "publish"
  | "agent-handoff"
  | "unknown";

export interface StudioErrorInfo {
  kind: StudioErrorKind;
  title: string;
  message: string;
  recovery: string;
  retryable: boolean;
  technical: string;
}

export interface StudioErrorFallback {
  kind: StudioErrorKind;
  title: string;
  recovery: string;
}

export function normalizeStudioError(error: unknown, fallback: StudioErrorFallback): StudioErrorInfo {
  const technical = stringifyError(error);
  const retryable = isRetryableError(technical, fallback.kind);
  return {
    kind: fallback.kind,
    title: fallback.title,
    message: friendlyMessage(technical, fallback.kind),
    recovery: fallback.recovery,
    retryable,
    technical
  };
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function friendlyMessage(technical: string, kind: StudioErrorKind): string {
  if (kind === "session-missing" || technical.includes(".ogdoc")) {
    return "This session does not have an editable .ogdoc document yet.";
  }
  if (kind === "validation") {
    return "The document could not be read as a valid Studio document.";
  }
  if (kind === "api-unavailable" || /failed to fetch|socket|network|load failed/i.test(technical)) {
    return "The local Studio service is not reachable right now.";
  }
  if (/:\s*(408|429|5\d\d)\b/.test(technical)) {
    return "The local Studio service rejected the request temporarily.";
  }
  if (kind === "export") {
    return "The export did not complete, but the editable document is still safe.";
  }
  if (kind === "publish") {
    return "The publish handoff was not written. No app metadata was changed.";
  }
  if (kind === "agent-handoff") {
    return "The agent handoff could not be written. Your document remains editable.";
  }
  return technical || "The action could not be completed.";
}

function isRetryableError(technical: string, kind: StudioErrorKind): boolean {
  if (kind === "session-missing" || kind === "validation") return false;
  return kind === "api-unavailable" || /failed to fetch|socket|network|load failed|:\s*(408|429|5\d\d)\b/i.test(technical);
}

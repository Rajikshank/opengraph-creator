import { useRef, type ChangeEvent } from "react";
import { AlertTriangle, FileArchive, FolderOpen, PencilRuler, RefreshCw } from "lucide-react";
import { unpackStudioDocument } from "@opengraph-creator/core";
import type { ProjectSummary } from "../api";
import { normalizeStudioError } from "../lib/studio-errors";
import { notifyStudioError, notifyStudioSuccess } from "../lib/studio-toast";
import { ConnectAgentPanel } from "./ConnectAgentPanel";
import { createManualProject, useStudio } from "./studio-store";

export type StartupMode = "global-hub" | "repo-hub" | "recovery";

interface ProjectPickerProps {
  mode?: StartupMode;
  repo?: string;
  recoveryMessage?: string;
  onOpenProject: (id: string) => void;
  onRetrySession?: () => void;
}

export function ProjectPicker({ mode = "global-hub", repo, recoveryMessage, onOpenProject, onRetrySession }: ProjectPickerProps) {
  const projects = useStudio((state) => state.projects);
  const replaceProject = useStudio((state) => state.replaceProject);
  const session = useStudio((state) => state.session);
  const openDocumentInputRef = useRef<HTMLInputElement>(null);

  const startManualDraft = () => replaceProject(createManualProject("Manual OG Draft"));

  const openDocumentFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", async () => {
      try {
        const bytes = reader.result instanceof ArrayBuffer ? new Uint8Array(reader.result) : undefined;
        if (!bytes) throw new Error("Could not read document bytes.");
        const document = await unpackStudioDocument(bytes);
        replaceProject(document.project);
        notifyStudioSuccess(`Opened ${file.name}`);
      } catch (error) {
        notifyStudioError(
          normalizeStudioError(error, {
            kind: "validation",
            title: "Could not open .ogdoc document",
            recovery: "Choose a valid Studio document package or ask the agent to regenerate it."
          })
        );
      }
    });
    reader.readAsArrayBuffer(file);
  };

  return (
    <main className={`project-picker project-hub project-hub-${mode}`} data-enter>
      <section className="picker-panel project-hub-hero">
        <div className="picker-kicker">{mode === "recovery" ? "Recovery" : mode === "repo-hub" ? "Repo workspace" : "Local Studio"}</div>
        <h1>{getHubTitle(mode)}</h1>
        <p>{getHubCopy(mode, repo)}</p>
        {mode === "recovery" ? (
          <div className="session-strip warning">
            <strong><AlertTriangle size={14} /> Session needs attention</strong>
            <span>{recoveryMessage ?? "The session opened, but its editable .ogdoc document could not be loaded."}</span>
          </div>
        ) : session ? (
          <div className="session-strip">
            <strong>{session.agent}</strong>
            <span>{session.status}</span>
            <small>{session.id}</small>
          </div>
        ) : (
          <div className="session-strip muted">
            <strong>No active agent session</strong>
            <span>Open from the Codex, Claude Code, or OpenCode skill for automatic handoff, or connect this repo manually.</span>
          </div>
        )}
        <div className="hub-action-grid">
          <button type="button" className="primary-action" onClick={() => openDocumentInputRef.current?.click()}>
            <FileArchive size={15} /> Open .ogdoc
          </button>
          <button type="button" className="secondary-action" onClick={startManualDraft}>
            <PencilRuler size={15} /> Start manual draft
          </button>
          {onRetrySession ? (
            <button type="button" className="secondary-action" onClick={onRetrySession}>
              <RefreshCw size={15} /> Retry session
            </button>
          ) : null}
        </div>
        <input ref={openDocumentInputRef} className="visually-hidden-input" type="file" accept=".ogdoc" onChange={openDocumentFile} aria-label="Open Studio document file" />
      </section>

      <section className="picker-panel project-hub-library">
        <div className="section-heading">
          <FolderOpen size={15} />
          <span>Recent documents</span>
        </div>
        <div className="library-list">
          {projects.length ? (
            projects.map((project) => (
              <button type="button" key={project.projectId} className="project-row" onClick={() => onOpenProject(project.projectId)}>
                <ProjectVisual project={project} />
                <span>
                  <strong>{project.name}</strong>
                  <small>{project.strategy ?? ".ogdoc"}{project.updatedAt ? ` · ${formatDate(project.updatedAt)}` : ""}</small>
                </span>
              </button>
            ))
          ) : (
            <p className="quiet-copy">No saved Studio documents yet. Open an `.ogdoc`, connect an agent session, or start a manual draft.</p>
          )}
        </div>
      </section>

      <section className="picker-panel project-hub-connect">
        <ConnectAgentPanel repo={repo} />
      </section>
    </main>
  );
}

function getHubTitle(mode: StartupMode): string {
  if (mode === "repo-hub") return "Prepare an OG session for this repo";
  if (mode === "recovery") return "Recover the Studio session";
  return "Open an editable OG document";
}

function getHubCopy(mode: StartupMode, repo?: string): string {
  if (mode === "repo-hub") return `No active agent is attached yet. Use the connection recipe for ${repo ?? "this repo"} or open an existing .ogdoc.`;
  if (mode === "recovery") return "The agent bridge is file-based, so recovery is safe: reopen the document, retry the session, or copy the connection recipe.";
  return "Use Studio as a local finishing tool, or invoke the agent skill to generate a layered .ogdoc and open the canvas automatically.";
}

function ProjectVisual({ project }: { project: ProjectSummary }) {
  const initials = project.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "OG";
  return (
    <span className="project-visual" aria-hidden="true">
      {initials}
    </span>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

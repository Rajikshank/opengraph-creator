import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { GalleryHorizontalEnd, Menu, PencilRuler, Redo2, Save, Undo2 } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Toaster } from "sonner";
import { listProjectsViaApi, readProjectViaApi, readSessionBundleViaApi, saveProjectViaApi, saveSessionDocumentViaApi } from "../api";
import { StudioSegmentedControl } from "../design-system/StudioControls";
import { StudioTooltipProvider } from "../design-system/StudioTooltip";
import { normalizeStudioError } from "../lib/studio-errors";
import { notifyStudioError, notifyStudioSuccess, notifyStudioWarning } from "../lib/studio-toast";
import { ArtboardEditor } from "./ArtboardEditor";
import { InspectorTabs } from "./InspectorTabs";
import { PreviewDock } from "./PlatformPreviewPanel";
import { ProjectPicker, type StartupMode } from "./ProjectPicker";
import { SourceRail } from "./SourceRail";
import { ToolPalette } from "./ToolPalette";
import { useStudio } from "./studio-store";

type SessionBundle = Awaited<ReturnType<typeof readSessionBundleViaApi>>;

export function SessionShell() {
  const shellRef = useRef<HTMLDivElement>(null);
  const hasPlayedEntranceRef = useRef(false);
  const project = useStudio((state) => state.project);
  const sourceRailOpen = useStudio((state) => state.sourceRailOpen);
  const setSourceRailOpen = useStudio((state) => state.setSourceRailOpen);
  const replaceProject = useStudio((state) => state.replaceProject);
  const setSession = useStudio((state) => state.setSession);
  const session = useStudio((state) => state.session);
  const dirty = useStudio((state) => state.dirty);
  const markSaved = useStudio((state) => state.markSaved);
  const setProjects = useStudio((state) => state.setProjects);
  const canUndo = useStudio((state) => state.past.length > 0);
  const canRedo = useStudio((state) => state.future.length > 0);
  const undo = useStudio((state) => state.undo);
  const redo = useStudio((state) => state.redo);
  const [startupMode, setStartupMode] = useState<StartupMode>("global-hub");
  const [startupRepo, setStartupRepo] = useState<string | undefined>();
  const [recoveryMessage, setRecoveryMessage] = useState<string | undefined>();
  const [loadedDocumentRevision, setLoadedDocumentRevision] = useState<string | undefined>();
  const [pendingAgentBundle, setPendingAgentBundle] = useState<SessionBundle | undefined>();
  const refreshStateRef = useRef({ dirty: false, loadedDocumentRevision: undefined as string | undefined });
  const pendingRevisionRef = useRef<string | undefined>();

  const loadSessionBundle = (bundle: SessionBundle, options: { notify?: boolean } = {}) => {
    setSession(bundle.session);
    if (bundle.project) {
      replaceProject(bundle.project);
      setLoadedDocumentRevision(bundle.documentRevision);
      setPendingAgentBundle(undefined);
      pendingRevisionRef.current = undefined;
      setRecoveryMessage(undefined);
      if (options.notify) notifyStudioSuccess("Loaded agent update");
      return true;
    }
    return false;
  };

  useEffect(() => {
    listProjectsViaApi()
      .then(setProjects)
      .catch((error) =>
        notifyStudioError(
          normalizeStudioError(error, {
            kind: "api-unavailable",
            title: "Project library unavailable",
            recovery: "Manual editing still works. Restart the local Studio service if the library is needed."
          })
        )
      );
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session");
    const repo = params.get("repo") ?? undefined;
    const projectId = params.get("project");
    setStartupRepo(repo);
    if (sessionId) {
      setStartupMode("recovery");
      readSessionBundleViaApi(fetch, { id: sessionId, repo })
        .then((bundle) => {
          if (!loadSessionBundle(bundle)) {
            setRecoveryMessage(bundle.documentError ?? "Session opened, but no editable .ogdoc document exists yet.");
            notifyStudioWarning(
              "Session document missing",
              bundle.documentError
                ? `Ask the coding agent to repair the editable .ogdoc document: ${bundle.documentError}`
                : "Ask the coding agent to regenerate the editable .ogdoc document, then reopen this session."
            );
          }
        })
        .catch((error) => {
          const info = normalizeStudioError(error, {
            kind: "session-missing",
            title: "Could not open session",
            recovery: "Use the session recovery files or ask the coding agent to reopen the Studio session."
          });
          setRecoveryMessage(info.technical);
          notifyStudioError(info);
        });
    } else if (projectId) {
      setStartupMode("global-hub");
      openProject(projectId);
    } else {
      setStartupMode(repo ? "repo-hub" : "global-hub");
    }
  }, []);

  useEffect(() => {
    refreshStateRef.current = { dirty, loadedDocumentRevision };
  }, [dirty, loadedDocumentRevision]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const bundle = await readSessionBundleViaApi(fetch, { id: session.id, repo: session.repo });
        if (cancelled || !bundle.documentRevision || bundle.documentRevision === refreshStateRef.current.loadedDocumentRevision) return;
        if (refreshStateRef.current.dirty) {
          if (bundle.documentRevision === pendingRevisionRef.current) return;
          pendingRevisionRef.current = bundle.documentRevision;
          setPendingAgentBundle(bundle);
          return;
        }
        loadSessionBundle(bundle, { notify: true });
      } catch {
        // Session refresh is opportunistic; normal API error handling remains on explicit user actions.
      }
    };
    const timer = window.setInterval(() => {
      void poll();
    }, 1600);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (editableTarget || (!event.metaKey && !event.ctrlKey)) return;

      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (key === "z") {
        event.preventDefault();
        undo();
      } else if (key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  useEffect(() => {
    if (hasPlayedEntranceRef.current || !shellRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    hasPlayedEntranceRef.current = true;
    const tween = gsap.fromTo(
      shellRef.current.querySelectorAll("[data-enter]"),
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.24, ease: "power2.out", stagger: 0.025 }
    );
    return () => {
      tween.kill();
    };
  }, []);

  const openProject = async (projectId: string) => {
    try {
      replaceProject(await readProjectViaApi(fetch, projectId));
      notifyStudioSuccess("Project opened");
    } catch (error) {
      notifyStudioError(
        normalizeStudioError(error, {
          kind: "validation",
          title: "Open project failed",
          recovery: "Choose another project or reopen the source .ogdoc document."
        })
      );
    }
  };

  const saveProject = async () => {
    if (!project) return;
    try {
      if (session) {
        const result = await saveSessionDocumentViaApi(fetch, { repo: session.repo, sessionId: session.id, project });
        markSaved();
        notifyStudioSuccess(`Saved ${result.path}`);
        return;
      }
      const result = await saveProjectViaApi(fetch, project);
      markSaved();
      notifyStudioSuccess(`Saved ${result.path}`);
      setProjects(await listProjectsViaApi());
    } catch (error) {
      notifyStudioError(
        normalizeStudioError(error, {
          kind: "document-save",
          title: "Save failed",
          recovery: "The current editor state is still in memory. Retry save before closing Studio."
        })
      );
    }
  };

  return (
    <StudioTooltipProvider>
    <div className="studio-shell" ref={shellRef}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "opengraph-creator-toast",
            title: "opengraph-creator-toast-title",
            description: "opengraph-creator-toast-description",
            actionButton: "opengraph-creator-toast-action",
            cancelButton: "opengraph-creator-toast-cancel",
            closeButton: "opengraph-creator-toast-close"
          }
        }}
      />
      <header className="studio-commandbar" data-enter>
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <img className="brand-mark-image" src="/opengraph-creator-logo.png" alt="" />
          </span>
          <div>
            <strong>OpenGraph Creator</strong>
            <span>{project ? project.name : "Project picker"}</span>
          </div>
        </div>
        <div className="command-actions">
          <button type="button" title="Undo" disabled={!project || !canUndo} onClick={undo}>
            <Undo2 size={15} /> Undo
          </button>
          <button type="button" title="Redo" disabled={!project || !canRedo} onClick={redo}>
            <Redo2 size={15} /> Redo
          </button>
          <button type="button" title="Save project" disabled={!project} onClick={saveProject}>
            <Save size={15} /> Save
          </button>
        </div>
      </header>

      {pendingAgentBundle ? (
        <div className="agent-update-banner" data-enter>
          <div>
            <strong>Agent update ready</strong>
            <span>The coding agent revised this .ogdoc while you have local edits.</span>
          </div>
          <div className="agent-update-actions">
            <button type="button" className="secondary-action" onClick={() => loadSessionBundle(pendingAgentBundle, { notify: true })}>
              Load update
            </button>
            <button
              type="button"
              className="ghost-action"
              onClick={() => {
                setLoadedDocumentRevision(pendingAgentBundle.documentRevision);
                setPendingAgentBundle(undefined);
                pendingRevisionRef.current = undefined;
              }}
            >
              Keep current
            </button>
          </div>
        </div>
      ) : null}

      {!project ? (
        <div className="empty-workspace">
          <ProjectPicker
            mode={startupMode}
            repo={startupRepo}
            recoveryMessage={recoveryMessage}
            onOpenProject={openProject}
            onRetrySession={startupMode === "recovery" ? () => window.location.reload() : undefined}
          />
        </div>
      ) : (
        <PanelGroup direction="horizontal" autoSaveId="OpenGraphCreator-final-layout" className="studio-workspace" data-enter>
          {sourceRailOpen ? (
            <>
              <Panel minSize={18} defaultSize={23} maxSize={32}>
                <SourceRail onClose={() => setSourceRailOpen(false)} />
              </Panel>
              <StudioResizeHandle />
            </>
          ) : null}
          <Panel minSize={52} defaultSize={sourceRailOpen ? 62 : 74}>
            <main className="studio-main canvas-main">
              <StageWorkspace sourceRailOpen={sourceRailOpen} onOpenSourceRail={() => setSourceRailOpen(true)} />
            </main>
          </Panel>
          <StudioResizeHandle />
          <Panel minSize={22} defaultSize={sourceRailOpen ? 26 : 26} maxSize={36}>
            <InspectorTabs />
          </Panel>
        </PanelGroup>
      )}
    </div>
    </StudioTooltipProvider>
  );
}

function StudioResizeHandle() {
  return <PanelResizeHandle className="resize-handle"><Menu size={13} /></PanelResizeHandle>;
}

function StageWorkspace({ sourceRailOpen, onOpenSourceRail }: { sourceRailOpen: boolean; onOpenSourceRail: () => void }) {
  const [mode, setMode] = useState<"canvas" | "preview">("canvas");

  return (
    <section className="stage-workspace">
      <StudioSegmentedControl
        label="Stage mode"
        value={mode}
        className="stage-mode-tabs"
        onValueChange={setMode}
        segments={[
          { value: "canvas", label: "Canvas", icon: <PencilRuler size={14} /> },
          { value: "preview", label: "Platform Preview", icon: <GalleryHorizontalEnd size={14} /> }
        ]}
      />
      {mode === "canvas" ? (
        <>
          <ToolPalette />
          <ArtboardEditor sourceRailOpen={sourceRailOpen} onOpenSourceRail={onOpenSourceRail} />
        </>
      ) : (
        <PreviewDock variant="stage" />
      )}
    </section>
  );
}

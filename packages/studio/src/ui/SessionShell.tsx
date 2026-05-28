import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { GalleryHorizontalEnd, Menu, PencilRuler, Save } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Toaster, toast } from "sonner";
import { listProjectsViaApi, readProjectViaApi, readSessionBundleViaApi, saveProjectViaApi, saveSessionDocumentViaApi } from "../api";
import { StudioSegmentedControl } from "../design-system/StudioControls";
import { StudioTooltipProvider } from "../design-system/StudioTooltip";
import { ArtboardEditor } from "./ArtboardEditor";
import { InspectorTabs } from "./InspectorTabs";
import { PreviewDock } from "./PlatformPreviewPanel";
import { ProjectPicker, type StartupMode } from "./ProjectPicker";
import { SourceRail } from "./SourceRail";
import { ToolPalette } from "./ToolPalette";
import { useStudio } from "./studio-store";

export function SessionShell() {
  const shellRef = useRef<HTMLDivElement>(null);
  const hasPlayedEntranceRef = useRef(false);
  const project = useStudio((state) => state.project);
  const hasProject = Boolean(project);
  const sourceRailOpen = useStudio((state) => state.sourceRailOpen);
  const setSourceRailOpen = useStudio((state) => state.setSourceRailOpen);
  const replaceProject = useStudio((state) => state.replaceProject);
  const setSession = useStudio((state) => state.setSession);
  const session = useStudio((state) => state.session);
  const setProjects = useStudio((state) => state.setProjects);
  const [startupMode, setStartupMode] = useState<StartupMode>("global-hub");
  const [startupRepo, setStartupRepo] = useState<string | undefined>();
  const [recoveryMessage, setRecoveryMessage] = useState<string | undefined>();

  useEffect(() => {
    listProjectsViaApi().then(setProjects).catch(() => toast.warning("Local API unavailable; manual editing still works"));
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session");
    const repo = params.get("repo") ?? undefined;
    const projectId = params.get("project");
    setStartupRepo(repo);
    if (sessionId) {
      setStartupMode("recovery");
      readSessionBundleViaApi(fetch, { id: sessionId, repo })
        .then((bundle) => {
          setSession(bundle.session);
          if (bundle.project) {
            replaceProject(bundle.project);
            setRecoveryMessage(undefined);
          } else {
            setRecoveryMessage("Session opened, but no editable .ogdoc document exists yet.");
            toast.warning("Session opened, but no editable .ogdoc document exists yet");
          }
        })
        .catch((error) => {
          setRecoveryMessage(error instanceof Error ? error.message : "Could not open session");
          toast.error(error instanceof Error ? error.message : "Could not open session");
        });
    } else if (projectId) {
      setStartupMode("global-hub");
      openProject(projectId);
    } else {
      setStartupMode(repo ? "repo-hub" : "global-hub");
    }
  }, []);

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
  }, [hasProject]);

  const openProject = async (projectId: string) => {
    try {
      replaceProject(await readProjectViaApi(fetch, projectId));
      toast.success("Project opened");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Open project failed");
    }
  };

  const saveProject = async () => {
    if (!project) return;
    try {
      if (session) {
        const result = await saveSessionDocumentViaApi(fetch, { repo: session.repo, sessionId: session.id, project });
        toast.success(`Saved ${result.path}`);
        return;
      }
      const result = await saveProjectViaApi(fetch, project);
      toast.success(`Saved ${result.path}`);
      setProjects(await listProjectsViaApi());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    }
  };

  return (
    <StudioTooltipProvider>
    <div className="studio-shell" ref={shellRef}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "graphforge-toast",
            title: "graphforge-toast-title",
            description: "graphforge-toast-description",
            actionButton: "graphforge-toast-action",
            cancelButton: "graphforge-toast-cancel",
            closeButton: "graphforge-toast-close"
          }
        }}
      />
      <header className="studio-commandbar" data-enter>
        <div className="brand-block">
          <span className="brand-mark">OL</span>
          <div>
            <strong>Ogloom</strong>
            <span>{project ? project.name : "Project picker"}</span>
          </div>
        </div>
        <div className="command-actions">
          <button type="button" title="Save project" disabled={!project} onClick={saveProject}>
            <Save size={15} /> Save
          </button>
        </div>
      </header>

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
        <PanelGroup direction="horizontal" autoSaveId="graphforge-final-layout" className="studio-workspace" data-enter>
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

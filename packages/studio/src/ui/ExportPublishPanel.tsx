import { useState } from "react";
import { Download, RotateCcw, Send } from "lucide-react";
import type { ExportFormat, Framework } from "@graphforge/core";
import {
  createAgentHandoffViaApi,
  createPublishRequestViaApi,
  createSessionAgentRequestViaApi,
  exportProjectPagesViaApi,
  exportProjectViaApi,
  recordSessionExportViaApi,
  restartSessionViaApi,
  saveProjectViaApi,
  saveSessionDocumentViaApi
} from "../api";
import { StudioSelect } from "../design-system/StudioSelect";
import { StudioSlider } from "../design-system/StudioSlider";
import { normalizeStudioError } from "../lib/studio-errors";
import { notifyStudioError, notifyStudioSuccess } from "../lib/studio-toast";
import { useStudio } from "./studio-store";

export function ExportPublishPanel() {
  const project = useStudio((state) => state.project);
  const session = useStudio((state) => state.session);
  const setLastExportSizeBytes = useStudio((state) => state.setLastExportSizeBytes);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [framework, setFramework] = useState<Framework>("unknown");
  const [quality, setQuality] = useState(82);
  const [target, setTarget] = useState("public/og.png");
  const [pageImages, setPageImages] = useState<Array<{ page: string; imagePath: string }>>([]);
  const [hasExported, setHasExported] = useState(false);
  const [hasPreviewRequest, setHasPreviewRequest] = useState(false);
  const [hasConfirmedPublish, setHasConfirmedPublish] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<"export" | "preview" | "confirm" | "handoff" | "restart" | null>(null);
  const isBusy = busyAction !== null;

  const runGuardedOperation = async (action: NonNullable<typeof busyAction>, operation: () => Promise<void>) => {
    if (busyAction) return;
    setBusyAction(action);
    try {
      await operation();
    } finally {
      setBusyAction(null);
    }
  };

  const exportProject = async () => {
    if (!project) return;
    try {
      if (session) await saveSessionDocumentViaApi(fetch, { repo: session.repo, sessionId: session.id, project });
      await saveProjectViaApi(fetch, project);
      const result = await exportProjectViaApi(fetch, { projectId: project.projectId, format, target, quality, repo: session?.repo });
      setLastExportSizeBytes(result.fileSizeBytes);
      setHasExported(true);
      setPageImages(project.pages?.length ? [{ page: project.targetPages[0] ?? "/", imagePath: result.target }] : []);
      setHasPreviewRequest(false);
      setHasConfirmedPublish(false);
      if (session) {
        await recordSessionExportViaApi(fetch, {
          repo: session.repo,
          sessionId: session.id,
          path: result.target,
          format,
          width: result.width ?? 1200,
          height: result.height ?? 630,
          fileSizeBytes: result.fileSizeBytes
        });
      }
      notifyStudioSuccess(`Exported ${result.target}`);
    } catch (error) {
      notifyStudioError(
        normalizeStudioError(error, {
          kind: "export",
          title: "Export failed",
          recovery: "Your editable document is still safe. Retry export after checking the target path and local Studio service."
        })
      );
    }
  };

  const exportAllPages = async () => {
    if (!project?.pages?.length) return;
    try {
      if (session) await saveSessionDocumentViaApi(fetch, { repo: session.repo, sessionId: session.id, project });
      await saveProjectViaApi(fetch, project);
      const result = await exportProjectPagesViaApi(fetch, {
        projectId: project.projectId,
        format,
        outDir: "public/og",
        quality,
        repo: session?.repo
      });
      const mappings = result.exports.map((item) => ({ page: item.page, imagePath: item.target }));
      setPageImages(mappings);
      setLastExportSizeBytes(result.exports.reduce((total, item) => total + (item.fileSizeBytes ?? 0), 0));
      setHasExported(true);
      setHasPreviewRequest(false);
      setHasConfirmedPublish(false);
      if (session) {
        for (const item of result.exports) {
          await recordSessionExportViaApi(fetch, {
            repo: session.repo,
            sessionId: session.id,
            path: item.target,
            format,
            page: item.page,
            width: item.width ?? 1200,
            height: item.height ?? 630,
            fileSizeBytes: item.fileSizeBytes
          });
        }
      }
      notifyStudioSuccess(`Exported ${result.exports.length} page OG image${result.exports.length === 1 ? "" : "s"}`);
    } catch (error) {
      notifyStudioError(
        normalizeStudioError(error, {
          kind: "export",
          title: "Page export failed",
          recovery: "Your editable page variants are still safe. Retry export after checking the target path and local Studio service."
        })
      );
    }
  };

  const createPublishPreview = async () => {
    if (!session) {
      notifyStudioError(
        normalizeStudioError("Open an agent session before creating a publish request", {
          kind: "publish",
          title: "No agent session connected",
          recovery: "Open Studio from a GraphForge agent session before creating a publish preview."
        })
      );
      return;
    }
    try {
      await createPublishRequestViaApi(fetch, { repo: session.repo, sessionId: session.id, imagePath: pageImages[0]?.imagePath ?? target, pageImages: pageImages.length ? pageImages : undefined, framework, confirmed: false });
      setHasPreviewRequest(true);
      setHasConfirmedPublish(false);
      notifyStudioSuccess("Publish preview request created");
    } catch (error) {
      notifyStudioError(
        normalizeStudioError(error, {
          kind: "publish",
          title: "Publish request failed",
          recovery: "No metadata was changed. Retry after saving the document or reopening the session."
        })
      );
    }
  };

  const confirmPublishHandoff = async () => {
    if (!session) {
      notifyStudioError(
        normalizeStudioError("Open an agent session before confirming publish", {
          kind: "publish",
          title: "No agent session connected",
          recovery: "Open Studio from a GraphForge agent session before confirming publish."
        })
      );
      return;
    }
    if (!hasExported) {
      notifyStudioError(
        normalizeStudioError("Export the OG image before confirming publish", {
          kind: "publish",
          title: "Export required",
          recovery: "Export the optimized OG image first, then create a publish preview."
        })
      );
      return;
    }
    if (!hasPreviewRequest) {
      notifyStudioError(
        normalizeStudioError("Create a publish preview before confirming handoff", {
          kind: "publish",
          title: "Preview required",
          recovery: "Create the publish preview before confirming the coding-agent handoff."
        })
      );
      return;
    }
    try {
      await createPublishRequestViaApi(fetch, { repo: session.repo, sessionId: session.id, imagePath: pageImages[0]?.imagePath ?? target, pageImages: pageImages.length ? pageImages : undefined, framework, confirmed: true });
      setHasPreviewRequest(true);
      setHasConfirmedPublish(true);
      notifyStudioSuccess("Publish confirmed for agent handoff");
    } catch (error) {
      notifyStudioError(
        normalizeStudioError(error, {
          kind: "publish",
          title: "Publish confirmation failed",
          recovery: "The preview request is still available. Retry confirmation after checking the local session."
        })
      );
    }
  };

  const askAgentToWire = async () => {
    if (!project) return;
    try {
      if (session) {
        await saveSessionDocumentViaApi(fetch, { repo: session.repo, sessionId: session.id, project });
        const request = await createSessionAgentRequestViaApi(fetch, {
          repo: session.repo,
          sessionId: session.id,
          prompt: pageImages.length
            ? `Wire the confirmed page-specific OG exports into the app metadata after previewing metadata. Page mappings: ${pageImages.map((item) => `${item.page} -> ${item.imagePath}`).join(", ")}.`
            : `Wire the confirmed OG export into the app metadata. Use ${target} as the selected raster OG image after previewing metadata.`,
          documentPath: session.activeDocumentPath,
          expectedOutput: session.activeDocumentPath
        });
        notifyStudioSuccess(`Agent request saved: ${request.path}`);
        return;
      }
      const result = await createAgentHandoffViaApi(fetch, {
        project,
        prompt: pageImages.length
          ? `Ask agent to wire page-specific exports after previewing metadata. Page mappings: ${pageImages.map((item) => `${item.page} -> ${item.imagePath}`).join(", ")}.`
          : `Ask agent to wire exports. Use ${target} as the selected raster OG image after previewing metadata.`,
        target,
        format: format === "jpg" ? "jpeg" : format
      });
      notifyStudioSuccess(`Ask agent to wire exports: ${result.path}`);
    } catch (error) {
      notifyStudioError(
        normalizeStudioError(error, {
          kind: "agent-handoff",
          title: "Agent wiring handoff failed",
          recovery: "Your document is still editable. Retry handoff after saving the project."
        })
      );
    }
  };

  const restartOgGeneration = async () => {
    if (!session) return;
    try {
      if (project) await saveSessionDocumentViaApi(fetch, { repo: session.repo, sessionId: session.id, project });
      await restartSessionViaApi(fetch, {
        repo: session.repo,
        sessionId: session.id,
        reason: "User requested Restart OG generation from Studio"
      });
      setPageImages([]);
      setHasExported(false);
      setHasPreviewRequest(false);
      setHasConfirmedPublish(false);
      setRestartConfirmOpen(false);
      notifyStudioSuccess("Restart requested. The agent will ask fresh OG setup questions.");
    } catch (error) {
      notifyStudioError(
        normalizeStudioError(error, {
          kind: "agent-handoff",
          title: "Restart request failed",
          recovery: "Your current document remains open. Retry restart after checking the local session connection."
        })
      );
    }
  };

  return (
    <section className="studio-section">
      <h2 className="section-heading">
        <Download size={15} />
        <span>Export</span>
      </h2>
      <StudioSelect
        label="Format"
        value={format}
        options={[
          { value: "png", label: "PNG" },
          { value: "webp", label: "WebP" },
          { value: "jpg", label: "JPEG" },
          { value: "svg", label: "SVG source" }
        ]}
        onValueChange={(value) => {
            const next = value as ExportFormat;
            setFormat(next);
            setTarget(next === "png" ? "public/og.png" : next === "webp" ? "public/og.webp" : next === "jpg" ? "public/og.jpg" : "public/og.svg");
          }}
      />
      <label>Output path<input value={target} onChange={(event) => setTarget(event.target.value)} /></label>
      <StudioSelect
        label="Framework"
        value={framework}
        options={[
          { value: "unknown", label: "Detect later" },
          { value: "next", label: "Next.js" },
          { value: "astro", label: "Astro" },
          { value: "nuxt", label: "Nuxt" },
          { value: "remix", label: "Remix" },
          { value: "vite", label: "Vite" },
          { value: "html", label: "HTML" }
        ]}
        onValueChange={(value) => setFramework(value as Framework)}
      />
      <StudioSlider label="Quality" min={40} max={100} value={quality} unit="%" onValueChange={setQuality} />
      <button type="button" className="primary-action" disabled={isBusy} onClick={() => void runGuardedOperation("export", exportProject)}>
        <Download size={15} /> {busyAction === "export" ? "Exporting..." : "Export OG image"}
      </button>
      {project?.pages?.length ? (
        <button type="button" className="secondary-action" disabled={isBusy} onClick={() => void runGuardedOperation("export", exportAllPages)}>
          <Download size={15} /> {busyAction === "export" ? "Exporting..." : "Export all pages"}
        </button>
      ) : null}
      <button type="button" className="secondary-action" disabled={isBusy} onClick={() => void runGuardedOperation("preview", createPublishPreview)}>
        <Send size={15} /> {busyAction === "preview" ? "Creating preview..." : "Create publish preview"}
      </button>
      <button
        type="button"
        className="secondary-action"
        disabled={isBusy || !hasExported || !hasPreviewRequest || hasConfirmedPublish}
        title={
          !hasExported
            ? "Export first"
            : !hasPreviewRequest
              ? "Create publish preview first"
              : hasConfirmedPublish
                ? "Publish already confirmed"
                : "Confirm publish handoff for the coding agent"
        }
        onClick={() => void runGuardedOperation("confirm", confirmPublishHandoff)}
      >
        <Send size={15} /> {busyAction === "confirm" ? "Confirming..." : "Confirm publish handoff"}
      </button>
      {hasConfirmedPublish ? <p className="quiet-copy">Waiting for agent to wire metadata.</p> : hasPreviewRequest ? <p className="quiet-copy">Preview ready. Confirm when the metadata handoff is approved.</p> : null}
      <button type="button" className="secondary-action" disabled={isBusy} onClick={() => void runGuardedOperation("handoff", askAgentToWire)}>
        <Send size={15} /> {busyAction === "handoff" ? "Saving handoff..." : "Ask agent to wire exports"}
      </button>
      <button
        type="button"
        className="secondary-action danger-action"
        disabled={isBusy || !session}
        title={session ? "Restart from question gate" : "Open through an agent session to restart generation"}
        onClick={() => setRestartConfirmOpen(true)}
      >
        <RotateCcw size={15} /> Restart OG generation
      </button>
      {restartConfirmOpen ? (
        <div className="modal-scrim" role="presentation">
          <section className="restart-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="restart-confirm-title">
            <h3 id="restart-confirm-title">Restart from question gate</h3>
            <p>
              GraphForge will archive the current generated document and hand the session back to the agent. The agent must ask fresh
              setup questions before creating a new OG document.
            </p>
            <div className="dialog-actions">
              <button type="button" className="secondary-action" disabled={isBusy} onClick={() => setRestartConfirmOpen(false)}>
                Keep current design
              </button>
              <button
                type="button"
                className="primary-action danger-action"
                disabled={isBusy}
                onClick={() => void runGuardedOperation("restart", restartOgGeneration)}
              >
                <RotateCcw size={15} /> {busyAction === "restart" ? "Requesting restart..." : "Restart OG generation"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

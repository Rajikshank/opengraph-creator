import { useEffect, useState } from "react";
import { Download, RotateCcw, Send } from "lucide-react";
import type { ExportFormat, OpenGraphCreatorSession } from "@opengraph-creator/core";
import {
  createAgentHandoffViaApi,
  createPublishRequestViaApi,
  exportProjectPagesViaApi,
  exportProjectViaApi,
  exportSourceViaApi,
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
  const setSession = useStudio((state) => state.setSession);
  const setLastExportSizeBytes = useStudio((state) => state.setLastExportSizeBytes);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(82);
  const [target, setTarget] = useState("public/og.png");
  const [pageImages, setPageImages] = useState<Array<{ page: string; imagePath: string }>>([]);
  const [hasExported, setHasExported] = useState(false);
  const [hasConfirmedPublish, setHasConfirmedPublish] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<"export" | "source-export" | "publish" | "restart" | null>(null);
  const isBusy = busyAction !== null;
  const publishUnavailableReason = getPublishUnavailableReason({
    busyAction,
    hasConfirmedPublish,
    hasExported
  });

  const runGuardedOperation = async (action: NonNullable<typeof busyAction>, operation: () => Promise<void>) => {
    if (busyAction) return;
    setBusyAction(action);
    try {
      await operation();
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    const existingExportState = getSessionExportState(session);
    if (!existingExportState.hasExported) return;
    setHasExported(true);
    setPageImages(existingExportState.pageImages);
    if (existingExportState.target) setTarget(existingExportState.target);
  }, [session]);

  const exportProject = async () => {
    if (!project) return;
    try {
      if (session) await saveSessionDocumentViaApi(fetch, { repo: session.repo, sessionId: session.id, project });
      await saveProjectViaApi(fetch, project);
      const result = await exportProjectViaApi(fetch, { projectId: project.projectId, format, target, quality, repo: session?.repo });
      const nextPageImages = project.pages?.length ? [{ page: project.targetPages[0] ?? "/", imagePath: result.target }] : [];
      if (session) {
        const updatedSession = await recordSessionExportViaApi(fetch, {
          repo: session.repo,
          sessionId: session.id,
          path: result.target,
          format,
          width: result.width ?? 1200,
          height: result.height ?? 630,
          fileSizeBytes: result.fileSizeBytes
        });
        setSession(updatedSession);
      }
      setLastExportSizeBytes(result.fileSizeBytes);
      setHasExported(true);
      setPageImages(nextPageImages);
      setHasConfirmedPublish(false);
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
      if (session) {
        for (const item of result.exports) {
          const updatedSession = await recordSessionExportViaApi(fetch, {
            repo: session.repo,
            sessionId: session.id,
            path: item.target,
            format,
            page: item.page,
            width: item.width ?? 1200,
            height: item.height ?? 630,
            fileSizeBytes: item.fileSizeBytes
          });
          setSession(updatedSession);
        }
      }
      setPageImages(mappings);
      setLastExportSizeBytes(result.exports.reduce((total, item) => total + (item.fileSizeBytes ?? 0), 0));
      setHasExported(true);
      setHasConfirmedPublish(false);
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

  const exportLayeredPsd = async () => {
    if (!project) return;
    try {
      if (session) await saveSessionDocumentViaApi(fetch, { repo: session.repo, sessionId: session.id, project });
      await saveProjectViaApi(fetch, project);
      const result = await exportSourceViaApi(fetch, {
        projectId: project.projectId,
        format: "psd",
        target: target.replace(/\.(png|webp|jpe?g|svg)$/i, ".psd"),
        repo: session?.repo
      });
      notifyStudioSuccess(`Exported layered PSD: ${result.target}`, `${result.layerCount} visual layer${result.layerCount === 1 ? "" : "s"}`);
    } catch (error) {
      notifyStudioError(
        normalizeStudioError(error, {
          kind: "export",
          title: "PSD export failed",
          recovery: "Your editable .ogdoc remains safe. Retry after saving the document or choose a writable PSD path."
        })
      );
    }
  };

  const publishWithAgent = async () => {
    if (!hasExported) {
      notifyStudioError(
        normalizeStudioError("Export the OG image before confirming publish", {
          kind: "publish",
          title: "Export required",
          recovery: "Export the optimized OG image first, then hand it to the coding agent for publish."
        })
      );
      return;
    }
    try {
      if (session) {
        await createPublishRequestViaApi(fetch, {
          repo: session.repo,
          sessionId: session.id,
          imagePath: pageImages[0]?.imagePath ?? target,
          pageImages: pageImages.length ? pageImages : undefined,
          framework: "unknown",
          confirmed: true
        });
        setHasConfirmedPublish(true);
        notifyStudioSuccess("Publish handoff sent to agent");
        return;
      }
      if (!project) {
        notifyStudioError(
          normalizeStudioError("No editable document is open", {
            kind: "agent-handoff",
            title: "No document available",
            recovery: "Open or import an editable .ogdoc before creating a publish handoff."
          })
        );
        return;
      }
      const result = await createAgentHandoffViaApi(fetch, {
        project,
        prompt: pageImages.length
          ? `Wire the confirmed page-specific OG exports into the app metadata after detecting the framework and previewing metadata. Page mappings: ${pageImages.map((item) => `${item.page} -> ${item.imagePath}`).join(", ")}.`
          : `Wire the confirmed OG export into the app metadata after detecting the framework and previewing metadata. Use ${target} as the selected raster OG image.`,
        target,
        format: format === "jpg" ? "jpeg" : format
      });
      setHasConfirmedPublish(true);
      notifyStudioSuccess(`Agent publish handoff saved: ${result.path}`);
    } catch (error) {
      notifyStudioError(
        normalizeStudioError(error, {
          kind: "agent-handoff",
          title: "Publish handoff failed",
          recovery: "Your export and editable document are still safe. Retry after saving or reopening the session."
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
      <p className="export-readiness-note">Framework detection is handled by the coding agent during publish.</p>
      <StudioSlider label="Quality" min={40} max={100} value={quality} unit="%" onValueChange={setQuality} />
      <button type="button" className="primary-action" disabled={isBusy} onClick={() => void runGuardedOperation("export", exportProject)}>
        <Download size={15} /> {busyAction === "export" ? "Exporting..." : "Export images"}
      </button>
      {project?.pages?.length ? (
        <button type="button" className="secondary-action" disabled={isBusy} onClick={() => void runGuardedOperation("export", exportAllPages)}>
          <Download size={15} /> {busyAction === "export" ? "Exporting..." : "Export all pages"}
        </button>
      ) : null}
      <button type="button" className="secondary-action" disabled={isBusy} onClick={() => void runGuardedOperation("source-export", exportLayeredPsd)}>
        <Download size={15} /> {busyAction === "source-export" ? "Exporting PSD..." : "Export layered PSD"}
      </button>
      <button
        type="button"
        className="secondary-action"
        disabled={Boolean(publishUnavailableReason)}
        title={publishUnavailableReason ?? "Send confirmed export handoff to the coding agent"}
        onClick={() => void runGuardedOperation("publish", publishWithAgent)}
      >
        <Send size={15} /> {busyAction === "publish" ? "Publishing..." : "Publish with agent"}
      </button>
      <p className="quiet-copy">
        {hasConfirmedPublish
          ? "Waiting for the agent to preview and wire metadata."
          : !hasExported
            ? "Agent handoff needs an export first."
            : session
              ? "Exported, ready for agent handoff."
              : "No agent session is connected; Studio will save a recovery handoff file."}
      </p>
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
              OpenGraph Creator will archive the current generated document and hand the session back to the agent. The agent must ask fresh
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

function getPublishUnavailableReason(input: {
  busyAction: "export" | "source-export" | "publish" | "restart" | null;
  hasConfirmedPublish: boolean;
  hasExported: boolean;
}): string | undefined {
  if (input.busyAction) return "Another export action is running";
  if (!input.hasExported) return "Export first";
  if (input.hasConfirmedPublish) return "Publish handoff already sent";
  return undefined;
}

function getSessionExportState(session: OpenGraphCreatorSession | null): {
  hasExported: boolean;
  target?: string;
  pageImages: Array<{ page: string; imagePath: string }>;
} {
  const sessionExports = session?.exports ?? [];
  if (!sessionExports.length) return { hasExported: false, pageImages: [] };
  const latest = sessionExports.at(-1);
  const latestByPage = new Map<string, string>();
  sessionExports.forEach((item) => {
    if (item.page) latestByPage.set(item.page, item.path);
  });
  return {
    hasExported: true,
    target: latest?.path,
    pageImages: Array.from(latestByPage, ([page, imagePath]) => ({ page, imagePath }))
  };
}

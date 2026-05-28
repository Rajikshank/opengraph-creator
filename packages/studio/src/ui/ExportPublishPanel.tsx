import { useState } from "react";
import { Download, Send } from "lucide-react";
import { toast } from "sonner";
import type { ExportFormat, Framework } from "@graphforge/core";
import {
  createAgentHandoffViaApi,
  createPublishRequestViaApi,
  createSessionAgentRequestViaApi,
  exportProjectViaApi,
  recordSessionExportViaApi,
  saveProjectViaApi,
  saveSessionDocumentViaApi
} from "../api";
import { StudioSelect } from "../design-system/StudioSelect";
import { StudioSlider } from "../design-system/StudioSlider";
import { useStudio } from "./studio-store";

export function ExportPublishPanel() {
  const project = useStudio((state) => state.project);
  const session = useStudio((state) => state.session);
  const setLastExportSizeBytes = useStudio((state) => state.setLastExportSizeBytes);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [framework, setFramework] = useState<Framework>("unknown");
  const [quality, setQuality] = useState(82);
  const [target, setTarget] = useState("public/og.png");
  const [hasExported, setHasExported] = useState(false);
  const [hasPreviewRequest, setHasPreviewRequest] = useState(false);
  const [hasConfirmedPublish, setHasConfirmedPublish] = useState(false);

  const exportProject = async () => {
    if (!project) return;
    try {
      if (session) await saveSessionDocumentViaApi(fetch, { repo: session.repo, sessionId: session.id, project });
      await saveProjectViaApi(fetch, project);
      const result = await exportProjectViaApi(fetch, { projectId: project.projectId, format, target, quality, repo: session?.repo });
      setLastExportSizeBytes(result.fileSizeBytes);
      setHasExported(true);
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
      toast.success(`Exported ${result.target}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  const createPublishPreview = async () => {
    if (!session) {
      toast.error("Open an agent session before creating a publish request");
      return;
    }
    try {
      await createPublishRequestViaApi(fetch, { repo: session.repo, sessionId: session.id, imagePath: target, framework, confirmed: false });
      setHasPreviewRequest(true);
      setHasConfirmedPublish(false);
      toast.success("Publish preview request created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish request failed");
    }
  };

  const confirmPublishHandoff = async () => {
    if (!session) {
      toast.error("Open an agent session before confirming publish");
      return;
    }
    if (!hasExported) {
      toast.error("Export the OG image before confirming publish");
      return;
    }
    if (!hasPreviewRequest) {
      toast.error("Create a publish preview before confirming handoff");
      return;
    }
    try {
      await createPublishRequestViaApi(fetch, { repo: session.repo, sessionId: session.id, imagePath: target, framework, confirmed: true });
      setHasPreviewRequest(true);
      setHasConfirmedPublish(true);
      toast.success("Publish confirmed for agent handoff");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish confirmation failed");
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
          prompt: `Wire the confirmed OG export into the app metadata. Use ${target} as the selected raster OG image after previewing metadata.`,
          documentPath: session.activeDocumentPath,
          expectedOutput: session.activeDocumentPath
        });
        toast.success(`Agent request saved: ${request.path}`);
        return;
      }
      const result = await createAgentHandoffViaApi(fetch, {
        project,
        prompt: `Ask agent to wire exports. Use ${target} as the selected raster OG image after previewing metadata.`,
        target,
        format: format === "jpg" ? "jpeg" : format
      });
      toast.success(`Ask agent to wire exports: ${result.path}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Agent wiring handoff failed");
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
      <button type="button" className="primary-action" onClick={exportProject}>
        <Download size={15} /> Export OG image
      </button>
      <button type="button" className="secondary-action" onClick={createPublishPreview}>
        <Send size={15} /> Create publish preview
      </button>
      <button
        type="button"
        className="secondary-action"
        disabled={!hasExported || !hasPreviewRequest || hasConfirmedPublish}
        title={
          !hasExported
            ? "Export first"
            : !hasPreviewRequest
              ? "Create publish preview first"
              : hasConfirmedPublish
                ? "Publish already confirmed"
                : "Confirm publish handoff for the coding agent"
        }
        onClick={confirmPublishHandoff}
      >
        <Send size={15} /> Confirm publish handoff
      </button>
      {hasConfirmedPublish ? <p className="quiet-copy">Waiting for agent to wire metadata.</p> : hasPreviewRequest ? <p className="quiet-copy">Preview ready. Confirm when the metadata handoff is approved.</p> : null}
      <button type="button" className="secondary-action" onClick={askAgentToWire}>
        <Send size={15} /> Ask agent to wire exports
      </button>
    </section>
  );
}

import { useState, type ChangeEvent } from "react";
import { FileCode2, PanelLeftClose, Send, Upload } from "lucide-react";
import { unpackStudioDocument, type OpenGraphCreatorSourceArtifact, type SourceArtifactKind } from "@opengraph-creator/core";
import { createSessionAgentRequestViaApi, importSourceViaApi, saveSessionDocumentViaApi, uploadSessionAssetViaApi } from "../api";
import { StudioSelect } from "../design-system/StudioSelect";
import { StudioScrollArea } from "../design-system/StudioScrollArea";
import { normalizeStudioError } from "../lib/studio-errors";
import { notifyStudioError, notifyStudioSuccess, notifyStudioWarning } from "../lib/studio-toast";
import { ConnectAgentPanel } from "./ConnectAgentPanel";
import { PageVariantNavigator } from "./PageVariantNavigator";
import { createManualProject, createProjectWithImportedAsset, useStudio } from "./studio-store";

export function SourceRail({ onClose }: { onClose?: () => void }) {
  const project = useStudio((state) => state.project);
  const session = useStudio((state) => state.session);
  const replaceProject = useStudio((state) => state.replaceProject);
  const attachSourceArtifact = useStudio((state) => state.attachSourceArtifact);
  const selectPageVariant = useStudio((state) => state.selectPageVariant);
  const [source, setSource] = useState(".opengraph-creator/sessions/<id>/document.ogdoc");
  const [kind, setKind] = useState<SourceArtifactKind>("svg");
  const [prompt, setPrompt] = useState("Revise the current OG document. Keep text and layout objects editable; use generated images, SVG, or HTML only as document asset layers.");

  const attachArtifact = (artifact: OpenGraphCreatorSourceArtifact) => {
    if (artifact.inline && (artifact.kind === "svg" || artifact.kind === "image")) {
      replaceProject(createManualProject(artifact.path ?? "Imported OG Source", artifact));
      return;
    }
    if (project) {
      attachSourceArtifact(artifact);
      return;
    }
    replaceProject(createManualProject(artifact.path ?? "Imported OG Source", artifact));
  };

  const importGeneratedAsset = async () => {
    try {
      const imported = await importSourceViaApi(fetch, {
        source,
        kind,
        name: project?.name ?? "Imported OG Source",
        origin: "codex"
      });
      replaceProject(imported);
      notifyStudioSuccess(`Imported ${kind} source`);
    } catch {
      attachArtifact({ kind, origin: "manual", path: source, createdAt: new Date().toISOString() });
      notifyStudioWarning("Attached source locally", "The local import API was unavailable, so Studio kept the source as a recoverable artifact.");
    }
  };

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      void handleLoadedFile(file, reader.result);
    });
    if (file.name.endsWith(".ogdoc")) reader.readAsArrayBuffer(file);
    else if (file.name.endsWith(".json")) reader.readAsText(file);
    else reader.readAsDataURL(file);
  };

  const handleLoadedFile = async (file: File, result: string | ArrayBuffer | null) => {
      if (file.name.endsWith(".ogdoc") && result instanceof ArrayBuffer) {
        try {
          const document = await unpackStudioDocument(new Uint8Array(result));
          replaceProject(document.project);
          notifyStudioSuccess("Opened .ogdoc document");
          return;
        } catch (error) {
          notifyStudioError(
            normalizeStudioError(error, {
              kind: "validation",
              title: "Studio document could not be opened",
              recovery: "Choose a valid .ogdoc package or ask the agent to regenerate the session document."
            })
          );
          return;
        }
      }
      const loaded = String(result ?? "");
      const fileKind: SourceArtifactKind = file.name.endsWith(".json")
        ? "project-json"
        : file.type.includes("svg")
          ? "svg"
          : file.type.includes("html")
            ? "html"
            : "image";
      if (fileKind === "project-json") {
        try {
          replaceProject(JSON.parse(loaded));
          notifyStudioSuccess("Opened editable project JSON");
          return;
        } catch {
          notifyStudioError(
            normalizeStudioError("Project JSON could not be parsed", {
              kind: "validation",
              title: "Project JSON could not be parsed",
              recovery: "Import a valid .ogdoc package when possible. JSON is a fallback format only."
            })
          );
        }
      }
      let artifactPath = file.name;
      let inline: string | undefined = loaded;
      if (session && (fileKind === "svg" || fileKind === "image")) {
        try {
          const uploaded = await uploadSessionAssetViaApi(fetch, {
            repo: session.repo,
            sessionId: session.id,
            fileName: file.name,
            dataUrl: loaded
          });
          artifactPath = uploaded.assetPath;
          inline = undefined;
        } catch {
          notifyStudioWarning("Using inline asset", "The asset upload failed, so Studio kept the image inline for recovery.");
        }
      }
      const artifact = {
        kind: fileKind,
        origin: "manual" as const,
        inline,
        path: artifactPath,
        createdAt: new Date().toISOString()
      };
      if (project) {
        replaceProject(createProjectWithImportedAsset(project, artifact));
        notifyStudioSuccess(`Imported ${file.name}`);
        return;
      }
      attachArtifact({
        ...artifact,
        inline: inline ?? loaded
      });
      notifyStudioSuccess(`Attached ${file.name}`);
  };

  const requestAgentRevision = async () => {
    if (!session || !project) {
      notifyStudioError(
        normalizeStudioError("Open through an agent session before requesting a revision", {
          kind: "agent-handoff",
          title: "No agent session connected",
          recovery: "Open Studio from Codex, Claude Code, or OpenCode before requesting an agent revision."
        })
      );
      return;
    }
    try {
      await saveSessionDocumentViaApi(fetch, { repo: session.repo, sessionId: session.id, project });
      const result = await createSessionAgentRequestViaApi(fetch, {
        repo: session.repo,
        sessionId: session.id,
        prompt,
        documentPath: session.activeDocumentPath,
        expectedOutput: session.activeDocumentPath
      });
      notifyStudioSuccess(`Agent revision requested: ${result.path}`);
    } catch (error) {
      notifyStudioError(
        normalizeStudioError(error, {
          kind: "agent-handoff",
          title: "Agent revision request failed",
          recovery: "The current .ogdoc remains editable. Save it and retry the revision request."
        })
      );
    }
  };

  return (
    <aside className="studio-panel source-rail">
      <StudioScrollArea className="source-rail-body">
        <section className="studio-section">
        <div className="source-rail-header">
          <h2 className="section-heading">
            <FileCode2 size={15} />
            <span>Source</span>
          </h2>
          <span className="source-status-pill">{project ? "Project linked" : "No project"}</span>
          {onClose ? (
            <button type="button" className="icon-action" title="Hide source rail" onClick={onClose}>
              <PanelLeftClose size={15} />
            </button>
          ) : null}
        </div>
        <div className="source-dropzone">
          <Upload size={18} />
          <strong>Import into document</strong>
          <span>.ogdoc assets, project JSON, SVG, HTML, or image</span>
          <input type="file" accept=".ogdoc,.json,.svg,.html,.htm,image/*" onChange={importFile} aria-label="Import into document" />
        </div>
        <label>
          Source path
          <input value={source} onChange={(event) => setSource(event.target.value)} />
        </label>
        <StudioSelect
          label="Source kind"
          value={kind}
          options={[
            { value: "project-json", label: "Project JSON" },
            { value: "svg", label: "SVG" },
            { value: "html", label: "HTML" },
            { value: "image", label: "Image" }
          ]}
          onValueChange={(value) => setKind(value as SourceArtifactKind)}
        />
        <button type="button" className="primary-action" onClick={importGeneratedAsset}>
          <Upload size={15} /> Import into document
        </button>
        {project?.pages?.length ? (
          <PageVariantNavigator
            project={project}
            onSelectPage={selectPageVariant}
          />
        ) : null}
        {session ? (
          <div className="agent-revision-card">
            <label>
              Agent revision
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </label>
            <button type="button" className="secondary-action" onClick={requestAgentRevision}>
              <Send size={15} /> Request agent revision
            </button>
          </div>
        ) : (
          <ConnectAgentPanel compact />
        )}
        </section>
      </StudioScrollArea>
    </aside>
  );
}

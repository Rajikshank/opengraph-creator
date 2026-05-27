import { useState, type ChangeEvent } from "react";
import { FileCode2, PanelLeftClose, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { unpackStudioDocument, type GraphForgeSourceArtifact, type SourceArtifactKind } from "@graphforge/core";
import { createSessionAgentRequestViaApi, importSourceViaApi, saveSessionDocumentViaApi, uploadSessionAssetViaApi } from "../api";
import { createManualProject, createProjectWithImportedAsset, useStudio } from "./studio-store";

export function SourceRail({ onClose }: { onClose?: () => void }) {
  const project = useStudio((state) => state.project);
  const session = useStudio((state) => state.session);
  const replaceProject = useStudio((state) => state.replaceProject);
  const attachSourceArtifact = useStudio((state) => state.attachSourceArtifact);
  const [source, setSource] = useState(".graphforge/sessions/<id>/document.ogdoc");
  const [kind, setKind] = useState<SourceArtifactKind>("svg");
  const [prompt, setPrompt] = useState("Revise the current OG document. Keep text and layout objects editable; use generated images only as asset layers unless pure-image mode was selected.");

  const attachArtifact = (artifact: GraphForgeSourceArtifact) => {
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
      toast.success(`Imported ${kind} source`);
    } catch (error) {
      attachArtifact({ kind, origin: "manual", path: source, createdAt: new Date().toISOString() });
      toast.warning(error instanceof Error ? `Attached locally: ${error.message}` : "Attached source locally");
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
          toast.success("Opened .ogdoc document");
          return;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Studio document could not be opened");
          return;
        }
      }
      const loaded = String(result ?? "");
      const fileKind: SourceArtifactKind = file.name.endsWith(".json")
        ? "graphforge-json"
        : file.type.includes("svg")
          ? "svg"
          : file.type.includes("html")
            ? "html"
            : "image";
      if (fileKind === "graphforge-json") {
        try {
          replaceProject(JSON.parse(loaded));
          toast.success("Opened editable project JSON");
          return;
        } catch {
          toast.error("Project JSON could not be parsed");
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
        } catch (error) {
          toast.warning(error instanceof Error ? `Using inline asset: ${error.message}` : "Using inline asset");
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
        toast.success(`Imported ${file.name}`);
        return;
      }
      attachArtifact({
        ...artifact,
        inline: inline ?? loaded
      });
      toast.success(`Attached ${file.name}`);
  };

  const requestAgentRevision = async () => {
    if (!session || !project) {
      toast.error("Open through an agent session before requesting a revision");
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
      toast.success(`Agent revision requested: ${result.path}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Agent revision request failed");
    }
  };

  return (
    <aside className="studio-panel studio-panel-scroll source-rail">
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
        <label>
          Source kind
          <select value={kind} onChange={(event) => setKind(event.target.value as SourceArtifactKind)}>
            <option value="graphforge-json">Project JSON</option>
            <option value="svg">SVG</option>
            <option value="html">HTML</option>
            <option value="image">Image</option>
          </select>
        </label>
        <button type="button" className="primary-action" onClick={importGeneratedAsset}>
          <Upload size={15} /> Import into document
        </button>
        {session ? (
          <>
            <label>
              Agent revision
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </label>
            <button type="button" className="secondary-action" onClick={requestAgentRevision}>
              <Send size={15} /> Request agent revision
            </button>
          </>
        ) : (
          <button type="button" className="secondary-action" disabled title="Open through an agent session to request revisions">
            <Send size={15} /> Agent revision unavailable
          </button>
        )}
      </section>
    </aside>
  );
}

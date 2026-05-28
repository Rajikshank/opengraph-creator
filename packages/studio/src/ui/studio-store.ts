import {
  createDefaultProject,
  updateActivePageLayers,
  type GraphForgeSession,
  type GraphForgeSourceArtifact,
  type LayerEffects,
  type OgLayer,
  type OgProject
} from "@graphforge/core";
import { create } from "zustand";
import {
  addLayer as addSessionLayer,
  alignLayers as alignSessionLayers,
  attachSourceArtifact as attachSessionSourceArtifact,
  type AddableLayerKind,
  type LayerAlignMode,
  type LayerDistributeMode,
  type LayerSnapTarget,
  createEditorSession,
  deleteLayer as deleteSessionLayer,
  distributeLayers as distributeSessionLayers,
  duplicateLayer as duplicateSessionLayer,
  moveLayerTo as moveSessionLayerTo,
  reorderLayers as reorderSessionLayers,
  resizeSelectedLayer,
  selectLayer,
  setImageCrop as setSessionImageCrop,
  setImageFocalPoint as setSessionImageFocalPoint,
  setImagePerspective as setSessionImagePerspective,
  setLayerEffects as setSessionLayerEffects,
  selectPageVariant as selectSessionPageVariant,
  snapLayer as snapSessionLayer,
  toggleLayerHidden as toggleSessionLayerHidden,
  toggleLayerLocked as toggleSessionLayerLocked,
  undo as undoSession,
  updateLayer as updateSessionLayer,
  redo as redoSession,
  type EditorSession
} from "../editor-model";
import type { ProjectSummary } from "../api";

interface StudioStore {
  project: OgProject | null;
  selectedLayerId: string;
  past: OgProject[];
  future: OgProject[];
  session: GraphForgeSession | null;
  projects: ProjectSummary[];
  sourceRailOpen: boolean;
  lastExportSizeBytes?: number;
  replaceProject: (project: OgProject | null) => void;
  setSession: (session: GraphForgeSession | null) => void;
  setProjects: (projects: ProjectSummary[]) => void;
  selectPageVariant: (pageIdOrRoute: string) => void;
  setSelectedLayerId: (id: string) => void;
  updateLayer: (id: string, patch: Partial<OgLayer>) => void;
  setLayerEffects: (id: string, patch: Partial<LayerEffects>) => void;
  alignLayers: (ids: string[], mode: LayerAlignMode) => void;
  distributeLayers: (ids: string[], mode: LayerDistributeMode) => void;
  snapLayer: (id: string, target: LayerSnapTarget) => void;
  setImageCrop: (id: string, crop: NonNullable<Extract<OgLayer, { kind: "image" | "logo" | "screenshot" }>["crop"]>) => void;
  setImageFocalPoint: (id: string, focalPoint: NonNullable<Extract<OgLayer, { kind: "image" | "logo" | "screenshot" }>["focalPoint"]>) => void;
  setImagePerspective: (id: string, perspective: NonNullable<Extract<OgLayer, { kind: "image" | "logo" | "screenshot" }>["perspective"]>) => void;
  attachSourceArtifact: (artifact: GraphForgeSourceArtifact) => void;
  moveLayerTo: (id: string, position: { x: number; y: number }) => void;
  resizeSelected: (size: { width: number; height: number }) => void;
  addLayer: (kind: AddableLayerKind) => void;
  duplicateLayer: (id: string) => void;
  deleteLayer: (id: string) => void;
  undo: () => void;
  redo: () => void;
  reorderLayers: (activeId: string, overId: string) => void;
  toggleLayerHidden: (id: string) => void;
  toggleLayerLocked: (id: string) => void;
  setSourceRailOpen: (open: boolean) => void;
  setLastExportSizeBytes: (size: number | undefined) => void;
}

const emptySession: EditorSession = {
  project: createDefaultProject({ name: "GraphForge internal empty state", strategy: "common" }),
  selectedLayerId: "",
  past: [],
  future: []
};

export const useStudio = create<StudioStore>((set) => ({
  ...emptySession,
  project: null,
  session: null,
  projects: [],
  sourceRailOpen: true,
  replaceProject: (project) =>
    set(() => {
      if (!project) return { project: null, selectedLayerId: "", past: [], future: [] };
      return createEditorSession(project);
    }),
  setSession: (session) => set({ session }),
  setProjects: (projects) => set({ projects }),
  selectPageVariant: (pageIdOrRoute) => set((state) => (state.project ? selectSessionPageVariant(state as EditorSession, pageIdOrRoute) : state)),
  setSelectedLayerId: (id) => set((state) => (state.project ? selectLayer(state as EditorSession, id) : state)),
  updateLayer: (id, patch) => set((state) => (state.project ? updateSessionLayer(state as EditorSession, id, patch) : state)),
  setLayerEffects: (id, patch) =>
    set((state) => (state.project ? setSessionLayerEffects(state as EditorSession, id, patch) : state)),
  alignLayers: (ids, mode) => set((state) => (state.project ? alignSessionLayers(state as EditorSession, ids, mode) : state)),
  distributeLayers: (ids, mode) =>
    set((state) => (state.project ? distributeSessionLayers(state as EditorSession, ids, mode) : state)),
  snapLayer: (id, target) => set((state) => (state.project ? snapSessionLayer(state as EditorSession, id, target) : state)),
  setImageCrop: (id, crop) => set((state) => (state.project ? setSessionImageCrop(state as EditorSession, id, crop) : state)),
  setImageFocalPoint: (id, focalPoint) =>
    set((state) => (state.project ? setSessionImageFocalPoint(state as EditorSession, id, focalPoint) : state)),
  setImagePerspective: (id, perspective) =>
    set((state) => (state.project ? setSessionImagePerspective(state as EditorSession, id, perspective) : state)),
  attachSourceArtifact: (artifact) =>
    set((state) => (state.project ? attachSessionSourceArtifact(state as EditorSession, artifact) : state)),
  moveLayerTo: (id, position) =>
    set((state) => (state.project ? moveSessionLayerTo(state as EditorSession, id, position) : state)),
  resizeSelected: (size) => set((state) => (state.project ? resizeSelectedLayer(state as EditorSession, size) : state)),
  addLayer: (kind) => set((state) => (state.project ? addSessionLayer(state as EditorSession, kind) : state)),
  duplicateLayer: (id) => set((state) => (state.project ? duplicateSessionLayer(state as EditorSession, id) : state)),
  deleteLayer: (id) => set((state) => (state.project ? deleteSessionLayer(state as EditorSession, id) : state)),
  undo: () => set((state) => (state.project ? undoSession(state as EditorSession) : state)),
  redo: () => set((state) => (state.project ? redoSession(state as EditorSession) : state)),
  reorderLayers: (activeId, overId) =>
    set((state) => (state.project ? reorderSessionLayers(state as EditorSession, activeId, overId) : state)),
  toggleLayerHidden: (id) =>
    set((state) => (state.project ? toggleSessionLayerHidden(state as EditorSession, id) : state)),
  toggleLayerLocked: (id) =>
    set((state) => (state.project ? toggleSessionLayerLocked(state as EditorSession, id) : state)),
  setSourceRailOpen: (open) => set({ sourceRailOpen: open }),
  setLastExportSizeBytes: (lastExportSizeBytes) => set({ lastExportSizeBytes })
}));

export function createManualProject(name: string, artifact?: GraphForgeSourceArtifact): OgProject {
  if (artifact && (artifact.inline || artifact.path?.startsWith("assets/")) && (artifact.kind === "svg" || artifact.kind === "image")) {
    const createdAt = artifact.createdAt ?? new Date().toISOString();
    const project = createDefaultProject({
      name,
      strategy: "common",
      generationMode: artifact.kind === "image" ? "pure-image" : "template",
      title: name,
      subtitle: "Imported source ready for Studio finalizing.",
      sourceArtifacts: [artifact]
    });

    return {
      ...project,
      canvas: { ...project.canvas, background: "#111315" },
      layers: [
        {
          id: "background",
          kind: "background",
          name: "Background",
          x: 0,
          y: 0,
          width: 1200,
          height: 630,
          rotation: 0,
          opacity: 1,
          locked: true,
          hidden: false,
          fill: "#111315",
          radius: 0,
          effects: { shadow: false, glow: false, blur: 0 }
        },
        {
          id: `manual-${artifact.kind}-source`,
          kind: "image",
          name: artifact.kind === "svg" ? "Imported SVG Source" : "Imported Image Source",
          x: 0,
          y: 0,
          width: 1200,
          height: 630,
          rotation: 0,
          opacity: 1,
          locked: false,
          hidden: false,
          src: artifact.inline ?? artifact.path ?? "graphforge://image-placeholder",
          assetPath: artifact.path?.startsWith("assets/") ? artifact.path : undefined,
          fit: "contain",
          borderRadius: 0,
          effects: { shadow: false, glow: false, blur: 0 }
        }
      ],
      updatedAt: createdAt
    };
  }

  return createDefaultProject({
    name,
    strategy: "common",
    title: name,
    subtitle: "Imported source ready for Studio finalizing.",
    sourceArtifacts: artifact ? [artifact] : []
  });
}

export function createProjectWithImportedAsset(project: OgProject, artifact: GraphForgeSourceArtifact): OgProject {
  if (!(artifact.kind === "svg" || artifact.kind === "image")) {
    return {
      ...project,
      sourceArtifacts: [...project.sourceArtifacts, artifact],
      updatedAt: new Date().toISOString()
    };
  }

  const now = new Date().toISOString();
  const layer: OgLayer = {
    id: `imported-${Date.now().toString(36)}`,
    kind: "image",
    name: artifact.kind === "svg" ? "Imported SVG Asset" : "Imported Image Asset",
    x: project.canvas.safeInset,
    y: project.canvas.safeInset,
    width: 360,
    height: 220,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    src: artifact.inline ?? artifact.path ?? "graphforge://image-placeholder",
    assetPath: artifact.path?.startsWith("assets/") ? artifact.path : undefined,
    fit: "contain",
    borderRadius: 8,
    effects: { shadow: true, glow: false, blur: 0 }
  };

  return {
    ...updateActivePageLayers(project, [...project.layers, layer]),
    sourceArtifacts: [...project.sourceArtifacts, artifact],
    updatedAt: now
  };
}

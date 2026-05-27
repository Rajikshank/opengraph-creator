import type {
  GenerationMode,
  GenerationStrategy,
  GraphForgeSourceArtifact,
  ImageLayer,
  LayerEffects,
  OgLayer,
  OgProject
} from "@graphforge/core";

export type AddableLayerKind = "text" | "image" | "shape" | "rectangle" | "rounded-rectangle" | "ellipse" | "line" | "frame";
export type LayerAlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type LayerDistributeMode = "horizontal" | "vertical";
export type LayerSnapTarget = "safe-zone" | "canvas-center" | "canvas-top-left" | "canvas-bottom-right";

export interface EditorSession {
  project: OgProject;
  selectedLayerId: string;
  past: OgProject[];
  future: OgProject[];
}

export function createEditorSession(project: OgProject): EditorSession {
  return {
    project,
    selectedLayerId: project.layers[0]?.id ?? "",
    past: [],
    future: []
  };
}

export function selectLayer(session: EditorSession, layerId: string): EditorSession {
  return {
    ...session,
    selectedLayerId: session.project.layers.some((layer) => layer.id === layerId)
      ? layerId
      : session.selectedLayerId
  };
}

export function updateSelectedLayer(session: EditorSession, patch: Partial<OgLayer>): EditorSession {
  return updateLayer(session, session.selectedLayerId, patch);
}

export function attachSourceArtifact(session: EditorSession, artifact: GraphForgeSourceArtifact): EditorSession {
  return pushHistory(session, {
    ...session.project,
    sourceArtifacts: [...(session.project.sourceArtifacts ?? []), artifact],
    updatedAt: new Date().toISOString()
  });
}

export function setLayerEffects(session: EditorSession, layerId: string, effectsPatch: Partial<LayerEffects>): EditorSession {
  const layer = session.project.layers.find((item) => item.id === layerId);
  if (!layer || !("effects" in layer)) return session;
  return updateLayer(session, layerId, {
    effects: {
      ...layer.effects,
      ...effectsPatch
    }
  } as Partial<OgLayer>);
}

export function alignLayers(session: EditorSession, layerIds: string[], mode: LayerAlignMode): EditorSession {
  const editableLayers = getEditableLayers(session, layerIds);
  if (editableLayers.length < 2) return session;

  const bounds = getLayerBounds(editableLayers);
  const layers = session.project.layers.map((layer) => {
    if (!editableLayers.some((item) => item.id === layer.id)) return layer;
    const patch =
      mode === "left"
        ? { x: bounds.left }
        : mode === "center"
          ? { x: bounds.left + (bounds.width - layer.width) / 2 }
          : mode === "right"
            ? { x: bounds.right - layer.width }
            : mode === "top"
              ? { y: bounds.top }
              : mode === "middle"
                ? { y: bounds.top + (bounds.height - layer.height) / 2 }
                : { y: bounds.bottom - layer.height };

    return clampLayerPosition(session.project, { ...layer, ...roundPosition(patch) } as OgLayer);
  });

  return pushHistory(session, { ...session.project, layers, updatedAt: new Date().toISOString() });
}

export function distributeLayers(session: EditorSession, layerIds: string[], mode: LayerDistributeMode): EditorSession {
  const editableLayers = getEditableLayers(session, layerIds);
  if (editableLayers.length < 3) return session;

  const sorted = [...editableLayers].sort((a, b) => (mode === "horizontal" ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return session;

  const start = mode === "horizontal" ? first.x : first.y;
  const end = mode === "horizontal" ? last.x : last.y;
  const step = (end - start) / (sorted.length - 1);
  const positions = new Map(sorted.map((layer, index) => [layer.id, Math.round(start + step * index)]));

  const layers = session.project.layers.map((layer) => {
    const position = positions.get(layer.id);
    if (position === undefined) return layer;
    return clampLayerPosition(
      session.project,
      mode === "horizontal" ? ({ ...layer, x: position } as OgLayer) : ({ ...layer, y: position } as OgLayer)
    );
  });

  return pushHistory(session, { ...session.project, layers, updatedAt: new Date().toISOString() });
}

export function snapLayer(session: EditorSession, layerId: string, target: LayerSnapTarget): EditorSession {
  const layer = session.project.layers.find((item) => item.id === layerId);
  if (!layer || layer.locked) return session;

  const canvas = session.project.canvas;
  const position =
    target === "safe-zone"
      ? { x: canvas.safeInset, y: canvas.safeInset }
      : target === "canvas-center"
        ? { x: (canvas.width - layer.width) / 2, y: (canvas.height - layer.height) / 2 }
        : target === "canvas-bottom-right"
          ? { x: canvas.width - layer.width, y: canvas.height - layer.height }
          : { x: 0, y: 0 };

  return updateLayer(session, layerId, roundPosition(position));
}

export function setImageCrop(session: EditorSession, layerId: string, crop: ImageLayer["crop"]): EditorSession {
  const layer = session.project.layers.find((item) => item.id === layerId);
  if (!isImageLayer(layer) || !crop) return session;
  const width = clamp(Number.isFinite(crop.width) ? crop.width : 1, 0.01, 1);
  const height = clamp(Number.isFinite(crop.height) ? crop.height : 1, 0.01, 1);
  return updateLayer(session, layerId, {
    crop: {
      x: clamp(Number.isFinite(crop.x) ? crop.x : 0, 0, 1 - width),
      y: clamp(Number.isFinite(crop.y) ? crop.y : 0, 0, 1 - height),
      width,
      height
    }
  } as Partial<OgLayer>);
}

export function setImageFocalPoint(session: EditorSession, layerId: string, focalPoint: ImageLayer["focalPoint"]): EditorSession {
  const layer = session.project.layers.find((item) => item.id === layerId);
  if (!isImageLayer(layer) || !focalPoint) return session;
  return updateLayer(session, layerId, {
    focalPoint: {
      x: clamp01(focalPoint.x),
      y: clamp01(focalPoint.y)
    }
  } as Partial<OgLayer>);
}

export function setImagePerspective(session: EditorSession, layerId: string, perspective: ImageLayer["perspective"]): EditorSession {
  const layer = session.project.layers.find((item) => item.id === layerId);
  if (!isImageLayer(layer) || !perspective || perspective.length !== 4) return session;
  return updateLayer(session, layerId, {
    perspective: perspective.map((point) => ({
      x: clamp01(point.x),
      y: clamp01(point.y)
    }))
  } as Partial<OgLayer>);
}

export function updateProjectSettings(
  session: EditorSession,
  patch: Partial<{ strategy: GenerationStrategy; generationMode: GenerationMode; targetPages: string[] }>
): EditorSession {
  const strategy = patch.strategy ?? session.project.strategy;
  const nextProject = {
    ...session.project,
    ...patch,
    strategy,
    generationMode: patch.generationMode ?? session.project.generationMode ?? "template",
    targetPages: patch.targetPages ? normalizeTargetPages(patch.targetPages) : session.project.targetPages,
    layers: session.project.layers.map((layer) =>
      layer.id === "badge" && (layer.kind === "badge" || layer.kind === "text")
        ? { ...layer, text: strategy === "pages" ? "Page-specific OG" : "Open Graph Preview" }
        : layer
    ),
    updatedAt: new Date().toISOString()
  } as OgProject;
  return pushHistory(session, nextProject);
}

function normalizeTargetPages(pages: string[]): string[] {
  const seen = new Set<string>();
  const normalized = pages
    .map((page) => page.trim())
    .filter(Boolean)
    .map((page) => (page.startsWith("/") ? page : `/${page}`))
    .map((page) => page.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/")
    .filter((page) => {
      if (seen.has(page)) return false;
      seen.add(page);
      return true;
    });

  return normalized.length ? normalized : ["/"];
}

export function updateLayer(session: EditorSession, layerId: string, patch: Partial<OgLayer>): EditorSession {
  const nextProject = {
    ...session.project,
    layers: session.project.layers.map((layer) => (layer.id === layerId ? ({ ...layer, ...patch } as OgLayer) : layer)),
    updatedAt: new Date().toISOString()
  };
  return pushHistory(session, nextProject);
}

export function nudgeSelectedLayer(session: EditorSession, delta: { dx: number; dy: number }): EditorSession {
  const layer = getSelectedLayer(session);
  if (!layer) return session;
  return updateSelectedLayer(session, {
    x: Math.round(layer.x + delta.dx),
    y: Math.round(layer.y + delta.dy)
  });
}

export function resizeSelectedLayer(
  session: EditorSession,
  size: { width: number; height: number }
): EditorSession {
  return updateSelectedLayer(session, {
    width: Math.max(1, Math.round(size.width)),
    height: Math.max(1, Math.round(size.height))
  });
}

export function moveLayerTo(session: EditorSession, layerId: string, position: { x: number; y: number }): EditorSession {
  const layer = session.project.layers.find((item) => item.id === layerId);
  if (!layer || layer.locked) return session;
  return updateLayer(session, layerId, {
    x: clamp(Math.round(position.x), 0, session.project.canvas.width - layer.width),
    y: clamp(Math.round(position.y), 0, session.project.canvas.height - layer.height)
  });
}

export function addLayer(session: EditorSession, kind: AddableLayerKind): EditorSession {
  const layer = createLayer(session.project, kind);
  return pushHistory(
    session,
    {
      ...session.project,
      layers: [...session.project.layers, layer],
      updatedAt: new Date().toISOString()
    },
    layer.id
  );
}

export function duplicateLayer(session: EditorSession, layerId: string): EditorSession {
  const index = session.project.layers.findIndex((layer) => layer.id === layerId);
  const layer = session.project.layers[index];
  if (!layer) return session;

  const copy = cloneLayer(layer);
  const nextLayer: OgLayer = {
    ...copy,
    id: nextCopyId(session.project.layers, layer.id),
    name: `${layer.name} copy`,
    x: clamp(layer.x + 24, 0, session.project.canvas.width - layer.width),
    y: clamp(layer.y + 24, 0, session.project.canvas.height - layer.height),
    locked: false,
    hidden: false
  } as OgLayer;
  const layers = [...session.project.layers];
  layers.splice(index + 1, 0, nextLayer);

  return pushHistory(
    session,
    {
      ...session.project,
      layers,
      updatedAt: new Date().toISOString()
    },
    nextLayer.id
  );
}

export function deleteLayer(session: EditorSession, layerId: string): EditorSession {
  const index = session.project.layers.findIndex((layer) => layer.id === layerId);
  const layer = session.project.layers[index];
  if (!layer || layer.locked || session.project.layers.length <= 1) return session;

  const layers = session.project.layers.filter((item) => item.id !== layerId);
  const selectedLayerId =
    session.selectedLayerId === layerId
      ? layers[Math.max(0, index - 1)]?.id ?? layers[0]?.id ?? ""
      : session.selectedLayerId;

  return pushHistory(
    session,
    {
      ...session.project,
      layers,
      updatedAt: new Date().toISOString()
    },
    selectedLayerId
  );
}

export function toggleLayerHidden(session: EditorSession, layerId: string): EditorSession {
  const layer = session.project.layers.find((item) => item.id === layerId);
  if (!layer) return session;
  return updateLayer(session, layerId, { hidden: !layer.hidden });
}

export function toggleLayerLocked(session: EditorSession, layerId: string): EditorSession {
  const layer = session.project.layers.find((item) => item.id === layerId);
  if (!layer) return session;
  return updateLayer(session, layerId, { locked: !layer.locked });
}

export function reorderLayers(session: EditorSession, activeId: string, overId: string): EditorSession {
  const oldIndex = session.project.layers.findIndex((layer) => layer.id === activeId);
  const newIndex = session.project.layers.findIndex((layer) => layer.id === overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return session;
  const layers = [...session.project.layers];
  const [active] = layers.splice(oldIndex, 1);
  layers.splice(newIndex, 0, active);
  return pushHistory(session, { ...session.project, layers, updatedAt: new Date().toISOString() });
}

export function undo(session: EditorSession): EditorSession {
  const previous = session.past.at(-1);
  if (!previous) return session;
  return {
    project: previous,
    selectedLayerId: previous.layers.find((layer) => layer.id === session.selectedLayerId)?.id ?? previous.layers[0]?.id ?? "",
    past: session.past.slice(0, -1),
    future: [session.project, ...session.future]
  };
}

export function redo(session: EditorSession): EditorSession {
  const next = session.future[0];
  if (!next) return session;
  return {
    project: next,
    selectedLayerId: next.layers.find((layer) => layer.id === session.selectedLayerId)?.id ?? next.layers[0]?.id ?? "",
    past: [...session.past, session.project],
    future: session.future.slice(1)
  };
}

function pushHistory(session: EditorSession, project: OgProject, selectedLayerId = session.selectedLayerId): EditorSession {
  return {
    ...session,
    project,
    selectedLayerId,
    past: [...session.past, session.project],
    future: []
  };
}

function getSelectedLayer(session: EditorSession): OgLayer | undefined {
  return session.project.layers.find((layer) => layer.id === session.selectedLayerId);
}

function getEditableLayers(session: EditorSession, layerIds: string[]): OgLayer[] {
  const ids = new Set(layerIds);
  return session.project.layers.filter((layer) => ids.has(layer.id) && !layer.locked);
}

function getLayerBounds(layers: OgLayer[]): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
  const left = Math.min(...layers.map((layer) => layer.x));
  const top = Math.min(...layers.map((layer) => layer.y));
  const right = Math.max(...layers.map((layer) => layer.x + layer.width));
  const bottom = Math.max(...layers.map((layer) => layer.y + layer.height));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function clampLayerPosition(project: OgProject, layer: OgLayer): OgLayer {
  return {
    ...layer,
    x: clamp(Math.round(layer.x), 0, project.canvas.width - layer.width),
    y: clamp(Math.round(layer.y), 0, project.canvas.height - layer.height)
  } as OgLayer;
}

function roundPosition(position: Partial<Pick<OgLayer, "x" | "y">>): Partial<Pick<OgLayer, "x" | "y">> {
  return {
    ...(position.x === undefined ? {} : { x: Math.round(position.x) }),
    ...(position.y === undefined ? {} : { y: Math.round(position.y) })
  };
}

function isImageLayer(layer: OgLayer | undefined): layer is ImageLayer {
  return layer?.kind === "image" || layer?.kind === "logo" || layer?.kind === "screenshot";
}

function cloneLayer(layer: OgLayer): OgLayer {
  return JSON.parse(JSON.stringify(layer)) as OgLayer;
}

function createLayer(project: OgProject, kind: AddableLayerKind): OgLayer {
  const inset = project.canvas.safeInset;
  const base = {
    id: nextLayerId(project.layers, `${kind}-layer`),
    x: inset + 56,
    y: inset + 56,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false
  };

  if (kind === "text") {
    return {
      ...base,
      kind: "text",
      name: "Text Layer",
      width: 520,
      height: 84,
      text: "New text",
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 46,
      fontWeight: 800,
      color: project.brand.text,
      align: "left",
      lineHeight: 1.08,
      effects: { shadow: false, glow: false, blur: 0 }
    };
  }

  if (kind === "image") {
    return {
      ...base,
      kind: "image",
      name: "Image Layer",
      width: 280,
      height: 180,
      src: "graphforge://image-placeholder",
      fit: "cover",
      borderRadius: 8,
      effects: { shadow: true, glow: false, blur: 0 }
    };
  }

  const shapeType =
    kind === "ellipse" || kind === "line" || kind === "frame" || kind === "rounded-rectangle" || kind === "rectangle"
      ? kind
      : "rectangle";
  return {
    ...base,
    kind: "shape",
    name:
      shapeType === "ellipse"
        ? "Circle Layer"
        : shapeType === "line"
          ? "Divider Layer"
          : shapeType === "frame"
            ? "Frame Layer"
            : shapeType === "rounded-rectangle"
              ? "Rounded Rectangle Layer"
              : "Rectangle Layer",
    width: shapeType === "line" ? 320 : shapeType === "ellipse" ? 180 : 260,
    height: shapeType === "line" ? 4 : shapeType === "ellipse" ? 180 : 160,
    shapeType,
    fill: shapeType === "line" ? project.brand.accent : "#f2eee4",
    radius: shapeType === "rounded-rectangle" || shapeType === "frame" ? 12 : 0,
    stroke: shapeType === "line" ? undefined : "#8f8a7d",
    strokeWidth: shapeType === "line" ? 0 : shapeType === "frame" ? 2 : 1,
    effects: { shadow: true, glow: false, blur: 0 }
  };
}

function nextCopyId(layers: OgLayer[], layerId: string): string {
  return nextLayerId(layers, `${layerId}-copy`);
}

function nextLayerId(layers: OgLayer[], baseId: string): string {
  const ids = new Set(layers.map((layer) => layer.id));
  let suffix = 1;
  let next = baseId;
  while (ids.has(next)) {
    suffix += 1;
    next = `${baseId}-${suffix}`;
  }
  return next;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clamp01(value: number): number {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

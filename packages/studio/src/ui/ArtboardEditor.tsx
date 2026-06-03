import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Konva from "konva";
import { Ellipse, Group, Image as KonvaImage, Layer as KonvaLayer, Line, Rect, Stage, Text as KonvaText, Transformer } from "react-konva";
import {
  getCanvasEffectCachePadding,
  getCanvasShadowVisual,
  getEffectNumberParam,
  getEffectStringParam,
  getNoiseDisplayOpacity,
  hasComposedLayerEffect,
  isDefaultPerspectiveQuad,
  isGlowEffectEnabled,
  normalizeLayerStyleEffects,
  normalizePerspectiveQuad,
  type ImageLayer,
  type LayerEffects,
  type LayerStyleEffect,
  type NoiseEffect,
  type OgLayer,
  type ShapeLayer,
  type TextLayer
} from "@opengraph-creator/core";
import { preloadFontFamily } from "../typography/fonts";
import { useStudio } from "./studio-store";

const canvasWidth = 1200;
const canvasHeight = 630;
const STUDIO_TRANSFORM_ACCENT = "#ecb052";
const STUDIO_TRANSFORM_HANDLE = "#171511";
const TEXT_WIDTH_FACTOR = 0.54;

interface ArtboardEditorProps {
  sourceRailOpen?: boolean;
  onOpenSourceRail?: () => void;
}

export function ArtboardEditor({ sourceRailOpen = true, onOpenSourceRail }: ArtboardEditorProps) {
  const project = useStudio((state) => state.project);
  const selectedLayerId = useStudio((state) => state.selectedLayerId);
  const setSelectedLayerId = useStudio((state) => state.setSelectedLayerId);
  const updateLayer = useStudio((state) => state.updateLayer);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 });
  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null);
  const [fontReadyVersion, setFontReadyVersion] = useState(0);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});

  const visibleLayers = useMemo(() => project?.layers.filter((layer) => !layer.hidden) ?? [], [project]);
  const visibleTextFontKey = useMemo(
    () =>
      visibleLayers
        .filter(isTextLayer)
        .map((layer) => `${layer.fontFamily}:${layer.fontWeight}:${layer.fontStyle ?? "normal"}`)
        .join("|"),
    [visibleLayers]
  );
  const fitScale = useMemo(() => {
    const viewportWidth = typeof window === "undefined" ? canvasWidth * 0.58 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? canvasHeight * 0.58 : window.innerHeight - 180;
    const availableWidth = Math.max(0, (workspaceSize.width || viewportWidth) - 56);
    const availableHeight = Math.max(0, (workspaceSize.height || viewportHeight) - 56);
    if (!availableWidth || !availableHeight) return Math.min(0.58, availableWidth / canvasWidth || 0.28);
    return Math.min(1, availableWidth / canvasWidth, availableHeight / canvasHeight);
  }, [workspaceSize]);
  const scale = Math.max(0.2, Math.min(1.4, fitScale * zoom));
  const stageWidth = Math.round(canvasWidth * scale);
  const stageHeight = Math.round(canvasHeight * scale);

  useEffect(() => {
    const node = workspaceRef.current;
    if (!node) return;
    const updateSize = () => setWorkspaceSize({ width: node.clientWidth, height: node.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const selectedNode = selectedLayerId ? nodeRefs.current[selectedLayerId] : undefined;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedLayerId, visibleLayers, fontReadyVersion]);

  useEffect(() => {
    let cancelled = false;
    const fonts = visibleLayers.filter(isTextLayer).map((layer) => layer.fontFamily);
    if (!fonts.length) return;
    void Promise.all(fonts.map((fontFamily) => preloadFontFamily(fontFamily))).finally(() => {
      if (!cancelled) setFontReadyVersion((version) => version + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [visibleLayers, visibleTextFontKey]);

  useEffect(() => {
    clearTextMeasureCache();
  }, [fontReadyVersion]);

  if (!project) return null;
  const editingTextLayer = editingTextLayerId
    ? visibleLayers.find((layer): layer is TextLayer => layer.id === editingTextLayerId && isTextLayer(layer))
    : undefined;

  const commitTransform = (layer: OgLayer, node: Konva.Node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    if (isTextLayer(layer)) {
      const metrics = getTextDisplayMetrics(layer);
      updateLayer(layer.id, {
        x: Math.round(node.x() - metrics.offsetX),
        y: Math.round(node.y()),
        width: Math.max(1, Math.round(metrics.width * scaleX)),
        fontSize: Math.max(6, Math.round(layer.fontSize * scaleY)),
        rotation: Math.round(node.rotation())
      } as Partial<OgLayer>);
      return;
    }
    updateLayer(layer.id, {
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.max(1, Math.round(layer.width * scaleX)),
      height: Math.max(1, Math.round(layer.height * scaleY)),
      rotation: Math.round(node.rotation())
    } as Partial<OgLayer>);
  };

  return (
    <section className="stage-shell">
      <div className="stage-toolbar">
        <div>
          <span>Canvas</span>
          <strong>{project.name}</strong>
        </div>
        <div className="tool-row">
          {!sourceRailOpen && onOpenSourceRail ? (
            <button type="button" className="toolbar-source-action" title="Open source rail" onClick={onOpenSourceRail}>
              Source
            </button>
          ) : null}
          <button type="button" className={showSafeZone ? "active" : ""} onClick={() => setShowSafeZone(!showSafeZone)}>
            Safe zone
          </button>
          <button type="button" onClick={() => setZoom(Math.max(0.5, zoom - 0.12))}>-</button>
          <button type="button" onClick={() => setZoom(1)}>{Math.round(scale * 100)}%</button>
          <button type="button" onClick={() => setZoom(Math.min(1.8, zoom + 0.12))}>+</button>
        </div>
      </div>
      <div ref={workspaceRef} className={`stage-bg canvas-workspace ${zoom > 1.01 ? "is-zoomed" : ""}`}>
        <div className="konva-frame" style={{ width: stageWidth, height: stageHeight }}>
          <Stage width={stageWidth} height={stageHeight} scaleX={scale} scaleY={scale}>
            <KonvaLayer>
              <Rect width={canvasWidth} height={canvasHeight} fill={project.canvas.background} />
              {visibleLayers.map((layer) => {
                const frame = getLayerFrame(layer);
                return (
                  <Group
                    key={layer.id}
                    ref={(node) => {
                      if (node) nodeRefs.current[layer.id] = node;
                    }}
                    x={layer.x + frame.offsetX}
                    y={layer.y}
                    width={frame.width}
                    height={frame.height}
                    rotation={layer.rotation}
                    opacity={layer.opacity}
                    draggable={!layer.locked}
                    onClick={() => setSelectedLayerId(layer.id)}
                    onTap={() => setSelectedLayerId(layer.id)}
                    onDblClick={() => {
                      if (isTextLayer(layer) && !layer.locked) {
                        setSelectedLayerId(layer.id);
                        setEditingTextLayerId(layer.id);
                      }
                    }}
                    onDblTap={() => {
                      if (isTextLayer(layer) && !layer.locked) {
                        setSelectedLayerId(layer.id);
                        setEditingTextLayerId(layer.id);
                      }
                    }}
                    onDragEnd={(event) => updateLayer(layer.id, { x: Math.round(event.target.x() - frame.offsetX), y: Math.round(event.target.y()) } as Partial<OgLayer>)}
                    onTransformEnd={(event) => commitTransform(layer, event.target)}
                  >
                    <KonvaLayerNode layer={layer} accent={project.brand.accent} fontReadyVersion={fontReadyVersion} />
                  </Group>
                );
              })}
              {showSafeZone ? (
                <Rect
                  x={project.canvas.safeInset}
                  y={project.canvas.safeInset}
                  width={canvasWidth - project.canvas.safeInset * 2}
                  height={canvasHeight - project.canvas.safeInset * 2}
                  stroke="#ecb052"
                  dash={[10, 8]}
                  listening={false}
                />
              ) : null}
              <Transformer
                ref={transformerRef}
                rotateEnabled
                borderStroke={STUDIO_TRANSFORM_ACCENT}
                borderStrokeWidth={1.4}
                borderDash={[7, 5]}
                anchorFill={STUDIO_TRANSFORM_HANDLE}
                anchorStroke={STUDIO_TRANSFORM_ACCENT}
                anchorStrokeWidth={1.6}
                anchorCornerRadius={3}
                anchorSize={9}
                rotateAnchorOffset={28}
                rotateAnchorCursor="grab"
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right"]}
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 12 || newBox.height < 12 ? oldBox : newBox)}
              />
            </KonvaLayer>
          </Stage>
          {editingTextLayer ? (
            <CanvasTextEditor
              layer={editingTextLayer}
              scale={scale}
              onChange={(text) => updateLayer(editingTextLayer.id, { text } as Partial<OgLayer>)}
              onClose={() => setEditingTextLayerId(null)}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CanvasTextEditor({ layer, scale, onChange, onClose }: { layer: TextLayer; scale: number; onChange: (text: string) => void; onClose: () => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const metrics = getTextDisplayMetrics(layer);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.select();
  }, [layer.id]);

  return (
    <textarea
      ref={textareaRef}
      className="canvas-text-editor"
      aria-label="Edit text layer on canvas"
      value={layer.text}
      onChange={(event) => onChange(event.currentTarget.value)}
      onBlur={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onClose();
        }
      }}
      style={{
        left: (layer.x + metrics.offsetX) * scale,
        top: layer.y * scale,
        width: Math.max(80, metrics.width * scale),
        minHeight: Math.max(36, metrics.height * scale),
        fontFamily: layer.fontFamily,
        fontSize: layer.fontSize * scale,
        fontWeight: layer.fontWeight,
        fontStyle: layer.fontStyle ?? "normal",
        lineHeight: layer.lineHeight,
        letterSpacing: `${(layer.letterSpacing ?? 0) * scale}px`,
        color: layer.color,
        textAlign: layer.align,
        transform: `rotate(${layer.rotation}deg)`,
        transformOrigin: "left top"
      }}
    />
  );
}

function KonvaLayerNode({ layer, accent, fontReadyVersion }: { layer: OgLayer; accent: string; fontReadyVersion: number }) {
  if (isTextLayer(layer)) {
    const metrics = getTextDisplayMetrics(layer);
    return (
      <EffectfulNode
        effects={layer.effects}
        accent={accent}
        bounds={{ width: metrics.width, height: metrics.height }}
        cacheKey={`${fontReadyVersion}:${layer.text}:${metrics.width}:${metrics.height}:${layer.fontFamily}:${layer.fontWeight}:${layer.fontStyle}:${layer.fontSize}:${layer.color}:${layer.lineHeight}:${layer.letterSpacing}`}
      >
        <KonvaText
          width={metrics.width}
          height={metrics.height}
          text={metrics.lines.join("\n")}
          wrap="none"
          fontFamily={layer.fontFamily}
          fontSize={layer.fontSize}
          fontStyle={`${layer.fontStyle ?? "normal"} ${layer.fontWeight}`}
          fill={layer.color}
          align={layer.align}
          lineHeight={layer.lineHeight}
          letterSpacing={layer.letterSpacing ?? 0}
          stroke={layer.stroke}
          strokeWidth={layer.strokeWidth ?? 0}
        />
      </EffectfulNode>
    );
  }
  if (isShapeLayer(layer)) {
    const fillProps = getKonvaFillProps(layer);
    const overlays = <EffectOverlays width={layer.width} height={layer.height} radius={layer.radius} effects={layer.effects} />;
    if (layer.shapeType === "ellipse") {
      return (
        <EffectfulNode effects={layer.effects} accent={accent} bounds={{ width: layer.width, height: layer.height }} cacheKey={`${layer.shapeType}:${layer.width}:${layer.height}:${layer.fill}:${layer.stroke}`}>
          <Ellipse x={layer.width / 2} y={layer.height / 2} radiusX={layer.width / 2} radiusY={layer.height / 2} stroke={layer.stroke} strokeWidth={layer.strokeWidth ?? 0} {...fillProps} />
          {overlays}
        </EffectfulNode>
      );
    }
    if (layer.shapeType === "line") {
      return (
        <EffectfulNode effects={layer.effects} accent={accent} bounds={{ width: layer.width, height: layer.height }} cacheKey={`${layer.shapeType}:${layer.width}:${layer.height}:${layer.fill}`}>
          <Line points={[0, layer.height / 2, layer.width, layer.height / 2]} stroke={layer.fill} strokeWidth={Math.max(1, layer.height)} lineCap="square" />
        </EffectfulNode>
      );
    }
    if (layer.shapeType === "frame") {
      return (
        <EffectfulNode effects={layer.effects} accent={accent} bounds={{ width: layer.width, height: layer.height }} cacheKey={`${layer.shapeType}:${layer.width}:${layer.height}:${layer.stroke}:${layer.strokeWidth}`}>
          <Rect width={layer.width} height={layer.height} fill="transparent" cornerRadius={layer.radius} stroke={layer.stroke ?? layer.fill} strokeWidth={Math.max(1, layer.strokeWidth ?? 2)} />
        </EffectfulNode>
      );
    }
    return (
      <EffectfulNode effects={layer.effects} accent={accent} bounds={{ width: layer.width, height: layer.height }} cacheKey={`${layer.shapeType}:${layer.width}:${layer.height}:${layer.fill}:${layer.stroke}:${layer.radius}`}>
        <Rect width={layer.width} height={layer.height} cornerRadius={layer.radius} stroke={layer.stroke} strokeWidth={layer.strokeWidth ?? 0} {...fillProps} />
        {overlays}
      </EffectfulNode>
    );
  }
  if (isImageLayer(layer)) {
    return <ImageLayerNode layer={layer} accent={accent} />;
  }
  return <Rect width={layer.width} height={layer.height} fill="#eef1eb" stroke="#a9b3a8" />;
}

function getLayerFrame(layer: OgLayer): { offsetX: number; width: number; height: number } {
  if (!isTextLayer(layer)) return { offsetX: 0, width: layer.width, height: layer.height };
  return getTextDisplayMetrics(layer);
}

function getTextDisplayMetrics(layer: TextLayer): { offsetX: number; width: number; height: number; lines: string[] } {
  const maxChars = Math.max(8, Math.floor(layer.width / (layer.fontSize * TEXT_WIDTH_FACTOR)));
  const lines = wrapText(layer.text, maxChars);
  const lineWidths = lines.map((line) => estimateTextLineWidth(layer, line));
  const width = Math.max(1, Math.ceil(Math.max(...lineWidths)));
  const height = Math.max(1, Math.ceil(lines.length * layer.fontSize * layer.lineHeight));
  const offsetX = layer.align === "center" ? (layer.width - width) / 2 : layer.align === "right" ? layer.width - width : 0;
  return { offsetX, width, height, lines };
}

function estimateTextLineWidth(layer: TextLayer, line: string): number {
  const spacing = layer.letterSpacing ?? 0;
  const measured = measureCanvasText(layer, line);
  return measured + Math.max(0, line.length - 1) * spacing + (layer.strokeWidth ?? 0) * 2;
}

function measureCanvasText(layer: TextLayer, line: string): number {
  const key = `${layer.fontFamily}:${layer.fontWeight}:${layer.fontStyle ?? "normal"}:${layer.fontSize}:${layer.letterSpacing ?? 0}:${layer.strokeWidth ?? 0}:${line}`;
  const cached = textMeasureCache.get(key);
  if (cached !== undefined) return cached;
  if (typeof document === "undefined") return line.length * layer.fontSize * 0.64;
  const context = getMeasureContext();
  if (!context) return line.length * layer.fontSize * 0.64;
  const style = layer.fontStyle && layer.fontStyle !== "normal" ? `${layer.fontStyle} ` : "";
  context.font = `${style}${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
  const measured = Math.ceil(context.measureText(line).width);
  textMeasureCache.set(key, measured);
  return measured;
}

let measureCanvas: HTMLCanvasElement | undefined;
const textMeasureCache = new Map<string, number>();

function getMeasureContext(): CanvasRenderingContext2D | null {
  measureCanvas ??= document.createElement("canvas");
  return measureCanvas.getContext("2d");
}

function clearTextMeasureCache() {
  textMeasureCache.clear();
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function ImageLayerNode({ layer, accent }: { layer: ImageLayer; accent: string }) {
  const image = useLayerImage(layer.src);
  const placement = useMemo(() => (image ? getImagePlacement(layer, image) : undefined), [image, layer.width, layer.height, layer.fit, layer.crop, layer.focalPoint]);
  const warped = useMemo(
    () => (image && placement && !isDefaultPerspectiveQuad(layer.perspective) ? createPerspectiveCanvas(layer, image, placement) : null),
    [image, placement, layer.width, layer.height, layer.perspective]
  );
  if (image) {
    if (!placement) return null;
    const imageCacheKey = `${image.src}:${image.naturalWidth}:${image.naturalHeight}:${image.complete}`;
    return (
      <EffectfulNode effects={layer.effects} accent={accent} bounds={{ width: layer.width, height: layer.height }} cacheKey={`${imageCacheKey}:${layer.fit}:${layer.width}:${layer.height}:${JSON.stringify(layer.crop)}:${JSON.stringify(layer.focalPoint)}:${JSON.stringify(layer.perspective)}`}>
        <Group clipX={0} clipY={0} clipWidth={layer.width} clipHeight={layer.height}>
          {warped ? (
            <KonvaImage image={warped} x={0} y={0} width={layer.width} height={layer.height} cornerRadius={layer.borderRadius} />
          ) : (
            <KonvaImage image={image} {...placement} cornerRadius={layer.borderRadius} />
          )}
          <EffectOverlays
            x={placement.x ?? 0}
            y={placement.y ?? 0}
            width={placement.width}
            height={placement.height}
            radius={layer.borderRadius}
            effects={layer.effects}
          />
        </Group>
      </EffectfulNode>
    );
  }
  return (
    <EffectfulNode effects={layer.effects} accent={accent} bounds={{ width: layer.width, height: layer.height }} cacheKey={`image-placeholder:${layer.width}:${layer.height}:${layer.name}:${accent}`}>
      <ImagePlaceholderThumbnail layer={layer} accent={accent} />
    </EffectfulNode>
  );
}

function createPerspectiveCanvas(layer: ImageLayer, image: HTMLImageElement, placement: ReturnType<typeof getImagePlacement>): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(layer.width));
  canvas.height = Math.max(1, Math.round(layer.height));
  const context = canvas.getContext("2d");
  if (!context) return null;
  for (const triangle of createPerspectiveMesh(layer)) {
    const matrix = getAffineMatrix(triangle.source, triangle.destination);
    if (!matrix) continue;
    context.save();
    context.beginPath();
    context.moveTo(triangle.destination[0].x, triangle.destination[0].y);
    context.lineTo(triangle.destination[1].x, triangle.destination[1].y);
    context.lineTo(triangle.destination[2].x, triangle.destination[2].y);
    context.closePath();
    context.clip();
    context.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    if (placement.crop) {
      context.drawImage(image, placement.crop.x, placement.crop.y, placement.crop.width, placement.crop.height, placement.x, placement.y, placement.width, placement.height);
    } else {
      context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
    }
    context.restore();
  }
  return canvas;
}

interface MeshTriangle {
  source: [Point, Point, Point];
  destination: [Point, Point, Point];
}

interface Point {
  x: number;
  y: number;
}

function createPerspectiveMesh(layer: ImageLayer): MeshTriangle[] {
  const quad = normalizePerspectiveQuad(layer.perspective);
  const steps = 6;
  const triangles: MeshTriangle[] = [];
  for (let y = 0; y < steps; y += 1) {
    for (let x = 0; x < steps; x += 1) {
      const u0 = x / steps;
      const v0 = y / steps;
      const u1 = (x + 1) / steps;
      const v1 = (y + 1) / steps;
      const sourceTopLeft = sourcePoint(layer, u0, v0);
      const sourceTopRight = sourcePoint(layer, u1, v0);
      const sourceBottomRight = sourcePoint(layer, u1, v1);
      const sourceBottomLeft = sourcePoint(layer, u0, v1);
      const destTopLeft = perspectivePoint(layer, quad, u0, v0);
      const destTopRight = perspectivePoint(layer, quad, u1, v0);
      const destBottomRight = perspectivePoint(layer, quad, u1, v1);
      const destBottomLeft = perspectivePoint(layer, quad, u0, v1);
      triangles.push(
        { source: [sourceTopLeft, sourceTopRight, sourceBottomRight], destination: [destTopLeft, destTopRight, destBottomRight] },
        { source: [sourceTopLeft, sourceBottomRight, sourceBottomLeft], destination: [destTopLeft, destBottomRight, destBottomLeft] }
      );
    }
  }
  return triangles;
}

function sourcePoint(layer: ImageLayer, u: number, v: number): Point {
  return {
    x: layer.width * u,
    y: layer.height * v
  };
}

function perspectivePoint(layer: ImageLayer, quad: ReturnType<typeof normalizePerspectiveQuad>, u: number, v: number): Point {
  const topX = lerp(quad[0].x, quad[1].x, u);
  const topY = lerp(quad[0].y, quad[1].y, u);
  const bottomX = lerp(quad[3].x, quad[2].x, u);
  const bottomY = lerp(quad[3].y, quad[2].y, u);
  return {
    x: lerp(topX, bottomX, v) * layer.width,
    y: lerp(topY, bottomY, v) * layer.height
  };
}

function getAffineMatrix(source: [Point, Point, Point], destination: [Point, Point, Point]): { a: number; b: number; c: number; d: number; e: number; f: number } | null {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 0.0001) return null;
  return {
    a: (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denominator,
    c: (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denominator,
    e: (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / denominator,
    b: (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denominator,
    d: (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denominator,
    f: (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / denominator
  };
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function ImagePlaceholderThumbnail({ layer, accent }: { layer: ImageLayer; accent: string }) {
  const radius = Math.max(0, layer.borderRadius);
  const padding = Math.max(14, Math.min(28, Math.min(layer.width, layer.height) * 0.09));
  const labelSize = Math.max(12, Math.min(18, layer.height * 0.09));
  const captionSize = Math.max(10, Math.min(13, layer.height * 0.065));
  const artworkX = padding;
  const artworkY = padding;
  const artworkWidth = Math.max(24, layer.width - padding * 2);
  const artworkHeight = Math.max(18, layer.height - padding * 2);
  const midY = artworkY + artworkHeight * 0.58;
  const title = "Image slot";

  return (
    <Group clipX={0} clipY={0} clipWidth={layer.width} clipHeight={layer.height}>
      <Rect width={layer.width} height={layer.height} cornerRadius={radius} fill="#161412" stroke="#6c604d" strokeWidth={1.2} />
      <Rect x={artworkX} y={artworkY} width={artworkWidth} height={artworkHeight} cornerRadius={Math.min(18, Math.max(6, radius - 4))} fill="#211d18" stroke="#4b4134" strokeWidth={1} />
      <Rect x={artworkX + 1} y={artworkY + 1} width={artworkWidth - 2} height={Math.max(22, artworkHeight * 0.22)} cornerRadius={Math.min(14, Math.max(4, radius - 6))} fill="#2a251d" opacity={0.86} />
      <Line
        points={[
          artworkX + artworkWidth * 0.1,
          midY + artworkHeight * 0.2,
          artworkX + artworkWidth * 0.34,
          midY - artworkHeight * 0.22,
          artworkX + artworkWidth * 0.5,
          midY + artworkHeight * 0.03,
          artworkX + artworkWidth * 0.66,
          midY - artworkHeight * 0.28,
          artworkX + artworkWidth * 0.9,
          midY + artworkHeight * 0.2
        ]}
        stroke="#d9b06b"
        strokeWidth={Math.max(2, Math.min(5, layer.height * 0.018))}
        lineCap="round"
        lineJoin="round"
        opacity={0.88}
      />
      <Rect x={artworkX + artworkWidth * 0.1} y={midY + artworkHeight * 0.2} width={artworkWidth * 0.8} height={Math.max(2, artworkHeight * 0.018)} cornerRadius={2} fill={accent} opacity={0.76} />
      <Rect x={artworkX + artworkWidth * 0.08} y={artworkY + artworkHeight * 0.08} width={artworkWidth * 0.18} height={Math.max(5, artworkHeight * 0.035)} cornerRadius={2} fill="#f5d593" opacity={0.92} />
      <Rect x={artworkX + artworkWidth * 0.31} y={artworkY + artworkHeight * 0.08} width={artworkWidth * 0.1} height={Math.max(5, artworkHeight * 0.035)} cornerRadius={2} fill="#6d6253" opacity={0.8} />
      <KonvaText
        x={artworkX + artworkWidth * 0.08}
        y={artworkY + artworkHeight - labelSize * 2.4}
        width={artworkWidth * 0.72}
        text={title}
        fontFamily="Inter, ui-sans-serif, system-ui"
        fontSize={labelSize}
        fontStyle="600"
        fill="#f5efe4"
      />
      <KonvaText
        x={artworkX + artworkWidth * 0.08}
        y={artworkY + artworkHeight - captionSize * 1.25}
        width={artworkWidth * 0.78}
        text="Replace with source art"
        fontFamily="Inter, ui-sans-serif, system-ui"
        fontSize={captionSize}
        fill="#a99d8b"
      />
    </Group>
  );
}

function EffectfulNode({
  effects,
  accent,
  bounds,
  cacheKey,
  children
}: {
  effects: LayerEffects;
  accent: string;
  bounds: { width: number; height: number };
  cacheKey: string;
  children: ReactNode;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const blur = Math.max(0, effects.blur ?? 0);
  const hasBlur = blur > 0;
  const hasCanvasEffect = hasComposedLayerEffect(effects);
  const shadowProps = getKonvaShadowProps(effects, accent);
  const effectCacheKey = `${cacheKey}:${blur}:${effects.shadow}:${JSON.stringify(effects.glow)}:${JSON.stringify(effects.noise)}:${JSON.stringify(effects.lighting)}:${effects.vignette ?? 0}:${JSON.stringify(effects.stack ?? [])}`;

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    if (hasCanvasEffect) {
      const padding = getCanvasEffectCachePadding(effects, accent);
      node.cache({
        x: -padding,
        y: -padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
        pixelRatio: window.devicePixelRatio ?? 1
      });
    } else {
      node.clearCache();
    }
    node.getLayer()?.batchDraw();
    return () => {
      node.clearCache();
      node.getLayer()?.batchDraw();
    };
  }, [accent, bounds.height, bounds.width, effectCacheKey, effects, hasCanvasEffect]);

  return (
    <Group
      ref={groupRef}
      filters={hasBlur ? [Konva.Filters.Blur] : undefined}
      blurRadius={blur}
      {...shadowProps}
    >
      {children}
    </Group>
  );
}

function EffectOverlays({ x = 0, y = 0, width, height, radius = 0, effects }: { x?: number; y?: number; width: number; height: number; radius?: number; effects: LayerEffects }) {
  return (
    <Fragment>
      {effects.lighting && effects.lighting.intensity > 0 ? (
        <Rect
          x={x}
          y={y}
          width={width}
          height={height}
          cornerRadius={radius}
          listening={false}
          opacity={Math.min(0.65, effects.lighting.intensity)}
          fillRadialGradientStartPoint={{ x: width * effects.lighting.x, y: height * effects.lighting.y }}
          fillRadialGradientStartRadius={0}
          fillRadialGradientEndPoint={{ x: width * effects.lighting.x, y: height * effects.lighting.y }}
          fillRadialGradientEndRadius={Math.max(width, height) * (effects.lighting.radius ?? 0.8)}
          fillRadialGradientColorStops={[0, effects.lighting.color, 1, "rgba(255,255,255,0)"]}
          globalCompositeOperation={effects.lighting.blendMode ?? "screen"}
        />
      ) : null}
      {effects.noise && effects.noise.amount > 0 ? <NoiseOverlay x={x} y={y} width={width} height={height} radius={radius} noise={effects.noise} /> : null}
      {normalizeLayerStyleEffects(effects).map((effect) => (
        <AdvancedEffectOverlay key={effect.id} x={x} y={y} width={width} height={height} radius={radius} effect={effect} />
      ))}
      {effects.vignette && effects.vignette > 0 ? (
        <Rect
          x={x}
          y={y}
          width={width}
          height={height}
          cornerRadius={radius}
          listening={false}
          opacity={Math.min(0.5, effects.vignette)}
          fillRadialGradientStartPoint={{ x: width / 2, y: height / 2 }}
          fillRadialGradientStartRadius={Math.min(width, height) * 0.25}
          fillRadialGradientEndPoint={{ x: width / 2, y: height / 2 }}
          fillRadialGradientEndRadius={Math.max(width, height) * 0.75}
          fillRadialGradientColorStops={[0, "rgba(0,0,0,0)", 1, "#000000"]}
        />
      ) : null}
    </Fragment>
  );
}

function AdvancedEffectOverlay({ x, y, width, height, radius, effect }: { x: number; y: number; width: number; height: number; radius: number; effect: LayerStyleEffect }) {
  const pattern = useMemo(() => createAdvancedEffectPattern(width, height, effect), [width, height, effect]);
  if (!effect.enabled || effect.intensity <= 0 || !pattern) return null;
  return (
    <KonvaImage
      image={pattern as unknown as HTMLImageElement}
      x={x}
      y={y}
      width={width}
      height={height}
      cornerRadius={radius}
      listening={false}
      opacity={Math.min(0.72, effect.intensity)}
      globalCompositeOperation={getStackCompositeOperation(effect.blendMode)}
    />
  );
}

function NoiseOverlay({ x, y, width, height, radius, noise }: { x: number; y: number; width: number; height: number; radius: number; noise: NoiseEffect }) {
  const pattern = useMemo(() => createNoisePattern(width, height, noise.amount), [width, height, noise.amount]);
  if (!pattern) return null;
  return (
    <KonvaImage
      image={pattern as unknown as HTMLImageElement}
      x={x}
      y={y}
      width={width}
      height={height}
      cornerRadius={radius}
      listening={false}
      opacity={getNoiseDisplayOpacity(noise.amount)}
      globalCompositeOperation={getCompositeOperation(noise.blendMode)}
    />
  );
}

function getKonvaShadowProps(effects: LayerEffects, accent: string) {
  const glowEnabled = isGlowEffectEnabled(effects.glow);
  const shadow = getCanvasShadowVisual(effects, accent);
  return {
    shadowEnabled: Boolean(effects.shadow || glowEnabled),
    shadowColor: shadow.color,
    shadowBlur: shadow.blur,
    shadowOpacity: shadow.opacity,
    shadowOffsetX: shadow.offsetX,
    shadowOffsetY: shadow.offsetY
  };
}

function createNoisePattern(width: number, height: number, amount: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const size = Math.min(512, Math.max(96, Math.round(Math.max(width, height))));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) return null;
  const imageData = context.createImageData(canvas.width, canvas.height);
  const data = imageData.data;
  let seed = Math.round(amount * 100_000) || 1337;
  for (let index = 0; index < data.length; index += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const checker = ((index / 4) % size) % 2 ? 18 : -18;
    const value = Math.max(0, Math.min(255, ((seed >>> 24) & 255) + checker));
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function getCompositeOperation(blendMode: NoiseEffect["blendMode"]): Konva.NodeConfig["globalCompositeOperation"] {
  if (blendMode === "normal") return "source-over";
  if (blendMode === "multiply") return "multiply";
  if (blendMode === "overlay") return "overlay";
  return "source-over";
}

function getStackCompositeOperation(blendMode: LayerStyleEffect["blendMode"]): Konva.NodeConfig["globalCompositeOperation"] {
  if (blendMode === "multiply") return "multiply";
  if (blendMode === "screen") return "screen";
  if (blendMode === "overlay") return "overlay";
  if (blendMode === "soft-light") return "soft-light";
  return "source-over";
}

function createAdvancedEffectPattern(width: number, height: number, effect: LayerStyleEffect): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (!["halftone", "ordered-dither", "ascii", "color-grade", "duotone", "rgb-split", "bloom", "displacement"].includes(effect.kind)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) return null;
  if (effect.kind === "color-grade") {
    context.fillStyle = getEffectStringParam(effect, "tint", "#e6aa54");
    context.globalAlpha = 0.22 + getEffectNumberParam(effect, "warmth", 0.08, -1, 1) * 0.18;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }
  if (effect.kind === "duotone") {
    const shadow = getEffectStringParam(effect, "shadow", "#12110f");
    const highlight = getEffectStringParam(effect, "highlight", "#f5d189");
    const gradient = context.createLinearGradient(0, canvas.height, canvas.width, 0);
    gradient.addColorStop(0, shadow);
    gradient.addColorStop(1, highlight);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }
  if (effect.kind === "bloom") {
    const radius = getEffectNumberParam(effect, "radius", 28, 0, 120);
    const gradient = context.createRadialGradient(canvas.width * 0.52, canvas.height * 0.38, 0, canvas.width * 0.52, canvas.height * 0.38, Math.max(canvas.width, canvas.height) * 0.42);
    gradient.addColorStop(0, getEffectStringParam(effect, "tint", "#f0b85d"));
    gradient.addColorStop(1, "rgba(240,184,93,0)");
    context.filter = `blur(${Math.max(0, radius / 5)}px)`;
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }
  if (effect.kind === "rgb-split") {
    const amount = getEffectNumberParam(effect, "amount", 6, 0, 80);
    context.globalAlpha = 0.5;
    context.fillStyle = "#ff3b30";
    context.fillRect(amount, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "screen";
    context.fillStyle = "#00c2ff";
    context.fillRect(-amount, 0, canvas.width, canvas.height);
    return canvas;
  }
  if (effect.kind === "halftone") {
    const scale = getEffectNumberParam(effect, "scale", 18, 6, 80);
    context.fillStyle = getEffectStringParam(effect, "ink", "#d8a24f");
    for (let yy = scale / 2; yy < canvas.height; yy += scale) {
      for (let xx = scale / 2; xx < canvas.width; xx += scale) {
        context.beginPath();
        context.arc(xx, yy, scale * 0.2, 0, Math.PI * 2);
        context.fill();
      }
    }
    return canvas;
  }
  if (effect.kind === "ordered-dither") {
    const cell = getEffectNumberParam(effect, "cellSize", 8, 3, 32);
    context.fillStyle = getEffectStringParam(effect, "light", "#f2c36f");
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#12110f";
    for (let yy = 0; yy < canvas.height; yy += cell) {
      for (let xx = 0; xx < canvas.width; xx += cell) {
        if (((xx / cell) + (yy / cell) * 2) % 4 < 1.5) context.fillRect(xx, yy, cell, cell);
      }
    }
    return canvas;
  }
  if (effect.kind === "ascii") {
    const cell = getEffectNumberParam(effect, "cellSize", 26, 10, 80);
    const charset = getEffectStringParam(effect, "charset", "@#%+=-:. ");
    context.fillStyle = getEffectStringParam(effect, "color", "#f0bd68");
    context.font = `${Math.round(cell * 0.58)}px ui-monospace, Consolas, monospace`;
    for (let yy = cell; yy < canvas.height; yy += cell) {
      for (let xx = 0; xx < canvas.width; xx += cell * 0.9) {
        const index = Math.abs(Math.round((xx + yy + (effect.seed ?? 0)) / cell)) % charset.length;
        context.fillText(charset[index] ?? "#", xx, yy);
      }
    }
    return canvas;
  }
  const imageData = context.createImageData(canvas.width, canvas.height);
  let seed = effect.seed ?? 7;
  for (let index = 0; index < imageData.data.length; index += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = (seed >>> 24) & 255;
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
    imageData.data[index + 3] = 96;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function getImagePlacement(layer: ImageLayer, image: HTMLImageElement) {
  const naturalWidth = image.naturalWidth || image.width || layer.width;
  const naturalHeight = image.naturalHeight || image.height || layer.height;

  if (layer.fit === "fill") {
    return { x: 0, y: 0, width: layer.width, height: layer.height };
  }

  if (layer.crop) {
    const cropWidth = Math.max(1, naturalWidth * layer.crop.width);
    const cropHeight = Math.max(1, naturalHeight * layer.crop.height);
    return {
      x: 0,
      y: 0,
      width: layer.width,
      height: layer.height,
      crop: {
        x: Math.max(0, Math.min(naturalWidth - cropWidth, naturalWidth * layer.crop.x)),
        y: Math.max(0, Math.min(naturalHeight - cropHeight, naturalHeight * layer.crop.y)),
        width: cropWidth,
        height: cropHeight
      }
    };
  }

  const imageRatio = naturalWidth / naturalHeight;
  const layerRatio = layer.width / layer.height;

  if (layer.fit === "contain") {
    const scale = imageRatio > layerRatio ? layer.width / naturalWidth : layer.height / naturalHeight;
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    return { x: (layer.width - width) / 2, y: (layer.height - height) / 2, width, height };
  }

  const crop =
    imageRatio > layerRatio
      ? {
          width: naturalHeight * layerRatio,
          height: naturalHeight,
          x: Math.max(0, Math.min(naturalWidth - naturalHeight * layerRatio, (naturalWidth - naturalHeight * layerRatio) * (layer.focalPoint?.x ?? 0.5))),
          y: 0
        }
      : {
          width: naturalWidth,
          height: naturalWidth / layerRatio,
          x: 0,
          y: Math.max(0, Math.min(naturalHeight - naturalWidth / layerRatio, (naturalHeight - naturalWidth / layerRatio) * (layer.focalPoint?.y ?? 0.5)))
        };

  return { x: 0, y: 0, width: layer.width, height: layer.height, crop };
}

function getKonvaFillProps(layer: ShapeLayer) {
  const gradient = layer.effects.gradient;
  if (!gradient) return { fill: layer.fill };
  const colors = gradient.stops.flatMap((stop) => [stop.position, stop.color]);
  if (gradient.type === "radial") {
    return {
      fillRadialGradientStartPoint: { x: layer.width / 2, y: layer.height / 2 },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndPoint: { x: layer.width / 2, y: layer.height / 2 },
      fillRadialGradientEndRadius: Math.max(layer.width, layer.height) / 1.4,
      fillRadialGradientColorStops: colors
    };
  }
  const angle = ((gradient.angle ?? 0) * Math.PI) / 180;
  const x = Math.cos(angle) * layer.width / 2;
  const y = Math.sin(angle) * layer.height / 2;
  return {
    fillLinearGradientStartPoint: { x: layer.width / 2 - x, y: layer.height / 2 - y },
    fillLinearGradientEndPoint: { x: layer.width / 2 + x, y: layer.height / 2 + y },
    fillLinearGradientColorStops: colors
  };
}

export function useLayerImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src || src.startsWith("ogcreator://")) {
      setImage(null);
      return;
    }
    setImage(null);
    const next = new window.Image();
    next.crossOrigin = "anonymous";
    next.onload = () => setImage(next);
    next.onerror = () => setImage(null);
    next.src = src;
    return () => {
      next.onload = null;
      next.onerror = null;
    };
  }, [src]);

  return image;
}

function isTextLayer(layer: OgLayer): layer is TextLayer {
  return layer.kind === "text" || layer.kind === "badge";
}

function isShapeLayer(layer: OgLayer): layer is ShapeLayer {
  return layer.kind === "shape" || layer.kind === "background";
}

function isImageLayer(layer: OgLayer): layer is ImageLayer {
  return layer.kind === "image" || layer.kind === "logo" || layer.kind === "screenshot";
}

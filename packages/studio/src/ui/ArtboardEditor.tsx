import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Konva from "konva";
import { Ellipse, Group, Image as KonvaImage, Layer as KonvaLayer, Line, Rect, Stage, Text as KonvaText, Transformer } from "react-konva";
import { isGlowEffectEnabled, normalizeGlowEffect, type ImageLayer, type LayerEffects, type NoiseEffect, type OgLayer, type ShapeLayer, type TextLayer } from "@graphforge/core";
import { useStudio } from "./studio-store";

const canvasWidth = 1200;
const canvasHeight = 630;
const STUDIO_TRANSFORM_ACCENT = "#ecb052";
const STUDIO_TRANSFORM_HANDLE = "#171511";

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
  const workspaceRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});

  const visibleLayers = useMemo(() => project?.layers.filter((layer) => !layer.hidden) ?? [], [project]);
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
  }, [selectedLayerId, visibleLayers]);

  if (!project) return null;

  const commitTransform = (layer: OgLayer, node: Konva.Node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
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
              {visibleLayers.map((layer) => (
                <Group
                  key={layer.id}
                  ref={(node) => {
                    if (node) nodeRefs.current[layer.id] = node;
                  }}
                  x={layer.x}
                  y={layer.y}
                  width={layer.width}
                  height={layer.height}
                  rotation={layer.rotation}
                  opacity={layer.opacity}
                  draggable={!layer.locked}
                  onClick={() => setSelectedLayerId(layer.id)}
                  onTap={() => setSelectedLayerId(layer.id)}
                  onDragEnd={(event) => updateLayer(layer.id, { x: Math.round(event.target.x()), y: Math.round(event.target.y()) } as Partial<OgLayer>)}
                  onTransformEnd={(event) => commitTransform(layer, event.target)}
                >
                  <KonvaLayerNode layer={layer} accent={project.brand.accent} />
                </Group>
              ))}
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
        </div>
      </div>
    </section>
  );
}

function KonvaLayerNode({ layer, accent }: { layer: OgLayer; accent: string }) {
  if (isTextLayer(layer)) {
    return (
      <EffectfulNode effects={layer.effects} accent={accent} cacheKey={`${layer.text}:${layer.width}:${layer.height}:${layer.fontSize}:${layer.color}`}>
        <KonvaText
          width={layer.width}
          height={layer.height}
          text={layer.text}
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
        <EffectfulNode effects={layer.effects} accent={accent} cacheKey={`${layer.shapeType}:${layer.width}:${layer.height}:${layer.fill}:${layer.stroke}`}>
          <Ellipse x={layer.width / 2} y={layer.height / 2} radiusX={layer.width / 2} radiusY={layer.height / 2} stroke={layer.stroke} strokeWidth={layer.strokeWidth ?? 0} {...fillProps} />
          {overlays}
        </EffectfulNode>
      );
    }
    if (layer.shapeType === "line") {
      return (
        <EffectfulNode effects={layer.effects} accent={accent} cacheKey={`${layer.shapeType}:${layer.width}:${layer.height}:${layer.fill}`}>
          <Line points={[0, layer.height / 2, layer.width, layer.height / 2]} stroke={layer.fill} strokeWidth={Math.max(1, layer.height)} lineCap="square" />
        </EffectfulNode>
      );
    }
    if (layer.shapeType === "frame") {
      return (
        <EffectfulNode effects={layer.effects} accent={accent} cacheKey={`${layer.shapeType}:${layer.width}:${layer.height}:${layer.stroke}:${layer.strokeWidth}`}>
          <Rect width={layer.width} height={layer.height} fill="transparent" cornerRadius={layer.radius} stroke={layer.stroke ?? layer.fill} strokeWidth={Math.max(1, layer.strokeWidth ?? 2)} />
        </EffectfulNode>
      );
    }
    return (
      <EffectfulNode effects={layer.effects} accent={accent} cacheKey={`${layer.shapeType}:${layer.width}:${layer.height}:${layer.fill}:${layer.stroke}:${layer.radius}`}>
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

function ImageLayerNode({ layer, accent }: { layer: ImageLayer; accent: string }) {
  const image = useLayerImage(layer.src);
  if (image) {
    const placement = getImagePlacement(layer, image);
    return (
      <EffectfulNode effects={layer.effects} accent={accent} cacheKey={`${layer.src}:${layer.fit}:${layer.width}:${layer.height}:${JSON.stringify(layer.crop)}:${JSON.stringify(layer.focalPoint)}`}>
        <Group clipX={0} clipY={0} clipWidth={layer.width} clipHeight={layer.height}>
          <KonvaImage image={image} {...placement} cornerRadius={layer.borderRadius} />
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
    <EffectfulNode effects={layer.effects} accent={accent} cacheKey={`${layer.width}:${layer.height}:${layer.name}`}>
      <Rect width={layer.width} height={layer.height} fill="#292e33" cornerRadius={layer.borderRadius} stroke="#58616b" />
      <KonvaText x={12} y={12} width={Math.max(20, layer.width - 24)} text={layer.name} fontSize={18} fill="#c8d0d8" />
    </EffectfulNode>
  );
}

function EffectfulNode({ effects, accent, cacheKey, children }: { effects: LayerEffects; accent: string; cacheKey: string; children: ReactNode }) {
  const groupRef = useRef<Konva.Group>(null);
  const blur = Math.max(0, effects.blur ?? 0);
  const hasBlur = blur > 0;
  const shadowProps = getKonvaShadowProps(effects, accent);
  const effectCacheKey = `${cacheKey}:${blur}:${effects.shadow}:${JSON.stringify(effects.glow)}:${JSON.stringify(effects.noise)}:${JSON.stringify(effects.lighting)}:${effects.vignette ?? 0}`;

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    if (hasBlur) {
      node.cache({ pixelRatio: 1 });
    } else {
      node.clearCache();
    }
    node.getLayer()?.batchDraw();
    return () => {
      node.clearCache();
      node.getLayer()?.batchDraw();
    };
  }, [effectCacheKey, hasBlur]);

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
          fillRadialGradientEndRadius={Math.max(width, height) * 0.8}
          fillRadialGradientColorStops={[0, effects.lighting.color, 1, "rgba(255,255,255,0)"]}
        />
      ) : null}
      {effects.noise && effects.noise.amount > 0 ? <NoiseOverlay x={x} y={y} width={width} height={height} radius={radius} noise={effects.noise} /> : null}
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
      opacity={Math.min(0.56, Math.max(0.05, noise.amount * 3.2))}
      globalCompositeOperation={getCompositeOperation(noise.blendMode)}
    />
  );
}

function getKonvaShadowProps(effects: LayerEffects, accent: string) {
  const glow = normalizeGlowEffect(effects.glow, accent);
  const glowEnabled = isGlowEffectEnabled(effects.glow);
  return {
    shadowEnabled: Boolean(effects.shadow || glowEnabled),
    shadowColor: glowEnabled ? (glow.color ?? accent) : "#020617",
    shadowBlur: glowEnabled ? glow.radius : effects.shadow ? 22 : 0,
    shadowOpacity: glowEnabled ? glow.intensity : effects.shadow ? 0.18 : 0,
    shadowOffsetY: effects.shadow ? 12 : 0
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
    if (!src || src.startsWith("graphforge://")) {
      setImage(null);
      return;
    }
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

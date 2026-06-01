import {
  getNoiseDisplayOpacity,
  getRenderableProject,
  getSvgShadowVisual,
  hasComposedLayerEffect,
  isDefaultPerspectiveQuad,
  isGlowEffectEnabled,
  normalizePerspectiveQuad,
  normalizeGlowEffect,
  type ImageLayer,
  type OgLayer,
  type OgProject
} from "@opengraph-creator/core";

export function renderProjectToSvg(project: OgProject): string {
  const renderableProject = getRenderableProject(project);
  const visibleLayers = renderableProject.layers.filter((layer) => !layer.hidden);
  const defs = [
    ...visibleLayers.flatMap((layer) => [...renderEffectDefs(layer, renderableProject), ...renderImageDefs(layer)])
  ];

  const body = visibleLayers
    .map((layer) => renderLayer(layer, renderableProject))
    .join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${renderableProject.canvas.width}" height="${renderableProject.canvas.height}" viewBox="0 0 ${renderableProject.canvas.width} ${renderableProject.canvas.height}" role="img" aria-label="${escapeXml(renderableProject.name)}">`,
    `<desc>${escapeXml(renderableProject.layers.filter(isVisibleTextLayer).map((layer) => layer.text).join(" "))}</desc>`,
    `<defs>${defs.join("")}</defs>`,
    body,
    `</svg>`
  ].join("\n");
}

function renderLayer(layer: OgLayer, project: OgProject): string {
  const center = `${layer.x + layer.width / 2} ${layer.y + layer.height / 2}`;
  const transform = [
    `rotate(${layer.rotation} ${center})`,
    layer.skewX ? `skewX(${layer.skewX})` : "",
    layer.skewY ? `skewY(${layer.skewY})` : ""
  ].filter(Boolean).join(" ");
  const filter = getFilter(layer);
  const common = `opacity="${layer.opacity}" transform="${transform}"`;
  const commonWithFilter = `${common}${filter ? ` filter="${filter}"` : ""}`;

  if (layer.kind === "background" || layer.kind === "shape") {
    return renderShapeLayer(layer, project, commonWithFilter);
  }

  if (layer.kind === "text" || layer.kind === "badge") {
    const lines = wrapText(layer.text, Math.max(8, Math.floor(layer.width / (layer.fontSize * 0.54))));
    const anchor = layer.align === "center" ? "middle" : layer.align === "right" ? "end" : "start";
    const x = layer.align === "center" ? layer.x + layer.width / 2 : layer.align === "right" ? layer.x + layer.width : layer.x;
    const tspans = lines
      .map(
        (line, index) =>
          `<tspan x="${x}" dy="${index === 0 ? 0 : layer.fontSize * layer.lineHeight}">${escapeXml(line)}</tspan>`
      )
      .join("");
    const stroke = layer.stroke ? ` stroke="${escapeXml(layer.stroke)}"` : "";
    const strokeWidth = layer.strokeWidth ? ` stroke-width="${layer.strokeWidth}"` : "";
    const fontStyle = layer.fontStyle ? ` font-style="${layer.fontStyle}"` : "";
    const letterSpacing = layer.letterSpacing ? ` letter-spacing="${layer.letterSpacing}"` : "";
    return `<text x="${x}" y="${layer.y + layer.fontSize}" width="${layer.width}" font-family="${escapeXml(layer.fontFamily)}" font-size="${layer.fontSize}" font-weight="${layer.fontWeight}"${fontStyle}${letterSpacing} fill="${layer.color}"${stroke}${strokeWidth} text-anchor="${anchor}" ${commonWithFilter}>${tspans}</text>`;
  }

  if (layer.kind === "logo" && layer.src === "ogcreator://logo-placeholder") {
    return `<g ${commonWithFilter}><rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.borderRadius}" fill="${project.brand.text}"/><path d="M ${layer.x + 20} ${layer.y + 42} L ${layer.x + 32} ${layer.y + 21} L ${layer.x + 44} ${layer.y + 42} Z" fill="${project.brand.surface}"/></g>`;
  }

  if ((layer.kind === "image" || layer.kind === "screenshot") && layer.src === "ogcreator://image-placeholder") {
    return renderImagePlaceholderLayer(layer, project, common, filter);
  }

  if (layer.kind === "image" || layer.kind === "logo" || layer.kind === "screenshot") {
    return renderImageLayer(layer, common, filter);
  }

  return "";
}

function renderImageLayer(layer: ImageLayer, common: string, filter: string): string {
  if (!isDefaultPerspectiveQuad(layer.perspective)) {
    return renderPerspectiveImageLayer(layer, common, filter);
  }
  const preserveAspectRatio = getImagePreserveAspectRatio(layer.fit, layer.focalPoint);
  const crop = layer.crop;
  const clipId = `gf-image-clip-${safeId(layer.id)}`;
  const maskId = `gf-image-mask-${safeId(layer.id)}`;
  const filterAttr = filter ? ` filter="${filter}"` : "";
  const overlays = renderEffectOverlays(layer, { maskId });
  if (!crop) {
    return `<g ${common}><g${filterAttr} clip-path="url(#${clipId})"><image href="${escapeXml(layer.src)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="${preserveAspectRatio}"/></g>${overlays}</g>`;
  }

  const cropWidth = Math.max(0.01, clamp(crop.width, 0.01, 1));
  const cropHeight = Math.max(0.01, clamp(crop.height, 0.01, 1));
  const width = Math.round(layer.width / cropWidth);
  const height = Math.round(layer.height / cropHeight);
  const cropX = clamp(crop.x, 0, 1 - cropWidth);
  const cropY = clamp(crop.y, 0, 1 - cropHeight);
  const x = Math.round(layer.x - cropX * width);
  const y = Math.round(layer.y - cropY * height);

  return `<g ${common}><g${filterAttr} clip-path="url(#${clipId})"><image href="${escapeXml(layer.src)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${preserveAspectRatio}"/></g>${overlays}</g>`;
}

function renderPerspectiveImageLayer(layer: ImageLayer, common: string, filter: string): string {
  const id = safeId(layer.id);
  const filterAttr = filter ? ` filter="${filter}"` : "";
  const overlays = renderEffectOverlays(layer, { maskId: `gf-image-mask-${id}` });
  const mesh = createPerspectiveMesh(layer)
    .map((triangle, index) => {
      const matrix = getAffineMatrix(triangle.source, triangle.destination);
      if (!matrix) return "";
      const clipId = `gf-perspective-clip-${id}-${index}`;
      return `<g clip-path="url(#${clipId})"><image href="${escapeXml(layer.src)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="none" transform="${matrix}"/></g>`;
    })
    .join("");
  return `<g ${common} data-og-perspective="${escapeXml(layer.id)}"><g${filterAttr}>${mesh}</g>${overlays}</g>`;
}

function renderImagePlaceholderLayer(layer: ImageLayer, project: OgProject, common: string, filter: string): string {
  const id = safeId(layer.id);
  const clipId = `gf-image-clip-${id}`;
  const maskId = `gf-image-mask-${id}`;
  const filterAttr = filter ? ` filter="${filter}"` : "";
  const overlays = renderEffectOverlays(layer, { maskId });
  const radius = layer.borderRadius;
  const padding = Math.max(14, Math.min(28, Math.min(layer.width, layer.height) * 0.09));
  const artworkX = layer.x + padding;
  const artworkY = layer.y + padding;
  const artworkWidth = Math.max(24, layer.width - padding * 2);
  const artworkHeight = Math.max(18, layer.height - padding * 2);
  const labelSize = Math.max(12, Math.min(18, layer.height * 0.09));
  const captionSize = Math.max(10, Math.min(13, layer.height * 0.065));
  const midY = artworkY + artworkHeight * 0.58;
  const title = "Image slot";
  const mountainStroke = Math.max(2, Math.min(5, layer.height * 0.018));

  return `<g ${common}><g${filterAttr} clip-path="url(#${clipId})">` +
    `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" fill="#161412" stroke="#6c604d" stroke-width="1.2"/>` +
    `<rect x="${artworkX}" y="${artworkY}" width="${artworkWidth}" height="${artworkHeight}" rx="${Math.min(18, Math.max(6, radius - 4))}" fill="#211d18" stroke="#4b4134" stroke-width="1"/>` +
    `<rect x="${artworkX + 1}" y="${artworkY + 1}" width="${Math.max(1, artworkWidth - 2)}" height="${Math.max(22, artworkHeight * 0.22)}" rx="${Math.min(14, Math.max(4, radius - 6))}" fill="#2a251d" opacity="0.86"/>` +
    `<path d="M ${artworkX + artworkWidth * 0.1} ${midY + artworkHeight * 0.2} L ${artworkX + artworkWidth * 0.34} ${midY - artworkHeight * 0.22} L ${artworkX + artworkWidth * 0.5} ${midY + artworkHeight * 0.03} L ${artworkX + artworkWidth * 0.66} ${midY - artworkHeight * 0.28} L ${artworkX + artworkWidth * 0.9} ${midY + artworkHeight * 0.2}" fill="none" stroke="#d9b06b" stroke-width="${mountainStroke}" stroke-linecap="round" stroke-linejoin="round" opacity="0.88"/>` +
    `<rect x="${artworkX + artworkWidth * 0.1}" y="${midY + artworkHeight * 0.2}" width="${artworkWidth * 0.8}" height="${Math.max(2, artworkHeight * 0.018)}" rx="2" fill="${escapeXml(project.brand.accent)}" opacity="0.76"/>` +
    `<rect x="${artworkX + artworkWidth * 0.08}" y="${artworkY + artworkHeight * 0.08}" width="${artworkWidth * 0.18}" height="${Math.max(5, artworkHeight * 0.035)}" rx="2" fill="#f5d593" opacity="0.92"/>` +
    `<rect x="${artworkX + artworkWidth * 0.31}" y="${artworkY + artworkHeight * 0.08}" width="${artworkWidth * 0.1}" height="${Math.max(5, artworkHeight * 0.035)}" rx="2" fill="#6d6253" opacity="0.8"/>` +
    `<text x="${artworkX + artworkWidth * 0.08}" y="${artworkY + artworkHeight - labelSize * 1.55}" width="${artworkWidth * 0.72}" font-family="Inter, ui-sans-serif, system-ui" font-size="${labelSize}" font-weight="600" fill="#f5efe4">${title}</text>` +
    `<text x="${artworkX + artworkWidth * 0.08}" y="${artworkY + artworkHeight - captionSize * 0.45}" width="${artworkWidth * 0.78}" font-family="Inter, ui-sans-serif, system-ui" font-size="${captionSize}" fill="#a99d8b">Replace with source art</text>` +
    `</g>${overlays}</g>`;
}

function renderShapeLayer(layer: Extract<OgLayer, { kind: "background" | "shape" }>, project: OgProject, common: string): string {
  const gradientId = getGradientId(layer);
  const fill = gradientId
    ? `url(#${gradientId})`
    : layer.fill.startsWith("linear-gradient")
      ? project.canvas.background
      : layer.fill;
  const base = renderShapePrimitive(layer, fill, "");
  const overlays = renderEffectOverlays(layer);
  if (!overlays) return renderShapePrimitive(layer, fill, common);
  return `<g ${common}>${base}${overlays}</g>`;
}

function renderShapePrimitive(layer: Extract<OgLayer, { kind: "background" | "shape" }>, fill: string, common: string): string {
  if (layer.shapeType === "ellipse") {
    return `<ellipse cx="${layer.x + layer.width / 2}" cy="${layer.y + layer.height / 2}" rx="${layer.width / 2}" ry="${layer.height / 2}" fill="${fill}" stroke="${layer.stroke ?? "none"}" stroke-width="${layer.strokeWidth ?? 0}" ${common}/>`;
  }
  if (layer.shapeType === "line") {
    const y = layer.y + layer.height / 2;
    return `<line x1="${layer.x}" y1="${y}" x2="${layer.x + layer.width}" y2="${y}" stroke="${layer.fill}" stroke-width="${Math.max(1, layer.height)}" stroke-linecap="square" ${common}/>`;
  }
  if (layer.shapeType === "frame") {
    return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.radius}" fill="none" stroke="${layer.stroke ?? fill}" stroke-width="${Math.max(1, layer.strokeWidth ?? 2)}" ${common}/>`;
  }
  return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.radius}" fill="${fill}" stroke="${layer.stroke ?? "none"}" stroke-width="${layer.strokeWidth ?? 0}" ${common}/>`;
}

function getImagePreserveAspectRatio(fit: "cover" | "contain" | "fill", focalPoint?: { x: number; y: number }): string {
  if (fit === "fill") return "none";
  const x = !focalPoint ? "xMid" : focalPoint.x < 0.34 ? "xMin" : focalPoint.x > 0.66 ? "xMax" : "xMid";
  const y = !focalPoint ? "YMid" : focalPoint.y < 0.34 ? "YMin" : focalPoint.y > 0.66 ? "YMax" : "YMid";
  return `${x}${y} ${fit === "contain" ? "meet" : "slice"}`;
}

function renderEffectDefs(layer: OgLayer, project: OgProject): string[] {
  if (!("effects" in layer)) return [];
  const defs: string[] = [];
  const id = safeId(layer.id);
  const composedFilter = renderComposedFilter(layer, project);
  if (composedFilter) defs.push(composedFilter);
  const gradient = layer.effects.gradient;
  if (gradient) {
    const stops = gradient.stops
      .map(
        (stop) =>
          `<stop offset="${Math.round(stop.position * 100)}%" stop-color="${escapeXml(stop.color)}" stop-opacity="${clamp(stop.opacity, 0, 1)}"/>`
      )
      .join("");
    if (gradient.type === "radial") {
      defs.push(`<radialGradient id="gf-gradient-${id}" cx="50%" cy="50%" r="75%">${stops}</radialGradient>`);
    } else {
      const angle = ((gradient.angle ?? 0) * Math.PI) / 180;
      const x = Math.cos(angle) * 50;
      const y = Math.sin(angle) * 50;
      defs.push(
        `<linearGradient id="gf-gradient-${id}" x1="${50 - x}%" y1="${50 - y}%" x2="${50 + x}%" y2="${50 + y}%">${stops}</linearGradient>`
      );
    }
  }
  if (layer.effects.noise && layer.effects.noise.amount > 0) {
    defs.push(
      `<filter id="gf-noise-${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`
    );
  }
  if (layer.effects.lighting && layer.effects.lighting.intensity > 0) {
    const lighting = layer.effects.lighting;
    defs.push(
      `<radialGradient id="gf-lighting-${id}" cx="${clamp(lighting.x, 0, 1) * 100}%" cy="${clamp(lighting.y, 0, 1) * 100}%" r="70%"><stop offset="0%" stop-color="${escapeXml(lighting.color)}" stop-opacity="${clamp(lighting.intensity, 0, 1)}"/><stop offset="100%" stop-color="${escapeXml(lighting.color)}" stop-opacity="0"/></radialGradient>`
    );
  }
  if (layer.effects.vignette && layer.effects.vignette > 0) {
    defs.push(
      `<radialGradient id="gf-vignette-${id}" cx="50%" cy="50%" r="75%"><stop offset="55%" stop-color="#000000" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="${clamp(layer.effects.vignette, 0, 1)}"/></radialGradient>`
    );
  }
  return defs;
}

function renderComposedFilter(layer: OgLayer, project: OgProject): string {
  if (!("effects" in layer) || !hasComposedFilter(layer)) return "";
  const id = safeId(layer.id);
  const effects = layer.effects;
  const glowEnabled = isGlowEffectEnabled(effects.glow);
  const glow = normalizeGlowEffect(effects.glow, project.brand.accent);
  const nodes: string[] = [];

  if (effects.shadow) {
    const shadow = getSvgShadowVisual(effects, project.brand.accent);
    nodes.push(
      `<feDropShadow in="SourceAlpha" dx="${shadow.dx}" dy="${shadow.dy}" stdDeviation="${shadow.stdDeviation}" flood-color="${escapeXml(shadow.color)}" flood-opacity="${shadow.floodOpacity}" result="gf-shadow-${id}"/>`
    );
  }

  if (glowEnabled) {
    nodes.push(
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${clamp(glow.radius / 3, 0, 28)}" result="gf-glow-blur-${id}"/>`,
      `<feMorphology operator="dilate" radius="${glow.spread ?? 0}" in="gf-glow-blur-${id}" result="gf-glow-spread-${id}"/>`,
      `<feFlood flood-color="${escapeXml(glow.color ?? project.brand.accent)}" flood-opacity="${clamp(glow.intensity, 0, 1)}" result="gf-glow-color-${id}"/>`,
      `<feComposite in="gf-glow-color-${id}" in2="gf-glow-spread-${id}" operator="in" result="gf-glow-${id}"/>`
    );
  }

  const sourceResult = `gf-layer-blur-${id}`;
  if (effects.blur > 0) {
    nodes.push(`<feGaussianBlur in="SourceGraphic" stdDeviation="${clamp(effects.blur, 0, 40)}" result="${sourceResult}"/>`);
  } else {
    nodes.push(`<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="${sourceResult}"/>`);
  }

  const mergeNodes = [
    effects.shadow ? `<feMergeNode in="gf-shadow-${id}"/>` : "",
    glowEnabled ? `<feMergeNode in="gf-glow-${id}"/>` : "",
    `<feMergeNode in="${sourceResult}"/>`
  ].filter(Boolean).join("");

  return `<filter id="gf-filter-${id}" x="-45%" y="-45%" width="190%" height="190%">${nodes.join("")}<feMerge>${mergeNodes}</feMerge></filter>`;
}

function renderImageDefs(layer: OgLayer): string[] {
  if (!(layer.kind === "image" || layer.kind === "logo" || layer.kind === "screenshot")) return [];
  const preserveAspectRatio = getImagePreserveAspectRatio(layer.fit, layer.focalPoint);
  const crop = layer.crop;
  const image = layer.src.startsWith("ogcreator://")
    ? `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.borderRadius}" fill="#ffffff"/>`
    : crop
    ? getCroppedImageGeometry(layer, preserveAspectRatio)
    : `<image href="${escapeXml(layer.src)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="${preserveAspectRatio}"/>`;
  const defs = [
    `<clipPath id="gf-image-clip-${safeId(layer.id)}"><rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.borderRadius}"/></clipPath>`,
    `<mask id="gf-image-mask-${safeId(layer.id)}" maskUnits="userSpaceOnUse" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" style="mask-type:alpha">${image}</mask>`
  ];
  if (!isDefaultPerspectiveQuad(layer.perspective)) {
    defs.push(
      ...createPerspectiveMesh(layer).map((triangle, index) => {
        const points = triangle.destination.map((point) => `${round(point.x)},${round(point.y)}`).join(" ");
        return `<clipPath id="gf-perspective-clip-${safeId(layer.id)}-${index}"><polygon points="${points}"/></clipPath>`;
      })
    );
  }
  return defs;
}

function renderEffectOverlays(
  layer: Extract<OgLayer, { kind: "background" | "shape" | "image" | "logo" | "screenshot" }>,
  options: { maskId?: string } = {}
): string {
  if (!("effects" in layer)) return "";
  const id = safeId(layer.id);
  const overlays: string[] = [];
  const radius = "borderRadius" in layer ? layer.borderRadius : layer.radius;
  const mask = options.maskId ? ` mask="url(#${options.maskId})"` : "";
  if (layer.effects.noise && layer.effects.noise.amount > 0) {
    overlays.push(
      `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" filter="url(#gf-noise-${id})" opacity="${getNoiseDisplayOpacity(layer.effects.noise.amount)}" style="mix-blend-mode:${layer.effects.noise.blendMode}"${mask}/>`
    );
  }
  if (layer.effects.lighting && layer.effects.lighting.intensity > 0) {
    overlays.push(
      `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" fill="url(#gf-lighting-${id})"${mask}/>`
    );
  }
  if (layer.effects.vignette && layer.effects.vignette > 0) {
    overlays.push(
      `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" fill="url(#gf-vignette-${id})"${mask}/>`
    );
  }
  return overlays.join("");
}

function getCroppedImageGeometry(
  layer: Extract<OgLayer, { kind: "image" | "logo" | "screenshot" }>,
  preserveAspectRatio: string
): string {
  const crop = layer.crop;
  if (!crop) {
    return `<image href="${escapeXml(layer.src)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="${preserveAspectRatio}"/>`;
  }
  const cropWidth = Math.max(0.01, clamp(crop.width, 0.01, 1));
  const cropHeight = Math.max(0.01, clamp(crop.height, 0.01, 1));
  const width = Math.round(layer.width / cropWidth);
  const height = Math.round(layer.height / cropHeight);
  const cropX = clamp(crop.x, 0, 1 - cropWidth);
  const cropY = clamp(crop.y, 0, 1 - cropHeight);
  const x = Math.round(layer.x - cropX * width);
  const y = Math.round(layer.y - cropY * height);
  return `<image href="${escapeXml(layer.src)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${preserveAspectRatio}"/>`;
}

function getGradientId(layer: OgLayer): string | undefined {
  return "effects" in layer && layer.effects.gradient ? `gf-gradient-${safeId(layer.id)}` : undefined;
}

function isVisibleTextLayer(layer: OgLayer): layer is Extract<OgLayer, { kind: "text" | "badge" }> {
  return (layer.kind === "text" || layer.kind === "badge") && !layer.hidden;
}

function getFilter(layer: OgLayer): string {
  return hasComposedFilter(layer) ? `url(#gf-filter-${safeId(layer.id)})` : "";
}

function hasComposedFilter(layer: OgLayer): boolean {
  return "effects" in layer && hasComposedLayerEffect(layer.effects);
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
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

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
    x: layer.x + layer.width * u,
    y: layer.y + layer.height * v
  };
}

function perspectivePoint(layer: ImageLayer, quad: ReturnType<typeof normalizePerspectiveQuad>, u: number, v: number): Point {
  const topX = lerp(quad[0].x, quad[1].x, u);
  const topY = lerp(quad[0].y, quad[1].y, u);
  const bottomX = lerp(quad[3].x, quad[2].x, u);
  const bottomY = lerp(quad[3].y, quad[2].y, u);
  return {
    x: layer.x + lerp(topX, bottomX, v) * layer.width,
    y: layer.y + lerp(topY, bottomY, v) * layer.height
  };
}

function getAffineMatrix(source: [Point, Point, Point], destination: [Point, Point, Point]): string {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 0.0001) return "";
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denominator;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denominator;
  const e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / denominator;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denominator;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denominator;
  const f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / denominator;
  return `matrix(${[a, b, c, d, e, f].map(round).join(" ")})`;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

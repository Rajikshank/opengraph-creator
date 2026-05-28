import { isGlowEffectEnabled, normalizeGlowEffect, type OgLayer, type OgProject } from "@graphforge/core";

export function renderProjectToSvg(project: OgProject): string {
  const visibleLayers = project.layers.filter((layer) => !layer.hidden);
  const defs = [
    ...visibleLayers.flatMap((layer) => [...renderEffectDefs(layer, project), ...renderImageDefs(layer)])
  ];

  const body = visibleLayers
    .map((layer) => renderLayer(layer, project))
    .join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${project.canvas.width}" height="${project.canvas.height}" viewBox="0 0 ${project.canvas.width} ${project.canvas.height}" role="img" aria-label="${escapeXml(project.name)}">`,
    `<desc>${escapeXml(project.layers.filter(isVisibleTextLayer).map((layer) => layer.text).join(" "))}</desc>`,
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
  const common = `opacity="${layer.opacity}" transform="${transform}"${filter ? ` filter="${filter}"` : ""}`;

  if (layer.kind === "background" || layer.kind === "shape") {
    return renderShapeLayer(layer, project, common);
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
    return `<text x="${x}" y="${layer.y + layer.fontSize}" width="${layer.width}" font-family="${escapeXml(layer.fontFamily)}" font-size="${layer.fontSize}" font-weight="${layer.fontWeight}"${fontStyle}${letterSpacing} fill="${layer.color}"${stroke}${strokeWidth} text-anchor="${anchor}" ${common}>${tspans}</text>`;
  }

  if (layer.kind === "logo" && layer.src === "graphforge://logo-placeholder") {
    return `<g ${common}><rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.borderRadius}" fill="${project.brand.text}"/><path d="M ${layer.x + 20} ${layer.y + 42} L ${layer.x + 32} ${layer.y + 21} L ${layer.x + 44} ${layer.y + 42} Z" fill="${project.brand.surface}"/></g>`;
  }

  if (layer.kind === "image" || layer.kind === "logo" || layer.kind === "screenshot") {
    return renderImageLayer(layer, common);
  }

  return "";
}

function renderImageLayer(layer: Extract<OgLayer, { kind: "image" | "logo" | "screenshot" }>, common: string): string {
  const preserveAspectRatio = getImagePreserveAspectRatio(layer.fit, layer.focalPoint);
  const crop = layer.crop;
  const clipId = `gf-image-clip-${safeId(layer.id)}`;
  if (!crop) {
    return `<g ${common} clip-path="url(#${clipId})"><image href="${escapeXml(layer.src)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="${preserveAspectRatio}"/>${renderEffectOverlays(layer)}</g>`;
  }

  const cropWidth = Math.max(0.01, clamp(crop.width, 0.01, 1));
  const cropHeight = Math.max(0.01, clamp(crop.height, 0.01, 1));
  const width = Math.round(layer.width / cropWidth);
  const height = Math.round(layer.height / cropHeight);
  const cropX = clamp(crop.x, 0, 1 - cropWidth);
  const cropY = clamp(crop.y, 0, 1 - cropHeight);
  const x = Math.round(layer.x - cropX * width);
  const y = Math.round(layer.y - cropY * height);

  return `<g ${common} clip-path="url(#${clipId})"><image href="${escapeXml(layer.src)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${preserveAspectRatio}"/>${renderEffectOverlays(layer)}</g>`;
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
    nodes.push(
      `<feDropShadow in="SourceAlpha" dx="0" dy="18" stdDeviation="18" flood-color="#020617" flood-opacity="0.34" result="gf-shadow-${id}"/>`
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
  return [
    `<clipPath id="gf-image-clip-${safeId(layer.id)}"><rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.borderRadius}"/></clipPath>`
  ];
}

function renderEffectOverlays(layer: Extract<OgLayer, { kind: "background" | "shape" | "image" | "logo" | "screenshot" }>): string {
  if (!("effects" in layer)) return "";
  const id = safeId(layer.id);
  const overlays: string[] = [];
  const radius = "borderRadius" in layer ? layer.borderRadius : layer.radius;
  if (layer.effects.noise && layer.effects.noise.amount > 0) {
    overlays.push(
      `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" filter="url(#gf-noise-${id})" opacity="${clamp(layer.effects.noise.amount, 0, 1)}" style="mix-blend-mode:${layer.effects.noise.blendMode}"/>`
    );
  }
  if (layer.effects.lighting && layer.effects.lighting.intensity > 0) {
    overlays.push(
      `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" fill="url(#gf-lighting-${id})"/>`
    );
  }
  if (layer.effects.vignette && layer.effects.vignette > 0) {
    overlays.push(
      `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" fill="url(#gf-vignette-${id})"/>`
    );
  }
  return overlays.join("");
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
  return "effects" in layer && (layer.effects.shadow || isGlowEffectEnabled(layer.effects.glow) || layer.effects.blur > 0);
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

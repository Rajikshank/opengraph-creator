import {
  getEffectNumberParam,
  getEffectStringParam,
  normalizeLayerStyleEffects,
  type LayerStyleEffect,
  type OgLayer
} from "@opengraph-creator/core";

export function renderAdvancedEffectPatternDefs(layer: OgLayer): string[] {
  if (!("effects" in layer)) return [];
  return normalizeLayerStyleEffects(layer.effects)
    .filter((effect) => effect.enabled && effect.intensity > 0)
    .flatMap((effect) => renderPatternDef(layer.id, effect));
}

export function renderAdvancedFilterNodes(
  layer: OgLayer,
  sourceResult: string,
  filterId: string
): { nodes: string[]; result: string; mergeBeforeSource: string[] } {
  if (!("effects" in layer)) return { nodes: [], result: sourceResult, mergeBeforeSource: [] };
  let current = sourceResult;
  const nodes: string[] = [];
  const mergeBeforeSource: string[] = [];

  for (const effect of normalizeLayerStyleEffects(layer.effects).filter((item) => item.enabled && item.intensity > 0)) {
    if (effect.kind === "color-grade") {
      const result = `${filterId}-grade-${effect.id}`;
      const brightness = getEffectNumberParam(effect, "brightness", 0, -1, 1) * effect.intensity;
      const contrast = 1 + getEffectNumberParam(effect, "contrast", 0.12, -0.8, 1.8) * effect.intensity;
      const saturation = 1 + getEffectNumberParam(effect, "saturation", 0.06, -1, 2) * effect.intensity;
      nodes.push(
        `<feColorMatrix in="${current}" type="saturate" values="${round(saturation)}" result="${result}-sat"/>`,
        `<feComponentTransfer in="${result}-sat" result="${result}"><feFuncR type="linear" slope="${round(contrast)}" intercept="${round(brightness)}"/><feFuncG type="linear" slope="${round(contrast)}" intercept="${round(brightness)}"/><feFuncB type="linear" slope="${round(contrast)}" intercept="${round(brightness)}"/></feComponentTransfer>`
      );
      current = result;
    }
    if (effect.kind === "duotone") {
      const result = `${filterId}-duotone-${effect.id}`;
      const shadow = hexToRgb(getEffectStringParam(effect, "shadow", "#12110f"));
      const highlight = hexToRgb(getEffectStringParam(effect, "highlight", "#f5d189"));
      nodes.push(
        `<feColorMatrix in="${current}" type="saturate" values="0" result="${result}-mono"/>`,
        `<feComponentTransfer in="${result}-mono" result="${result}"><feFuncR type="table" tableValues="${round(shadow.r / 255)} ${round(highlight.r / 255)}"/><feFuncG type="table" tableValues="${round(shadow.g / 255)} ${round(highlight.g / 255)}"/><feFuncB type="table" tableValues="${round(shadow.b / 255)} ${round(highlight.b / 255)}"/></feComponentTransfer>`
      );
      current = result;
    }
    if (effect.kind === "displacement") {
      const turbulence = `${filterId}-warp-noise-${effect.id}`;
      const result = `${filterId}-warp-${effect.id}`;
      const amount = getEffectNumberParam(effect, "amount", 10, 0, 80) * effect.intensity;
      const scale = getEffectNumberParam(effect, "scale", 0.025, 0.005, 0.15);
      nodes.push(
        `<feTurbulence type="fractalNoise" baseFrequency="${round(scale)}" numOctaves="2" seed="${Math.round(effect.seed ?? 7)}" result="${turbulence}"/>`,
        `<feDisplacementMap in="${current}" in2="${turbulence}" scale="${round(amount)}" xChannelSelector="R" yChannelSelector="G" result="${result}"/>`
      );
      current = result;
    }
    if (effect.kind === "rgb-split") {
      const amount = getEffectNumberParam(effect, "amount", 6, 0, 80) * effect.intensity;
      const angle = (getEffectNumberParam(effect, "angle", 0, -360, 360) * Math.PI) / 180;
      const dx = round(Math.cos(angle) * amount);
      const dy = round(Math.sin(angle) * amount);
      const red = `${filterId}-rgb-red-${effect.id}`;
      const cyan = `${filterId}-rgb-cyan-${effect.id}`;
      nodes.push(
        `<feOffset in="${current}" dx="${dx}" dy="${dy}" result="${red}-offset"/>`,
        `<feColorMatrix in="${red}-offset" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${round(effect.intensity)} 0" result="${red}"/>`,
        `<feOffset in="${current}" dx="${-dx}" dy="${-dy}" result="${cyan}-offset"/>`,
        `<feColorMatrix in="${cyan}-offset" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${round(effect.intensity)} 0" result="${cyan}"/>`
      );
      mergeBeforeSource.push(red, cyan);
    }
    if (effect.kind === "bloom") {
      const blur = `${filterId}-bloom-blur-${effect.id}`;
      const color = `${filterId}-bloom-color-${effect.id}`;
      const result = `${filterId}-bloom-${effect.id}`;
      const radius = getEffectNumberParam(effect, "radius", 28, 0, 120) * effect.intensity;
      const tint = getEffectStringParam(effect, "tint", "#f0b85d");
      nodes.push(
        `<feGaussianBlur in="${current}" stdDeviation="${round(radius / 3)}" result="${blur}"/>`,
        `<feFlood flood-color="${escapeXml(tint)}" flood-opacity="${round(0.38 * effect.intensity)}" result="${color}"/>`,
        `<feComposite in="${color}" in2="${blur}" operator="in" result="${result}"/>`
      );
      mergeBeforeSource.push(result);
    }
  }

  return { nodes, result: current, mergeBeforeSource };
}

export function renderAdvancedEffectOverlays(
  layer: Extract<OgLayer, { kind: "background" | "shape" | "image" | "logo" | "screenshot" }>,
  options: { mask?: string } = {}
): string {
  if (!("effects" in layer)) return "";
  const id = safeId(layer.id);
  const radius = "borderRadius" in layer ? layer.borderRadius : layer.radius;
  const mask = options.mask ? ` ${options.mask}` : "";
  return normalizeLayerStyleEffects(layer.effects)
    .filter((effect) => effect.enabled && effect.intensity > 0)
    .map((effect) => {
      const opacity = round(Math.min(0.74, effect.intensity));
      if (effect.kind === "halftone") {
        return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" fill="url(#ogc-halftone-${id}-${safeId(effect.id)})" opacity="${opacity}" style="mix-blend-mode:${effect.blendMode ?? "overlay"}"${mask}/>`;
      }
      if (effect.kind === "ordered-dither") {
        return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" fill="url(#ogc-dither-${id}-${safeId(effect.id)})" opacity="${opacity}" style="mix-blend-mode:${effect.blendMode ?? "multiply"}"${mask}/>`;
      }
      if (effect.kind === "ascii") {
        return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" fill="url(#ogc-ascii-${id}-${safeId(effect.id)})" opacity="${opacity}" style="mix-blend-mode:${effect.blendMode ?? "overlay"}"${mask}/>`;
      }
      return "";
    })
    .join("");
}

function renderPatternDef(layerId: string, effect: LayerStyleEffect): string[] {
  const id = safeId(layerId);
  const effectId = safeId(effect.id);
  if (effect.kind === "halftone") {
    const scale = getEffectNumberParam(effect, "scale", 18, 6, 80);
    const ink = getEffectStringParam(effect, "ink", "#d8a24f");
    const radius = round(scale * 0.16 + scale * 0.16 * effect.intensity);
    return [
      `<pattern id="ogc-halftone-${id}-${effectId}" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse" patternTransform="rotate(${getEffectNumberParam(effect, "angle", 28, -90, 90)})"><circle cx="${scale / 2}" cy="${scale / 2}" r="${radius}" fill="${escapeXml(ink)}"/></pattern>`
    ];
  }
  if (effect.kind === "ordered-dither") {
    const cell = getEffectNumberParam(effect, "cellSize", 8, 3, 32);
    const palette = effect.params.palette;
    const dark = Array.isArray(palette) && typeof palette[0] === "string" ? palette[0] : "#12110f";
    const light = getEffectStringParam(
      effect,
      "light",
      Array.isArray(palette) && typeof palette[1] === "string" ? palette[1] : "#f2c36f"
    );
    return [
      `<pattern id="ogc-dither-${id}-${effectId}" width="${cell * 4}" height="${cell * 4}" patternUnits="userSpaceOnUse"><rect width="${cell * 4}" height="${cell * 4}" fill="${escapeXml(light)}"/><rect width="${cell}" height="${cell}" fill="${escapeXml(dark)}"/><rect x="${cell * 2}" y="${cell}" width="${cell}" height="${cell}" fill="${escapeXml(dark)}"/><rect x="${cell}" y="${cell * 2}" width="${cell}" height="${cell}" fill="${escapeXml(dark)}"/><rect x="${cell * 3}" y="${cell * 3}" width="${cell}" height="${cell}" fill="${escapeXml(dark)}"/></pattern>`
    ];
  }
  if (effect.kind === "ascii") {
    const cell = getEffectNumberParam(effect, "cellSize", 26, 10, 80);
    const color = getEffectStringParam(effect, "color", "#f0bd68");
    const glyphs = getEffectStringParam(effect, "charset", "@#%+=-:. ").slice(0, 8) || "@#%+=-:.";
    return [
      `<pattern id="ogc-ascii-${id}-${effectId}" width="${cell * 4}" height="${cell * 2}" patternUnits="userSpaceOnUse"><text x="0" y="${cell}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="${cell * 0.58}" fill="${escapeXml(color)}">${escapeXml(glyphs)}</text></pattern>`
    ];
  }
  return [];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16)
  };
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

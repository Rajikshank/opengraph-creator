import type { EffectCapability, LayerKind, LayerEffects } from "./index.js";

export type LayerStyleEffectKind =
  | "color-grade"
  | "duotone"
  | "bloom"
  | "rgb-split"
  | "halftone"
  | "ordered-dither"
  | "ascii"
  | "displacement";

export type LayerStyleEffectParam =
  | string
  | number
  | boolean
  | undefined
  | Array<string | number>
  | Record<string, string | number | boolean | undefined>;

export interface LayerStyleEffect {
  id: string;
  kind: LayerStyleEffectKind;
  enabled: boolean;
  intensity: number;
  blendMode?: "normal" | "multiply" | "screen" | "overlay" | "soft-light";
  seed?: number;
  clipMode?: "layer" | "image-content";
  params: Record<string, LayerStyleEffectParam>;
}

export interface LayerStyleEffectDefinition {
  kind: LayerStyleEffectKind;
  label: string;
  category: "Color" | "Light" | "Texture" | "Stylize" | "Distortion";
  description: string;
  defaultParams: Record<string, LayerStyleEffectParam>;
  supportedLayers: LayerKind[];
}

export const layerStyleEffectDefinitions: LayerStyleEffectDefinition[] = [
  {
    kind: "color-grade",
    label: "Color Grade",
    category: "Color",
    description: "Studio-grade brightness, contrast, saturation, warmth, and tint.",
    supportedLayers: ["background", "shape", "image", "logo", "screenshot"],
    defaultParams: { brightness: 0, contrast: 0.12, saturation: 0.06, warmth: 0.08, tint: "#e6aa54" }
  },
  {
    kind: "duotone",
    label: "Duotone",
    category: "Color",
    description: "Map shadows and highlights into a controlled editorial palette.",
    supportedLayers: ["background", "shape", "image", "logo", "screenshot"],
    defaultParams: { shadow: "#12110f", mid: "#8c6841", highlight: "#f5d189", contrast: 0.45 }
  },
  {
    kind: "bloom",
    label: "Bloom",
    category: "Light",
    description: "Soft threshold glow for practical light and luminous edges.",
    supportedLayers: ["background", "shape", "text", "badge", "image", "logo", "screenshot"],
    defaultParams: { radius: 28, threshold: 0.45, tint: "#f0b85d" }
  },
  {
    kind: "rgb-split",
    label: "RGB Split",
    category: "Stylize",
    description: "Subtle chromatic channel offset with controlled angle and strength.",
    supportedLayers: ["background", "shape", "text", "badge", "image", "logo", "screenshot"],
    defaultParams: { amount: 6, angle: 0, mode: "cyan-red" }
  },
  {
    kind: "halftone",
    label: "Halftone",
    category: "Texture",
    description: "Print dots or lines clipped to the selected layer.",
    supportedLayers: ["background", "shape", "image", "logo", "screenshot"],
    defaultParams: { style: "dot", scale: 18, angle: 28, ink: "#d8a24f", contrast: 0.6 }
  },
  {
    kind: "ordered-dither",
    label: "Ordered Dither",
    category: "Texture",
    description: "Bayer-style structured dithering for crisp retro texture.",
    supportedLayers: ["background", "shape", "image", "logo", "screenshot"],
    defaultParams: { cellSize: 8, threshold: 0.45, palette: ["#12110f", "#f2c36f"] }
  },
  {
    kind: "ascii",
    label: "ASCII Poster",
    category: "Stylize",
    description: "Glyph mosaic texture with adjustable cell size and contrast.",
    supportedLayers: ["background", "shape", "image", "logo", "screenshot"],
    defaultParams: { cellSize: 26, charset: "@#%+=-:. ", contrast: 0.7, color: "#f0bd68" }
  },
  {
    kind: "displacement",
    label: "Heat Ripple",
    category: "Distortion",
    description: "Subtle procedural displacement driven by seeded turbulence.",
    supportedLayers: ["background", "shape", "image", "logo", "screenshot"],
    defaultParams: { amount: 10, scale: 0.025, softness: 0.5, direction: 35 }
  }
];

const definitionByKind = new Map(layerStyleEffectDefinitions.map((definition) => [definition.kind, definition]));

export function createLayerStyleEffect(kind: LayerStyleEffectKind, overrides: Partial<LayerStyleEffect> = {}): LayerStyleEffect {
  const definition = definitionByKind.get(kind);
  return {
    id: overrides.id ?? `effect-${kind}-${Date.now().toString(36)}`,
    kind,
    enabled: overrides.enabled ?? true,
    intensity: clamp01(overrides.intensity ?? 0.72),
    blendMode: overrides.blendMode ?? "normal",
    seed: overrides.seed ?? stableSeed(kind),
    clipMode: overrides.clipMode ?? "layer",
    params: {
      ...(definition?.defaultParams ?? {}),
      ...(overrides.params ?? {})
    }
  };
}

export function normalizeLayerStyleEffects(effects: LayerEffects): LayerStyleEffect[] {
  return (effects.stack ?? [])
    .filter((effect): effect is LayerStyleEffect => Boolean(effect?.kind && definitionByKind.has(effect.kind)))
    .map((effect) => {
      const definition = definitionByKind.get(effect.kind);
      return createLayerStyleEffect(effect.kind, {
        ...effect,
        intensity: clamp01(effect.intensity),
        params: {
          ...(definition?.defaultParams ?? {}),
          ...(effect.params ?? {})
        }
      });
    });
}

export function hasEnabledLayerStyleEffect(effects: LayerEffects, kinds?: LayerStyleEffectKind[]): boolean {
  return normalizeLayerStyleEffects(effects).some((effect) => effect.enabled && effect.intensity > 0 && (!kinds || kinds.includes(effect.kind)));
}

export function getLayerStyleEffectCapability(kind: LayerStyleEffectKind, layerKind: LayerKind): EffectCapability {
  const definition = definitionByKind.get(kind);
  if (!definition) return "disabled";
  return definition.supportedLayers.includes(layerKind) ? "supported" : "disabled";
}

export function getLayerStyleEffectCapabilities(layerKind: LayerKind): Record<LayerStyleEffectKind, EffectCapability> {
  return Object.fromEntries(
    layerStyleEffectDefinitions.map((definition) => [definition.kind, getLayerStyleEffectCapability(definition.kind, layerKind)])
  ) as Record<LayerStyleEffectKind, EffectCapability>;
}

export function getLayerStyleEffectDefinition(kind: LayerStyleEffectKind): LayerStyleEffectDefinition | undefined {
  return definitionByKind.get(kind);
}

export function getEffectNumberParam(effect: LayerStyleEffect, key: string, fallback: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number {
  const value = effect.params[key];
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(Math.max(numberValue, min), max);
}

export function getEffectStringParam(effect: LayerStyleEffect, key: string, fallback: string): string {
  const value = effect.params[key];
  return typeof value === "string" ? value : fallback;
}

function stableSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp01(value: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);
}

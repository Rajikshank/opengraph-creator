import { normalizeLayerStyleEffects, type LayerEffects, type LayerStyleEffect } from "@opengraph-creator/core";

export interface RasterEffectPlan {
  effects: LayerStyleEffect[];
  cacheKey: string;
  requiresPixelPass: boolean;
}

export function createRasterEffectPlan(effects: LayerEffects, contentHash: string): RasterEffectPlan {
  const stack = normalizeLayerStyleEffects(effects).filter((effect) => effect.enabled && effect.intensity > 0);
  return {
    effects: stack,
    cacheKey: `${contentHash}:${JSON.stringify(stack)}`,
    requiresPixelPass: stack.some((effect) => effect.kind === "ordered-dither" || effect.kind === "ascii")
  };
}

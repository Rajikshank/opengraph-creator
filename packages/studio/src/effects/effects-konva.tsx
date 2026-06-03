import { normalizeLayerStyleEffects, type LayerEffects, type LayerStyleEffect } from "@opengraph-creator/core";

export function getKonvaPreviewEffectStack(effects: LayerEffects): LayerStyleEffect[] {
  return normalizeLayerStyleEffects(effects).filter((effect) => effect.enabled && effect.intensity > 0);
}

export function getKonvaEffectCacheKey(effects: LayerEffects): string {
  return JSON.stringify(getKonvaPreviewEffectStack(effects));
}

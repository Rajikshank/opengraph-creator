import { getLayerStyleEffectDefinition, type LayerStyleEffectKind } from "@opengraph-creator/core";

export interface EffectThumbnailModel {
  kind: LayerStyleEffectKind;
  label: string;
  category: string;
  className: string;
}

export function getEffectThumbnailModel(kind: LayerStyleEffectKind): EffectThumbnailModel {
  const definition = getLayerStyleEffectDefinition(kind);
  return {
    kind,
    label: definition?.label ?? kind,
    category: definition?.category ?? "Stylize",
    className: `effect-card-${kind}`
  };
}

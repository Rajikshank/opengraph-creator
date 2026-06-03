import { createLayerStyleEffect, layerStyleEffectDefinitions, type LayerKind, type LayerStyleEffectKind } from "@opengraph-creator/core";

interface EffectGalleryProps {
  layerKind: LayerKind;
  onAdd: (kind: LayerStyleEffectKind) => void;
}

export function EffectGallery({ layerKind, onAdd }: EffectGalleryProps) {
  return (
    <div className="effect-gallery" aria-label="Effect gallery">
      {layerStyleEffectDefinitions.map((effect) => {
        const supported = effect.supportedLayers.includes(layerKind);
        return (
          <button
            type="button"
            key={effect.kind}
            className={`effect-card effect-card-${effect.kind}`}
            disabled={!supported}
            title={supported ? effect.description : `${effect.label} is not supported on ${layerKind} layers`}
            onClick={() => onAdd(effect.kind)}
          >
            <span className="effect-card-preview" aria-hidden="true">
              <span />
            </span>
            <span className="effect-card-copy">
              <strong>{effect.label}</strong>
              <small>{effect.category}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function createDefaultStudioEffect(kind: LayerStyleEffectKind) {
  return createLayerStyleEffect(kind, { id: `style-${kind}-${Date.now().toString(36)}` });
}

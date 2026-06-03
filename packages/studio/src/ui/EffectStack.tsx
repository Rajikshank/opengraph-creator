import { Copy, GripVertical, RotateCcw, Trash2 } from "lucide-react";
import {
  createLayerStyleEffect,
  getEffectNumberParam,
  getEffectStringParam,
  getLayerStyleEffectDefinition,
  layerStyleEffectDefinitions,
  type LayerStyleEffect,
  type LayerStyleEffectKind
} from "@opengraph-creator/core";
import { StudioSelect } from "../design-system/StudioSelect";
import { StudioSlider } from "../design-system/StudioSlider";
import { StudioSwitch } from "../design-system/StudioSwitch";

interface EffectStackProps {
  effects: LayerStyleEffect[];
  selectedEffectId?: string;
  onSelect: (id: string) => void;
  onChange: (effects: LayerStyleEffect[]) => void;
  onChangeTransient: (effects: LayerStyleEffect[], key: string) => void;
  onCommit: () => void;
}

export function EffectStack({ effects, selectedEffectId, onSelect, onChange, onChangeTransient, onCommit }: EffectStackProps) {
  const selected = effects.find((effect) => effect.id === selectedEffectId) ?? effects[0];

  if (!effects.length) {
    return <p className="effect-empty-state">Add an effect from the gallery to build a custom visual treatment.</p>;
  }

  const patchEffect = (id: string, patch: Partial<LayerStyleEffect>) => {
    onChange(effects.map((effect) => effect.id === id ? { ...effect, ...patch, params: patch.params ?? effect.params } : effect));
  };

  const patchEffectTransient = (id: string, patch: Partial<LayerStyleEffect>, key: string) => {
    onChangeTransient(effects.map((effect) => effect.id === id ? { ...effect, ...patch, params: patch.params ?? effect.params } : effect), key);
  };

  const move = (id: string, direction: -1 | 1) => {
    const index = effects.findIndex((effect) => effect.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= effects.length) return;
    const next = [...effects];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    onChange(next);
  };

  return (
    <div className="effect-stack">
      <div className="effect-stack-list" aria-label="Active effects">
        {effects.map((effect) => {
          const definition = getLayerStyleEffectDefinition(effect.kind);
          return (
            <button
              type="button"
              key={effect.id}
              className={`effect-stack-row ${effect.id === selected?.id ? "selected" : ""}`}
              onClick={() => onSelect(effect.id)}
            >
              <GripVertical size={13} />
              <span>
                <strong>{definition?.label ?? effect.kind}</strong>
                <small>{effect.enabled ? `${Math.round(effect.intensity * 100)}%` : "Disabled"}</small>
              </span>
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="effect-stack-inspector">
          <div className="effect-stack-toolbar">
            <StudioSwitch label="Enabled" checked={selected.enabled} onCheckedChange={(enabled) => patchEffect(selected.id, { enabled })} />
            <button type="button" title="Move effect up" onClick={() => move(selected.id, -1)}>Up</button>
            <button type="button" title="Move effect down" onClick={() => move(selected.id, 1)}>Down</button>
            <button type="button" title="Duplicate effect" onClick={() => onChange([...effects, { ...selected, id: `style-${selected.kind}-${Date.now().toString(36)}` }])}>
              <Copy size={13} />
            </button>
            <button type="button" title="Reset effect" onClick={() => patchEffect(selected.id, { ...createLayerStyleEffect(selected.kind, { id: selected.id }) })}>
              <RotateCcw size={13} />
            </button>
            <button type="button" title="Remove effect" onClick={() => onChange(effects.filter((effect) => effect.id !== selected.id))}>
              <Trash2 size={13} />
            </button>
          </div>
          <StudioSlider
            label="Intensity"
            min={0}
            max={1}
            step={0.02}
            value={selected.intensity}
            onValueChange={(intensity) => patchEffectTransient(selected.id, { intensity }, `${selected.id}:intensity`)}
            onValueCommit={onCommit}
          />
          <EffectParamEditor
            effect={selected}
            onPatch={(params) => patchEffect(selected.id, { params: { ...selected.params, ...params } })}
            onPatchTransient={(params, key) => patchEffectTransient(selected.id, { params: { ...selected.params, ...params } }, key)}
            onCommit={onCommit}
          />
        </div>
      ) : null}
    </div>
  );
}

function EffectParamEditor({
  effect,
  onPatch,
  onPatchTransient,
  onCommit
}: {
  effect: LayerStyleEffect;
  onPatch: (params: LayerStyleEffect["params"]) => void;
  onPatchTransient: (params: LayerStyleEffect["params"], key: string) => void;
  onCommit: () => void;
}) {
  const slider = (label: string, key: string, min: number, max: number, step: number, fallback: number) => (
    <StudioSlider
      label={label}
      min={min}
      max={max}
      step={step}
      value={getEffectNumberParam(effect, key, fallback, min, max)}
      onValueChange={(value) => onPatchTransient({ [key]: value }, `${effect.id}:${key}`)}
      onValueCommit={onCommit}
    />
  );
  const color = (label: string, key: string, fallback: string) => (
    <label className="studio-field color-text-control">
      <span>{label}</span>
      <span className="color-swatch-field precise-color-field">
        <span className="color-swatch-preview" style={{ background: getEffectStringParam(effect, key, fallback) }} aria-hidden="true" />
        <input type="color" value={getEffectStringParam(effect, key, fallback)} onChange={(event) => onPatch({ [key]: event.target.value })} />
      </span>
    </label>
  );

  if (effect.kind === "color-grade") {
    return <>{slider("Brightness", "brightness", -1, 1, 0.02, 0)}{slider("Contrast", "contrast", -0.8, 1.8, 0.02, 0.12)}{slider("Saturation", "saturation", -1, 2, 0.02, 0.06)}{slider("Warmth", "warmth", -1, 1, 0.02, 0.08)}{color("Tint", "tint", "#e6aa54")}</>;
  }
  if (effect.kind === "duotone") {
    return <>{color("Shadow", "shadow", "#12110f")}{color("Mid", "mid", "#8c6841")}{color("Highlight", "highlight", "#f5d189")}{slider("Contrast", "contrast", 0, 1, 0.02, 0.45)}</>;
  }
  if (effect.kind === "bloom") {
    return <>{slider("Threshold", "threshold", 0, 1, 0.02, 0.45)}{slider("Radius", "radius", 0, 120, 1, 28)}{color("Tint", "tint", "#f0b85d")}</>;
  }
  if (effect.kind === "rgb-split") {
    return <>{slider("Amount", "amount", 0, 80, 1, 6)}{slider("Angle", "angle", -180, 180, 1, 0)}</>;
  }
  if (effect.kind === "halftone") {
    return <>{slider("Scale", "scale", 6, 80, 1, 18)}{slider("Angle", "angle", -90, 90, 1, 28)}{slider("Contrast", "contrast", 0, 1, 0.02, 0.6)}{color("Ink", "ink", "#d8a24f")}</>;
  }
  if (effect.kind === "ordered-dither") {
    return <>{slider("Cell size", "cellSize", 3, 32, 1, 8)}{slider("Threshold", "threshold", 0, 1, 0.02, 0.45)}{color("Light", "light", "#f2c36f")}</>;
  }
  if (effect.kind === "ascii") {
    return <>{slider("Cell size", "cellSize", 10, 80, 1, 26)}{slider("Contrast", "contrast", 0, 1, 0.02, 0.7)}{color("Glyph color", "color", "#f0bd68")}</>;
  }
  return <>{slider("Amount", "amount", 0, 80, 1, 10)}{slider("Scale", "scale", 0.005, 0.15, 0.005, 0.025)}{slider("Softness", "softness", 0, 1, 0.02, 0.5)}{slider("Direction", "direction", -180, 180, 1, 35)}</>;
}

export const EFFECT_KIND_OPTIONS = layerStyleEffectDefinitions.map((effect) => ({
  value: effect.kind,
  label: effect.label
})) as Array<{ value: LayerStyleEffectKind; label: string }>;

export function EffectKindSelect({ value, onValueChange }: { value: LayerStyleEffectKind; onValueChange: (kind: LayerStyleEffectKind) => void }) {
  return <StudioSelect label="Effect" value={value} options={EFFECT_KIND_OPTIONS} onValueChange={onValueChange} />;
}

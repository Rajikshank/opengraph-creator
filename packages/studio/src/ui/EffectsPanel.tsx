import { Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";
import { getLayerEffectCapabilities, normalizeGlowEffect, normalizeLayerStyleEffects, type GlowEffect, type GradientEffect, type GradientStop, type LayerStyleEffect, type LightingEffect, type NoiseEffect } from "@opengraph-creator/core";
import { StudioField } from "../design-system/StudioField";
import { StudioSelect } from "../design-system/StudioSelect";
import { StudioSlider } from "../design-system/StudioSlider";
import { StudioSwitch } from "../design-system/StudioSwitch";
import { EffectGallery, createDefaultStudioEffect } from "./EffectGallery";
import { EffectStack } from "./EffectStack";
import { LightPositionPad } from "./LightPositionPad";
import { useStudio } from "./studio-store";

export function EffectsPanel() {
  const project = useStudio((state) => state.project);
  const selectedLayerId = useStudio((state) => state.selectedLayerId);
  const setLayerEffects = useStudio((state) => state.setLayerEffects);
  const setLayerEffectsTransient = useStudio((state) => state.setLayerEffectsTransient);
  const commitTransientHistory = useStudio((state) => state.commitTransientHistory);
  const [selectedEffectId, setSelectedEffectId] = useState<string | undefined>();
  const layer = project?.layers.find((item) => item.id === selectedLayerId);
  const effects = layer && "effects" in layer ? layer.effects : undefined;
  const stack = effects ? normalizeLayerStyleEffects(effects) : [];
  useEffect(() => {
    setSelectedEffectId((current) => current && stack.some((effect) => effect.id === current) ? current : stack[0]?.id);
  }, [layer?.id, stack.length]);
  if (!layer || !effects) return null;
  const capabilities = getLayerEffectCapabilities(layer.kind);
  const gradient = effects.gradient;
  const noise = effects.noise ?? { amount: 0, blendMode: "normal" };
  const glow = normalizeGlowEffect(effects.glow, project?.brand.accent ?? "#f6c36b");
  const updateGradientStop = (index: number, patch: Partial<GradientStop>) => {
    const nextGradient = ensureGradient(gradient);
    setLayerEffects(layer.id, {
      gradient: {
        ...nextGradient,
        stops: nextGradient.stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop)
      }
    });
  };
  const updateStack = (nextStack: LayerStyleEffect[]) => setLayerEffects(layer.id, { stack: nextStack });
  const updateStackTransient = (nextStack: LayerStyleEffect[], key: string) => setLayerEffectsTransient(layer.id, { stack: nextStack }, key);
  const lighting = normalizeLighting(effects.lighting);

  return (
    <section className="studio-section" data-selected-layer={layer.name}>
      <h2 className="section-heading">
        <Lightbulb size={15} />
        <span>Effects</span>
      </h2>
      <div className="effect-control-section effect-gallery-section">
        <h3>Effect Gallery</h3>
        <EffectGallery
          layerKind={layer.kind}
          onAdd={(kind) => {
            const next = createDefaultStudioEffect(kind);
            updateStack([...stack, next]);
            setSelectedEffectId(next.id);
          }}
        />
      </div>
      <div className="effect-control-section">
        <h3>Active Stack</h3>
        <EffectStack
          effects={stack}
          selectedEffectId={selectedEffectId}
          onSelect={setSelectedEffectId}
          onChange={updateStack}
          onChangeTransient={updateStackTransient}
          onCommit={commitTransientHistory}
        />
      </div>
      <div className="effect-control-grid">
        {capabilities.gradient === "supported" ? (
          <div className="effect-control-section">
            <h3>Fill</h3>
            <StudioSelect
              label="Gradient"
              value={effects.gradient?.type ?? "none"}
              options={[
                { value: "none", label: "None" },
                { value: "linear", label: "Linear" },
                { value: "radial", label: "Radial" }
              ]}
              onValueChange={(value) =>
                setLayerEffects(layer.id, {
                  gradient:
                    value === "none"
                      ? undefined
                      : {
                          type: value as "linear" | "radial",
                          angle: 35,
                          stops: [
                            { color: "#ffffff", position: 0, opacity: 1 },
                            { color: "#dfe9e5", position: 1, opacity: 0.92 }
                          ]
                        }
                })
              }
            />
            <div className="effect-two-column">
              <ColorSwatchField label="Stop A" value={gradient?.stops[0]?.color ?? "#ffffff"} disabled={!gradient} onChange={(value) => updateGradientStop(0, { color: value })} />
              <ColorSwatchField label="Stop B" value={gradient?.stops[1]?.color ?? "#dfe9e5"} disabled={!gradient} onChange={(value) => updateGradientStop(1, { color: value })} />
            </div>
            <StudioSlider label="Stop A opacity" min={0} max={1} step={0.05} value={gradient?.stops[0]?.opacity ?? 1} onValueChange={(value) => updateGradientStop(0, { opacity: value })} onValueCommit={commitTransientHistory} disabled={!gradient} />
            <StudioSlider label="Stop B opacity" min={0} max={1} step={0.05} value={gradient?.stops[1]?.opacity ?? 0.92} onValueChange={(value) => updateGradientStop(1, { opacity: value })} onValueCommit={commitTransientHistory} disabled={!gradient} />
          </div>
        ) : null}
        {capabilities.noise === "supported" ? (
          <div className="effect-control-section">
            <h3>Texture</h3>
            <StudioSlider label="Noise" min={0} max={0.2} step={0.01} value={noise.amount} onValueChange={(value) => setLayerEffectsTransient(layer.id, { noise: { ...noise, amount: value } }, `${layer.id}:noise`)} onValueCommit={commitTransientHistory} />
            <StudioSelect
              label="Blend mode"
              value={noise.blendMode === "soft-light" ? "normal" : noise.blendMode}
              options={[
                { value: "normal", label: "Normal" },
                { value: "multiply", label: "Multiply" },
                { value: "overlay", label: "Overlay" }
              ]}
              onValueChange={(value) => setLayerEffects(layer.id, { noise: { ...noise, blendMode: value as NoiseEffect["blendMode"] } })}
            />
          </div>
        ) : null}
        {capabilities.lighting === "supported" || capabilities.vignette === "supported" ? (
          <div className="effect-control-section">
            <h3>Light</h3>
            {capabilities.lighting === "supported" ? (
              <>
                <LightPositionPad
                  value={lighting}
                  onChange={(value) => setLayerEffectsTransient(layer.id, { lighting: value }, `${layer.id}:lightingPosition`)}
                  onCommit={commitTransientHistory}
                />
                <StudioSlider label="Lighting" min={0} max={1} step={0.05} value={lighting.intensity} onValueChange={(value) => setLayerEffectsTransient(layer.id, { lighting: { ...lighting, intensity: value } }, `${layer.id}:lighting`)} onValueCommit={commitTransientHistory} />
                <StudioSlider label="Radius" min={0.1} max={1.5} step={0.05} value={lighting.radius ?? 0.7} onValueChange={(value) => setLayerEffectsTransient(layer.id, { lighting: { ...lighting, radius: value } }, `${layer.id}:lightingRadius`)} onValueCommit={commitTransientHistory} />
                <StudioSlider label="Softness" min={0} max={1} step={0.05} value={lighting.softness ?? 0.65} onValueChange={(value) => setLayerEffectsTransient(layer.id, { lighting: { ...lighting, softness: value } }, `${layer.id}:lightingSoftness`)} onValueCommit={commitTransientHistory} />
                <ColorSwatchField label="Light color" value={lighting.color} onChange={(value) => setLayerEffects(layer.id, { lighting: { ...lighting, color: value } })} />
              </>
            ) : null}
            {capabilities.vignette === "supported" ? <StudioSlider label="Vignette" min={0} max={0.4} step={0.02} value={effects.vignette ?? 0} onValueChange={(value) => setLayerEffectsTransient(layer.id, { vignette: value }, `${layer.id}:vignette`)} onValueCommit={commitTransientHistory} /> : null}
          </div>
        ) : null}
        <div className="effect-control-section">
          <h3>Depth</h3>
          <StudioSlider label="Blur" min={0} max={14} step={1} value={effects.blur} unit="px" onValueChange={(value) => setLayerEffectsTransient(layer.id, { blur: value }, `${layer.id}:blur`)} onValueCommit={commitTransientHistory} />
          <StudioSwitch label="Shadow" checked={effects.shadow} onCheckedChange={(checked) => setLayerEffects(layer.id, { shadow: checked })} />
          <StudioSwitch label="Glow" checked={glow.enabled} onCheckedChange={(checked) => setLayerEffects(layer.id, { glow: { ...glow, enabled: checked } })} />
          <ColorSwatchField label="Glow color" value={glow.color ?? "#f6c36b"} onChange={(value) => setLayerEffects(layer.id, { glow: patchGlow(glow, { color: value, enabled: true }) })} />
          <StudioSlider label="Glow intensity" min={0} max={1} step={0.05} value={glow.intensity} onValueChange={(value) => setLayerEffectsTransient(layer.id, { glow: patchGlow(glow, { intensity: value, enabled: value > 0 }) }, `${layer.id}:glowIntensity`)} onValueCommit={commitTransientHistory} />
          <StudioSlider label="Glow radius" min={0} max={80} step={1} value={glow.radius} unit="px" onValueChange={(value) => setLayerEffectsTransient(layer.id, { glow: patchGlow(glow, { radius: value, enabled: value > 0 }) }, `${layer.id}:glowRadius`)} onValueCommit={commitTransientHistory} />
          <StudioSlider label="Glow spread" min={0} max={24} step={1} value={glow.spread ?? 0} unit="px" onValueChange={(value) => setLayerEffectsTransient(layer.id, { glow: patchGlow(glow, { spread: value, enabled: glow.enabled || value > 0 }) }, `${layer.id}:glowSpread`)} onValueCommit={commitTransientHistory} />
        </div>
      </div>
    </section>
  );
}

function normalizeLighting(lighting?: LightingEffect): LightingEffect {
  return {
    type: lighting?.type ?? "spotlight",
    x: lighting?.x ?? 0.55,
    y: lighting?.y ?? 0.35,
    intensity: lighting?.intensity ?? 0,
    color: lighting?.color ?? "#ffffff",
    radius: lighting?.radius ?? 0.7,
    softness: lighting?.softness ?? 0.65,
    falloff: lighting?.falloff ?? 0.5,
    blendMode: lighting?.blendMode ?? "screen",
    scope: lighting?.scope ?? "layer"
  };
}

function ColorSwatchField({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <StudioField label={label}>
      <span className="color-swatch-field">
        <span className="color-swatch-preview" style={{ background: value }} aria-hidden="true" />
        <input type="color" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </span>
    </StudioField>
  );
}

function patchGlow(glow: GlowEffect, patch: Partial<GlowEffect>): GlowEffect {
  return { ...glow, ...patch };
}

function ensureGradient(gradient?: GradientEffect): GradientEffect {
  return gradient ?? {
    type: "linear",
    angle: 35,
    stops: [
      { color: "#ffffff", position: 0, opacity: 1 },
      { color: "#dfe9e5", position: 1, opacity: 0.92 }
    ]
  };
}

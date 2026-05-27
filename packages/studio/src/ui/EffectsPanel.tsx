import { Lightbulb } from "lucide-react";
import { normalizeGlowEffect, type GlowEffect, type GradientEffect, type GradientStop, type NoiseEffect } from "@graphforge/core";
import { StudioSlider } from "../design-system/StudioSlider";
import { useStudio } from "./studio-store";

export function EffectsPanel() {
  const project = useStudio((state) => state.project);
  const selectedLayerId = useStudio((state) => state.selectedLayerId);
  const setLayerEffects = useStudio((state) => state.setLayerEffects);
  const layer = project?.layers.find((item) => item.id === selectedLayerId);
  const effects = layer && "effects" in layer ? layer.effects : undefined;
  if (!layer || !effects) return null;
  const gradient = effects.gradient;
  const noise = effects.noise ?? { amount: 0, blendMode: "soft-light" };
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

  return (
    <section className="studio-section" data-selected-layer={layer.name}>
      <h2 className="section-heading">
        <Lightbulb size={15} />
        <span>Effects</span>
      </h2>
      <div className="effect-control-grid">
        <label>
          Gradient
          <select
            value={effects.gradient?.type ?? "none"}
            onChange={(event) =>
              setLayerEffects(layer.id, {
                gradient:
                  event.target.value === "none"
                    ? undefined
                    : {
                        type: event.target.value as "linear" | "radial",
                        angle: 35,
                        stops: [
                          { color: "#ffffff", position: 0, opacity: 1 },
                          { color: "#dfe9e5", position: 1, opacity: 0.92 }
                        ]
                      }
              })
            }
          >
            <option value="none">None</option>
            <option value="linear">Linear</option>
            <option value="radial">Radial</option>
          </select>
        </label>
        <label>Stop A<input type="color" value={gradient?.stops[0]?.color ?? "#ffffff"} onChange={(event) => updateGradientStop(0, { color: event.target.value })} disabled={!gradient} /></label>
        <label>Stop B<input type="color" value={gradient?.stops[1]?.color ?? "#dfe9e5"} onChange={(event) => updateGradientStop(1, { color: event.target.value })} disabled={!gradient} /></label>
        <StudioSlider label="Stop A opacity" min={0} max={1} step={0.05} value={gradient?.stops[0]?.opacity ?? 1} onValueChange={(value) => updateGradientStop(0, { opacity: value })} disabled={!gradient} />
        <StudioSlider label="Stop B opacity" min={0} max={1} step={0.05} value={gradient?.stops[1]?.opacity ?? 0.92} onValueChange={(value) => updateGradientStop(1, { opacity: value })} disabled={!gradient} />
        <StudioSlider label="Noise" min={0} max={0.2} step={0.01} value={noise.amount} onValueChange={(value) => setLayerEffects(layer.id, { noise: { ...noise, amount: value } })} />
        <label>Blend mode<select value={noise.blendMode} onChange={(event) => setLayerEffects(layer.id, { noise: { ...noise, blendMode: event.target.value as NoiseEffect["blendMode"] } })}><option value="normal">Normal</option><option value="multiply">Multiply</option><option value="overlay">Overlay</option><option value="soft-light">Soft light</option></select></label>
        <StudioSlider label="Lighting" min={0} max={1} step={0.05} value={effects.lighting?.intensity ?? 0} onValueChange={(value) => setLayerEffects(layer.id, { lighting: { type: "spotlight", x: 0.55, y: 0.35, intensity: value, color: "#ffffff" } })} />
        <StudioSlider label="Vignette" min={0} max={0.4} step={0.02} value={effects.vignette ?? 0} onValueChange={(value) => setLayerEffects(layer.id, { vignette: value })} />
        <StudioSlider label="Blur" min={0} max={14} step={1} value={effects.blur} unit="px" onValueChange={(value) => setLayerEffects(layer.id, { blur: value })} />
        <label>Shadow<input type="checkbox" checked={effects.shadow} onChange={(event) => setLayerEffects(layer.id, { shadow: event.target.checked })} /></label>
        <label>Glow<input type="checkbox" checked={glow.enabled} onChange={(event) => setLayerEffects(layer.id, { glow: { ...glow, enabled: event.target.checked } })} /></label>
        <label>Glow color<input type="color" value={glow.color ?? "#f6c36b"} onChange={(event) => setLayerEffects(layer.id, { glow: patchGlow(glow, { color: event.target.value, enabled: true }) })} /></label>
        <StudioSlider label="Glow intensity" min={0} max={1} step={0.05} value={glow.intensity} onValueChange={(value) => setLayerEffects(layer.id, { glow: patchGlow(glow, { intensity: value, enabled: value > 0 }) })} />
        <StudioSlider label="Glow radius" min={0} max={80} step={1} value={glow.radius} unit="px" onValueChange={(value) => setLayerEffects(layer.id, { glow: patchGlow(glow, { radius: value, enabled: value > 0 }) })} />
        <StudioSlider label="Glow spread" min={0} max={24} step={1} value={glow.spread ?? 0} unit="px" onValueChange={(value) => setLayerEffects(layer.id, { glow: patchGlow(glow, { spread: value, enabled: glow.enabled || value > 0 }) })} />
      </div>
    </section>
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

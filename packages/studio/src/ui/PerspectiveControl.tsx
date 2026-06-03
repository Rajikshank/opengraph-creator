import type { ImageLayer } from "@opengraph-creator/core";
import { StudioSlider } from "../design-system/StudioSlider";

type PerspectiveQuad = NonNullable<ImageLayer["perspective"]>;

interface PerspectiveControlProps {
  perspective: PerspectiveQuad;
  onChange: (perspective: PerspectiveQuad) => void;
  onCommit?: () => void;
}

export function PerspectiveControl({ perspective, onChange, onCommit }: PerspectiveControlProps) {
  const setPoint = (index: number, x: number, y: number) => {
    onChange(perspective.map((point, pointIndex) => pointIndex === index ? { x: clamp01(x), y: clamp01(y) } : point) as PerspectiveQuad);
  };
  const setPreset = (preset: "reset" | "subtle" | "editorial" | "product" | "dramatic") => {
    onChange(getPerspectivePreset(preset));
    onCommit?.();
  };
  const rotate = (axis: "yaw" | "pitch" | "roll", amount: number) => {
    onChange(createPerspectiveFromRotation(axis, amount));
  };

  return (
    <section className="perspective-control" aria-label="Perspective">
      <div className="perspective-actions">
        <button type="button" onClick={() => setPreset("reset")}>Reset</button>
        <button type="button" onClick={() => setPreset("subtle")}>Subtle</button>
        <button type="button" onClick={() => setPreset("editorial")}>Editorial tilt</button>
        <button type="button" onClick={() => setPreset("product")}>Product angle</button>
        <button type="button" onClick={() => setPreset("dramatic")}>Dramatic</button>
      </div>
      <div className="perspective-pad" aria-label="Corner pin editor">
        <svg viewBox="0 0 100 52.5" role="img" aria-label="Perspective corner pin preview">
          <polygon points={perspective.map((point) => `${point.x * 100},${point.y * 52.5}`).join(" ")} />
        </svg>
        {perspective.map((point, index) => (
          <button
            type="button"
            key={index}
            className="perspective-point"
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            aria-label={`Move ${["top left", "top right", "bottom right", "bottom left"][index]} perspective point`}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (event.buttons !== 1) return;
              const rect = event.currentTarget.parentElement?.getBoundingClientRect();
              if (!rect) return;
              setPoint(index, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
            }}
            onPointerUp={onCommit}
          />
        ))}
      </div>
      <div className="perspective-rotation-grid">
        <StudioSlider label="Yaw" min={-1} max={1} step={0.02} value={0} onValueChange={(value) => rotate("yaw", value)} onValueCommit={onCommit} />
        <StudioSlider label="Pitch" min={-1} max={1} step={0.02} value={0} onValueChange={(value) => rotate("pitch", value)} onValueCommit={onCommit} />
        <StudioSlider label="Roll" min={-1} max={1} step={0.02} value={0} onValueChange={(value) => rotate("roll", value)} onValueCommit={onCommit} />
      </div>
      <div className="perspective-grid">
        {perspective.map((point, index) => (
          <fieldset key={index}>
            <legend>{["TL", "TR", "BR", "BL"][index]}</legend>
            <input type="number" min="0" max="1" step="0.05" value={point.x} onChange={(event) => setPoint(index, Number(event.target.value), point.y)} />
            <input type="number" min="0" max="1" step="0.05" value={point.y} onChange={(event) => setPoint(index, point.x, Number(event.target.value))} />
          </fieldset>
        ))}
      </div>
    </section>
  );
}

function getPerspectivePreset(preset: "reset" | "subtle" | "editorial" | "product" | "dramatic"): PerspectiveQuad {
  const presets = {
    reset: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ],
    subtle: [
      { x: 0.04, y: 0.02 },
      { x: 0.96, y: 0.08 },
      { x: 1, y: 0.96 },
      { x: 0, y: 1 }
    ],
    editorial: [
      { x: 0.1, y: 0.03 },
      { x: 0.95, y: 0.14 },
      { x: 0.98, y: 0.92 },
      { x: 0.02, y: 0.98 }
    ],
    product: [
      { x: 0.16, y: 0.08 },
      { x: 0.92, y: 0.02 },
      { x: 1, y: 0.86 },
      { x: 0.08, y: 1 }
    ],
    dramatic: [
      { x: 0.18, y: 0.02 },
      { x: 0.88, y: 0.22 },
      { x: 1, y: 0.82 },
      { x: 0.04, y: 1 }
    ]
  } satisfies Record<string, PerspectiveQuad>;
  return presets[preset];
}

function createPerspectiveFromRotation(axis: "yaw" | "pitch" | "roll", amount: number): PerspectiveQuad {
  const clamped = Math.max(-1, Math.min(1, amount));
  if (axis === "yaw") {
    return [
      { x: 0.08 + Math.max(0, clamped) * 0.14, y: 0.04 },
      { x: 0.96 + Math.min(0, clamped) * 0.14, y: 0.1 },
      { x: 1 + Math.min(0, clamped) * 0.08, y: 0.92 },
      { x: 0 + Math.max(0, clamped) * 0.08, y: 1 }
    ];
  }
  if (axis === "pitch") {
    return [
      { x: 0.06, y: 0.04 + Math.max(0, clamped) * 0.16 },
      { x: 0.94, y: 0.04 + Math.max(0, clamped) * 0.16 },
      { x: 1, y: 0.94 + Math.min(0, clamped) * 0.16 },
      { x: 0, y: 0.94 + Math.min(0, clamped) * 0.16 }
    ];
  }
  return [
    { x: 0.06 + clamped * 0.05, y: 0.04 - clamped * 0.05 },
    { x: 0.94 + clamped * 0.05, y: 0.06 + clamped * 0.05 },
    { x: 0.96 - clamped * 0.05, y: 0.96 + clamped * 0.05 },
    { x: 0.04 - clamped * 0.05, y: 0.94 - clamped * 0.05 }
  ];
}

function clamp01(value: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);
}

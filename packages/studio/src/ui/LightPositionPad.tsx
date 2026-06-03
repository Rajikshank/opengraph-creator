import type { LightingEffect } from "@opengraph-creator/core";

interface LightPositionPadProps {
  value: LightingEffect;
  onChange: (value: LightingEffect) => void;
  onCommit?: () => void;
}

export function LightPositionPad({ value, onChange, onCommit }: LightPositionPadProps) {
  const updateFromPointer = (clientX: number, clientY: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    onChange({
      ...value,
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height)
    });
  };

  return (
    <div className="light-position-pad-field">
      <span className="pad-label">Light position</span>
      <button
        type="button"
        className="light-position-pad"
        aria-label="Set light position"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event.clientX, event.clientY, event.currentTarget);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          updateFromPointer(event.clientX, event.clientY, event.currentTarget);
        }}
        onPointerUp={onCommit}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.05 : 0.01;
          const next = { ...value };
          if (event.key === "ArrowLeft") next.x = clamp01(value.x - step);
          else if (event.key === "ArrowRight") next.x = clamp01(value.x + step);
          else if (event.key === "ArrowUp") next.y = clamp01(value.y - step);
          else if (event.key === "ArrowDown") next.y = clamp01(value.y + step);
          else return;
          event.preventDefault();
          onChange(next);
          onCommit?.();
        }}
      >
        <span className="light-position-grid" aria-hidden="true" />
        <span className="light-position-glow" style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%`, background: value.color }} aria-hidden="true" />
      </button>
      <span className="pad-meta">{Math.round(value.x * 100)}%, {Math.round(value.y * 100)}%</span>
    </div>
  );
}

function clamp01(value: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);
}

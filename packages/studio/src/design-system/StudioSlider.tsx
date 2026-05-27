import type { CSSProperties, InputHTMLAttributes } from "react";

interface StudioSliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onValueChange: (value: number) => void;
}

export function StudioSlider({ label, value, min, max, step = 1, unit = "", onValueChange, disabled, ...props }: StudioSliderProps) {
  const safeMax = max === min ? min + 1 : max;
  const progress = Math.min(100, Math.max(0, ((value - min) / (safeMax - min)) * 100));
  const displayValue = Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, "");

  return (
    <label className="studio-slider">
      <span className="slider-label">
        <span>{label}</span>
        <output aria-hidden="true">{displayValue}{unit}</output>
      </span>
      <span className="slider-shell" style={{ "--slider-thumb": `${progress}%` } as CSSProperties}>
        <span className="slider-progress" style={{ width: `${progress}%` }} />
        <input
          {...props}
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onValueChange(Number(event.target.value))}
        />
      </span>
    </label>
  );
}

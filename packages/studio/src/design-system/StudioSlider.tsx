import { useEffect, useRef, type CSSProperties, type FormEvent, type InputHTMLAttributes, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

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
  const lastEmittedValueRef = useRef(value);
  const shellRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const safeMax = max === min ? min + 1 : max;
  const progress = Math.min(100, Math.max(0, ((value - min) / (safeMax - min)) * 100));
  const displayValue = Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, "");
  useEffect(() => {
    lastEmittedValueRef.current = value;
  }, [value]);

  const emitSliderValue = (nextValue: number) => {
    if (Number.isNaN(nextValue) || nextValue === lastEmittedValueRef.current) return;
    lastEmittedValueRef.current = nextValue;
    onValueChange(nextValue);
  };

  const handleSliderChange = (event: FormEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>) => {
    emitSliderValue(Number(event.currentTarget.value));
  };

  const commitValueFromClientX = (clientX: number) => {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const percent = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const rawValue = min + percent * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    const precision = getStepPrecision(step);
    emitSliderValue(Number(Math.min(max, Math.max(min, steppedValue)).toFixed(precision)));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (disabled) return;
    event.preventDefault();
    inputRef.current?.focus();
    commitValueFromClientX(event.clientX);
    const handlePointerMove = (moveEvent: PointerEvent) => commitValueFromClientX(moveEvent.clientX);
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  };

  return (
    <label className="studio-slider">
      <span className="slider-label">
        <span>{label}</span>
        <output aria-hidden="true">{displayValue}{unit}</output>
      </span>
      <span ref={shellRef} className="slider-shell" style={{ "--slider-thumb": `${progress}%` } as CSSProperties} onPointerDown={handlePointerDown}>
        <span className="slider-progress" style={{ width: `${progress}%` }} />
        <input
          {...props}
          ref={inputRef}
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onInput={handleSliderChange}
          onChange={handleSliderChange}
          onKeyUp={handleSliderChange}
        />
      </span>
    </label>
  );
}

function getStepPrecision(step: number): number {
  const [, decimals = ""] = step.toString().split(".");
  return decimals.length;
}

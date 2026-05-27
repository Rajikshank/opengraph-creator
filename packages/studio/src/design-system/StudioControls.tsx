import type { ReactNode } from "react";

export interface StudioSegment<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface StudioSegmentedControlProps<T extends string> {
  label: string;
  value: T;
  segments: Array<StudioSegment<T>>;
  onValueChange: (value: T) => void;
  className?: string;
}

export function StudioSegmentedControl<T extends string>({
  label,
  value,
  segments,
  onValueChange,
  className = ""
}: StudioSegmentedControlProps<T>) {
  return (
    <div className={`studio-segmented-control ${className}`} role="radiogroup" aria-label={label}>
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          role="radio"
          aria-checked={value === segment.value}
          className={value === segment.value ? "active" : ""}
          onClick={() => onValueChange(segment.value)}
          value={segment.value}
        >
          {segment.icon}
          <span>{segment.label}</span>
        </button>
      ))}
    </div>
  );
}

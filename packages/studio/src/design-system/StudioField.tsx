import type { ReactNode } from "react";

export function StudioField({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {children}
      {help ? <small>{help}</small> : null}
    </label>
  );
}

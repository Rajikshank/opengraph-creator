import * as SwitchPrimitive from "@radix-ui/react-switch";

interface StudioSwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function StudioSwitch({ label, checked, onCheckedChange, disabled }: StudioSwitchProps) {
  return (
    <label className="studio-switch">
      <span>{label}</span>
      <SwitchPrimitive.Root className="studio-switch-root" checked={checked} onCheckedChange={onCheckedChange} disabled={disabled}>
        <SwitchPrimitive.Thumb className="studio-switch-thumb" />
      </SwitchPrimitive.Root>
    </label>
  );
}

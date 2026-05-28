import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export interface StudioSelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface StudioSelectProps<T extends string> {
  label: string;
  value: T;
  options: Array<StudioSelectOption<T>>;
  onValueChange: (value: T) => void;
  disabled?: boolean;
}

export function StudioSelect<T extends string>({ label, value, options, onValueChange, disabled }: StudioSelectProps<T>) {
  return (
    <label className="studio-field studio-select-field">
      <span>{label}</span>
      <SelectPrimitive.Root value={value} onValueChange={(next) => onValueChange(next as T)} disabled={disabled}>
        <SelectPrimitive.Trigger className="studio-select-trigger" aria-label={label}>
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon>
            <ChevronDown size={14} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="studio-select-content" position="popper" sideOffset={5}>
            <SelectPrimitive.Viewport>
              {options.map((option) => (
                <SelectPrimitive.Item key={option.value} value={option.value} disabled={option.disabled} className="studio-select-item">
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check size={13} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </label>
  );
}

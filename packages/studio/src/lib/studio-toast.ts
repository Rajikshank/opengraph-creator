import { toast } from "sonner";
import type { StudioErrorInfo } from "./studio-errors";

const recentToastKeys = new Map<string, number>();
const dedupeMs = 1800;

export function notifyStudioSuccess(message: string, description?: string): void {
  toast.success(message, { description });
}

export function notifyStudioWarning(title: string, description?: string): void {
  toast.warning(title, { description });
}

export function notifyStudioError(info: StudioErrorInfo): void {
  const key = `${info.kind}:${info.title}:${info.message}`;
  const now = Date.now();
  const lastShownAt = recentToastKeys.get(key) ?? 0;
  if (now - lastShownAt < dedupeMs) return;
  recentToastKeys.set(key, now);

  toast.error(info.title, {
    description: `${info.message} ${info.recovery}`,
    action:
      typeof navigator !== "undefined" && navigator.clipboard
        ? {
            label: "Copy details",
            onClick: () => {
              void navigator.clipboard.writeText(info.technical);
            }
          }
        : undefined
  });
}

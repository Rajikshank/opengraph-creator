import * as ScrollArea from "@radix-ui/react-scroll-area";
import type { ReactNode } from "react";

export function StudioScrollArea({
  children,
  className = "",
  viewportClassName = "",
  orientation = "vertical",
  type = "auto"
}: {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  orientation?: "vertical" | "horizontal" | "both";
  type?: "auto" | "always" | "scroll" | "hover";
}) {
  return (
    <ScrollArea.Root className={`studio-scroll-area ${className}`.trim()} type={type}>
      <ScrollArea.Viewport className={`studio-scroll-viewport ${viewportClassName}`.trim()}>{children}</ScrollArea.Viewport>
      {(orientation === "vertical" || orientation === "both") && (
        <ScrollArea.Scrollbar className="studio-scrollbar studio-scrollbar-vertical" orientation="vertical">
          <ScrollArea.Thumb className="studio-scroll-thumb" />
        </ScrollArea.Scrollbar>
      )}
      {(orientation === "horizontal" || orientation === "both") && (
        <ScrollArea.Scrollbar className="studio-scrollbar studio-scrollbar-horizontal" orientation="horizontal">
          <ScrollArea.Thumb className="studio-scroll-thumb" />
        </ScrollArea.Scrollbar>
      )}
      <ScrollArea.Corner className="studio-scroll-corner" />
    </ScrollArea.Root>
  );
}

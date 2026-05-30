import { useEffect, useRef } from "react";
import { CheckCircle2, CircleDot, Clock3, FileOutput, Layers3, Route } from "lucide-react";
import type { OgPageStatus, OgProject } from "@opengraph-creator/core";
import { StudioScrollArea } from "../design-system/StudioScrollArea";

const pageStatusCopy: Record<OgPageStatus, { label: string; icon: typeof CircleDot }> = {
  draft: { label: "Draft", icon: CircleDot },
  edited: { label: "Edited", icon: Clock3 },
  exported: { label: "Exported", icon: FileOutput },
  "publish-preview": { label: "Previewed", icon: FileOutput },
  confirmed: { label: "Confirmed", icon: CheckCircle2 }
};

export function PageVariantNavigator({
  project,
  onSelectPage,
  onApplyStyleToAll
}: {
  project: OgProject;
  onSelectPage: (pageIdOrRoute: string) => void;
  onApplyStyleToAll: () => void;
}) {
  const pages = project.pages ?? [];
  const activePage = pages.find((page) => page.id === project.activePageId) ?? pages[0];
  const activeCardRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ block: "nearest" });
  }, [activePage?.id]);

  if (!pages.length || !activePage) return null;

  return (
    <section className="page-variant-navigator" aria-label="OG Pages">
      <header className="page-variant-header">
        <div>
          <h3 className="section-heading">
            <Layers3 size={14} />
            <span>OG Pages</span>
          </h3>
          <p>{pages.length} variants share one visual system</p>
        </div>
        <span className="page-variant-count">{pages.length}</span>
      </header>
      <div className="page-variant-active">
        <span>Editing</span>
        <strong>{activePage.route}</strong>
      </div>
      <StudioScrollArea className="page-variant-scroll" viewportClassName="page-variant-list">
        {pages.map((page, index) => {
          const status = pageStatusCopy[page.status] ?? pageStatusCopy.draft;
          const StatusIcon = status.icon;
          const active = page.id === project.activePageId;
          return (
            <button
              key={page.id}
              ref={active ? activeCardRef : undefined}
              type="button"
              className={`page-variant-card ${active ? "active" : ""}`}
              onClick={() => onSelectPage(page.id)}
              aria-current={active ? "page" : undefined}
            >
              <span className="page-variant-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="page-variant-content">
                <span className="page-variant-title-row">
                  <span className="page-variant-route">
                    <Route size={12} />
                    {page.route}
                  </span>
                  <span className={`page-variant-status ${page.status}`}>
                    <StatusIcon size={12} />
                    {status.label}
                  </span>
                </span>
                <strong>{page.title || page.sourceContext?.detectedTitle || "Untitled page"}</strong>
                <span className="page-variant-meta-row">
                  <small>{page.exportPath ?? page.sourceContext?.routeFile ?? "Export path pending"}</small>
                </span>
              </span>
            </button>
          );
        })}
      </StudioScrollArea>
      <button type="button" className="secondary-action page-variant-apply" onClick={onApplyStyleToAll}>
        Apply style to all
      </button>
    </section>
  );
}

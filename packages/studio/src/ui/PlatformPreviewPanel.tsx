import { useEffect, useMemo, useState } from "react";
import { getPlatformWarnings } from "@opengraph-creator/core";
import { renderProjectToSvg } from "@opengraph-creator/render/browser";
import { getPlatformPreviewCards, getPlatformPreviewSpecs, type PlatformPreviewCard, type PlatformPreviewSpec } from "../platforms";
import { PlatformIcon, PlatformTabs } from "./platform-preview/PlatformTabs";
import { PreviewFrame } from "./platform-preview/PreviewFrame";
import { useStudio } from "./studio-store";

export function PreviewDock({ variant = "dock" }: { variant?: "dock" | "stage" }) {
  const project = useStudio((state) => state.project);
  const lastExportSizeBytes = useStudio((state) => state.lastExportSizeBytes);
  const [activeId, setActiveId] = useState("x");
  const [svg, setSvg] = useState("");
  const specs = useMemo(() => getPlatformPreviewSpecs(), []);

  useEffect(() => {
    if (!project) {
      setSvg("");
      return;
    }
    let cancelled = false;
    const render = () => {
      if (!cancelled) setSvg(renderProjectToSvg(project));
    };
    if (!svg) {
      render();
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setTimeout(render, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [project, svg]);

  if (!project) return null;

  const cards = getPlatformPreviewCards(project);
  const active = cards.find((card) => card.id === activeId) ?? cards[0];
  const activeSpec = specs.find((spec) => spec.id === active.id) ?? specs[0];
  const warnings = getPlatformWarnings(project, { fileSizeBytes: lastExportSizeBytes ?? 0 });

  return (
    <section className={`preview-dock studio-panel ${variant === "stage" ? "platform-stage" : ""}`}>
      <header className="preview-dock-header">
        <div>
          <span>Platform preview</span>
          <strong>{active.title}</strong>
        </div>
        <PlatformMeta card={active} spec={activeSpec} />
      </header>
      <div className={`platform-preview-shell platform-preview-${activeSpec.surface}`}>
        <PlatformTabs cards={cards} activeId={active.id} onSelect={setActiveId} />
        <div className="platform-preview-viewport">
          <div className="platform-preview-body">
            <PreviewFrame card={active} spec={activeSpec} projectName={project.name} svg={svg} />
          </div>
        </div>
      </div>
      <div className="platform-insight-row">
        <p className="preview-hint">{active.cropHint}</p>
        <small className={warnings.length ? "preview-warning" : "preview-ok"}>
          {warnings.length ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : "No crop warnings"}
        </small>
      </div>
      <p className="platform-source-note">{activeSpec.sourceNote}</p>
    </section>
  );
}

function PlatformMeta({ card, spec }: { card: PlatformPreviewCard; spec: PlatformPreviewSpec }) {
  return (
    <div className="platform-meta">
      <PlatformIcon card={card} />
      <div>
        <strong>
          {card.previewSize.width}x{card.previewSize.height}
        </strong>
        <span>{spec.imageAspect}</span>
      </div>
    </div>
  );
}

export function PlatformPreviewPanel() {
  return <PreviewDock />;
}

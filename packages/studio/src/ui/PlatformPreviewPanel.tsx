import { useMemo, useState } from "react";
import { Facebook, Globe, Linkedin, MessageCircle, MessagesSquare, Slack, Twitter } from "lucide-react";
import { getPlatformWarnings } from "@graphforge/core";
import { renderProjectToSvg } from "@graphforge/render/browser";
import { getPlatformPreviewCards, type PlatformPreviewCard } from "../platforms";
import { useStudio } from "./studio-store";

export function PreviewDock({ variant = "dock" }: { variant?: "dock" | "stage" }) {
  const project = useStudio((state) => state.project);
  const lastExportSizeBytes = useStudio((state) => state.lastExportSizeBytes);
  const [activeId, setActiveId] = useState("x");
  const svg = useMemo(() => (project ? renderProjectToSvg(project) : ""), [project]);
  if (!project) return null;
  const cards = getPlatformPreviewCards(project);
  const active = cards.find((card) => card.id === activeId) ?? cards[0];
  const warnings = getPlatformWarnings(project, { fileSizeBytes: lastExportSizeBytes ?? 0 });

  return (
    <section className={`preview-dock studio-panel ${variant === "stage" ? "platform-stage" : ""}`}>
      <header className="preview-dock-header">
        <div>
          <span>Platform preview</span>
          <strong>{active.title}</strong>
        </div>
        <PlatformMeta card={active} />
      </header>
      <div className="platform-preview-body">
        <ActivePlatformPreview card={active} projectName={project.name} svg={svg} />
      </div>
      <div className="platform-insight-row">
        <p className="preview-hint">{active.cropHint}</p>
        <small className={warnings.length ? "preview-warning" : "preview-ok"}>
          {warnings.length ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : "No crop warnings"}
        </small>
      </div>
      <div className="platform-switcher" role="tablist" aria-label="Preview platform">
        {cards.map((card) => (
          <button
            type="button"
            key={card.id}
            role="tab"
            aria-selected={active.id === card.id}
            className={active.id === card.id ? "active" : ""}
            onClick={() => setActiveId(card.id)}
          >
            <PlatformIcon card={card} />
            <span>{card.title}</span>
            <small>{card.aspectLabel}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function ActivePlatformPreview({ card, projectName, svg }: { card: PlatformPreviewCard; projectName: string; svg: string }) {
  const image = (
    <div className="platform-preview-image-slot">
      <div className="preview-image-large" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );

  if (card.id === "discord" || card.id === "slack") {
    return (
      <div className={`platform-frame ${card.chrome} ${card.id}`}>
        <div className="platform-frame-shell">
          <div className="chat-author">
            <span className="chat-avatar"><PlatformIcon card={card} /></span>
            <div>
              <strong>{card.id === "discord" ? "Ogloom Bot" : "ogloom.local"}</strong>
              <span>{card.id === "discord" ? "Today at 10:24 AM" : "App unfurl preview"}</span>
            </div>
          </div>
          <div className="chat-embed">
            <div className="embed-rule" />
            <div className="embed-body">
              <strong>{projectName}</strong>
              <span>{card.description}</span>
              {image}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (card.id === "whatsapp" || card.id === "imessage") {
    return (
      <div className={`platform-frame ${card.chrome} ${card.id}`}>
        <div className="platform-frame-shell mobile-shell">
          <div className="mobile-statusbar">
            <span>{card.id === "whatsapp" ? "WhatsApp" : "Messages"}</span>
            <small>10:24</small>
          </div>
          <div className="message-bubble">
            {image}
            <div className="message-meta">
              <strong>{projectName}</strong>
              <span>ogloom.local</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (card.id === "browser") {
    return (
      <div className={`platform-frame ${card.chrome} ${card.id}`}>
        <div className="platform-frame-shell browser-shell">
          <div className="browser-bar">
            <span />
            <span />
            <span />
            <strong>ogloom.local</strong>
          </div>
          <div className="browser-result">
            {image}
            <strong>{projectName}</strong>
            <span>{card.description}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`platform-frame ${card.chrome} ${card.id}`}>
      <div className="platform-frame-shell feed-shell">
        <div className="feed-header">
          <span className="feed-avatar"><PlatformIcon card={card} /></span>
          <div>
            <strong>{card.title}</strong>
            <span>{card.id === "linkedin" ? "Professional feed card" : card.id === "facebook" ? "News feed share" : "Large summary card"}</span>
          </div>
        </div>
        {image}
        <div className="feed-meta">
          <span>ogloom.local</span>
          <strong>{projectName}</strong>
        </div>
      </div>
    </div>
  );
}

function PlatformMeta({ card }: { card: PlatformPreviewCard }) {
  return (
    <div className="platform-meta">
      <PlatformIcon card={card} />
      <div>
        <strong>{card.previewSize.width}x{card.previewSize.height}</strong>
        <span>{card.aspectLabel}</span>
      </div>
    </div>
  );
}

export function PlatformPreviewPanel() {
  return <PreviewDock />;
}

function PlatformIcon({ card }: { card: PlatformPreviewCard }) {
  const size = 14;
  if (card.icon === "twitter") return <Twitter size={size} />;
  if (card.icon === "linkedin") return <Linkedin size={size} />;
  if (card.icon === "facebook") return <Facebook size={size} />;
  if (card.icon === "slack") return <Slack size={size} />;
  if (card.icon === "message-circle") return <MessageCircle size={size} />;
  if (card.icon === "messages-square") return <MessagesSquare size={size} />;
  return <Globe size={size} />;
}

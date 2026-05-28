import { Facebook, Globe, Linkedin, MessageCircle, MessagesSquare, Slack, Twitter } from "lucide-react";
import type { PlatformPreviewCard } from "../../platforms";

export function PlatformTabs({
  cards,
  activeId,
  onSelect
}: {
  cards: PlatformPreviewCard[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="platform-tab-list platform-switcher" role="tablist" aria-label="Preview platform">
      {cards.map((card) => (
        <button
          type="button"
          key={card.id}
          role="tab"
          aria-selected={activeId === card.id}
          className={activeId === card.id ? "active" : ""}
          onClick={() => onSelect(card.id)}
          title={`${card.title} preview`}
        >
          <PlatformIcon card={card} />
          <span>{getPlatformShortLabel(card)}</span>
          <small>{card.aspectLabel}</small>
        </button>
      ))}
    </div>
  );
}

export function PlatformIcon({ card }: { card: PlatformPreviewCard }) {
  const size = 14;
  if (card.icon === "twitter") return <Twitter size={size} />;
  if (card.icon === "linkedin") return <Linkedin size={size} />;
  if (card.icon === "facebook") return <Facebook size={size} />;
  if (card.icon === "slack") return <Slack size={size} />;
  if (card.icon === "message-circle") return <MessageCircle size={size} />;
  if (card.icon === "messages-square" || card.icon === "discord") return <MessagesSquare size={size} />;
  return <Globe size={size} />;
}

function getPlatformShortLabel(card: PlatformPreviewCard): string {
  if (card.id === "x") return "X";
  if (card.id === "linkedin") return "LinkedIn";
  if (card.id === "facebook") return "Facebook";
  if (card.id === "whatsapp") return "WhatsApp";
  if (card.id === "imessage") return "iMessage";
  if (card.id === "browser") return "Browser";
  return card.title;
}

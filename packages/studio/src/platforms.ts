import type { OgProject } from "@opengraph-creator/core";

export interface PlatformPreviewCard {
  id: PlatformPreviewId;
  title: string;
  chrome: "social" | "chat" | "browser";
  frameKind: "feed" | "chat" | "whatsapp" | "imessage" | "browser";
  icon: "twitter" | "linkedin" | "facebook" | "discord" | "slack" | "message-circle" | "messages-square" | "globe";
  aspectLabel: string;
  previewSize: { width: number; height: number };
  description: string;
  cropHint: string;
}

export type PlatformPreviewId = "x" | "linkedin" | "facebook" | "discord" | "slack" | "whatsapp" | "imessage" | "browser";

export interface PlatformPreviewSpec extends PlatformPreviewCard {
  componentName:
    | "XFrame"
    | "LinkedInFrame"
    | "FacebookFrame"
    | "DiscordFrame"
    | "SlackFrame"
    | "WhatsAppFrame"
    | "IMessageFrame"
    | "BrowserFrame";
  imageAspect: "1.91:1" | "2:1" | "compact";
  layoutBasis: "official" | "client-observed";
  surface: "social-feed" | "desktop-chat" | "mobile-chat" | "metadata-debugger";
  frame: {
    maxWidth: number;
    minHeight: number;
    imageMaxWidth: number;
  };
  sourceNote: string;
}

const platformPreviewSpecs: PlatformPreviewSpec[] = [
    {
      id: "x",
      title: "X / Twitter",
      chrome: "social",
      frameKind: "feed",
      icon: "twitter",
      aspectLabel: "1.91:1",
      imageAspect: "2:1",
      previewSize: { width: 1200, height: 630 },
      description: "Large summary card with strong crop sensitivity.",
      cropHint: "Large-summary cards can crop tighter than universal OG previews.",
      componentName: "XFrame",
      layoutBasis: "official",
      surface: "social-feed",
      frame: { maxWidth: 660, minHeight: 430, imageMaxWidth: 500 },
      sourceNote: "X large summary cards document a 2:1 image surface; OpenGraph Creator shows the 1200x630 OG image inside that crop."
    },
    {
      id: "linkedin",
      title: "LinkedIn",
      chrome: "social",
      frameKind: "feed",
      icon: "linkedin",
      aspectLabel: "1.91:1",
      imageAspect: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "Professional feed preview with title truncation.",
      cropHint: "Keep small text readable in a restrained professional feed card.",
      componentName: "LinkedInFrame",
      layoutBasis: "client-observed",
      surface: "social-feed",
      frame: { maxWidth: 660, minHeight: 430, imageMaxWidth: 500 },
      sourceNote: "LinkedIn exposes Post Inspector validation; client chrome is modeled from current feed behavior."
    },
    {
      id: "facebook",
      title: "Facebook",
      chrome: "social",
      frameKind: "feed",
      icon: "facebook",
      aspectLabel: "1.91:1",
      imageAspect: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "Feed card with bold image and compact text.",
      cropHint: "Use the universal 1200x630 image and keep key text off the edges.",
      componentName: "FacebookFrame",
      layoutBasis: "official",
      surface: "social-feed",
      frame: { maxWidth: 660, minHeight: 430, imageMaxWidth: 500 },
      sourceNote: "Open Graph image metadata is the basis; feed chrome varies by client."
    },
    {
      id: "discord",
      title: "Discord",
      chrome: "chat",
      frameKind: "chat",
      icon: "discord",
      aspectLabel: "1.91:1",
      imageAspect: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "Chat embed preview with dark chrome.",
      cropHint: "Dark OG backgrounds need a visible edge against Discord embed chrome.",
      componentName: "DiscordFrame",
      layoutBasis: "official",
      surface: "desktop-chat",
      frame: { maxWidth: 660, minHeight: 430, imageMaxWidth: 500 },
      sourceNote: "Discord message embeds expose image, thumbnail, title, description, provider, and color fields."
    },
    {
      id: "slack",
      title: "Slack",
      chrome: "chat",
      frameKind: "chat",
      icon: "slack",
      aspectLabel: "1.91:1",
      imageAspect: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "Workspace unfurl with compact metadata.",
      cropHint: "Slack unfurls are compact, so logos and headline blocks need strong hierarchy.",
      componentName: "SlackFrame",
      layoutBasis: "official",
      surface: "desktop-chat",
      frame: { maxWidth: 660, minHeight: 430, imageMaxWidth: 500 },
      sourceNote: "Slack crawls links and renders classic or app unfurls inside message surfaces."
    },
    {
      id: "whatsapp",
      title: "WhatsApp",
      chrome: "chat",
      frameKind: "whatsapp",
      icon: "message-circle",
      aspectLabel: "1.91:1",
      imageAspect: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "WhatsApp mobile link card with compressed image display.",
      cropHint: "Mobile chat cards compress aggressively; avoid thin lines and tiny copy.",
      componentName: "WhatsAppFrame",
      layoutBasis: "client-observed",
      surface: "mobile-chat",
      frame: { maxWidth: 660, minHeight: 430, imageMaxWidth: 330 },
      sourceNote: "WhatsApp does not publish a complete visual preview spec; OpenGraph Creator models common mobile link-card behavior."
    },
    {
      id: "imessage",
      title: "iMessage",
      chrome: "chat",
      frameKind: "imessage",
      icon: "messages-square",
      aspectLabel: "compact",
      imageAspect: "compact",
      previewSize: { width: 1200, height: 630 },
      description: "iMessage compact mobile bubble preview.",
      cropHint: "The image may become a small rich-link thumbnail; test the central composition.",
      componentName: "IMessageFrame",
      layoutBasis: "client-observed",
      surface: "mobile-chat",
      frame: { maxWidth: 660, minHeight: 430, imageMaxWidth: 330 },
      sourceNote: "iMessage visual layout is client-controlled; OpenGraph Creator models the rich-link bubble shape and crop pressure."
    },
    {
      id: "browser",
      title: "Browser / Search",
      chrome: "browser",
      frameKind: "browser",
      icon: "globe",
      aspectLabel: "metadata",
      imageAspect: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "Generic metadata sanity preview.",
      cropHint: "Validate title, description, image URL, dimensions, and alt metadata together.",
      componentName: "BrowserFrame",
      layoutBasis: "official",
      surface: "metadata-debugger",
      frame: { maxWidth: 660, minHeight: 430, imageMaxWidth: 500 },
      sourceNote: "Open Graph exposes image URL, width, height, type, and alt fields for debugger-style validation."
    }
];

export function getPlatformPreviewSpecs(): PlatformPreviewSpec[] {
  return platformPreviewSpecs;
}

export function getPlatformPreviewCards(_project: OgProject): PlatformPreviewCard[] {
  return platformPreviewSpecs.map((spec) => ({
    id: spec.id,
    title: spec.title,
    chrome: spec.chrome,
    frameKind: spec.frameKind,
    icon: spec.icon,
    aspectLabel: spec.aspectLabel,
    previewSize: spec.previewSize,
    description: spec.description,
    cropHint: spec.cropHint
  }));
}

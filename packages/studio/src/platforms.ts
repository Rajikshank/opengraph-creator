import type { OgProject } from "@graphforge/core";

export interface PlatformPreviewCard {
  id: string;
  title: string;
  chrome: "social" | "chat" | "browser";
  icon: "twitter" | "linkedin" | "facebook" | "discord" | "slack" | "message-circle" | "messages-square" | "globe";
  aspectLabel: string;
  previewSize: { width: number; height: number };
  description: string;
  cropHint: string;
}

export function getPlatformPreviewCards(_project: OgProject): PlatformPreviewCard[] {
  return [
    {
      id: "x",
      title: "X / Twitter",
      chrome: "social",
      icon: "twitter",
      aspectLabel: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "Large summary card with strong crop sensitivity.",
      cropHint: "Keep text inside 64px safe zone."
    },
    {
      id: "linkedin",
      title: "LinkedIn",
      chrome: "social",
      icon: "linkedin",
      aspectLabel: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "Professional feed preview with title truncation.",
      cropHint: "Avoid tiny subtitles."
    },
    {
      id: "facebook",
      title: "Facebook",
      chrome: "social",
      icon: "facebook",
      aspectLabel: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "Feed card with bold image and compact text.",
      cropHint: "Check contrast at small feed sizes."
    },
    {
      id: "discord",
      title: "Discord",
      chrome: "chat",
      icon: "discord",
      aspectLabel: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "Chat embed preview with dark chrome.",
      cropHint: "Dark backgrounds should still separate from chat UI."
    },
    {
      id: "slack",
      title: "Slack",
      chrome: "chat",
      icon: "slack",
      aspectLabel: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "Workspace unfurl with compact metadata.",
      cropHint: "Logo and headline should remain readable."
    },
    {
      id: "whatsapp",
      title: "WhatsApp",
      chrome: "chat",
      icon: "message-circle",
      aspectLabel: "1.91:1",
      previewSize: { width: 1200, height: 630 },
      description: "Mobile share preview with compressed image display.",
      cropHint: "Avoid thin lines and low contrast text."
    },
    {
      id: "imessage",
      title: "iMessage",
      chrome: "chat",
      icon: "messages-square",
      aspectLabel: "compact",
      previewSize: { width: 1200, height: 630 },
      description: "Small mobile bubble preview.",
      cropHint: "Headline must work as a thumbnail."
    },
    {
      id: "browser",
      title: "Browser / Search",
      chrome: "browser",
      icon: "globe",
      aspectLabel: "metadata",
      previewSize: { width: 1200, height: 630 },
      description: "Generic metadata sanity preview.",
      cropHint: "Validate title and description alongside image."
    }
  ];
}

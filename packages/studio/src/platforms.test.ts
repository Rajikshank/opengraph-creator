import { describe, expect, it } from "vitest";
import { createDefaultProject } from "@opengraph-creator/core";
import { getPlatformPreviewCards, getPlatformPreviewSpecs } from "./platforms";

describe("platform previews", () => {
  it("returns high-value social surfaces with crop and metadata hints", () => {
    const project = createDefaultProject({ name: "Preview", strategy: "hybrid" });
    const cards = getPlatformPreviewCards(project);

    expect(cards.map((card) => card.id)).toEqual([
      "x",
      "linkedin",
      "facebook",
      "discord",
      "slack",
      "whatsapp",
      "imessage",
      "browser"
    ]);
    expect(cards[0]).toMatchObject({
      title: "X / Twitter",
      aspectLabel: "1.91:1",
      chrome: "social",
      frameKind: "feed",
      icon: "twitter",
      previewSize: { width: 1200, height: 630 }
    });
    expect(cards.map((card) => card.frameKind)).toEqual([
      "feed",
      "feed",
      "feed",
      "chat",
      "chat",
      "whatsapp",
      "imessage",
      "browser"
    ]);
    expect(cards.find((card) => card.id === "whatsapp")).toMatchObject({
      frameKind: "whatsapp",
      description: expect.stringContaining("WhatsApp")
    });
    expect(cards.find((card) => card.id === "imessage")).toMatchObject({
      frameKind: "imessage",
      description: expect.stringContaining("iMessage")
    });
    expect(cards.every((card) => card.previewSize.width > 0 && card.previewSize.height > 0)).toBe(true);
  });

  it("models every platform with a dedicated preview spec instead of a generic frame", () => {
    const specs = getPlatformPreviewSpecs();

    expect(specs.map((spec) => spec.id)).toEqual([
      "x",
      "linkedin",
      "facebook",
      "discord",
      "slack",
      "whatsapp",
      "imessage",
      "browser"
    ]);
    expect(specs.every((spec) => spec.componentName.endsWith("Frame"))).toBe(true);
    expect(new Set(specs.map((spec) => spec.componentName)).size).toBe(specs.length);
    expect(specs.every((spec) => spec.layoutBasis === "official" || spec.layoutBasis === "client-observed")).toBe(true);
    expect(specs.every((spec) => spec.frame.maxWidth > 0 && spec.frame.minHeight > 0)).toBe(true);
    expect(specs.find((spec) => spec.id === "whatsapp")).toMatchObject({
      layoutBasis: "client-observed",
      surface: "mobile-chat"
    });
    expect(specs.find((spec) => spec.id === "x")).toMatchObject({
      componentName: "XFrame",
      imageAspect: "2:1"
    });
  });
});

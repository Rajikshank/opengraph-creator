import { describe, expect, it } from "vitest";
import { createDefaultProject } from "@graphforge/core";
import { getPlatformPreviewCards } from "./platforms";

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
      icon: "twitter",
      previewSize: { width: 1200, height: 630 }
    });
    expect(cards.every((card) => card.previewSize.width > 0 && card.previewSize.height > 0)).toBe(true);
  });
});

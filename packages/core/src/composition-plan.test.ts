import { describe, expect, it } from "vitest";
import { lintCompositionPlan, type CompositionPlan } from "./composition-plan";

const completePlan: CompositionPlan = {
  version: 1,
  appName: "Signal Desk",
  strategy: "hybrid",
  capabilityGate: {
    imageGeneration: "unknown",
    svgGeneration: "available",
    htmlGeneration: "available",
    webReferenceResearch: "unknown"
  },
  brandEvidence: ["Detected logo at public/logo.svg", "Route copy mentions newsroom analytics."],
  referenceResearch: ["Use editorial signal-room mood from local brand evidence only."],
  conceptThesis: "A newsroom signal room where route context becomes a clear editorial focal object.",
  styleThesis: "Matte graphite editorial surface with warm amber signal accents and restrained depth.",
  semanticPalette: [
    { role: "brand-anchor", color: "#0b0d10", reason: "Matches dark newsroom app chrome." },
    { role: "signal-accent", color: "#d9a441", reason: "Highlights important route-specific focal points." },
    { role: "readability-surface", color: "#f4efe6", reason: "Keeps social headline readable." }
  ],
  compositionArchetype: {
    id: "data-signal",
    reason: "Route copy is about news analysis and signal discovery.",
    avoidRepeating: ["left-text-right-image", "generic-dashboard-card"]
  },
  focalHierarchy: [
    { role: "headline", layerId: "headline", priority: 1 },
    { role: "route motif", layerId: "signal-map", priority: 2 },
    { role: "brand mark", layerId: "logo", priority: 3 }
  ],
  assetStrategy: [
    {
      role: "headline",
      medium: "ogdoc-text",
      textPolicy: "editable-required",
      reason: "Primary readable social text must stay editable."
    },
    {
      role: "background signal map",
      medium: "svg",
      textPolicy: "no-important-text-baked",
      reason: "Crisp semantic geometry is enough; no model-generated bitmap is required."
    }
  ],
  effectsPlan: [
    { kind: "lighting", scope: "canvas", reason: "Guide attention to the headline and signal map." }
  ],
  negativeDirection: ["No meaningless blobs.", "No baked headline text.", "No repeated old structure."],
  qualityChecklist: ["Readable at 1200x630.", "All important text remains editable.", "Preview and export must match."]
};

describe("composition plan", () => {
  it("accepts a complete professional composition plan", () => {
    expect(lintCompositionPlan(completePlan)).toMatchObject({ ok: true, errors: [] });
  });

  it("rejects generic visual plans that can create repeated slop", () => {
    const result = lintCompositionPlan({
      ...completePlan,
      conceptThesis: "Make it look cool.",
      styleThesis: "Nice modern design.",
      brandEvidence: [],
      compositionArchetype: {
        id: "left-text-right-image",
        reason: "Looks good.",
        avoidRepeating: []
      },
      negativeDirection: ["No bad design."]
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("conceptThesis");
    expect(result.errors.join("\n")).toContain("brandEvidence");
    expect(result.errors.join("\n")).toContain("compositionArchetype");
    expect(result.errors.join("\n")).toContain("negativeDirection");
  });

  it("rejects important text planned as a generated image asset", () => {
    const result = lintCompositionPlan({
      ...completePlan,
      assetStrategy: [
        {
          role: "headline and subtitle",
          medium: "image-generation",
          textPolicy: "no-important-text-baked",
          reason: "Generate the whole card as one beautiful image."
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("headline and subtitle");
    expect(result.errors.join("\n")).toContain("ogdoc-text");
  });
});

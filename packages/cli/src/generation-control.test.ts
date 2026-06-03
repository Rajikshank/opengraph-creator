import { describe, expect, it } from "vitest";
import { createDefaultProject, type ImageLayer, type OgProject } from "@opengraph-creator/core";
import {
  checkRender,
  createDefaultAssetPlan,
  createRecipeSelection,
  defaultGenerationCapabilities,
  lintDesignDocument,
  lintGenerationBrief,
  type AssetPlanItem
} from "./generation-control";

describe("generation control", () => {
  it("accepts a structured editable generation brief", () => {
    const recipeSelection = createRecipeSelection({
      appName: "Signal Desk",
      framework: "next",
      routes: ["/", "/reports"],
      routeContexts: [],
      brandAssets: ["public/logo.svg"]
    });
    const brief = {
      appName: "Signal Desk",
      capabilities: defaultGenerationCapabilities,
      referenceResearch: ["Detected local route copy and logo."],
      conceptThesis: "A signal room metaphor tied to reporting workflows.",
      styleThesis: "Matte editorial newsroom surface with one warm signal accent.",
      semanticPalette: ["brand anchor", "depth shadow", "signal accent"],
      compositionPlan: ["Use a route-map system for page variants."],
      assetPlan: createDefaultAssetPlan({
        generationMode: "template",
        strategy: "hybrid",
        recipeId: recipeSelection.id,
        imageGeneration: "unknown"
      }),
      recipeSelection,
      negativeDirection: ["No generic blobs or dashboard filler."],
      noisePolicy: "disallowed",
      texturePolicy: "unknown"
    };

    expect(lintGenerationBrief(brief)).toMatchObject({ ok: true, errors: [] });
  });

  it("rejects important text routed into generated image assets", () => {
    const badAssetPlan: AssetPlanItem[] = [
      {
        id: "baked-headline",
        role: "headline and subtitle",
        medium: "image-generation",
        fallbacks: ["svg"],
        reason: "Looks good",
        textPolicy: "no-important-text-baked",
        editableOverlayLayers: [],
        validation: [],
        requiredEvidence: []
      }
    ];

    const result = lintGenerationBrief({
      capabilities: defaultGenerationCapabilities,
      referenceResearch: ["repo"],
      conceptThesis: "domain-specific concept",
      styleThesis: "domain-specific style",
      semanticPalette: ["roles"],
      compositionPlan: ["plan"],
      assetPlan: badAssetPlan,
      recipeSelection: {
        id: "editorial-split",
        reason: "The app content needs a readable editorial hierarchy.",
        requiredEvidence: ["route copy"],
        antiSlopRules: ["No filler shapes.", "Text remains editable."]
      },
      negativeDirection: ["avoid baked text"],
      noisePolicy: "disallowed",
      texturePolicy: "unknown"
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("important text");
    expect(result.errors.join("\n")).toContain("concrete reason");
  });

  it("flags image-like layers that look like baked headline text", () => {
    const project = createDefaultProject({ name: "Baked Text", strategy: "common" });
    const imageTextLayer: ImageLayer = {
      id: "headline-image",
      kind: "image",
      name: "Baked headline image",
      x: 0,
      y: 0,
      width: 1200,
      height: 630,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      src: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E",
      fit: "cover",
      borderRadius: 0,
      effects: { shadow: false, glow: false, blur: 0 }
    };
    const brokenProject: OgProject = {
      ...project,
      layers: [imageTextLayer, ...project.layers.filter((layer) => layer.kind !== "text" && layer.kind !== "badge")]
    };

    const result = lintDesignDocument(brokenProject);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("editable text");
    expect(result.errors.join("\n")).toContain("Baked headline image");
  });

  it("checks render output through the existing SVG renderer", () => {
    const project = createDefaultProject({ name: "Renderer Check", strategy: "common" });
    expect(checkRender(project)).toMatchObject({ ok: true, errors: [] });
  });
});

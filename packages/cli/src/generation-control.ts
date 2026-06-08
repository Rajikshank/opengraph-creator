import type { CompositionPlan, Framework, OgLayer, OgProject } from "@opengraph-creator/core";
import { getRenderableProject, lintCompositionPlan, validateStudioDocument } from "@opengraph-creator/core";
import { renderProjectToSvg } from "@opengraph-creator/render";
import type { RouteContext } from "./scan.js";

export type GenerationCapability = "available" | "unavailable" | "unknown";

export interface GenerationCapabilities {
  imageGeneration: GenerationCapability;
  webReferenceResearch: GenerationCapability;
  svgGeneration: GenerationCapability;
  htmlGeneration: GenerationCapability;
  repoAssetAccess: GenerationCapability;
  studioRuntime: GenerationCapability;
}

export type AssetMedium =
  | "ogdoc-text"
  | "ogdoc-shape"
  | "ogdoc-effect"
  | "svg"
  | "react-satori-svg"
  | "react-playwright-capture"
  | "d3-svg"
  | "repo-screenshot"
  | "image-generation"
  | "repo-asset"
  | "placeholder";

export type AssetTextPolicy =
  | "editable-required"
  | "no-important-text-baked"
  | "decorative-text-only"
  | "pure-image-explicit";

export type RecipeId =
  | "editorial-split"
  | "cinematic-object"
  | "product-window"
  | "data-signal"
  | "route-map"
  | "typographic-poster"
  | "document-stack"
  | "crafted-emblem";

export interface AssetPlanItem {
  id: string;
  role: string;
  medium: AssetMedium;
  fallbacks: AssetMedium[];
  reason: string;
  textPolicy: AssetTextPolicy;
  editableOverlayLayers: string[];
  validation: string[];
  requiredEvidence: string[];
  recipeId?: RecipeId;
}

export interface RecipeSelection {
  id: RecipeId;
  reason: string;
  requiredEvidence: string[];
  antiSlopRules: string[];
}

export interface LibraryPlan {
  primaryReferences: string[];
  optionalAdapters: string[];
  forbiddenRuntimeChanges: string[];
}

export interface GenerationControlLintResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  recovery: string[];
}

export interface GenerationBriefLike {
  appName?: string;
  framework?: Framework | string;
  routes?: string[];
  routeContexts?: RouteContext[];
  capabilities?: Partial<GenerationCapabilities>;
  referenceResearch?: unknown;
  conceptThesis?: unknown;
  styleThesis?: unknown;
  semanticPalette?: unknown;
  compositionPlan?: unknown;
  compositionPlanV2?: unknown;
  assetPlan?: unknown;
  recipeSelection?: unknown;
  libraryPlan?: unknown;
  negativeDirection?: unknown;
  designQualityChecklist?: unknown;
  noisePolicy?: unknown;
  texturePolicy?: unknown;
  generationMode?: string;
}

export const defaultGenerationCapabilities: GenerationCapabilities = {
  imageGeneration: "unknown",
  webReferenceResearch: "unknown",
  svgGeneration: "available",
  htmlGeneration: "available",
  repoAssetAccess: "available",
  studioRuntime: "available"
};

export function createRecipeSelection(input: {
  appName: string;
  framework: Framework;
  routes: string[];
  routeContexts: RouteContext[];
  brandAssets: string[];
}): RecipeSelection {
  const hasMultipleRoutes = input.routes.length > 1;
  const combinedCopy = input.routeContexts
    .map((route) => `${route.detectedTitle ?? ""} ${route.detectedDescription ?? ""}`)
    .join(" ")
    .toLowerCase();
  const dataLike = /\b(data|analytics|signal|report|metric|finance|news|insight|dashboard)\b/.test(combinedCopy);
  const productLike = input.brandAssets.length > 0 || /\b(product|app|platform|studio|tool|saas)\b/.test(combinedCopy);

  const id: RecipeId = hasMultipleRoutes
    ? "route-map"
    : dataLike
      ? "data-signal"
      : productLike
        ? "product-window"
        : "editorial-split";

  return {
    id,
    reason:
      id === "route-map"
        ? "Multiple routes need a shared system with page-specific focal motifs."
        : id === "data-signal"
          ? "The route copy suggests insight, reporting, or signal, so the visual should make information feel intentional."
          : id === "product-window"
            ? "Detected brand/product evidence can anchor the card in a concrete app surface."
            : "The repo evidence is light, so a strong editorial hierarchy is the safest editable starting point.",
    requiredEvidence: [
      "route copy or metadata",
      input.brandAssets.length ? "detected brand assets" : "documented visual assumption",
      hasMultipleRoutes ? "page-to-page variant rule" : "single-card hierarchy"
    ],
    antiSlopRules: [
      "Every large shape must explain the app, route, or focal object.",
      "No generic blobs, orbits, sparkle fields, or decorative dashboards unless the concept thesis gives them a specific job.",
      "Important text must be editable .ogdoc text or badge layers.",
      "Noise, grain, and texture must remain absent unless explicitly allowed by the user or reference."
    ]
  };
}

export function createDefaultAssetPlan(input: {
  generationMode: "template" | "pure-image";
  strategy: "common" | "pages" | "hybrid";
  recipeId: RecipeId;
  imageGeneration: GenerationCapability;
  referenceImage?: string;
}): AssetPlanItem[] {
  const plan: AssetPlanItem[] = [
    {
      id: "editable-headline-system",
      role: "headline, subtitle, route label, badge, and CTA text",
      medium: "ogdoc-text",
      fallbacks: ["ogdoc-text"],
      reason: "Readable social text is the main value of the OG image and must remain editable after Studio opens.",
      textPolicy: "editable-required",
      editableOverlayLayers: ["headline", "subtitle", "badge", "route-label"],
      validation: ["visible editable text or badge layers exist", "text stays inside the 64px safe zone"],
      requiredEvidence: ["route title", "route description", "user visual direction"],
      recipeId: input.recipeId
    },
    {
      id: "editable-layout-geometry",
      role: "layout rules, dividers, frames, masks, and semantic shapes",
      medium: "ogdoc-shape",
      fallbacks: ["svg", "placeholder"],
      reason: "Core composition geometry should stay selectable, reorderable, and editable in Studio.",
      textPolicy: "no-important-text-baked",
      editableOverlayLayers: ["shape", "background", "frame"],
      validation: ["large shapes have semantic names", "no full-canvas flat art replaces the layout"],
      requiredEvidence: ["concept thesis", "semantic palette"],
      recipeId: input.recipeId
    },
    {
      id: "supporting-visual-asset",
      role: "background art, product scene, screenshot treatment, icon field, or route motif",
      medium: input.imageGeneration === "available" ? "image-generation" : "svg",
      fallbacks: input.imageGeneration === "available" ? ["svg", "repo-asset", "placeholder"] : ["repo-asset", "placeholder"],
      reason:
        input.imageGeneration === "available"
          ? "Generated raster art may add richness, but only as a non-text asset under editable Studio layers."
          : "No image-generation capability is assumed, so SVG/repo assets should carry the visual motif without pretending to be generated art.",
      textPolicy: "no-important-text-baked",
      editableOverlayLayers: ["headline", "subtitle", "badge", "brand", "safe-zone-guides"],
      validation: ["asset is packaged under assets/* or uses a valid data URL", "no headline or badge text is baked into the asset"],
      requiredEvidence: input.referenceImage ? ["provided reference image", "concept thesis"] : ["local repo evidence", "concept thesis"],
      recipeId: input.recipeId
    },
    {
      id: "controlled-effects",
      role: "glow, shadow, blur, lighting, vignette, and optional texture",
      medium: "ogdoc-effect",
      fallbacks: ["ogdoc-shape"],
      reason: "Effects should be serialized in .ogdoc so canvas, preview, and export can stay in parity.",
      textPolicy: "no-important-text-baked",
      editableOverlayLayers: ["effect controls"],
      validation: ["noise is absent unless allowed", "effects use supported layer kinds"],
      requiredEvidence: ["style thesis", "noisePolicy", "texturePolicy"],
      recipeId: input.recipeId
    }
  ];

  if (input.generationMode === "pure-image") {
    return plan.map((item) =>
      item.id === "supporting-visual-asset"
        ? {
            ...item,
            medium: input.imageGeneration === "available" ? "image-generation" : item.medium,
            textPolicy: "pure-image-explicit",
            reason: `${item.reason} The user explicitly chose pure-image fallback, so editability is reduced and must be documented.`
          }
        : item
    );
  }

  return plan;
}

export function createDefaultLibraryPlan(): LibraryPlan {
  return {
    primaryReferences: [
      "OpenGraph Creator .ogdoc layer schema",
      "Satori-style React-to-SVG only as optional static SVG authoring reference",
      "Playwright capture only as optional heavy adapter for browser-accurate non-text assets",
      "Tailwind, shadcn, and Radix only as composition references, not as the Studio renderer",
      "Lucide/Iconify only for licensed icon assets that become editable or packaged layers"
    ],
    optionalAdapters: ["satori", "playwright", "tailwind", "shadcn", "radix", "d3", "visx", "lucide", "iconify", "svgjs", "paperjs", "roughjs", "resvg"],
    forbiddenRuntimeChanges: [
      "Do not make React components the master document format.",
      "Do not render React in Studio preview/export.",
      "Do not bake important text into PNG/SVG/HTML captures.",
      "Do not add heavy browser-rendering dependencies to the normal npx runtime path."
    ]
  };
}

export function lintGenerationBrief(brief: GenerationBriefLike): GenerationControlLintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recovery = [
    "Complete the Question Gate before generating assets.",
    "Write a concept thesis, style thesis, semantic palette, and structured assetPlan before creating document.ogdoc.",
    "Regenerate any asset that bakes important text into SVG, HTML, PNG, JPEG, WebP, or screenshot layers.",
    "Run opengraph-creator design lint and opengraph-creator render check before launching Studio."
  ];

  if (!brief.capabilities || typeof brief.capabilities !== "object") {
    errors.push("Generation brief must include a capabilities gate.");
  } else {
    for (const key of Object.keys(defaultGenerationCapabilities) as Array<keyof GenerationCapabilities>) {
      const value = brief.capabilities[key];
      if (value !== "available" && value !== "unavailable" && value !== "unknown") {
        errors.push(`Capability ${key} must be available, unavailable, or unknown.`);
      }
    }
  }

  assertNonEmpty(brief.referenceResearch, "referenceResearch", errors);
  assertNonEmpty(brief.conceptThesis, "conceptThesis", errors);
  assertNonEmpty(brief.styleThesis, "styleThesis", errors);
  assertNonEmpty(brief.semanticPalette, "semanticPalette", errors);
  assertNonEmpty(brief.compositionPlan, "compositionPlan", errors);
  assertNonEmpty(brief.negativeDirection, "negativeDirection", errors);
  if (!brief.compositionPlanV2 || typeof brief.compositionPlanV2 !== "object") {
    errors.push("Generation brief must include compositionPlanV2.");
  } else {
    const compositionResult = lintCompositionPlan(brief.compositionPlanV2 as CompositionPlan);
    errors.push(...compositionResult.errors);
    warnings.push(...compositionResult.warnings);
  }

  const assetPlan = normalizeAssetPlan(brief.assetPlan);
  if (!assetPlan.length) {
    errors.push("Generation brief must include a structured assetPlan array.");
  }

  for (const item of assetPlan) {
    if (!item.id || !item.role) errors.push("Every assetPlan item must include id and role.");
    if (!isAssetMedium(item.medium)) errors.push(`Asset plan ${item.id || "(unknown)"} uses unsupported medium ${String(item.medium)}.`);
    if (!item.reason || isGenericReason(item.reason)) errors.push(`Asset plan ${item.id || "(unknown)"} needs a concrete reason tied to the concept or repo evidence.`);
    if (!isTextPolicy(item.textPolicy)) errors.push(`Asset plan ${item.id || "(unknown)"} must declare textPolicy.`);
    if (!Array.isArray(item.fallbacks) || item.fallbacks.some((fallback) => !isAssetMedium(fallback))) {
      errors.push(`Asset plan ${item.id || "(unknown)"} must declare valid fallbacks.`);
    }
    if (isImportantTextRole(item.role) && item.textPolicy !== "editable-required") {
      errors.push(`Asset plan ${item.id} handles important text but does not require editable text layers.`);
    }
    if (isImportantTextRole(item.role) && item.medium !== "ogdoc-text") {
      errors.push(`Asset plan ${item.id} handles important text with ${item.medium}; important text must be ogdoc-text.`);
    }
    if (item.medium === "image-generation" && item.textPolicy !== "no-important-text-baked" && item.textPolicy !== "pure-image-explicit") {
      errors.push(`Asset plan ${item.id} uses image generation without a no-baked-important-text policy.`);
    }
    if (!Array.isArray(item.validation) || item.validation.length === 0) {
      warnings.push(`Asset plan ${item.id || "(unknown)"} should list validation checks.`);
    }
    if (!Array.isArray(item.requiredEvidence) || item.requiredEvidence.length === 0) {
      warnings.push(`Asset plan ${item.id || "(unknown)"} should list required evidence.`);
    }
  }

  const recipe = brief.recipeSelection as Partial<RecipeSelection> | undefined;
  if (!recipe || typeof recipe !== "object") {
    errors.push("Generation brief must include recipeSelection.");
  } else {
    if (!isRecipeId(recipe.id)) errors.push("recipeSelection.id must be a known OpenGraph Creator recipe.");
    if (!recipe.reason || isGenericReason(recipe.reason)) errors.push("recipeSelection.reason must explain why the recipe fits this app/page.");
    if (!Array.isArray(recipe.antiSlopRules) || recipe.antiSlopRules.length < 2) {
      warnings.push("recipeSelection should include antiSlopRules to prevent decorative filler.");
    }
  }

  if (brief.noisePolicy !== "allowed" && brief.noisePolicy !== "disallowed" && brief.noisePolicy !== "unknown") {
    warnings.push("Set noisePolicy to allowed, disallowed, or unknown. Defaulting to disallowed is safest.");
  }
  if (brief.texturePolicy !== "allowed" && brief.texturePolicy !== "disallowed" && brief.texturePolicy !== "unknown") {
    warnings.push("Set texturePolicy to allowed, disallowed, or unknown. Defaulting to disallowed is safest.");
  }

  return { ok: errors.length === 0, errors, warnings, recovery: errors.length ? recovery : [] };
}

export function lintDesignDocument(project: OgProject, assets: Record<string, Uint8Array> = {}): GenerationControlLintResult {
  const base = validateStudioDocument(project, assets);
  const errors = [...base.errors];
  const warnings = [...base.warnings];
  const recovery = [
    "Open or regenerate document.ogdoc with separate editable layers.",
    "Use real packaged assets/* paths or data URLs for generated art.",
    "Keep headline, subtitle, badge, route labels, and CTA text as text/badge layers.",
    "Run opengraph-creator document validate, design lint, and render check again."
  ];

  const allLayers = getAllLayers(project);
  const visibleLayers = allLayers.filter((layer) => !layer.hidden);
  const importantTextLayers = visibleLayers.filter((layer) => (layer.kind === "text" || layer.kind === "badge") && layer.text.trim().length > 0);
  const imageLikeLayers = visibleLayers.filter((layer) => layer.kind === "image" || layer.kind === "logo" || layer.kind === "screenshot");
  const genericLargeShapes = visibleLayers.filter(
    (layer) =>
      (layer.kind === "shape" || layer.kind === "background") &&
      isGenericLayerName(layer.name) &&
      layer.width * layer.height > project.canvas.width * project.canvas.height * 0.08
  );

  if (project.generationMode === "template" && importantTextLayers.length === 0) {
    errors.push("Template document needs visible editable text or badge layers.");
  }

  if (project.generationMode === "template") {
    const fullCanvasImages = imageLikeLayers.filter((layer) => layer.x <= 0 && layer.y <= 0 && layer.width >= project.canvas.width && layer.height >= project.canvas.height);
    if (fullCanvasImages.length && importantTextLayers.length < 2) {
      errors.push("Full-canvas art must have editable headline/subtitle/badge layers above it.");
    }
  }

  if (genericLargeShapes.length > 2) {
    warnings.push("Several large generic shapes were found. Rename or replace them with concept-specific layers before launch.");
  }

  const imageLayersWithLikelyText = imageLikeLayers.filter((layer) => /\b(headline|subtitle|badge|title|cta|copy|text)\b/i.test(layer.name));
  if (imageLayersWithLikelyText.length) {
    errors.push(`Important text appears to be baked into image-like layer names: ${imageLayersWithLikelyText.map((layer) => layer.name).join(", ")}.`);
  }

  const noisyLayers = visibleLayers.filter((layer) => "effects" in layer && layer.effects.noise && layer.effects.noise.amount > 0);
  if (noisyLayers.length > 0 && !hasAllowedNoiseEvidence(project)) {
    warnings.push("Noise/grain effects exist without explicit project evidence. Generated noise should be opt-in.");
  }

  return { ok: errors.length === 0, errors, warnings, recovery: errors.length ? recovery : [] };
}

export function checkRender(project: OgProject): GenerationControlLintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recovery = [
    "Fix the .ogdoc project until renderProjectToSvg produces a nonblank 1200x630 SVG.",
    "Run opengraph-creator render check again before launching Studio or exporting."
  ];

  try {
    const renderable = project.pages?.length ? getRenderableProject(project, project.activePageId ?? project.pages[0]?.id) : project;
    const svg = renderProjectToSvg(renderable);
    if (!svg.includes("<svg")) errors.push("Renderer did not return an SVG document.");
    if (!/width=["']1200["']/.test(svg) || !/height=["']630["']/.test(svg)) {
      errors.push("Rendered SVG must be exactly 1200x630.");
    }
    if (svg.length < 500) warnings.push("Rendered SVG is very small and may be blank or under-specified.");
    if (!/(<text|<image|<rect|<ellipse|<path|<foreignObject)/.test(svg)) {
      errors.push("Rendered SVG does not contain visible drawing primitives.");
    }
  } catch (error) {
    errors.push(`Render failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { ok: errors.length === 0, errors, warnings, recovery: errors.length ? recovery : [] };
}

function assertNonEmpty(value: unknown, label: string, errors: string[]): void {
  if (Array.isArray(value) && value.length > 0) return;
  if (typeof value === "string" && value.trim()) return;
  errors.push(`Generation brief must include ${label}.`);
}

function normalizeAssetPlan(value: unknown): AssetPlanItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AssetPlanItem => Boolean(item) && typeof item === "object") as AssetPlanItem[];
}

function isAssetMedium(value: unknown): value is AssetMedium {
  return (
    value === "ogdoc-text" ||
    value === "ogdoc-shape" ||
    value === "ogdoc-effect" ||
    value === "svg" ||
    value === "react-satori-svg" ||
    value === "react-playwright-capture" ||
    value === "d3-svg" ||
    value === "repo-screenshot" ||
    value === "image-generation" ||
    value === "repo-asset" ||
    value === "placeholder"
  );
}

function isTextPolicy(value: unknown): value is AssetTextPolicy {
  return value === "editable-required" || value === "no-important-text-baked" || value === "decorative-text-only" || value === "pure-image-explicit";
}

function isRecipeId(value: unknown): value is RecipeId {
  return (
    value === "editorial-split" ||
    value === "cinematic-object" ||
    value === "product-window" ||
    value === "data-signal" ||
    value === "route-map" ||
    value === "typographic-poster" ||
    value === "document-stack" ||
    value === "crafted-emblem"
  );
}

function isImportantTextRole(role: string): boolean {
  return /\b(headline|subtitle|badge|route label|cta|title|copy|logo text|wordmark)\b/i.test(role);
}

function isGenericReason(reason: string): boolean {
  const normalized = reason.trim().toLowerCase();
  return normalized.length < 24 || normalized === "looks good" || normalized === "visual interest" || normalized === "decoration";
}

function getAllLayers(project: OgProject): OgLayer[] {
  return [...project.layers, ...(project.pages ?? []).flatMap((page) => page.layers)];
}

function isGenericLayerName(name: string): boolean {
  return /\b(shape|blob|orb|decoration|decorative|abstract|random|glow field)\b/i.test(name);
}

function hasAllowedNoiseEvidence(project: OgProject): boolean {
  const artifacts = project.sourceArtifacts.map((artifact) => `${artifact.path ?? ""} ${artifact.inline ?? ""}`).join(" ").toLowerCase();
  return artifacts.includes("noise") || artifacts.includes("grain") || artifacts.includes("texture");
}

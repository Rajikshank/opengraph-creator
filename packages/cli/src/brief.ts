import type { Framework, GenerationStrategy } from "@opengraph-creator/core";
import {
  createDefaultAssetPlan,
  createDefaultLibraryPlan,
  createRecipeSelection,
  defaultGenerationCapabilities,
  type AssetPlanItem,
  type GenerationCapabilities,
  type LibraryPlan,
  type RecipeSelection
} from "./generation-control.js";
import { scanRepo, type RepoScanResult } from "./scan.js";
import type { RouteContext } from "./scan.js";

export type GenerationMode = "template" | "pure-image";

export interface GenerationBriefInput {
  repo: string;
  name: string;
  strategy: GenerationStrategy;
  generationMode?: GenerationMode;
  referenceImage?: string;
}

export interface GenerationBrief {
  appName: string;
  repo: string;
  strategy: GenerationStrategy;
  generationMode: GenerationMode;
  framework: Framework;
  routes: string[];
  routeContexts: RouteContext[];
  metadataFiles: string[];
  brandAssets: string[];
  referenceImage?: string;
  capabilities: GenerationCapabilities;
  referenceResearch: string[];
  conceptThesis: string;
  styleThesis: string;
  semanticPalette: string[];
  visualTasteProfile: string[];
  compositionPlan: string[];
  assetPlan: AssetPlanItem[];
  recipeSelection: RecipeSelection;
  libraryPlan: LibraryPlan;
  negativeDirection: string[];
  designQualityChecklist: string[];
  noisePolicy: "allowed" | "disallowed" | "unknown";
  texturePolicy: "allowed" | "disallowed" | "unknown";
  outputContract: string[];
  codexPrompt: string;
}

export async function createGenerationBrief(input: GenerationBriefInput): Promise<GenerationBrief> {
  const scan = await scanRepo(input.repo);
  return createGenerationBriefFromScan(input, scan);
}

function createGenerationBriefFromScan(input: GenerationBriefInput, scan: RepoScanResult): GenerationBrief {
  const routes = scan.routes.length ? scan.routes : ["/"];
  const generationMode = input.generationMode ?? "template";
  const capabilities = defaultGenerationCapabilities;
  const referenceResearch = buildReferenceResearch(input, scan);
  const conceptThesis = buildConceptThesis(input, routes, scan);
  const styleThesis = buildStyleThesis(input, routes, scan);
  const semanticPalette = buildSemanticPalette(input, scan);
  const visualTasteProfile = buildVisualTasteProfile(input, scan);
  const compositionPlan = buildCompositionPlan(input, routes);
  const recipeSelection = createRecipeSelection({
    appName: input.name,
    framework: scan.framework,
    routes,
    routeContexts: scan.routeContexts,
    brandAssets: scan.brandAssets
  });
  const assetPlan = buildAssetPlan(input, recipeSelection);
  const libraryPlan = createDefaultLibraryPlan();
  const negativeDirection = buildNegativeDirection(input);
  const designQualityChecklist = buildDesignQualityChecklist(input);
  const noisePolicy = "disallowed";
  const texturePolicy = "unknown";
  const outputContract =
    generationMode === "pure-image"
      ? [
          "pure 1200x630 Open Graph bitmap generation plan",
          "Use opengraph-creator agent-image to create a local agent image handoff plan.",
          "Preserve the app name, route intent, brand colors, and readable social-card hierarchy in the prompt.",
          "Use the reference image as art direction if provided, without copying it blindly.",
          "Do not require a provider API key inside OpenGraph Creator; Codex, Claude, or OpenCode generates the asset and returns it to Studio."
        ]
      : [
          "editable .ogdoc Studio document package",
          "Return an editable Studio document: text, badges, images, screenshots, shapes, and backgrounds must be separate layers.",
          "Use 1200x630 canvas dimensions and keep important text inside the 64px safe zone.",
          "Keep text, badge, logo, screenshot, image, and decorative objects as separate editable layers.",
          "Include font, color, glow, shadow, blur, opacity, lock, and hidden state fields on applicable layers.",
          "Do not return a flat bitmap or one baked SVG unless the user explicitly chose pure image generation."
        ];

  return {
    appName: input.name,
    repo: scan.root,
    strategy: input.strategy,
    generationMode,
    framework: scan.framework,
    routes,
    routeContexts: scan.routeContexts,
    metadataFiles: scan.metadataFiles,
    brandAssets: scan.brandAssets,
    referenceImage: input.referenceImage,
    capabilities,
    referenceResearch,
    conceptThesis,
    styleThesis,
    semanticPalette,
    visualTasteProfile,
    compositionPlan,
    assetPlan,
    recipeSelection,
    libraryPlan,
    negativeDirection,
    designQualityChecklist,
    noisePolicy,
    texturePolicy,
    outputContract,
    codexPrompt: buildCodexPrompt({
      ...input,
      framework: scan.framework,
      routes,
      routeContexts: scan.routeContexts,
      metadataFiles: scan.metadataFiles,
      brandAssets: scan.brandAssets,
      capabilities,
      referenceResearch,
      conceptThesis,
      styleThesis,
      semanticPalette,
      visualTasteProfile,
      compositionPlan,
      assetPlan,
      recipeSelection,
      libraryPlan,
      negativeDirection,
      designQualityChecklist,
      noisePolicy,
      texturePolicy
    })
  };
}

function buildCodexPrompt(input: GenerationBriefInput & {
  framework: Framework;
  routes: string[];
  routeContexts: RouteContext[];
  metadataFiles: string[];
  brandAssets: string[];
  capabilities: GenerationCapabilities;
  referenceResearch: string[];
  conceptThesis: string;
  styleThesis: string;
  semanticPalette: string[];
  visualTasteProfile: string[];
  compositionPlan: string[];
  assetPlan: AssetPlanItem[];
  recipeSelection: RecipeSelection;
  libraryPlan: LibraryPlan;
  negativeDirection: string[];
  designQualityChecklist: string[];
  noisePolicy: "allowed" | "disallowed" | "unknown";
  texturePolicy: "allowed" | "disallowed" | "unknown";
}): string {
  const intent =
    input.strategy === "common"
      ? "Create one common Open Graph image for the app."
      : input.strategy === "pages"
        ? "Create page-specific Open Graph images for every route."
        : "Create a common base design plus page-specific Open Graph variations.";

  const reference = input.referenceImage ? `\nReference image to respect without copying blindly: ${input.referenceImage}` : "";
  const generationMode = input.generationMode ?? "template";
  const routeContext =
    input.routeContexts.length > 0
      ? input.routeContexts
          .map((page) => {
            const title = page.detectedTitle ? `title "${page.detectedTitle}"` : "no title detected";
            const description = page.detectedDescription ? `description "${page.detectedDescription}"` : "no description detected";
            const file = page.routeFile ? `from ${page.routeFile}` : "without route file";
            return `${page.route}: ${title}, ${description}, ${file}, confidence ${page.confidence}`;
          })
          .join("; ")
      : "none detected";
  const modeInstruction =
    generationMode === "pure-image"
      ? "The user chose pure image generation. Create an agent image handoff for Codex, Claude, or OpenCode; OpenGraph Creator should not call an image provider directly or require a provider API key."
      : "The user chose editable template generation. Return an editable .ogdoc Studio document package using separate layers; if you draft JSON first, pack it into .ogdoc and validate it.";

  return [
    `${intent}`,
    modeInstruction,
    `App name: ${input.name}`,
    `Framework: ${input.framework}`,
    `Routes: ${input.routes.join(", ")}`,
    `Route context: ${routeContext}`,
    `Brand assets: ${input.brandAssets.length ? input.brandAssets.join(", ") : "none detected"}`,
    `Metadata files: ${input.metadataFiles.length ? input.metadataFiles.join(", ") : "none detected"}`,
    reference.trim(),
    `Capability gate: ${formatCapabilities(input.capabilities)}`,
    `Reference research phase: ${input.referenceResearch.join(" ")}`,
    `Concept thesis: ${input.conceptThesis}`,
    `Style thesis: ${input.styleThesis}`,
    `Semantic palette: ${input.semanticPalette.join(" ")}`,
    `Visual taste profile: ${input.visualTasteProfile.join(" ")}`,
    `Composition plan: ${input.compositionPlan.join(" ")}`,
    `Recipe selection: ${input.recipeSelection.id}. ${input.recipeSelection.reason} Anti-slop rules: ${input.recipeSelection.antiSlopRules.join(" ")}`,
    `Asset plan: ${formatAssetPlan(input.assetPlan)}`,
    `Library plan: ${input.libraryPlan.primaryReferences.join(" ")}`,
    `Noise policy: ${input.noisePolicy}. Texture policy: ${input.texturePolicy}.`,
    `Negative direction: ${input.negativeDirection.join(" ")}`,
    `Design quality checklist: ${input.designQualityChecklist.join(" ")}`,
    "Design requirements: premium, minimal, readable at social-card size, not generic AI dashboard styling.",
    generationMode === "pure-image"
      ? "Use opengraph-creator agent-image with the app context, route intent, brand assets, and optional reference image, then open OpenGraph Creator Studio for review/edit/export."
      : "Generate a .ogdoc document with layers for headline, subtitle, badge, logo, screenshots, images, shapes, and background. Never bake important text into one SVG/image.",
    input.strategy === "pages" || input.strategy === "hybrid"
      ? "Generate one .ogdoc with internal page variants. Each page variant must preserve the shared visual system while changing route-specific text, badges, imagery, and exportPath."
      : "Generate a common .ogdoc document with no internal page variants unless the user changes strategy.",
    "If image generation tools are available, use them only for background/art/texture/product-scene asset layers unless pure-image mode was selected.",
    "Use the structured asset plan as the contract. If an asset cannot pass validation, choose its fallback medium instead of baking text or flattening the card.",
    "Use strategy common/pages/hybrid exactly as requested and preserve the route list.",
    "Do not copy protected internet references or use third-party images unless the user supplied them or license/permission is clear."
  ]
    .filter(Boolean)
    .join("\n");
}

function buildReferenceResearch(input: GenerationBriefInput, scan: RepoScanResult): string[] {
  return [
    "Inspect local brand assets, screenshots, existing metadata, and route copy before selecting a visual direction.",
    scan.brandAssets.length
      ? `Use detected brand assets as primary reference material: ${scan.brandAssets.join(", ")}.`
      : "If no brand assets exist, derive tone from route copy, product vocabulary, and framework context.",
    input.referenceImage
      ? `Use the provided reference image as art direction only: ${input.referenceImage}.`
      : "If internet/reference research is available, use it for mood and composition notes only; do not copy protected assets."
  ];
}

function buildStyleThesis(input: GenerationBriefInput, routes: string[], scan: RepoScanResult): string {
  const routeScope = input.strategy === "common" ? "one reusable app-level OG" : `${routes.length} route-aware OG variant${routes.length === 1 ? "" : "s"}`;
  const framework = scan.framework === "unknown" ? "the detected app" : `${scan.framework} app`;
  return `${input.name} should feel like a deliberate ${framework} social card system: ${routeScope}, high readability, a clear visual point of view, and editable layers rather than a random generated collage.`;
}

function buildVisualTasteProfile(input: GenerationBriefInput, scan: RepoScanResult): string[] {
  return [
    "Choose a premium but specific visual language from the repo evidence before drawing layers.",
    "Prefer strong hierarchy, useful negative space, restrained texture, and one memorable visual device over generic dashboard decoration.",
    scan.brandAssets.length ? "Let logo/brand assets influence palette and geometry without overwhelming the 1200x630 card." : "Create a simple brandable palette from app copy and product category.",
    input.generationMode === "pure-image" ? "If pure-image fallback is explicitly selected, make the image rich, cinematic, and still previewable through Studio." : "For editable documents, let generated art support the layout instead of replacing it."
  ];
}

function buildCompositionPlan(input: GenerationBriefInput, routes: string[]): string[] {
  return [
    "Choose a fresh composition archetype from the app/page evidence before placing layers; examples include editorial spread, cinematic object scene, product-window collage, route-map system, typographic poster, document stack, or data-signal field.",
    input.strategy === "pages" || input.strategy === "hybrid"
      ? `Create route-specific variants for ${routes.join(", ")} while preserving one recognizable visual system and changing the focal motif where the page context changes.`
      : "Create one app-level composition unless the user later asks for page variants.",
    "Keep all text, badges, shapes, and key layout objects separately editable in the Studio document.",
    "Do not reuse the last OpenGraph Creator document structure unless this is an explicit recovery task."
  ];
}

function buildConceptThesis(input: GenerationBriefInput, routes: string[], scan: RepoScanResult): string {
  const routeScope = input.strategy === "common" ? "the app as a whole" : `${routes.length} page context${routes.length === 1 ? "" : "s"}`;
  const evidence = scan.routeContexts
    .map((page) => page.detectedTitle ?? page.detectedDescription ?? page.route)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  return `${input.name} should use one concrete visual metaphor derived from ${routeScope}${evidence ? ` (${evidence})` : ""}. Large shapes, images, and effects must express that metaphor instead of acting as filler.`;
}

function buildSemanticPalette(input: GenerationBriefInput, scan: RepoScanResult): string[] {
  return [
    `${input.name} brand anchor: choose from detected assets or route vocabulary.`,
    "Depth shadow: use only to separate meaningful layers from the background.",
    "Action highlight: reserve one warm or bright accent for the focal route idea.",
    scan.brandAssets.length ? "Brand asset color influence: present but restrained." : "Derived palette: document the assumption because no brand asset was detected."
  ];
}

function buildAssetPlan(input: GenerationBriefInput, recipeSelection: RecipeSelection): AssetPlanItem[] {
  return createDefaultAssetPlan({
    generationMode: input.generationMode ?? "template",
    strategy: input.strategy,
    recipeId: recipeSelection.id,
    imageGeneration: defaultGenerationCapabilities.imageGeneration,
    referenceImage: input.referenceImage
  });
}

function buildNegativeDirection(input: GenerationBriefInput): string[] {
  return [
    "Do not bake important text, route labels, badges, or logos into one flat SVG/image.",
    "Do not copy protected internet references or third-party artwork.",
    "Do not produce a generic AI dashboard card, vague glow collage, unreadable small text, or disconnected page variants.",
    "Do not repeat the same left-text/right-art structure, badge stack, or background treatment across fresh generations unless the user asks to preserve it.",
    input.generationMode === "pure-image" ? "Do not pretend a pure bitmap is fully editable in Studio." : "Do not use pure bitmap output when an editable .ogdoc can represent the design."
  ];
}

function formatCapabilities(capabilities: GenerationCapabilities): string {
  return Object.entries(capabilities)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

function formatAssetPlan(assetPlan: AssetPlanItem[]): string {
  return assetPlan
    .map((item) => `${item.id}: role=${item.role}; medium=${item.medium}; fallbacks=${item.fallbacks.join("/")}; textPolicy=${item.textPolicy}; reason=${item.reason}`)
    .join(" ");
}

function buildDesignQualityChecklist(input: GenerationBriefInput): string[] {
  return [
    "Readable at social-card size and inside the 64px safe zone.",
    "Each route variant has route-specific reason, text, imagery, and exportPath while sharing the system.",
    "Layer names are meaningful and all main objects remain editable.",
    "Canvas, platform preview, and export should render the same visual state.",
    input.referenceImage ? "Reference image influence is visible as mood/composition, not copied pixels." : "Visual direction is justified by app evidence or documented assumptions."
  ];
}

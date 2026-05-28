import type { Framework, GenerationStrategy } from "@graphforge/core";
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
  const outputContract =
    generationMode === "pure-image"
      ? [
          "pure 1200x630 Open Graph bitmap generation plan",
          "Use graphforge agent-image to create a local agent image handoff plan.",
          "Preserve the app name, route intent, brand colors, and readable social-card hierarchy in the prompt.",
          "Use the reference image as art direction if provided, without copying it blindly.",
          "Do not require a provider API key inside GraphForge; Codex, Claude, or OpenCode generates the asset and returns it to Studio."
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
    outputContract,
    codexPrompt: buildCodexPrompt({
      ...input,
      framework: scan.framework,
      routes,
      routeContexts: scan.routeContexts,
      metadataFiles: scan.metadataFiles,
      brandAssets: scan.brandAssets
    })
  };
}

function buildCodexPrompt(input: GenerationBriefInput & {
  framework: Framework;
  routes: string[];
  routeContexts: RouteContext[];
  metadataFiles: string[];
  brandAssets: string[];
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
      ? "The user chose pure image generation. Create an agent image handoff for Codex, Claude, or OpenCode; GraphForge should not call an image provider directly or require a provider API key."
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
    "Design requirements: premium, minimal, readable at social-card size, not generic AI dashboard styling.",
    generationMode === "pure-image"
      ? "Use graphforge agent-image with the app context, route intent, brand assets, and optional reference image, then open GraphForge Studio for review/edit/export."
      : "Generate a .ogdoc document with layers for headline, subtitle, badge, logo, screenshots, images, shapes, and background. Never bake important text into one SVG/image.",
    input.strategy === "pages" || input.strategy === "hybrid"
      ? "Generate one .ogdoc with internal page variants. Each page variant must preserve the shared visual system while changing route-specific text, badges, imagery, and exportPath."
      : "Generate a common .ogdoc document with no internal page variants unless the user changes strategy.",
    "If image generation tools are available, use them only for background/art/texture/product-scene asset layers unless pure-image mode was selected.",
    "Use strategy common/pages/hybrid exactly as requested and preserve the route list."
  ]
    .filter(Boolean)
    .join("\n");
}

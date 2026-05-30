import type { OgLayer, OgProject, TextLayer } from "@opengraph-creator/core";

export type AgentImageOutputFormat = "png" | "webp" | "jpeg" | "svg";
export type AiImageOutputFormat = AgentImageOutputFormat;

export interface AgentImagePromptInput {
  project?: OgProject;
  briefPrompt?: string;
  extraPrompt?: string;
  referenceImage?: string;
}

export interface AgentImagePlanInput extends AgentImagePromptInput {
  out: string;
  format?: AgentImageOutputFormat;
}

export interface AgentImagePlan {
  mode: "agent-handoff";
  agent: "codex-claude-or-opencode";
  output: string;
  prompt: string;
  expectedArtifact: {
    width: 1200;
    height: 630;
    format: AgentImageOutputFormat;
  };
  instructions: string[];
  acceptanceCriteria: string[];
  studioReview: string[];
}

export type AiImagePromptInput = AgentImagePromptInput;
export type AiImagePlanInput = AgentImagePlanInput;
export type AiImagePlan = AgentImagePlan;

export function buildAgentImagePrompt(input: AgentImagePromptInput): string {
  const project = input.project;
  const textLayers =
    project?.layers
      .filter((layer): layer is TextLayer => isTextLayer(layer) && !layer.hidden)
      .map((layer) => `${layer.name}: ${layer.text}`)
      .join("\n") ?? "";

  return [
    "You are Codex, Claude, or OpenCode acting as the coding agent for OpenGraph Creator Studio.",
    "Create or author a polished 1200x630 Open Graph image for a software product.",
    "You may generate a flat bitmap, author SVG/HTML, or produce editable OpenGraph Creator project JSON when that better preserves editing control.",
    "Use premium, minimal, developer-tool visual design with large readable typography.",
    "Avoid generic AI-dashboard styling, tiny text, visual clutter, and fake browser chrome unless useful.",
    project ? `App: ${project.name}` : undefined,
    project ? `Strategy: ${project.strategy}` : undefined,
    project ? `Generation mode: ${project.generationMode}` : undefined,
    project ? `Target pages: ${project.targetPages.join(", ")}` : undefined,
    project ? `Brand colors: accent ${project.brand.accent}, surface ${project.brand.surface}, text ${project.brand.text}` : undefined,
    textLayers ? `Editable layer copy to preserve:\n${textLayers}` : undefined,
    input.briefPrompt ? `OpenGraph Creator generation brief:\n${input.briefPrompt}` : undefined,
    input.referenceImage ? `Reference image to respect without copying blindly: ${input.referenceImage}` : undefined,
    input.extraPrompt ? `Additional art direction:\n${input.extraPrompt}` : undefined,
    "Leave enough safe space around edges for social platform cropping.",
    "After creating the asset, open or return it to OpenGraph Creator Studio for human review, platform preview, compression, export, and metadata publishing."
  ]
    .filter(Boolean)
    .join("\n");
}

export function createAgentImagePlan(input: AgentImagePlanInput): AgentImagePlan {
  const format = input.format ?? inferFormat(input.out);
  return {
    mode: "agent-handoff",
    agent: "codex-claude-or-opencode",
    output: input.out,
    prompt: buildAgentImagePrompt(input),
    expectedArtifact: {
      width: 1200,
      height: 630,
      format
    },
    instructions: [
      "Generate or author the OG asset using the coding agent environment, not an in-app provider key.",
      "Prefer editable OpenGraph Creator project JSON when the requested design can stay layered.",
      "For pure-image work, write the generated bitmap/SVG/HTML-derived export to the output path.",
      "Open OpenGraph Creator Studio after generation so the user can inspect, edit, preview platforms, compress, export, and publish metadata."
    ],
    acceptanceCriteria: [
      "Final image is exactly 1200x630.",
      "Key text remains inside the 64px safe zone.",
      "The design is unique to the app or page strategy selected by the user.",
      "No provider API key is required by OpenGraph Creator Studio or the CLI.",
      "The asset can be reviewed and exported from OpenGraph Creator Studio before metadata is applied."
    ],
    studioReview: [
      "Run opengraph-creator studio to open the editor.",
      "Import or open the generated project/asset in Studio.",
      "Use platform previews for X, LinkedIn, Facebook, Discord, Slack, WhatsApp, iMessage, and browser/search.",
      "Export optimized PNG/WebP/JPEG and run opengraph-creator publish --preview before any metadata mutation."
    ]
  };
}

export const buildAiImagePrompt = buildAgentImagePrompt;
export const createAiImagePlan = createAgentImagePlan;

function isTextLayer(layer: OgLayer): layer is TextLayer {
  return layer.kind === "text" || layer.kind === "badge";
}

function inferFormat(out: string): AgentImageOutputFormat {
  const normalized = out.toLowerCase();
  if (normalized.endsWith(".webp")) return "webp";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "jpeg";
  if (normalized.endsWith(".svg")) return "svg";
  return "png";
}

import type { GenerationStrategy } from "./index.js";

export type CompositionCapability = "available" | "unavailable" | "unknown";
export type CompositionAssetMedium = "ogdoc-text" | "ogdoc-shape" | "ogdoc-effect" | "svg" | "html" | "image-generation" | "repo-asset" | "placeholder";
export type CompositionTextPolicy = "editable-required" | "no-important-text-baked" | "decorative-text-only" | "pure-image-explicit";

export interface CompositionPlan {
  version: 1;
  appName: string;
  strategy: GenerationStrategy;
  capabilityGate: {
    imageGeneration: CompositionCapability;
    svgGeneration: CompositionCapability;
    htmlGeneration: CompositionCapability;
    webReferenceResearch: CompositionCapability;
  };
  brandEvidence: string[];
  referenceResearch: string[];
  conceptThesis: string;
  styleThesis: string;
  semanticPalette: Array<{ role: string; color: string; reason: string }>;
  compositionArchetype: {
    id: string;
    reason: string;
    avoidRepeating: string[];
  };
  focalHierarchy: Array<{ role: string; layerId: string; priority: number }>;
  assetStrategy: Array<{
    role: string;
    medium: CompositionAssetMedium;
    textPolicy: CompositionTextPolicy;
    reason: string;
  }>;
  effectsPlan: Array<{ kind: string; scope: "layer" | "canvas" | "export"; reason: string }>;
  negativeDirection: string[];
  qualityChecklist: string[];
}

export interface CompositionPlanLintResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  recovery: string[];
}

export function lintCompositionPlan(plan: CompositionPlan): CompositionPlanLintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recovery = [
    "Run the OpenGraph Creator question gate before generating .ogdoc.",
    "Use repo evidence, references, and route context to write a specific concept thesis.",
    "Keep all important text as editable .ogdoc text or badge layers.",
    "Choose a fresh composition archetype and record what structure must not be repeated."
  ];

  if (!plan.appName.trim()) errors.push("compositionPlan.appName is required.");
  if (!plan.brandEvidence.length) errors.push("compositionPlan.brandEvidence must include repo, route, brand, or user evidence.");
  if (!plan.referenceResearch.length) warnings.push("compositionPlan.referenceResearch should record local or user-supplied taste references.");
  if (isWeakThesis(plan.conceptThesis)) errors.push("compositionPlan.conceptThesis must be specific to the app/page, not a generic visual request.");
  if (isWeakThesis(plan.styleThesis)) errors.push("compositionPlan.styleThesis must describe a concrete visual taste and finish.");
  if (plan.semanticPalette.length < 3) errors.push("compositionPlan.semanticPalette needs at least three role-based colors.");
  for (const item of plan.semanticPalette) {
    if (!item.role || !item.reason || !/^#[0-9a-f]{6}$/i.test(item.color)) {
      errors.push("compositionPlan.semanticPalette entries need role, #rrggbb color, and reason.");
      break;
    }
  }
  if (isGenericArchetype(plan.compositionArchetype.id) || isGenericReason(plan.compositionArchetype.reason)) {
    errors.push("compositionPlan.compositionArchetype must be a fresh, justified structure instead of a generic repeated layout.");
  }
  if (plan.compositionArchetype.avoidRepeating.length < 2) {
    errors.push("compositionPlan.compositionArchetype.avoidRepeating must list structures to avoid repeating.");
  }
  if (plan.focalHierarchy.length < 2) errors.push("compositionPlan.focalHierarchy needs at least primary and secondary focal roles.");
  if (!plan.focalHierarchy.some((item) => item.priority === 1)) errors.push("compositionPlan.focalHierarchy must identify priority 1.");
  for (const item of plan.assetStrategy) {
    if (isImportantTextRole(item.role) && item.medium !== "ogdoc-text") {
      errors.push(`compositionPlan.assetStrategy role "${item.role}" handles important text and must use ogdoc-text.`);
    }
    if (isImportantTextRole(item.role) && item.textPolicy !== "editable-required") {
      errors.push(`compositionPlan.assetStrategy role "${item.role}" must declare editable-required.`);
    }
    if (isGenericReason(item.reason)) {
      errors.push(`compositionPlan.assetStrategy role "${item.role}" needs a concrete reason.`);
    }
  }
  if (!plan.assetStrategy.length) errors.push("compositionPlan.assetStrategy must describe how every major asset will be generated.");
  if (!plan.effectsPlan.every((effect) => effect.kind && effect.reason)) {
    errors.push("compositionPlan.effectsPlan entries need kind and reason.");
  }
  if (plan.negativeDirection.length < 3 || plan.negativeDirection.some(isGenericNegativeDirection)) {
    errors.push("compositionPlan.negativeDirection must contain specific anti-slop constraints.");
  }
  if (plan.qualityChecklist.length < 3) warnings.push("compositionPlan.qualityChecklist should include readability, editability, and preview/export parity.");

  return { ok: errors.length === 0, errors, warnings, recovery: errors.length ? recovery : [] };
}

function isWeakThesis(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length < 48 || /^(make it )?(look )?(cool|nice|modern|beautiful|premium)\.?$/.test(normalized);
}

function isGenericArchetype(value: string): boolean {
  return /^(left-text-right-image|generic-dashboard-card|default-template|same-as-before)$/i.test(value.trim());
}

function isGenericReason(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length < 28 || normalized === "looks good" || normalized === "visual interest" || normalized === "decoration";
}

function isImportantTextRole(role: string): boolean {
  return /\b(headline|subtitle|title|badge|cta|copy|route label|wordmark|logo text)\b/i.test(role);
}

function isGenericNegativeDirection(value: string): boolean {
  return /^(no bad design|avoid slop|make it good|not ugly)\.?$/i.test(value.trim());
}

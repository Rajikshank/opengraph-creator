import { describe, expect, it } from "vitest";
import { createDefaultProject } from "@graphforge/core";
import {
  buildAgentImagePrompt,
  buildAiImagePrompt,
  createAgentImagePlan,
  createAiImagePlan
} from "./ai-image";

describe("agent image handoff", () => {
  it("builds an OG-specific prompt for a coding agent from an editable project", () => {
    const project = createDefaultProject({
      name: "PromptKit",
      strategy: "hybrid",
      title: "Generate sharp previews",
      subtitle: "A developer-first OG workflow"
    });

    const prompt = buildAgentImagePrompt({ project, extraPrompt: "Use a product UI screenshot feeling." });

    expect(prompt).toContain("1200x630 Open Graph image");
    expect(prompt).toContain("coding agent");
    expect(prompt).toContain("Codex, Claude, or OpenCode");
    expect(prompt).toContain("PromptKit");
    expect(prompt).toContain("Generate sharp previews");
    expect(prompt).toContain("A developer-first OG workflow");
    expect(prompt).toContain("Use a product UI screenshot feeling.");
    expect(prompt).toContain("large readable typography");
  });

  it("creates a local handoff plan without requiring a provider key or network call", () => {
    const project = createDefaultProject({ name: "PlanOnly", strategy: "common" });

    const plan = createAgentImagePlan({ project, out: "public/og.png", format: "png" });

    expect(plan.mode).toBe("agent-handoff");
    expect(plan.agent).toBe("codex-claude-or-opencode");
    expect(plan.output).toBe("public/og.png");
    expect(plan.expectedArtifact).toMatchObject({ width: 1200, height: 630, format: "png" });
    expect(plan.instructions.join("\n")).toContain("Generate or author");
    expect(plan.instructions.join("\n")).toContain("GraphForge Studio");
    expect(plan.acceptanceCriteria).toContain("Final image is exactly 1200x630.");
    expect(JSON.stringify(plan)).not.toContain("OPENAI_API_KEY");
    expect(JSON.stringify(plan)).not.toContain("openai");
  });

  it("keeps ai-image as a compatibility alias for the agent handoff path", () => {
    const project = createDefaultProject({ name: "Alias", strategy: "common" });

    const prompt = buildAiImagePrompt({ project });
    const plan = createAiImagePlan({ project, out: "public/og.png" });

    expect(prompt).toContain("Codex, Claude, or OpenCode");
    expect(plan.mode).toBe("agent-handoff");
  });
});

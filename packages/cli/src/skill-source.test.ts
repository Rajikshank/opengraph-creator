import { readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const skillRoot = "skills/opengraph-creator";

describe("OpenGraph Creator public skill source", () => {
  it("documents editable layer generation and preview-first metadata safety", async () => {
    const skill = await readFile(`${skillRoot}/SKILL.md`, "utf8");

    expect(skill).toContain("name: opengraph-creator");
    expect(skill).toContain("Codex, Claude, or OpenCode");
    expect(skill).toContain("editable document JSON");
    expect(skill).toContain("Always create an editable `.ogdoc` master document");
    expect(skill).toContain("Non-Negotiable Editable Master Rule");
    expect(skill).toContain("preview before applying metadata");
    expect(skill).toContain("opengraph-creator session create");
    expect(skill).toContain("opengraph-creator session attach");
    expect(skill).toContain("--until next-action --timeout 0");
    expect(skill).toContain("Mandatory State Machine");
    expect(skill).toContain("Do not end the chat after launch");
    expect(skill).toContain("agent-restart-from-question-gate");
    expect(skill).toContain("npx skills check -g opengraph-creator");
    expect(skill).toContain('npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent "*" -y');
    expect(skill).not.toContain("OPENAI_API_KEY");
    expect(skill).not.toContain("Image API");
  });

  it("keeps the question gate and capability gate in the installable source", async () => {
    const skill = await readFile(`${skillRoot}/SKILL.md`, "utf8");

    expect(skill).toContain("Question Gate");
    expect(skill).toContain("Capability And Question Gate");
    expect(skill).toContain("Do not assume image generation exists");
    expect(skill).toContain("Never invent custom `ogcreator://` URLs");
    expect(skill).toContain("Stop and wait for answers");
    expect(skill).toContain("Do not create a session, document, image, SVG, HTML, or launch Studio before the Question Gate is complete");
    expect(skill).toContain("Coverage: one common OG for the whole app, page-specific OG images, or a hybrid");
    expect(skill).toContain("Asset strategy: which visual parts should be editable text/shapes/effects");
    expect(skill).toContain("Pure-image fallback is allowed only when the user explicitly asks");
    expect(skill).toContain("generation-brief.json");
    expect(skill).toContain("assetStrategy");
    expect(skill).toContain("referenceResearch");
    expect(skill).toContain("conceptThesis");
    expect(skill).toContain("styleThesis");
    expect(skill).toContain("recipeSelection");
    expect(skill).toContain("opengraph-creator brief lint");
    expect(skill).toContain("opengraph-creator render check");
    expect(skill).toContain('--document ".opengraph-creator/sessions/<id>/document.ogdoc"');
    expect(skill).toContain("routeVariantRules");
  });

  it("ships public references, agent metadata, and bootstrap script from one skill folder", async () => {
    const [
      metadata,
      handoffReference,
      waitingReference,
      schemaReference,
      metadataReference,
      workflowReference,
      ogdocReference,
      recoveryReference,
      visualReference,
      routerReference,
      recipeReference,
      ensureScript
    ] = await Promise.all([
      readFile(`${skillRoot}/agents/openai.yaml`, "utf8"),
      readFile(`${skillRoot}/references/agent-handoff.md`, "utf8"),
      readFile(`${skillRoot}/references/agent-waiting.md`, "utf8"),
      readFile(`${skillRoot}/references/project-schema.md`, "utf8"),
      readFile(`${skillRoot}/references/metadata-apply.md`, "utf8"),
      readFile(`${skillRoot}/references/workflow.md`, "utf8"),
      readFile(`${skillRoot}/references/ogdoc-schema.md`, "utf8"),
      readFile(`${skillRoot}/references/recovery.md`, "utf8"),
      readFile(`${skillRoot}/references/visual-generation-guide.md`, "utf8"),
      readFile(`${skillRoot}/references/asset-strategy-router.md`, "utf8"),
      readFile(`${skillRoot}/references/recipes/route-map.md`, "utf8"),
      readFile(`${skillRoot}/scripts/ensure-opengraph-creator.mjs`, "utf8")
    ]);

    expect(metadata).toContain("display_name: OpenGraph Creator");
    expect(metadata).toContain("Generate editable .ogdoc");
    expect(handoffReference).toContain(".opengraph-creator/agent-handoff.json");
    expect(handoffReference).toContain("--until next-action");
    expect(waitingReference).toContain("durable files plus explicit wait targets");
    expect(schemaReference).toContain("sourceArtifacts");
    expect(metadataReference).toContain("preview before applying");
    expect(workflowReference).toContain("opengraph-creator session launch");
    expect(ogdocReference).toContain(".ogdoc");
    expect(recoveryReference).toContain("ensure-opengraph-creator");
    expect(visualReference).toContain("Capability Gate");
    expect(visualReference).toContain("Without image generation");
    expect(visualReference).toContain("Do not use invented `ogcreator://` URLs");
    expect(visualReference).toContain("Composition Archetype Router");
    expect(routerReference).toContain("Asset Strategy Router");
    expect(routerReference).toContain("opengraph-creator design lint");
    expect(routerReference).toContain('--document ".opengraph-creator/sessions/<id>/document.ogdoc"');
    expect(recipeReference).toContain("Route Map");
    expect(ensureScript).toContain("opengraph-creator doctor --json");
    await expect(stat(`${skillRoot}/scripts/ensure-opengraph-creator.mjs`)).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(`${skillRoot}/references/visual-generation-guide.md`)).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(`${skillRoot}/references/asset-strategy-router.md`)).resolves.toMatchObject({ size: expect.any(Number) });
  });
});

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGenerationBrief } from "./brief";
import { runCli } from "./index";

describe("generation brief", () => {
  it("turns a repo scan into a Codex-ready editable OG brief", async () => {
    const repo = await createNextRepo();

    const brief = await createGenerationBrief({
      repo,
      name: "BillingKit",
      strategy: "pages",
      referenceImage: "references/inspiration.png"
    });

    expect(brief.appName).toBe("BillingKit");
    expect(brief.strategy).toBe("pages");
    expect(brief.framework).toBe("next");
    expect(brief.routes).toEqual(["/", "/pricing"]);
    expect(brief.routeContexts).toEqual([
      expect.objectContaining({ route: "/", routeFile: "app/page.tsx", detectedTitle: "BillingKit Home" }),
      expect.objectContaining({ route: "/pricing", routeFile: "app/pricing/page.tsx", detectedTitle: "Pricing Plans" })
    ]);
    expect(brief.brandAssets).toEqual(["public/logo.svg"]);
    expect(brief.referenceImage).toBe("references/inspiration.png");
    expect(brief.referenceResearch).toContain("Inspect local brand assets, screenshots, existing metadata, and route copy before selecting a visual direction.");
    expect(brief.capabilities.studioRuntime).toBe("available");
    expect(brief.conceptThesis).toContain("BillingKit");
    expect(brief.semanticPalette.join("\n")).toContain("brand anchor");
    expect(brief.styleThesis).toContain("BillingKit");
    expect(brief.visualTasteProfile.join("\n")).toContain("premium but specific");
    expect(brief.compositionPlan.join("\n")).toContain("composition archetype");
    expect(brief.compositionPlan.join("\n")).toContain("Do not reuse the last OpenGraph Creator document structure");
    expect(brief.compositionPlan.join("\n")).not.toContain("Use a shared 1200x630 composition with headline, subtitle, badge, logo/screenshot/art");
    expect(brief.compositionPlanV2).toMatchObject({
      version: 1,
      appName: "BillingKit",
      strategy: "pages",
      compositionArchetype: expect.objectContaining({ id: "route-map" })
    });
    expect(brief.compositionPlanV2.brandEvidence.join("\n")).toContain("public/logo.svg");
    expect(brief.compositionPlanV2.assetStrategy.some((item) => item.role.includes("headline") && item.medium === "ogdoc-text")).toBe(true);
    expect(brief.recipeSelection.id).toBe("route-map");
    expect(brief.assetPlan).toEqual([
      expect.objectContaining({ id: "editable-headline-system", medium: "ogdoc-text", textPolicy: "editable-required" }),
      expect.objectContaining({ id: "editable-layout-geometry", medium: "ogdoc-shape" }),
      expect.objectContaining({ id: "supporting-visual-asset", textPolicy: "no-important-text-baked" }),
      expect.objectContaining({ id: "controlled-effects", medium: "ogdoc-effect" })
    ]);
    expect(brief.libraryPlan.forbiddenRuntimeChanges.join("\n")).toContain("Do not make React components the master document format");
    expect(brief.noisePolicy).toBe("disallowed");
    expect(brief.negativeDirection.join("\n")).toContain("Do not bake important text");
    expect(brief.negativeDirection.join("\n")).toContain("Do not repeat the same left-text/right-art structure");
    expect(brief.designQualityChecklist.join("\n")).toContain("Each route variant has route-specific reason");
    expect(brief.outputContract).toContain("editable .ogdoc Studio document package");
    expect(brief.codexPrompt).toContain("Create page-specific Open Graph images");
    expect(brief.codexPrompt).toContain("Generate a .ogdoc document");
    expect(brief.codexPrompt).toContain("Reference research phase:");
    expect(brief.codexPrompt).toContain("Concept thesis:");
    expect(brief.codexPrompt).toContain("Style thesis:");
    expect(brief.codexPrompt).toContain("Composition plan v2:");
    expect(brief.codexPrompt).toContain("Asset plan:");
    expect(brief.codexPrompt).toContain("editable-headline-system");
    expect(brief.codexPrompt).toContain("Negative direction:");
    expect(brief.codexPrompt).toContain("Do not copy protected internet references");
    expect(brief.codexPrompt).toContain("Route context:");
    expect(brief.codexPrompt).toContain("Pricing Plans");
    expect(brief.codexPrompt).toContain("one .ogdoc with internal page variants");
    expect(brief.codexPrompt).toContain("composition archetype");
    expect(brief.codexPrompt).toContain("Noise policy: disallowed");
    expect(brief.codexPrompt).toContain("/pricing");
  });

  it("supports a pure image generation mode in the Codex brief", async () => {
    const repo = await createNextRepo();

    const brief = await createGenerationBrief({
      repo,
      name: "BillingKit",
      strategy: "common",
      generationMode: "pure-image",
      referenceImage: "references/og-reference.png"
    });

    expect(brief.generationMode).toBe("pure-image");
    expect(brief.outputContract).toContain("pure 1200x630 Open Graph bitmap generation plan");
    expect(brief.codexPrompt).toContain("The user chose pure image generation.");
    expect(brief.codexPrompt).toContain("agent image handoff");
    expect(brief.codexPrompt).toContain("Codex, Claude, or OpenCode");
    expect(brief.codexPrompt).not.toContain("OPENAI_API_KEY");
    expect(brief.codexPrompt).toContain("references/og-reference.png");
  });

  it("writes the brief through the CLI entrypoint", async () => {
    const repo = await createNextRepo();
    const target = join(repo, ".opengraph-creator", "brief.json");

    await runCli(["brief", "--repo", repo, "--name", "BillingKit", "--strategy", "hybrid", "--mode", "pure-image", "--out", target]);

    const brief = JSON.parse(await readFile(target, "utf8")) as Awaited<ReturnType<typeof createGenerationBrief>>;
    expect(brief.strategy).toBe("hybrid");
    expect(brief.generationMode).toBe("pure-image");
    expect(brief.routes).toEqual(["/", "/pricing"]);
    expect(brief.codexPrompt).toContain("common base design");
  });

  it("lints a generated brief through the CLI", async () => {
    const repo = await createNextRepo();
    const target = join(repo, ".opengraph-creator", "brief.json");
    const log = join(repo, ".opengraph-creator", "generation-checks.jsonl");

    await runCli(["brief", "--repo", repo, "--name", "BillingKit", "--strategy", "pages", "--out", target]);
    await runCli(["brief", "lint", "--source", target, "--log", log]);

    const logText = await readFile(log, "utf8");
    expect(logText).toContain("brief.lint");
    expect(logText).toContain('"ok":true');
  });
});

async function createNextRepo(): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), "OpenGraphCreator-brief-"));
  await mkdir(join(repo, "app", "pricing"), { recursive: true });
  await mkdir(join(repo, "public"), { recursive: true });
  await writeFile(join(repo, "next.config.js"), "module.exports = {}");
  await writeFile(
    join(repo, "app", "page.tsx"),
    'export const metadata = { title: "BillingKit Home", description: "Automated billing for focused SaaS teams." }; export default function Page() { return <h1>BillingKit Home</h1> }'
  );
  await writeFile(
    join(repo, "app", "pricing", "page.tsx"),
    'export const metadata = { title: "Pricing Plans", description: "Simple tiers for teams from launch to scale." }; export default function Pricing() { return <h1>Pricing Plans</h1> }'
  );
  await writeFile(join(repo, "app", "layout.tsx"), "export const metadata = {}");
  await writeFile(join(repo, "public", "logo.svg"), "<svg></svg>");
  return repo;
}

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
    expect(brief.outputContract).toContain("editable .ogdoc Studio document package");
    expect(brief.codexPrompt).toContain("Create page-specific Open Graph images");
    expect(brief.codexPrompt).toContain("Generate a .ogdoc document");
    expect(brief.codexPrompt).toContain("Route context:");
    expect(brief.codexPrompt).toContain("Pricing Plans");
    expect(brief.codexPrompt).toContain("one .ogdoc with internal page variants");
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
    const target = join(repo, ".graphforge", "brief.json");

    await runCli(["brief", "--repo", repo, "--name", "BillingKit", "--strategy", "hybrid", "--mode", "pure-image", "--out", target]);

    const brief = JSON.parse(await readFile(target, "utf8")) as Awaited<ReturnType<typeof createGenerationBrief>>;
    expect(brief.strategy).toBe("hybrid");
    expect(brief.generationMode).toBe("pure-image");
    expect(brief.routes).toEqual(["/", "/pricing"]);
    expect(brief.codexPrompt).toContain("common base design");
  });
});

async function createNextRepo(): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), "graphforge-brief-"));
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

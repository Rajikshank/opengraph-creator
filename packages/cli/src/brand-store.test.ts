import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createBrandStoreFromScan, getBrandStorePaths, recordCompositionHistory } from "./brand-store";
import { createGenerationBrief } from "./brief";
import { runCli } from "./index";
import { scanRepo } from "./scan";

describe("brand store", () => {
  it("creates a local brand evidence store from repo scan data", async () => {
    const repo = await createBrandRepo();
    const scan = await scanRepo(repo);

    const store = await createBrandStoreFromScan(scan);
    const paths = getBrandStorePaths(repo);
    const storedJson = JSON.parse(await readFile(paths.brandJson, "utf8"));

    expect(store).toMatchObject({
      version: 1,
      appName: "Brand App",
      framework: "next",
      routes: [
        expect.objectContaining({ route: "/", title: "Brand App Home" }),
        expect.objectContaining({ route: "/pricing", title: "Pricing Studio" })
      ]
    });
    expect(store.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "public/logo.svg", role: "brand-asset" }),
      expect.objectContaining({ path: "app/layout.tsx", role: "metadata" })
    ]));
    expect(store.rules.blockedMotifs).toContain("left-text-right-image");
    expect(storedJson.assets[0]).toMatchObject({ path: "public/logo.svg" });
  });

  it("records recent composition history so future briefs avoid repeated structures", async () => {
    const repo = await createBrandRepo();
    await createBrandStoreFromScan(await scanRepo(repo));

    await recordCompositionHistory(repo, {
      sessionId: "session-a",
      archetypeId: "data-signal",
      conceptThesis: "Data-signal newsroom direction.",
      createdAt: "2026-06-08T00:00:00.000Z"
    });
    const brief = await createGenerationBrief({ repo, name: "Brand App", strategy: "hybrid" });

    expect(brief.compositionPlanV2.compositionArchetype.avoidRepeating).toContain("recent:data-signal");
    expect(brief.referenceResearch.join("\n")).toContain("brand store");
  });

  it("exposes brand inspect through the CLI", async () => {
    const repo = await createBrandRepo();

    await runCli(["brand", "inspect", "--repo", repo]);
    const store = JSON.parse(await readFile(getBrandStorePaths(repo).brandJson, "utf8"));

    expect(store.appName).toBe("Brand App");
    expect(store.routes.map((route: { route: string }) => route.route)).toEqual(["/", "/pricing"]);
  });
});

async function createBrandRepo(): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), "OpenGraphCreator-brand-"));
  await mkdir(join(repo, "app", "pricing"), { recursive: true });
  await mkdir(join(repo, "public"), { recursive: true });
  await writeFile(join(repo, "next.config.js"), "module.exports = {}");
  await writeFile(
    join(repo, "app", "page.tsx"),
    'export const metadata = { title: "Brand App Home", description: "Create premium market cards." }; export default function Page() { return <h1>Brand App Home</h1> }'
  );
  await writeFile(
    join(repo, "app", "pricing", "page.tsx"),
    'export const metadata = { title: "Pricing Studio", description: "Pricing plans for creative teams." }; export default function Pricing() { return <h1>Pricing Studio</h1> }'
  );
  await writeFile(join(repo, "app", "layout.tsx"), "export const metadata = {}");
  await writeFile(join(repo, "public", "logo.svg"), "<svg><title>Brand App</title></svg>");
  return repo;
}

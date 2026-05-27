import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanRepo } from "./scan";

describe("repo scanner", () => {
  it("detects framework, routes, metadata files, and brand assets", async () => {
    const repo = await mkdtemp(join(tmpdir(), "graphforge-scan-"));
    await mkdir(join(repo, "app", "pricing"), { recursive: true });
    await mkdir(join(repo, "public"), { recursive: true });
    await writeFile(join(repo, "next.config.js"), "module.exports = {}");
    await writeFile(join(repo, "app", "page.tsx"), "export default function Page() { return null }");
    await writeFile(join(repo, "app", "pricing", "page.tsx"), "export default function Pricing() { return null }");
    await writeFile(join(repo, "app", "layout.tsx"), "export const metadata = {}");
    await writeFile(join(repo, "public", "logo.svg"), "<svg></svg>");

    const result = await scanRepo(repo);

    expect(result.framework).toBe("next");
    expect(result.routes).toEqual(["/", "/pricing"]);
    expect(result.metadataFiles).toEqual(["app/layout.tsx"]);
    expect(result.brandAssets).toEqual(["public/logo.svg"]);
  });
});

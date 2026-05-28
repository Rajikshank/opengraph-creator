import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultProject, unpackStudioDocument } from "@graphforge/core";
import {
  applyMetadataPlanToRepo,
  createDoctorReport,
  createProjectFromArgs,
  createMetadataPlan,
  exportProjectPages,
  exportProjectFile,
  runCli
} from "./index";

describe("GraphForge CLI helpers", () => {
  it("creates a project from CLI-like args without touching app files", () => {
    const project = createProjectFromArgs({
      name: "Acme",
      strategy: "pages",
      repo: "D:/apps/acme",
      pages: ["/", "/pricing"],
      preset: "technical-article",
      generationMode: "pure-image"
    });

    expect(project.name).toBe("Acme");
    expect(project.sourceRepo).toBe("D:/apps/acme");
    expect(project.generationMode).toBe("pure-image");
    expect(project.targetPages).toEqual(["/", "/pricing"]);
    expect(project.pages?.map((page) => [page.route, page.layers.find((layer) => layer.id === "badge")?.kind])).toEqual([
      ["/", "badge"],
      ["/pricing", "badge"]
    ]);
    expect(project.sharedDesign?.description).toContain("Shared visual system");
  });

  it("writes generation mode through the new CLI command", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-new-mode-"));
    const projectPath = join(dir, "project.og.json");

    await runCli(["new", "--name", "Mode App", "--strategy", "hybrid", "--mode", "pure-image", "--out", projectPath]);

    const project = JSON.parse(await readFile(projectPath, "utf8")) as ReturnType<typeof createDefaultProject>;
    expect(project.generationMode).toBe("pure-image");
    expect(project.strategy).toBe("hybrid");
  });

  it("creates one multi-page document when the CLI receives page targets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-new-pages-"));
    const documentPath = join(dir, "pages.ogdoc");

    await runCli([
      "document",
      "new",
      "--name",
      "Pages App",
      "--strategy",
      "pages",
      "--mode",
      "template",
      "--pages",
      "/,/pricing,/features",
      "--out",
      documentPath
    ]);

    const document = await unpackStudioDocument(await readFile(documentPath));
    expect(document.project.pages?.map((page) => [page.route, page.exportPath])).toEqual([
      ["/", "public/og.png"],
      ["/pricing", "public/og/pricing.png"],
      ["/features", "public/og/features.png"]
    ]);
    expect(document.project.layers).toEqual(document.project.pages?.[0].layers);
  });

  it("builds a preview-first metadata plan for Next.js", () => {
    const plan = createMetadataPlan({
      framework: "next",
      page: "/pricing",
      imagePath: "public/og/pricing.png",
      confirm: false
    });

    expect(plan.mode).toBe("preview");
    expect(plan.mutations).toHaveLength(0);
    expect(plan.instructions.join("\n")).toContain("metadata.openGraph.images");
  });

  it("exports a project file to PNG through the CLI service layer", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-cli-"));
    const projectPath = join(dir, "project.og.json");
    const target = join(dir, "og.png");
    await writeFile(projectPath, JSON.stringify(createDefaultProject({ name: "CLI Export", strategy: "common" })));

    const result = await exportProjectFile({ projectPath, format: "png", target });

    expect(result).toMatchObject({ format: "png", width: 1200, height: 630, target });
  });

  it("exports a project file to JPEG through the CLI service layer", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-cli-jpeg-"));
    const projectPath = join(dir, "project.og.json");
    const target = join(dir, "og.jpg");
    await writeFile(projectPath, JSON.stringify(createDefaultProject({ name: "CLI JPEG Export", strategy: "common" })));

    const result = await exportProjectFile({ projectPath, format: "jpg", target });

    expect(result).toMatchObject({ format: "jpg", width: 1200, height: 630, target });
  });

  it("exports every page variant with deterministic page-to-image mapping", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-page-export-"));
    const project = createProjectFromArgs({
      name: "Page Export",
      strategy: "pages",
      generationMode: "template",
      pages: ["/", "/pricing"]
    });
    const projectPath = join(dir, "pages.og.json");
    await writeFile(projectPath, JSON.stringify(project));

    const result = await exportProjectPages({
      projectPath,
      format: "png",
      outDir: join(dir, "public", "og")
    });

    expect(result.exports.map((item) => [item.page, item.path, item.width, item.height])).toEqual([
      ["/", join(dir, "public", "og", "home.png"), 1200, 630],
      ["/pricing", join(dir, "public", "og", "pricing.png"), 1200, 630]
    ]);
    await expect(stat(result.exports[0].path)).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(result.exports[1].path)).resolves.toMatchObject({ size: expect.any(Number) });
  });

  it("renders SVG from an existing editable project file through the CLI entrypoint", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-render-project-"));
    const projectPath = join(dir, "project.og.json");
    const target = join(dir, "public", "og.svg");
    const project = createDefaultProject({
      name: "Render Project",
      strategy: "pages",
      title: "Exact project headline",
      subtitle: "Do not replace this copy"
    });
    await writeFile(projectPath, JSON.stringify(project));

    await runCli(["render", "--project", projectPath, "--out", target]);

    const svg = await readFile(target, "utf8");
    expect(svg).toContain("Exact project headline");
    expect(svg).toContain("Do not replace this copy");
    expect(svg).not.toContain("Rendered OG");
  });

  it("applies confirmed Next.js metadata by creating the smallest metadata file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-next-"));

    const result = await applyMetadataPlanToRepo({
      repo: dir,
      framework: "next",
      page: "/",
      imagePath: "public/og.png",
      confirm: true
    });
    const layout = await readFile(join(dir, "app", "layout.tsx"), "utf8");

    expect(result.mode).toBe("apply");
    expect(layout).toContain("openGraph");
    expect(layout).toContain("/og.png");
  });

  it("preserves an existing Next.js layout while replacing a simple metadata export", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-next-preserve-"));
    const layoutPath = join(dir, "app", "layout.tsx");
    await mkdir(join(dir, "app"), { recursive: true });
    await writeFile(
      layoutPath,
      [
        'import type { Metadata } from "next";',
        "",
        "export const metadata: Metadata = {",
        '  title: "Keep title",',
        "};",
        "",
        "export default function RootLayout({ children }: { children: React.ReactNode }) {",
        "  return <html><body><main>{children}</main></body></html>;",
        "}"
      ].join("\n")
    );

    await applyMetadataPlanToRepo({
      repo: dir,
      framework: "next",
      page: "/",
      imagePath: "public/og/next.png",
      confirm: true
    });

    const layout = await readFile(layoutPath, "utf8");
    expect(layout).toContain('title: "Keep title"');
    expect(layout).toContain('url: "/og/next.png"');
    expect(layout).toContain('images: ["/og/next.png"]');
    expect(layout).toContain("<main>{children}</main>");
    expect(await readFile(`${layoutPath}.graphforge.bak`, "utf8")).toContain("Keep title");
  });

  it("inserts a Next.js metadata export when a layout has none", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-next-insert-"));
    const layoutPath = join(dir, "app", "layout.tsx");
    await mkdir(join(dir, "app"), { recursive: true });
    await writeFile(
      layoutPath,
      [
        "export default function RootLayout({ children }: { children: React.ReactNode }) {",
        "  return <html><body>{children}</body></html>;",
        "}"
      ].join("\n")
    );

    await applyMetadataPlanToRepo({
      repo: dir,
      framework: "next",
      page: "/",
      imagePath: "public/og.png",
      confirm: true
    });

    const layout = await readFile(layoutPath, "utf8");
    expect(layout).toContain('import type { Metadata } from "next";');
    expect(layout).toContain("export const metadata: Metadata");
    expect(layout).toContain('url: "/og.png"');
    expect(layout).toContain("RootLayout");
  });

  it.each([
    ["astro", "src/layouts/Layout.astro", "og:image"],
    ["nuxt", "app.vue", "useSeoMeta"],
    ["remix", "app/root.tsx", "export const meta"],
    ["vite", "index.html", "og:image"],
    ["html", "index.html", "og:image"]
  ] as const)("applies confirmed %s metadata", async (framework, filePath, expected) => {
    const dir = await mkdtemp(join(tmpdir(), `graphforge-${framework}-`));

    await applyMetadataPlanToRepo({
      repo: dir,
      framework,
      page: "/",
      imagePath: "public/og.png",
      confirm: true
    });

    const file = await readFile(join(dir, filePath), "utf8");
    expect(file).toContain(expected);
    expect(file).toContain("/og.png");
  });

  it("preserves an existing Astro layout while upserting social image tags", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-astro-preserve-"));
    const layoutPath = join(dir, "src", "layouts", "Layout.astro");
    await mkdir(join(dir, "src", "layouts"), { recursive: true });
    await writeFile(
      layoutPath,
      [
        "---",
        "const title = 'Keep Astro';",
        "---",
        "<html lang=\"en\">",
        "  <head>",
        "    <title>{title}</title>",
        "    <meta property=\"og:image\" content=\"/old-astro.png\" />",
        "  </head>",
        "  <body>",
        "    <slot />",
        "  </body>",
        "</html>"
      ].join("\n")
    );

    await applyMetadataPlanToRepo({
      repo: dir,
      framework: "astro",
      page: "/",
      imagePath: "public/og/astro.png",
      confirm: true
    });

    const layout = await readFile(layoutPath, "utf8");
    expect(layout).toContain("const title = 'Keep Astro';");
    expect(layout).toContain("<title>{title}</title>");
    expect(layout).toContain("<slot />");
    expect(layout).toContain('<meta property="og:image" content="/og/astro.png">');
    expect(layout).toContain('<meta name="twitter:image" content="/og/astro.png">');
    expect(layout).not.toContain("/old-astro.png");
    expect(await readFile(`${layoutPath}.graphforge.bak`, "utf8")).toContain("/old-astro.png");
  });

  it("preserves an existing Nuxt app while upserting useSeoMeta", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-nuxt-preserve-"));
    const appPath = join(dir, "app.vue");
    await writeFile(
      appPath,
      [
        "<script setup lang=\"ts\">",
        "const appName = 'Keep Nuxt';",
        "useSeoMeta({",
        "  title: appName,",
        "  ogImage: '/old-nuxt.png'",
        "});",
        "</script>",
        "",
        "<template>",
        "  <NuxtLayout>",
        "    <NuxtPage />",
        "  </NuxtLayout>",
        "</template>"
      ].join("\n")
    );

    await applyMetadataPlanToRepo({
      repo: dir,
      framework: "nuxt",
      page: "/",
      imagePath: "public/og/nuxt.png",
      confirm: true
    });

    const app = await readFile(appPath, "utf8");
    expect(app).toContain("const appName = 'Keep Nuxt';");
    expect(app).toContain("title: appName");
    expect(app).toContain('ogImage: "/og/nuxt.png"');
    expect(app).toContain('twitterImage: "/og/nuxt.png"');
    expect(app).toContain("<NuxtLayout>");
    expect(await readFile(`${appPath}.graphforge.bak`, "utf8")).toContain("/old-nuxt.png");
  });

  it("inserts a Nuxt script setup when app.vue has only a template", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-nuxt-insert-"));
    const appPath = join(dir, "app.vue");
    await writeFile(appPath, "<template><NuxtPage /></template>");

    await applyMetadataPlanToRepo({
      repo: dir,
      framework: "nuxt",
      page: "/",
      imagePath: "public/og.png",
      confirm: true
    });

    const app = await readFile(appPath, "utf8");
    expect(app).toContain('<script setup lang="ts">');
    expect(app).toContain('ogImage: "/og.png"');
    expect(app).toContain("<template><NuxtPage /></template>");
  });

  it("preserves an existing Remix root while upserting meta entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-remix-preserve-"));
    const rootPath = join(dir, "app", "root.tsx");
    await mkdir(join(dir, "app"), { recursive: true });
    await writeFile(
      rootPath,
      [
        'import type { MetaFunction } from "@remix-run/node";',
        'import { Links, Meta, Outlet, Scripts } from "@remix-run/react";',
        "",
        "export const meta: MetaFunction = () => [",
        '  { title: "Keep Remix" },',
        '  { property: "og:image", content: "/old-remix.png" }',
        "];",
        "",
        "export default function App() {",
        "  return <html><head><Meta /><Links /></head><body><Outlet /><Scripts /></body></html>;",
        "}"
      ].join("\n")
    );

    await applyMetadataPlanToRepo({
      repo: dir,
      framework: "remix",
      page: "/",
      imagePath: "public/og/remix.png",
      confirm: true
    });

    const root = await readFile(rootPath, "utf8");
    expect(root).toContain('{ title: "Keep Remix" }');
    expect(root).toContain('{ property: "og:image", content: "/og/remix.png" }');
    expect(root).toContain('{ name: "twitter:image", content: "/og/remix.png" }');
    expect(root).toContain("<Outlet />");
    expect(root).not.toContain("/old-remix.png");
    expect(await readFile(`${rootPath}.graphforge.bak`, "utf8")).toContain("/old-remix.png");
  });

  it("inserts a Remix meta export when root has none", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-remix-insert-"));
    const rootPath = join(dir, "app", "root.tsx");
    await mkdir(join(dir, "app"), { recursive: true });
    await writeFile(rootPath, "export default function App() { return <Outlet />; }");

    await applyMetadataPlanToRepo({
      repo: dir,
      framework: "remix",
      page: "/",
      imagePath: "public/og.png",
      confirm: true
    });

    const root = await readFile(rootPath, "utf8");
    expect(root).toContain('import type { MetaFunction } from "@remix-run/node";');
    expect(root).toContain("export const meta: MetaFunction");
    expect(root).toContain('{ property: "og:image", content: "/og.png" }');
    expect(root).toContain("export default function App");
  });

  it("backs up existing metadata files before confirmed apply", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-backup-"));
    const file = join(dir, "index.html");
    await writeFile(file, "<html><head></head><body>Existing</body></html>");

    await applyMetadataPlanToRepo({
      repo: dir,
      framework: "html",
      page: "/",
      imagePath: "public/og.png",
      confirm: true
    });

    expect(await readFile(`${file}.graphforge.bak`, "utf8")).toContain("Existing");
  });

  it("preserves existing HTML while upserting OG metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-html-preserve-"));
    const file = join(dir, "index.html");
    await writeFile(
      file,
      [
        "<!doctype html>",
        "<html>",
        "  <head>",
        "    <title>Keep Me</title>",
        "    <meta property=\"og:image\" content=\"/old.png\">",
        "  </head>",
        "  <body><main id=\"app\">Existing app</main></body>",
        "</html>"
      ].join("\n")
    );

    await applyMetadataPlanToRepo({
      repo: dir,
      framework: "html",
      page: "/",
      imagePath: "public/og/new.png",
      confirm: true
    });

    const html = await readFile(file, "utf8");
    expect(html).toContain("<title>Keep Me</title>");
    expect(html).toContain("<main id=\"app\">Existing app</main>");
    expect(html).toContain('<meta property="og:image" content="/og/new.png">');
    expect(html).toContain('<meta name="twitter:image" content="/og/new.png">');
    expect(html).not.toContain("/old.png");
  });

  it("inserts HTML metadata into an existing head when tags are missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-vite-preserve-"));
    const file = join(dir, "index.html");
    await writeFile(file, "<html><head><title>Vite App</title></head><body><div id=\"root\"></div></body></html>");

    await applyMetadataPlanToRepo({
      repo: dir,
      framework: "vite",
      page: "/",
      imagePath: "public/og.png",
      confirm: true
    });

    const html = await readFile(file, "utf8");
    expect(html).toContain("<title>Vite App</title>");
    expect(html).toContain('<meta property="og:image" content="/og.png">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<div id="root"></div>');
  });

  it("adds a head to minimal HTML without dropping body content", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-html-no-head-"));
    const file = join(dir, "index.html");
    await writeFile(file, "<html><body><div id=\"root\">Keep body</div></body></html>");

    await applyMetadataPlanToRepo({
      repo: dir,
      framework: "html",
      page: "/",
      imagePath: "public/og.png",
      confirm: true
    });

    const html = await readFile(file, "utf8");
    expect(html).toContain("<head>");
    expect(html).toContain('<meta property="og:image" content="/og.png">');
    expect(html).toContain('<div id="root">Keep body</div>');
  });

  it("saves projects to a selected library through the CLI entrypoint", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-cli-save-"));
    const projectPath = join(dir, "project.og.json");
    const home = join(dir, "home");
    await writeFile(projectPath, JSON.stringify(createDefaultProject({ name: "Saved CLI", strategy: "common" })));

    await runCli(["save", "--project", projectPath, "--home", home]);
    const files = await readFile(join(home, "projects", JSON.parse(await readFile(projectPath, "utf8")).projectId + ".og.json"), "utf8");

    expect(files).toContain("Saved CLI");
  });

  it("writes page-specific variant project files from a base project", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-variants-"));
    const projectPath = join(dir, "base.og.json");
    await writeFile(
      projectPath,
      JSON.stringify(createDefaultProject({ name: "Variants", strategy: "pages", pages: ["/", "/pricing"] }))
    );

    await runCli(["variants", "--project", projectPath, "--outDir", dir]);
    const variantFiles = (await readdir(dir)).filter((file) => file.endsWith(".og.json") && file !== "base.og.json");
    const pricingFile = variantFiles.find((file) => file.includes("pricing"));
    const pricing = await readFile(join(dir, pricingFile ?? ""), "utf8");

    expect(pricing).toContain("\"targetPages\": [\n    \"/pricing\"");
    expect(pricing).toContain("Pricing");
  });

  it("creates a durable session and writes a publish preview without mutating metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-cli-session-"));

    await runCli(["session", "create", "--repo", dir, "--id", "cli-session", "--agent", "codex", "--strategy", "hybrid"]);
    await runCli([
      "publish",
      "--preview",
      "--repo",
      dir,
      "--session",
      "cli-session",
      "--framework",
      "next",
      "--image",
      "public/og.png"
    ]);

    const request = await readFile(join(dir, ".graphforge", "sessions", "cli-session", "publish-request.json"), "utf8");
    expect(request).toContain('"status": "preview"');
    await expect(readFile(join(dir, "app", "layout.tsx"), "utf8")).rejects.toThrow();
  });

  it("publishes page-specific exports from the session export map", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-cli-page-publish-"));
    await mkdir(join(dir, "app", "pricing"), { recursive: true });
    await writeFile(join(dir, "app", "layout.tsx"), "export default function RootLayout({ children }) { return children }");
    await writeFile(join(dir, "app", "pricing", "page.tsx"), "export default function Pricing() { return null }");

    await runCli(["session", "create", "--repo", dir, "--id", "page-session", "--agent", "codex", "--strategy", "pages"]);
    await runCli(["publish", "--preview", "--repo", dir, "--session", "page-session", "--framework", "next", "--pageImages", JSON.stringify([
      { page: "/", imagePath: "public/og/home.png" },
      { page: "/pricing", imagePath: "public/og/pricing.png" }
    ])]);
    await runCli(["publish", "--confirm", "--repo", dir, "--session", "page-session", "--framework", "next", "--allPages"]);

    const request = JSON.parse(await readFile(join(dir, ".graphforge", "sessions", "page-session", "publish-request.json"), "utf8"));
    const layout = await readFile(join(dir, "app", "layout.tsx"), "utf8");
    const pricing = await readFile(join(dir, "app", "pricing", "page.tsx"), "utf8");
    expect(request.pageImages).toEqual([
      { page: "/", imagePath: "public/og/home.png" },
      { page: "/pricing", imagePath: "public/og/pricing.png" }
    ]);
    expect(request.status).toBe("confirmed");
    expect(layout).toContain("/og/home.png");
    expect(pricing).toContain("/og/pricing.png");
  });

  it("publishes with confirmation by creating metadata backup-safe files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-cli-publish-confirm-"));

    await runCli(["publish", "--confirm", "--repo", dir, "--session", "manual", "--framework", "next", "--image", "public/og.png"]);

    const request = await readFile(join(dir, ".graphforge", "sessions", "manual", "publish-request.json"), "utf8");
    const layout = await readFile(join(dir, "app", "layout.tsx"), "utf8");
    expect(request).toContain('"status": "confirmed"');
    expect(layout).toContain("/og.png");
  });

  it("waits for confirmed publish instead of treating preview as terminal", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-cli-wait-confirm-"));

    await runCli(["session", "create", "--repo", dir, "--id", "wait-session", "--agent", "codex", "--strategy", "common"]);
    await runCli(["publish", "--preview", "--repo", dir, "--session", "wait-session", "--framework", "vite", "--image", "public/og.png"]);
    const started = Date.now();
    await runCli([
      "session",
      "wait",
      "--repo",
      dir,
      "--id",
      "wait-session",
      "--until",
      "publish-confirmed",
      "--timeout",
      "100"
    ]);
    const previewElapsed = Date.now() - started;

    const previewSession = await readFile(join(dir, ".graphforge", "sessions", "wait-session", "session.json"), "utf8");
    expect(previewElapsed).toBeGreaterThanOrEqual(75);
    expect(previewSession).toContain('"status": "preview"');
    expect(previewSession).not.toContain('"status": "confirmed"');

    await runCli(["publish", "--confirm", "--repo", dir, "--session", "wait-session", "--framework", "vite", "--image", "public/og.png"]);
    await runCli([
      "session",
      "wait",
      "--repo",
      dir,
      "--id",
      "wait-session",
      "--until",
      "publish-confirmed",
      "--timeout",
      "1000"
    ]);
    const confirmedSession = await readFile(join(dir, ".graphforge", "sessions", "wait-session", "session.json"), "utf8");

    expect(confirmedSession).toContain('"status": "confirmed"');
  });

  it("waits for the next Studio decision across agent request and confirmed publish", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-cli-next-action-"));

    await runCli(["session", "create", "--repo", dir, "--id", "next-action", "--agent", "claude", "--strategy", "hybrid"]);
    await runCli([
      "session",
      "wait",
      "--repo",
      dir,
      "--id",
      "next-action",
      "--until",
      "next-action",
      "--timeout",
      "100"
    ]);

    await runCli([
      "publish",
      "--confirm",
      "--repo",
      dir,
      "--session",
      "next-action",
      "--framework",
      "vite",
      "--image",
      "public/og.png"
    ]);
    await runCli([
      "session",
      "wait",
      "--repo",
      dir,
      "--id",
      "next-action",
      "--until",
      "next-action",
      "--timeout",
      "1000"
    ]);
    const confirmedSession = await readFile(join(dir, ".graphforge", "sessions", "next-action", "session.json"), "utf8");

    expect(confirmedSession).toContain('"status": "published"');
    expect(confirmedSession).toContain('"status": "confirmed"');
  });

  it("imports generated SVG, HTML, and image assets into editable project wrappers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-import-"));
    const svgPath = join(dir, "generated.svg");
    const htmlPath = join(dir, "generated.html");
    const imagePath = join(dir, "generated.png");
    const svgProjectPath = join(dir, "svg.og.json");
    const htmlProjectPath = join(dir, "html.og.json");
    const imageProjectPath = join(dir, "image.og.json");
    await writeFile(svgPath, "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    await writeFile(htmlPath, "<!doctype html><html><body>OG</body></html>");
    await writeFile(imagePath, "not-real-image");

    await runCli(["import", "--source", svgPath, "--kind", "svg", "--name", "SVG Import", "--out", svgProjectPath]);
    await runCli(["import", "--source", htmlPath, "--kind", "html", "--name", "HTML Import", "--out", htmlProjectPath]);
    await runCli(["import", "--source", imagePath, "--kind", "image", "--name", "Image Import", "--out", imageProjectPath]);

    const svgProject = JSON.parse(await readFile(svgProjectPath, "utf8")) as ReturnType<typeof createDefaultProject>;
    const htmlProject = JSON.parse(await readFile(htmlProjectPath, "utf8")) as ReturnType<typeof createDefaultProject>;
    const imageProject = JSON.parse(await readFile(imageProjectPath, "utf8")) as ReturnType<typeof createDefaultProject>;
    const svgSourceLayer = svgProject.layers.find((layer) => layer.id === "imported-svg-source");
    const imageSourceLayer = imageProject.layers.find((layer) => layer.id === "imported-image-source");

    expect(svgProject.sourceArtifacts[0]).toMatchObject({ kind: "svg", origin: "codex", path: svgPath });
    expect(svgProject.layers.map((layer) => layer.name)).toEqual(["Background", "Imported SVG Source"]);
    expect(svgSourceLayer).toMatchObject({ kind: "image", x: 0, y: 0, width: 1200, height: 630, fit: "contain" });
    expect(svgSourceLayer && "src" in svgSourceLayer ? svgSourceLayer.src : "").toMatch(/^data:image\/svg\+xml;base64,/);
    expect(htmlProject.sourceArtifacts[0]).toMatchObject({ kind: "html", origin: "codex", path: htmlPath });
    expect(htmlProject.layers.some((layer) => layer.kind === "screenshot" && "src" in layer && layer.src === "graphforge://html-source")).toBe(true);
    expect(imageProject.sourceArtifacts[0]).toMatchObject({ kind: "image", origin: "codex", path: imagePath });
    expect(imageProject.layers.map((layer) => layer.name)).toEqual(["Background", "Imported Image Source"]);
    expect(imageSourceLayer).toMatchObject({ kind: "image", x: 0, y: 0, width: 1200, height: 630, fit: "contain" });
    expect(imageSourceLayer && "src" in imageSourceLayer ? imageSourceLayer.src : "").toMatch(/^data:image\/png;base64,/);
  });

  it("creates, validates, and imports proprietary Studio document packages", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-ogdoc-"));
    const documentPath = join(dir, "launch.ogdoc");
    const svgPath = join(dir, "generated.svg");
    const importedDocumentPath = join(dir, "imported.ogdoc");
    await writeFile(svgPath, "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");

    await runCli(["document", "new", "--name", "Layered Doc", "--strategy", "common", "--out", documentPath]);
    await runCli(["document", "validate", "--source", documentPath]);
    await runCli(["import", "--source", svgPath, "--kind", "svg", "--name", "Imported SVG Doc", "--out", importedDocumentPath]);

    const created = await unpackStudioDocument(await readFile(documentPath));
    const imported = await unpackStudioDocument(await readFile(importedDocumentPath));

    expect(created.project.name).toBe("Layered Doc");
    expect(created.project.layers.some((layer) => layer.kind === "text")).toBe(true);
    expect(imported.project.generationMode).toBe("pure-image");
    expect(imported.assets["assets/generated.svg"]).toBeInstanceOf(Uint8Array);
    expect(imported.project.layers.find((layer) => layer.id === "imported-svg-source")).toMatchObject({
      src: "assets/generated.svg",
      assetPath: "assets/generated.svg"
    });
  });

  it("writes an agent handoff plan without calling a provider", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-ai-plan-"));
    const projectPath = join(dir, "project.og.json");
    const planPath = join(dir, "agent-plan.json");
    await writeFile(projectPath, JSON.stringify(createDefaultProject({ name: "AI Plan", strategy: "common" })));

    await runCli([
      "agent-handoff",
      "--project",
      projectPath,
      "--prompt",
      "Make it feel editorial.",
      "--out",
      join(dir, "og.png"),
      "--plan",
      planPath
    ]);

    const plan = JSON.parse(await readFile(planPath, "utf8")) as {
      mode: string;
      agent: string;
      prompt: string;
      expectedArtifact: { width: number; height: number };
    };
    expect(plan.mode).toBe("agent-handoff");
    expect(plan.agent).toBe("codex-claude-or-opencode");
    expect(plan.prompt).toContain("AI Plan");
    expect(plan.prompt).toContain("Make it feel editorial.");
    expect(plan.expectedArtifact).toMatchObject({ width: 1200, height: 630 });
    expect(JSON.stringify(plan)).not.toContain("OPENAI_API_KEY");
  });

  it("reports actionable doctor checks for Codex skill, studio build, and agent handoff readiness", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-doctor-"));

    const report = await createDoctorReport({
      repo: dir,
      home: join(dir, "home"),
      staticDir: join(dir, "missing-studio-dist")
    });

    expect(report.checks.map((check) => check.id)).toEqual([
      "cli",
      "renderer",
      "studio-build",
      "codex-skill-source",
      "codex-skill-installed",
      "agent-handoff"
    ]);
    expect(report.checks.find((check) => check.id === "studio-build")).toMatchObject({
      status: "warn",
      action: "Run npm run build before launching the packaged studio."
    });
    expect(report.checks.find((check) => check.id === "codex-skill-installed")).toMatchObject({
      status: "warn",
      action: expect.stringContaining("graphforge install-skill")
    });
    expect(report.checks.find((check) => check.id === "agent-handoff")).toMatchObject({
      status: "pass",
      detail: expect.stringContaining("Codex, Claude, or OpenCode")
    });
    expect(report.ready).toBe(false);
  });
});

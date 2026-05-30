import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDefaultProject, createMultiPageProject, unpackStudioDocument } from "@opengraph-creator/core";
import { createLibrary } from "./library";
import { createStudioServer, getDefaultStudioStaticDir, type StudioServerHandle } from "./server";

let handle: StudioServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

describe("OpenGraph Creator Studio local API", () => {
  it("serves bundled studio assets from the CLI package by default", () => {
    expect(getDefaultStudioStaticDir().replaceAll("\\", "/")).toContain("packages/cli/studio-dist");
  });

  it("saves, lists, reads, and exports projects over HTTP", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-api-"));
    const library = createLibrary({ root });
    handle = await createStudioServer({ library, port: 0 });
    const project = createDefaultProject({ name: "API Project", strategy: "hybrid" });

    const saveResponse = await fetch(`${handle.url}/api/projects/${project.projectId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(project)
    });
    const listResponse = await fetch(`${handle.url}/api/projects`);
    const readResponse = await fetch(`${handle.url}/api/projects/${project.projectId}`);
    const exportTarget = join(root, "exports", "api.svg");
    const exportResponse = await fetch(`${handle.url}/api/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.projectId, format: "svg", target: exportTarget })
    });

    expect(saveResponse.status).toBe(200);
    expect((await listResponse.json()).projects).toEqual([
      expect.objectContaining({ projectId: project.projectId, name: "API Project" })
    ]);
    expect((await readResponse.json()).project.name).toBe("API Project");
    expect((await exportResponse.json()).result).toMatchObject({ target: exportTarget, format: "svg" });
    expect(await readFile(exportTarget, "utf8")).toContain("<svg");
  });

  it("does not serve the Studio HTML shell for unknown API routes", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-api-fallback-"));
    const library = createLibrary({ root });
    handle = await createStudioServer({ library, port: 0 });

    const response = await fetch(`${handle.url}/api/unknown-route`);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toEqual({ error: "Unknown Studio API route." });
  });

  it("exports relative session targets inside the user repo", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-api-export-repo-"));
    const library = createLibrary({ root: join(root, "library") });
    const repo = join(root, "user-app");
    handle = await createStudioServer({ library, port: 0, sessionRepo: repo });
    const project = createDefaultProject({ name: "Repo Export", strategy: "common" });

    await fetch(`${handle.url}/api/projects/${project.projectId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(project)
    });
    const exportResponse = await fetch(`${handle.url}/api/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.projectId, format: "svg", target: "public/og.svg", repo })
    });
    const body = await exportResponse.json();

    expect(exportResponse.status).toBe(200);
    expect(body.result).toMatchObject({ target: "public/og.svg", format: "svg" });
    await expect(stat(join(repo, "public", "og.svg"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(join(root, "library", "public", "og.svg"))).rejects.toThrow();
  });

  it("exports every page variant through the repo-scoped export-pages endpoint", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-api-page-export-"));
    const library = createLibrary({ root: join(root, "library") });
    const repo = join(root, "user-app");
    handle = await createStudioServer({ library, port: 0, sessionRepo: repo });
    const project = createMultiPageProject(
      createDefaultProject({ name: "Page Export", strategy: "pages", pages: ["/", "/pricing"] })
    );

    await fetch(`${handle.url}/api/projects/${project.projectId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(project)
    });
    const exportResponse = await fetch(`${handle.url}/api/export-pages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.projectId, format: "png", outDir: "public/og", repo })
    });
    const body = await exportResponse.json();

    expect(exportResponse.status).toBe(200);
    expect(body.exports).toEqual([
      expect.objectContaining({ page: "/", target: "public/og/home.png", width: 1200, height: 630 }),
      expect.objectContaining({ page: "/pricing", target: "public/og/pricing.png", width: 1200, height: 630 })
    ]);
    await expect(stat(join(repo, "public", "og", "home.png"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(join(repo, "public", "og", "pricing.png"))).resolves.toMatchObject({ size: expect.any(Number) });
  });


  it("imports generated assets and creates agent handoff plans over HTTP", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-api-import-"));
    const library = createLibrary({ root });
    handle = await createStudioServer({ library, port: 0 });
    const source = join(root, "generated.svg");
    await writeFile(source, "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");

    const importResponse = await fetch(`${handle.url}/api/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source, kind: "svg", name: "Imported API", origin: "codex" })
    });
    const importedProject = (await importResponse.json()).project;
    const handoffResponse = await fetch(`${handle.url}/api/agent-handoff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project: importedProject, prompt: "Revise the OG image.", target: "public/og.png" })
    });
    const handoff = await handoffResponse.json();

    expect(importResponse.status).toBe(200);
    expect(importedProject.sourceArtifacts[0]).toMatchObject({ kind: "svg", origin: "codex", path: source });
    expect(importedProject.layers.find((layer: { id?: string; src?: string }) => layer.id === "imported-svg-source")?.src).toMatch(
      /^data:image\/svg\+xml;base64,/
    );
    expect(handoff.plan).toMatchObject({ mode: "agent-handoff", output: "public/og.png" });
    expect(JSON.stringify(handoff)).not.toContain("OPENAI_API_KEY");
  });

  it("creates session, event, export, and publish-request files over HTTP", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-api-session-"));
    const library = createLibrary({ root });
    handle = await createStudioServer({ library, port: 0 });

    const createResponse = await fetch(`${handle.url}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo: root, id: "api-session", agent: "codex", strategy: "common", mode: "template" })
    });
    const eventResponse = await fetch(`${handle.url}/api/session/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo: root, sessionId: "api-session", type: "agent.waiting", message: "Waiting" })
    });
    const exportResponse = await fetch(`${handle.url}/api/session/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repo: root,
        sessionId: "api-session",
        path: "public/og.png",
        format: "png",
        width: 1200,
        height: 630,
        fileSizeBytes: 10_000
      })
    });
    const publishResponse = await fetch(`${handle.url}/api/session/publish-request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo: root, sessionId: "api-session", imagePath: "public/og.png", framework: "next" })
    });
    const confirmResponse = await fetch(`${handle.url}/api/session/publish-request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo: root, sessionId: "api-session", imagePath: "public/og.png", framework: "next", confirmed: true })
    });
    const agentRequestResponse = await fetch(`${handle.url}/api/session/agent-request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo: root, sessionId: "api-session", prompt: "Revise this layered document." })
    });
    const readResponse = await fetch(`${handle.url}/api/session?id=api-session&repo=${encodeURIComponent(root)}`);

    expect(createResponse.status).toBe(200);
    expect(eventResponse.status).toBe(200);
    expect(exportResponse.status).toBe(200);
    expect(publishResponse.status).toBe(200);
    expect(confirmResponse.status).toBe(200);
    expect(agentRequestResponse.status).toBe(200);
    expect((await readResponse.json()).session).toMatchObject({
      id: "api-session",
      exports: [expect.objectContaining({ path: "public/og.png" })],
      publishRequests: [
        expect.objectContaining({ imagePath: "public/og.png", status: "preview" }),
        expect.objectContaining({ imagePath: "public/og.png", status: "confirmed" })
      ],
      agentRequests: [expect.objectContaining({ prompt: "Revise this layered document." })]
    });
  });

  it("restarts a session through the local API and wakes the waiting agent", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-api-session-restart-"));
    const library = createLibrary({ root });
    handle = await createStudioServer({ library, port: 0 });

    await fetch(`${handle.url}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo: root, id: "api-restart", agent: "codex", strategy: "hybrid", mode: "template" })
    });
    const restartResponse = await fetch(`${handle.url}/api/session/restart`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo: root, sessionId: "api-restart", reason: "Need a fresh designer brief" })
    });
    const body = await restartResponse.json();
    const request = JSON.parse(await readFile(join(root, ".opengraph-creator", "sessions", "api-restart", "agent-request.json"), "utf8"));

    expect(restartResponse.status).toBe(200);
    expect(body.session).toMatchObject({ id: "api-restart", status: "agent-requested", pendingAction: "agent-restart-from-question-gate" });
    expect(body.request.prompt).toContain("Restart OG generation from the Question Gate while keeping this session alive");
    expect(request.prompt).toContain("Generate a fresh editable .ogdoc master");
  });

  it("opens a session from the repo bound to session open without a repo query parameter", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-api-session-bound-repo-"));
    const library = createLibrary({ root: join(root, "library") });
    handle = await createStudioServer({ library, port: 0, sessionRepo: root });

    await fetch(`${handle.url}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "bound-session", agent: "codex", strategy: "common", mode: "template" })
    });
    const readResponse = await fetch(`${handle.url}/api/session?id=bound-session`);

    expect(readResponse.status).toBe(200);
    expect((await readResponse.json()).session).toMatchObject({ id: "bound-session", repo: root });
  });

  it("returns a provider-neutral agent connection recipe for repo-scoped studio launches", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-api-connect-recipe-"));
    const library = createLibrary({ root: join(root, "library") });
    const repo = join(root, "user-app");
    handle = await createStudioServer({ library, port: 0, sessionRepo: repo });

    const response = await fetch(`${handle.url}/api/connect-recipe?repo=${encodeURIComponent(repo)}`);
    const recipe = await response.json();

    expect(response.status).toBe(200);
    expect(recipe).toMatchObject({
      repo,
      sessionRoot: join(repo, ".opengraph-creator", "sessions")
    });
    expect(recipe.command).toContain("opengraph-creator session create");
    expect(recipe.command).toContain(`--repo "${repo}"`);
    expect(recipe.prompt).toContain("editable .ogdoc");
    expect(recipe.prompt).toContain("next-action");
    expect(JSON.stringify(recipe).toLowerCase()).not.toContain("openai_api_key");
  });

  it("saves session edits and imported assets into the Studio document package", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-api-document-"));
    const library = createLibrary({ root: join(root, "library") });
    handle = await createStudioServer({ library, port: 0, sessionRepo: root });
    const project = createDefaultProject({ name: "Session Doc", strategy: "common" });

    await fetch(`${handle.url}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "doc-session", agent: "codex", strategy: "common", mode: "template" })
    });
    await fetch(`${handle.url}/api/session/document`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "doc-session", project })
    });
    const uploadResponse = await fetch(`${handle.url}/api/session/asset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "doc-session",
        fileName: "logo.svg",
        dataUrl: `data:image/svg+xml;base64,${Buffer.from("<svg />").toString("base64")}`
      })
    });
    const upload = await uploadResponse.json();
    const nextProject = {
      ...project,
      layers: [
        ...project.layers,
        {
          id: "logo-asset",
          kind: "image",
          name: "Logo Asset",
          x: 80,
          y: 80,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          locked: false,
          hidden: false,
          src: "data:image/svg+xml;base64,PHN2ZyAvPg==",
          assetPath: upload.assetPath,
          fit: "contain",
          borderRadius: 0,
          effects: { shadow: false, glow: false, blur: 0 }
        }
      ]
    };
    await fetch(`${handle.url}/api/session/document`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "doc-session", project: nextProject })
    });

    const paths = (await import("./session")).getSessionPaths(root, "doc-session");
    const document = await unpackStudioDocument(await readFile(paths.documentFile));
    const readResponse = await fetch(`${handle.url}/api/session?id=doc-session`);
    const bundle = await readResponse.json();

    expect(upload).toEqual({ assetPath: "assets/logo.svg" });
    expect(document.assets["assets/logo.svg"]).toBeInstanceOf(Uint8Array);
    const savedLogoLayer = document.project.layers.find((layer) => layer.id === "logo-asset");
    expect(savedLogoLayer && "src" in savedLogoLayer ? savedLogoLayer.src : undefined).toBe("assets/logo.svg");
    expect(bundle.project.layers.find((layer: { id?: string; src?: string }) => layer.id === "logo-asset")?.src).toMatch(
      /^data:image\/svg\+xml;base64,/
    );
  });
});

import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultProject, unpackStudioDocument } from "@graphforge/core";
import {
  appendSessionEvent,
  atomicWriteJson,
  createAgentRequest,
  cancelGraphForgeSession,
  createGraphForgeSession,
  createPublishRequest,
  getSessionPaths,
  readGraphForgeSession,
  recordSessionExport,
  restartGraphForgeSession
} from "./session";

describe("GraphForge durable sessions", () => {
  it("creates the durable session folder with recovery files", async () => {
    const repo = await mkdtemp(join(tmpdir(), "graphforge-session-"));

    const session = await createGraphForgeSession({
      repo,
      id: "session-1",
      agent: "codex",
      strategy: "hybrid",
      mode: "template"
    });
    const paths = getSessionPaths(repo, "session-1");

    expect(session).toMatchObject({
      id: "session-1",
      agent: "codex",
      strategy: "hybrid",
      status: "waiting-for-agent"
    });
    await expect(stat(paths.sessionJson)).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(paths.eventsJsonl)).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(paths.incomingDir)).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(paths.projectJson)).rejects.toThrow();
    expect(await readGraphForgeSession(repo, "session-1")).toMatchObject({ id: "session-1" });
  });

  it("writes the Studio document package only when the agent supplies an editable project", async () => {
    const repo = await mkdtemp(join(tmpdir(), "graphforge-session-project-"));
    const project = createDefaultProject({ name: "Agent Project", strategy: "common" });

    await createGraphForgeSession({ repo, id: "session-with-project", project });
    const paths = getSessionPaths(repo, "session-with-project");

    const document = await unpackStudioDocument(await readFile(paths.documentFile));
    expect(document.project.name).toBe("Agent Project");
    expect(await readGraphForgeSession(repo, "session-with-project")).toMatchObject({
      activeProjectId: project.projectId,
      activeDocumentPath: paths.documentFile,
      strategy: "common",
      mode: "template"
    });
  });

  it("atomically writes JSON and appends an event log", async () => {
    const repo = await mkdtemp(join(tmpdir(), "graphforge-session-events-"));
    await createGraphForgeSession({ repo, id: "session-2" });
    const paths = getSessionPaths(repo, "session-2");

    await atomicWriteJson(join(repo, ".graphforge", "atomic.json"), { ok: true });
    await appendSessionEvent(repo, "session-2", { type: "agent.waiting", message: "Waiting for user edit" });

    expect(await readFile(join(repo, ".graphforge", "atomic.json"), "utf8")).toContain('"ok": true');
    expect(await readFile(paths.eventsJsonl, "utf8")).toContain("agent.waiting");
  });

  it("records exports and publish requests for agent recovery", async () => {
    const repo = await mkdtemp(join(tmpdir(), "graphforge-session-publish-"));
    await createGraphForgeSession({ repo, id: "session-3" });
    const paths = getSessionPaths(repo, "session-3");

    const updated = await recordSessionExport(repo, "session-3", {
      path: "public/og.png",
      format: "png",
      width: 1200,
      height: 630,
      fileSizeBytes: 42_000,
      createdAt: "2026-05-26T00:00:00.000Z"
    });
    const request = await createPublishRequest({
      repo,
      sessionId: "session-3",
      imagePath: "public/og.png",
      framework: "next",
      page: "/",
      confirmed: false
    });

    expect(updated.status).toBe("exported");
    expect(request).toMatchObject({ imagePath: "public/og.png", status: "preview" });
    expect(await readFile(paths.exportJson, "utf8")).toContain("public/og.png");
    expect(await readFile(paths.publishRequestJson, "utf8")).toContain("preview");
  });

  it("records page-aware export and publish mappings for per-page handoff", async () => {
    const repo = await mkdtemp(join(tmpdir(), "graphforge-session-pages-"));
    await createGraphForgeSession({ repo, id: "session-pages", strategy: "pages" });
    const paths = getSessionPaths(repo, "session-pages");

    await recordSessionExport(repo, "session-pages", {
      path: "public/og/pricing.png",
      format: "png",
      width: 1200,
      height: 630,
      fileSizeBytes: 44_000,
      createdAt: "2026-05-26T00:00:00.000Z",
      page: "/pricing"
    });
    const request = await createPublishRequest({
      repo,
      sessionId: "session-pages",
      imagePath: "public/og/pricing.png",
      framework: "next",
      page: "/pricing",
      confirmed: true,
      pageImages: [{ page: "/pricing", imagePath: "public/og/pricing.png" }]
    });

    const exportJson = JSON.parse(await readFile(paths.exportJson, "utf8"));
    const publishJson = JSON.parse(await readFile(paths.publishRequestJson, "utf8"));
    expect(exportJson.exports).toEqual([
      expect.objectContaining({ page: "/pricing", path: "public/og/pricing.png" })
    ]);
    expect(request.pageImages).toEqual([{ page: "/pricing", imagePath: "public/og/pricing.png" }]);
    expect(publishJson.pageImages).toEqual([{ page: "/pricing", imagePath: "public/og/pricing.png" }]);
  });

  it("records confirmed publish and agent revision requests for deterministic waits", async () => {
    const repo = await mkdtemp(join(tmpdir(), "graphforge-session-confirm-"));
    await createGraphForgeSession({ repo, id: "session-4" });
    const paths = getSessionPaths(repo, "session-4");

    const confirmed = await createPublishRequest({
      repo,
      sessionId: "session-4",
      imagePath: "public/og.png",
      framework: "vite",
      page: "/",
      confirmed: true
    });
    const agentRequest = await createAgentRequest({
      repo,
      sessionId: "session-4",
      prompt: "Revise the lighting and keep editable text.",
      documentPath: paths.documentFile
    });
    const session = await readGraphForgeSession(repo, "session-4");

    expect(confirmed.status).toBe("confirmed");
    expect(agentRequest).toMatchObject({ status: "requested", expectedOutput: paths.documentFile });
    expect(session.publishRequests.some((request) => request.status === "confirmed")).toBe(true);
    expect(session.agentRequests?.[0]).toMatchObject({ prompt: "Revise the lighting and keep editable text." });
    expect(await readFile(paths.agentRequestJson, "utf8")).toContain("Revise the lighting");
  });

  it("records cancelled sessions as terminal user decisions", async () => {
    const repo = await mkdtemp(join(tmpdir(), "graphforge-session-cancel-"));
    await createGraphForgeSession({ repo, id: "session-cancel", agent: "opencode" });
    const paths = getSessionPaths(repo, "session-cancel");

    const cancelled = await cancelGraphForgeSession(repo, "session-cancel", "User stopped the handoff from Studio");
    const eventLog = await readFile(paths.eventsJsonl, "utf8");

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.pendingAction).toBeUndefined();
    expect(eventLog).toContain("session.cancelled");
    expect(eventLog).toContain("User stopped the handoff from Studio");
  });

  it("archives generated files and asks the agent to restart from the question gate", async () => {
    const repo = await mkdtemp(join(tmpdir(), "graphforge-session-restart-"));
    const project = createDefaultProject({ name: "Restart Me", strategy: "hybrid" });
    await createGraphForgeSession({ repo, id: "session-restart", agent: "codex", project });
    const paths = getSessionPaths(repo, "session-restart");

    await recordSessionExport(repo, "session-restart", {
      path: "public/og.png",
      format: "png",
      width: 1200,
      height: 630,
      fileSizeBytes: 42_000,
      createdAt: "2026-05-26T00:00:00.000Z"
    });
    await createPublishRequest({
      repo,
      sessionId: "session-restart",
      imagePath: "public/og.png",
      framework: "next",
      page: "/",
      confirmed: false
    });
    await createAgentRequest({
      repo,
      sessionId: "session-restart",
      prompt: "Previous revision",
      documentPath: paths.documentFile
    });

    const restarted = await restartGraphForgeSession(repo, "session-restart", "User requested a fresh OG direction");
    const archives = await readdir(paths.restartsDir);
    const archiveDir = join(paths.restartsDir, archives[0]);
    const request = JSON.parse(await readFile(paths.agentRequestJson, "utf8"));
    const eventLog = await readFile(paths.eventsJsonl, "utf8");

    expect(restarted).toMatchObject({
      status: "agent-requested",
      pendingAction: "agent-restart-from-question-gate",
      exports: [],
      publishRequests: []
    });
    expect(restarted.agentRequests?.at(-1)?.prompt).toContain("Restart OG generation from the question gate");
    expect(request.prompt).toContain("Ask the user fresh setup questions before creating a new document");
    await expect(stat(join(archiveDir, "document.ogdoc"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(join(archiveDir, "export.json"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(join(archiveDir, "publish-request.json"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(join(archiveDir, "agent-request.json"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(paths.documentFile)).rejects.toThrow();
    await expect(stat(paths.exportJson)).rejects.toThrow();
    await expect(stat(paths.publishRequestJson)).rejects.toThrow();
    expect(eventLog).toContain("session.restart.requested");
  });
});

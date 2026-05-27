import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultProject, unpackStudioDocument } from "@graphforge/core";
import {
  appendSessionEvent,
  atomicWriteJson,
  createGraphForgeSession,
  createPublishRequest,
  getSessionPaths,
  readGraphForgeSession,
  recordSessionExport
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
});

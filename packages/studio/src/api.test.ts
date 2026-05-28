import { describe, expect, it, vi } from "vitest";
import { createDefaultProject } from "@graphforge/core";
import {
  appendSessionEventViaApi,
  createAgentHandoffViaApi,
  createPublishRequestViaApi,
  createSessionAgentRequestViaApi,
  createSessionViaApi,
  exportProjectViaApi,
  importSourceViaApi,
  listProjectsViaApi,
  readConnectRecipeViaApi,
  readSessionViaApi,
  recordSessionExportViaApi,
  saveProjectViaApi
} from "./api";

describe("studio API client", () => {
  it("lists projects and saves editable project JSON through fetch", async () => {
    const project = createDefaultProject({ name: "API Client", strategy: "common" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ projectId: "one", name: "One" }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: project.projectId, path: "project.og.json" })));

    const projects = await listProjectsViaApi(fetchMock);
    const saved = await saveProjectViaApi(fetchMock, project);

    expect(projects).toEqual([{ projectId: "one", name: "One" }]);
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/projects/${project.projectId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(project)
    });
    expect(saved.path).toBe("project.og.json");
  });

  it("exports through the local API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: { format: "png", target: "public/og.png" } }))
    );

    const result = await exportProjectViaApi(fetchMock, {
      projectId: "project-1",
      format: "png",
      target: "public/og.png",
      quality: 82
    });

    expect(result).toEqual({ format: "png", target: "public/og.png" });
  });

  it("creates an agent handoff through the local API without provider credentials", async () => {
    const project = createDefaultProject({ name: "Agent API", strategy: "hybrid" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          path: ".graphforge/agent.json",
          plan: { mode: "agent-handoff", output: "public/og-agent.png", prompt: "Codex, Claude, or OpenCode" }
        })
      )
    );

    const result = await createAgentHandoffViaApi(fetchMock, {
      project,
      prompt: "Create a distinctive OG image.",
      target: "public/og-agent.png",
      format: "png"
    });

    expect(result.plan.mode).toBe("agent-handoff");
    expect(fetchMock).toHaveBeenCalledWith("/api/agent-handoff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project,
        prompt: "Create a distinctive OG image.",
        target: "public/og-agent.png",
        format: "png"
      })
    });
    expect(JSON.stringify((fetchMock as unknown as { mock: { calls: Array<[string, { body: string }]> } }).mock.calls)).not.toContain(
      "OPENAI_API_KEY"
    );
  });

  it("imports generated source artifacts through the local API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ project: createDefaultProject({ name: "Imported API", strategy: "common" }) }))
    );

    const result = await importSourceViaApi(fetchMock, {
      source: ".graphforge/generated/og.svg",
      kind: "svg",
      name: "Imported API",
      origin: "codex"
    });

    expect(result.name).toBe("Imported API");
    expect(fetchMock).toHaveBeenCalledWith("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: ".graphforge/generated/og.svg",
        kind: "svg",
        name: "Imported API",
        origin: "codex"
      })
    });
  });

  it("uses durable session endpoints for agent recovery and publish handoff", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { id: "s1", status: "waiting-for-agent" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { id: "s1", status: "editing" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ event: { id: "e1", sessionId: "s1", type: "agent.waiting" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { id: "s1", status: "exported" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ request: { imagePath: "public/og.png", status: "preview" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ request: { imagePath: "public/og.png", status: "confirmed" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ request: { prompt: "Revise lighting", status: "requested" } })));

    await expect(createSessionViaApi(fetchMock, { id: "s1", agent: "codex", strategy: "common" })).resolves.toMatchObject({
      id: "s1"
    });
    await expect(readSessionViaApi(fetchMock, { id: "s1" })).resolves.toMatchObject({ status: "editing" });
    await expect(appendSessionEventViaApi(fetchMock, { sessionId: "s1", type: "agent.waiting" })).resolves.toMatchObject({
      type: "agent.waiting"
    });
    await expect(
      recordSessionExportViaApi(fetchMock, {
        sessionId: "s1",
        path: "public/og.png",
        format: "png",
        width: 1200,
        height: 630
      })
    ).resolves.toMatchObject({ status: "exported" });
    await expect(
      createPublishRequestViaApi(fetchMock, { sessionId: "s1", imagePath: "public/og.png", framework: "next" })
    ).resolves.toMatchObject({ status: "preview" });
    await expect(
      createPublishRequestViaApi(fetchMock, { sessionId: "s1", imagePath: "public/og.png", framework: "next", confirmed: true })
    ).resolves.toMatchObject({ status: "confirmed" });
    await expect(
      createSessionAgentRequestViaApi(fetchMock, { sessionId: "s1", prompt: "Revise lighting" })
    ).resolves.toMatchObject({ status: "requested" });
  });

  it("retries transient local API failures before returning data", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("socket closed"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ projectId: "one", name: "One" }] })));

    await expect(listProjectsViaApi(fetchMock)).resolves.toEqual([{ projectId: "one", name: "One" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads provider-neutral agent connection recipes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          repo: "D:/app",
          command: "graphforge session create --repo \"D:/app\" --agent codex --strategy hybrid --mode template",
          prompt: "Use the GraphForge skill and wait with next-action.",
          sessionRoot: "D:/app/.graphforge/sessions"
        })
      )
    );

    await expect(readConnectRecipeViaApi(fetchMock, "D:/app")).resolves.toMatchObject({
      repo: "D:/app",
      sessionRoot: "D:/app/.graphforge/sessions"
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/connect-recipe?repo=D%3A%2Fapp", undefined);
  });

  it("retries retryable server responses but not client errors", async () => {
    const retryingFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "busy" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { format: "webp", target: "public/og.webp" } })));

    await expect(
      exportProjectViaApi(retryingFetch, {
        projectId: "project-1",
        format: "webp",
        target: "public/og.webp"
      })
    ).resolves.toMatchObject({ format: "webp" });
    expect(retryingFetch).toHaveBeenCalledTimes(2);

    const clientErrorFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "missing" }), { status: 404 }));
    await expect(listProjectsViaApi(clientErrorFetch)).rejects.toThrow("Could not list projects: 404");
    expect(clientErrorFetch).toHaveBeenCalledTimes(1);
  });

  it("reports frontend fallback HTML as a local API launch problem", async () => {
    const htmlFallbackFetch = vi.fn().mockResolvedValue(
      new Response("<html lang=\"en\"><body>Studio shell</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      })
    );

    await expect(listProjectsViaApi(htmlFallbackFetch)).rejects.toThrow(
      "Could not list projects: Local Studio API returned HTML instead of JSON. Launch Studio through graphforge studio, not the frontend-only dev server."
    );
  });
});

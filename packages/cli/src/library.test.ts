import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultProject } from "@opengraph-creator/core";
import {
  createLibrary,
  exportLibraryProject,
  listLibraryProjects,
  readLibraryProject,
  saveLibraryProject
} from "./library";

describe("OpenGraphCreator global library", () => {
  it("saves, lists, and reads editable projects from a local library", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-library-"));
    const library = createLibrary({ root });
    const project = createDefaultProject({ name: "Library Project", strategy: "hybrid" });

    const saved = await saveLibraryProject(library, project);
    const projects = await listLibraryProjects(library);
    const readBack = await readLibraryProject(library, project.projectId);

    expect(saved.path).toContain(`${project.projectId}.og.json`);
    expect(projects).toEqual([
      expect.objectContaining({
        projectId: project.projectId,
        name: "Library Project",
        strategy: "hybrid"
      })
    ]);
    expect(readBack.name).toBe("Library Project");
  });

  it("exports a library project to the requested target", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-library-"));
    const library = createLibrary({ root });
    const project = createDefaultProject({ name: "Export Library", strategy: "common" });
    await saveLibraryProject(library, project);

    const target = join(root, "exports", "og.svg");
    const result = await exportLibraryProject(library, {
      projectId: project.projectId,
      format: "svg",
      target
    });

    expect(result.target).toBe(target);
    expect(await readFile(target, "utf8")).toContain("<svg");
  });

  it("resolves relative export targets inside a session repo", async () => {
    const root = await mkdtemp(join(tmpdir(), "OpenGraphCreator-library-repo-export-"));
    const library = createLibrary({ root: join(root, "library") });
    const repo = join(root, "user-app");
    const project = createDefaultProject({ name: "Repo Export", strategy: "common" });
    await saveLibraryProject(library, project);

    const result = await exportLibraryProject(library, {
      projectId: project.projectId,
      format: "svg",
      target: "public/og.svg",
      repo
    });

    expect(result.target).toBe("public/og.svg");
    expect(await readFile(join(repo, "public", "og.svg"), "utf8")).toContain("<svg");
    await expect(
      exportLibraryProject(library, {
        projectId: project.projectId,
        format: "svg",
        target: "../escaped.svg",
        repo
      })
    ).rejects.toThrow("Export target must stay inside the session repo");
  });
});

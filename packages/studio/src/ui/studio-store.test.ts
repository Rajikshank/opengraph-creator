import { describe, expect, it } from "vitest";
import { createDefaultProject } from "@opengraph-creator/core";
import { createProjectWithImportedAsset } from "./studio-store";

describe("studio store project helpers", () => {
  it("uses packaged session asset paths instead of keeping uploaded images inline", () => {
    const project = createDefaultProject({ name: "Imported Asset", strategy: "common" });

    const updated = createProjectWithImportedAsset(project, {
      kind: "image",
      origin: "manual",
      inline: "data:image/png;base64,large-inline-payload",
      path: "assets/photo.png",
      createdAt: "2026-06-02T00:00:00.000Z"
    });
    const layer = updated.layers.at(-1);

    expect(layer).toMatchObject({
      kind: "image",
      src: "assets/photo.png",
      assetPath: "assets/photo.png"
    });
    expect(JSON.stringify(updated)).not.toContain("large-inline-payload");
  });
});

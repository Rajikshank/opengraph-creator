import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPsd } from "ag-psd";
import { describe, expect, it } from "vitest";
import { createDefaultProject } from "@opengraph-creator/core";
import { exportProjectToPsd } from "./psd-export";

describe("PSD source export", () => {
  it("exports a layered PSD from the .ogdoc project model", async () => {
    const dir = await mkdtemp(join(tmpdir(), "OpenGraphCreator-psd-"));
    const target = join(dir, "open-graph.psd");
    const project = createDefaultProject({ name: "PSD Export", strategy: "common" });
    project.layers = project.layers.map((layer) =>
      layer.id === "subtitle" ? { ...layer, hidden: true } : layer
    );

    const result = await exportProjectToPsd(project, target);
    const buffer = await readFile(target);
    const psd = readPsd(buffer, {
      skipLayerImageData: true,
      skipCompositeImageData: true,
      skipThumbnail: true
    });

    expect(result).toMatchObject({
      target,
      width: 1200,
      height: 630,
      layerCount: project.layers.filter((layer) => !layer.hidden).length
    });
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(psd).toMatchObject({ width: 1200, height: 630 });
    expect(psd.children?.map((layer) => layer.name)).toEqual(
      [...project.layers.filter((layer) => !layer.hidden)].reverse().map((layer) => layer.name)
    );
  });
});

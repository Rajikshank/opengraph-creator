import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createDefaultProject } from "@graphforge/core";
import { exportProject, renderProjectToSvg } from "./index";

describe("GraphForge export pipeline", () => {
  it("exports SVG and reports file metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-"));
    const target = join(dir, "og.svg");
    const project = createDefaultProject({ name: "Export", strategy: "common" });

    const result = await exportProject(project, { format: "svg", target });
    const file = await readFile(target, "utf8");
    const info = await stat(target);

    expect(file).toContain("<svg");
    expect(result).toMatchObject({ format: "svg", width: 1200, height: 630, target });
    expect(result.fileSizeBytes).toBe(info.size);
  });

  it("exports an optimized PNG with correct OG dimensions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-"));
    const target = join(dir, "og.png");
    const project = createDefaultProject({ name: "PNG Export", strategy: "common" });

    const result = await exportProject(project, { format: "png", target });
    const metadata = await sharp(target).metadata();

    expect(result).toMatchObject({ format: "png", width: 1200, height: 630, target });
    expect(metadata).toMatchObject({ width: 1200, height: 630, format: "png" });
    expect(result.fileSizeBytes).toBeGreaterThan(1000);
  });

  it("exports WebP with a caller-provided quality setting", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-"));
    const target = join(dir, "og.webp");
    const project = createDefaultProject({ name: "WebP Export", strategy: "common" });

    const result = await exportProject(project, { format: "webp", target, quality: 70 });
    const metadata = await sharp(target).metadata();

    expect(result).toMatchObject({ format: "webp", width: 1200, height: 630, target });
    expect(metadata).toMatchObject({ width: 1200, height: 630, format: "webp" });
  });

  it("exports JPEG with the default OG compression settings", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphforge-"));
    const target = join(dir, "og.jpg");
    const project = createDefaultProject({ name: "JPEG Export", strategy: "common" });

    const result = await exportProject(project, { format: "jpg", target });
    const metadata = await sharp(target).metadata();

    expect(result).toMatchObject({ format: "jpg", width: 1200, height: 630, target });
    expect(metadata).toMatchObject({ width: 1200, height: 630, format: "jpeg" });
  });

  it("renders image crop and focal point data into the SVG export source", () => {
    const project = createDefaultProject({ name: "Cropped Image", strategy: "common" });
    const imageLayer = project.layers.find((layer) => layer.kind === "logo");
    if (!imageLayer || !("src" in imageLayer)) throw new Error("default logo layer missing");
    const svg = renderProjectToSvg({
      ...project,
      layers: [
        {
          ...imageLayer,
          kind: "image",
          id: "reference",
          name: "Reference",
          src: "data:image/png;base64,AA==",
          fit: "cover",
          x: 100,
          y: 120,
          width: 400,
          height: 200,
          crop: { x: 0.25, y: 0.1, width: 0.5, height: 0.8 },
          focalPoint: { x: 0.9, y: 0.1 }
        }
      ]
    });

    expect(svg).toContain('clipPath id="gf-image-clip-reference"');
    expect(svg).toContain('x="-100"');
    expect(svg).toContain('y="95"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="250"');
    expect(svg).toContain('preserveAspectRatio="xMaxYMin slice"');
  });
});

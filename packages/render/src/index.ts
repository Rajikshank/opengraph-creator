import type { ExportFormat, OgProject } from "@graphforge/core";
import { renderProjectToSvg } from "./browser.js";

export { renderProjectToSvg } from "./browser.js";

export interface ExportOptions {
  format: ExportFormat;
  target: string;
  quality?: number;
}

export interface ExportResult {
  format: ExportFormat;
  width: number;
  height: number;
  target: string;
  fileSizeBytes: number;
}

export async function exportProject(project: OgProject, options: ExportOptions): Promise<ExportResult> {
  const [{ mkdir, stat, writeFile }, { dirname }, sharpModule] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
    import("sharp")
  ]);
  const sharp = sharpModule.default;
  const svg = renderProjectToSvg(project);
  await mkdir(dirname(options.target), { recursive: true });

  if (options.format === "svg") {
    await writeFile(options.target, svg, "utf8");
  } else if (options.format === "png") {
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(options.target);
  } else if (options.format === "webp") {
    await sharp(Buffer.from(svg)).webp({ quality: options.quality ?? 82, effort: 5 }).toFile(options.target);
  } else if (options.format === "jpg") {
    await sharp(Buffer.from(svg)).jpeg({ quality: options.quality ?? 82, progressive: true, mozjpeg: true }).toFile(options.target);
  }

  const info = await stat(options.target);

  return {
    format: options.format,
    width: project.canvas.width,
    height: project.canvas.height,
    target: options.target,
    fileSizeBytes: info.size
  };
}

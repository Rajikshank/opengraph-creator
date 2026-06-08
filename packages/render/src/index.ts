import { getRenderableProject, type ExportFormat, type OgProject } from "@opengraph-creator/core";
import { renderProjectToSvg } from "./browser.js";

export { renderProjectToSvg } from "./browser.js";
export { createRenderPlan, type RenderPlan, type RenderPlanNode } from "./render-plan.js";

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
  qualityReport: ExportQualityReport;
}

export interface ExportQualityReport {
  format: ExportFormat;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
  width: number;
  height: number;
  fileSizeBytes: number;
  nonblank: boolean;
  socialReady: boolean;
  warnings: string[];
}

type SharpQualityReader = (input: string | Buffer) => {
  metadata(): Promise<{ width?: number; height?: number }>;
  stats(): Promise<{ channels: Array<{ stdev: number }> }>;
};

export async function exportProject(project: OgProject, options: ExportOptions): Promise<ExportResult> {
  const [{ mkdir, stat, writeFile }, { dirname }, sharpModule] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
    import("sharp")
  ]);
  const sharp = sharpModule.default;
  const renderableProject = getRenderableProject(project);
  const svg = renderProjectToSvg(renderableProject);
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
  const qualityReport = await createExportQualityReport({
    sharp,
    target: options.target,
    format: options.format,
    width: renderableProject.canvas.width,
    height: renderableProject.canvas.height,
    fileSizeBytes: info.size,
    svg
  });

  return {
    format: options.format,
    width: renderableProject.canvas.width,
    height: renderableProject.canvas.height,
    target: options.target,
    fileSizeBytes: info.size,
    qualityReport
  };
}

async function createExportQualityReport(input: {
  sharp: SharpQualityReader;
  target: string;
  format: ExportFormat;
  width: number;
  height: number;
  fileSizeBytes: number;
  svg: string;
}): Promise<ExportQualityReport> {
  const mimeType = getMimeType(input.format);
  const warnings: string[] = [];
  let width = input.width;
  let height = input.height;
  let nonblank = hasVisibleSvgContent(input.svg);

  if (input.format !== "svg" || !nonblank) {
    const metadata = await input.sharp(input.target).metadata();
    width = metadata.width ?? width;
    height = metadata.height ?? height;
    if (input.format !== "svg") {
      const stats = await input.sharp(input.target).stats();
      nonblank = stats.channels.some((channel) => channel.stdev > 0.5);
    }
  }

  if (width !== 1200 || height !== 630) warnings.push(`Expected 1200x630 OG output, got ${width}x${height}.`);
  if (!nonblank) warnings.push("Export appears blank.");
  if (input.fileSizeBytes > 5_000_000) warnings.push("Export is larger than 5 MB.");
  if (input.fileSizeBytes > 1_000_000) warnings.push("Export is above the recommended 1 MB social preview budget.");

  return {
    format: input.format,
    mimeType,
    width,
    height,
    fileSizeBytes: input.fileSizeBytes,
    nonblank,
    socialReady: width === 1200 && height === 630 && nonblank && input.fileSizeBytes <= 5_000_000,
    warnings
  };
}

function hasVisibleSvgContent(svg: string): boolean {
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/g, "").replace(/<desc>[\s\S]*?<\/desc>/g, "");
  if (!body.includes("<svg")) return false;
  return /<(rect|circle|ellipse|path|polygon|polyline|line|text|image)\b/i.test(body);
}

function getMimeType(format: ExportFormat): ExportQualityReport["mimeType"] {
  if (format === "jpg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  if (format === "svg") return "image/svg+xml";
  return "image/png";
}

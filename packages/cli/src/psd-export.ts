import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getRenderableProject, type OgLayer, type OgProject } from "@opengraph-creator/core";
import { renderProjectToSvg } from "@opengraph-creator/render";
import { writePsdBuffer, type Layer, type PixelData, type Psd } from "ag-psd";
import sharp from "sharp";

export interface PsdExportResult {
  target: string;
  width: number;
  height: number;
  layerCount: number;
  fileSizeBytes: number;
}

export async function exportProjectToPsd(project: OgProject, target: string): Promise<PsdExportResult> {
  const renderableProject = getRenderableProject(project);
  const visibleLayers = renderableProject.layers.filter((layer) => !layer.hidden);
  const children: Layer[] = [];

  for (const layer of [...visibleLayers].reverse()) {
    children.push(await renderLayerToPsdLayer(renderableProject, layer));
  }

  const composite = await renderProjectToPixelData(renderableProject);
  const psd: Psd = {
    width: renderableProject.canvas.width,
    height: renderableProject.canvas.height,
    children,
    imageData: composite,
    imageResources: {
      resolutionInfo: {
        horizontalResolution: 72,
        horizontalResolutionUnit: "PPI",
        widthUnit: "Inches",
        verticalResolution: 72,
        verticalResolutionUnit: "PPI",
        heightUnit: "Inches"
      }
    }
  };

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, writePsdBuffer(psd, { noBackground: true, compress: true }));
  const info = await stat(target);
  return {
    target,
    width: renderableProject.canvas.width,
    height: renderableProject.canvas.height,
    layerCount: children.length,
    fileSizeBytes: info.size
  };
}

async function renderLayerToPsdLayer(project: OgProject, layer: OgLayer): Promise<Layer> {
  const layerProject: OgProject = {
    ...project,
    layers: [
      {
        ...JSON.parse(JSON.stringify(layer)),
        opacity: 1,
        hidden: false
      } as OgLayer
    ]
  };
  const imageData = await renderProjectToPixelData(layerProject);
  return {
    name: layer.name || layer.id,
    left: 0,
    top: 0,
    right: project.canvas.width,
    bottom: project.canvas.height,
    opacity: Math.round(Math.max(0, Math.min(1, layer.opacity)) * 255),
    hidden: layer.hidden,
    protected: layer.locked
      ? {
          transparency: true,
          composite: true,
          position: true,
          artboards: false
        }
      : undefined,
    imageData
  };
}

async function renderProjectToPixelData(project: OgProject): Promise<PixelData> {
  const svg = renderProjectToSvg(project);
  const result = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8ClampedArray(result.data),
    width: result.info.width,
    height: result.info.height
  };
}

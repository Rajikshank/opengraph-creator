import { getRenderableProject, type LayerEffects, type OgLayer, type OgProject } from "@opengraph-creator/core";

export interface RenderPlan {
  version: 1;
  sourceProjectId: string;
  activePageId?: string;
  targetSurface: "social-og";
  canvas: {
    width: number;
    height: number;
  };
  nodes: RenderPlanNode[];
}

export interface RenderPlanNode {
  layerId: string;
  kind: OgLayer["kind"];
  name: string;
  drawIndex: number;
  hidden: boolean;
  locked: boolean;
  opacity: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  effectScopes: string[];
}

export function createRenderPlan(project: OgProject): RenderPlan {
  const activePageId = project.pages?.length ? project.activePageId ?? project.pages[0].id : undefined;
  const renderable = activePageId ? getRenderableProject(project, activePageId) : project;

  return {
    version: 1,
    sourceProjectId: project.projectId,
    activePageId,
    targetSurface: "social-og",
    canvas: {
      width: renderable.canvas.width,
      height: renderable.canvas.height
    },
    nodes: renderable.layers.map((layer, index) => ({
      layerId: layer.id,
      kind: layer.kind,
      name: layer.name,
      drawIndex: index,
      hidden: layer.hidden,
      locked: layer.locked,
      opacity: layer.opacity,
      bounds: {
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rotation: layer.rotation
      },
      effectScopes: "effects" in layer ? getEffectScopes(layer.effects) : []
    }))
  };
}

function getEffectScopes(effects: LayerEffects): string[] {
  const scopes: string[] = [];
  if (effects.shadow) scopes.push("shadow:layer");
  if (effects.glow) scopes.push("glow:layer");
  if (effects.blur > 0) scopes.push("blur:layer");
  if (effects.gradient) scopes.push("gradient:layer");
  if (effects.noise && effects.noise.amount > 0) scopes.push("noise:layer");
  if (effects.lighting && effects.lighting.intensity > 0) scopes.push(`lighting:${effects.lighting.scope ?? "layer"}`);
  if (effects.vignette && effects.vignette > 0) scopes.push("vignette:layer");
  for (const effect of effects.stack ?? []) {
    if (effect.enabled && effect.intensity > 0) scopes.push(`${effect.kind}:layer`);
  }
  return scopes;
}

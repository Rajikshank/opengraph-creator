export type GenerationStrategy = "common" | "pages" | "hybrid";
export type GenerationMode = "template" | "pure-image";
export type ExportFormat = "png" | "webp" | "jpg" | "svg";
export type Framework = "next" | "astro" | "nuxt" | "remix" | "vite" | "html" | "unknown";
export type LayerKind = "background" | "text" | "image" | "logo" | "screenshot" | "shape" | "badge" | "group";
export type SourceArtifactKind = "project-json" | "svg" | "html" | "image";
export type SourceArtifactOrigin = "codex" | "claude" | "manual" | "library";
export type AgentKind = "codex" | "claude" | "opencode" | "manual" | "unknown";
export type SessionStatus =
  | "draft"
  | "waiting-for-agent"
  | "editing"
  | "exported"
  | "publish-requested"
  | "published"
  | "agent-requested"
  | "cancelled"
  | "terminal"
  | "stale";
export type EffectCapability = "supported" | "disabled";
export type EffectName = "gradient" | "noise" | "lighting" | "vignette" | "blur" | "shadow" | "glow";

export * from "./document-package.js";

export interface OpenGraphCreatorSourceArtifact {
  kind: SourceArtifactKind;
  origin: SourceArtifactOrigin;
  path?: string;
  inline?: string;
  createdAt: string;
}

export type OgPageStatus = "draft" | "edited" | "exported" | "publish-preview" | "confirmed";
export type OgPageConfidence = "high" | "medium" | "low";

export interface OgPageSourceContext {
  route?: string;
  routeFile?: string;
  metadataFile?: string;
  detectedTitle?: string;
  detectedDescription?: string;
  confidence: OgPageConfidence;
}

export interface GradientStop {
  color: string;
  position: number;
  opacity: number;
}

export interface GradientEffect {
  type: "linear" | "radial";
  angle?: number;
  stops: GradientStop[];
}

export interface NoiseEffect {
  amount: number;
  blendMode: "normal" | "multiply" | "overlay" | "soft-light";
}

export interface LightingEffect {
  type: "spotlight" | "edge";
  x: number;
  y: number;
  intensity: number;
  color: string;
}

export interface GlowEffect {
  enabled: boolean;
  color?: string;
  radius: number;
  intensity: number;
  spread?: number;
}

export interface LayerEffects {
  shadow: boolean;
  glow: boolean | GlowEffect;
  blur: number;
  gradient?: GradientEffect;
  noise?: NoiseEffect;
  lighting?: LightingEffect;
  vignette?: number;
}

export function getNoiseDisplayOpacity(amount: number): number {
  return Math.min(0.56, Math.max(0.05, amount * 3.2));
}

export interface CanvasShadowVisual {
  color: string;
  blur: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
}

export interface SvgShadowVisual {
  color: string;
  stdDeviation: number;
  floodOpacity: number;
  dx: number;
  dy: number;
}

const shadowVisual = {
  color: "#020617",
  blur: 18,
  opacity: 0.34,
  offsetX: 0,
  offsetY: 18
} as const;

export function hasComposedLayerEffect(effects: LayerEffects): boolean {
  return Boolean(effects.shadow || isGlowEffectEnabled(effects.glow) || Math.max(0, effects.blur ?? 0) > 0);
}

export function getCanvasShadowVisual(effects: LayerEffects, fallbackColor: string): CanvasShadowVisual {
  const glow = normalizeGlowEffect(effects.glow, fallbackColor);
  if (isGlowEffectEnabled(effects.glow)) {
    return {
      color: glow.color ?? fallbackColor,
      blur: glow.radius,
      opacity: glow.intensity,
      offsetX: 0,
      offsetY: effects.shadow ? shadowVisual.offsetY : 0
    };
  }
  return {
    color: shadowVisual.color,
    blur: effects.shadow ? shadowVisual.blur : 0,
    opacity: effects.shadow ? shadowVisual.opacity : 0,
    offsetX: shadowVisual.offsetX,
    offsetY: effects.shadow ? shadowVisual.offsetY : 0
  };
}

export function getSvgShadowVisual(effects: LayerEffects, fallbackColor: string): SvgShadowVisual {
  const canvas = getCanvasShadowVisual(effects, fallbackColor);
  return {
    color: canvas.color,
    stdDeviation: canvas.blur,
    floodOpacity: canvas.opacity,
    dx: canvas.offsetX,
    dy: canvas.offsetY
  };
}

export function getCanvasEffectCachePadding(effects: LayerEffects, fallbackColor = "#d9a441"): number {
  const blur = Math.max(0, effects.blur ?? 0);
  const shadow = getCanvasShadowVisual(effects, fallbackColor);
  const glow = normalizeGlowEffect(effects.glow, fallbackColor);
  const glowSpread = isGlowEffectEnabled(effects.glow) ? glow.radius + (glow.spread ?? 0) : 0;
  return Math.ceil(Math.max(blur * 3, shadow.blur * 2 + Math.abs(shadow.offsetY), glowSpread * 2, 0) + 8);
}

export function getLayerEffectCapabilities(kind: LayerKind): Record<EffectName, EffectCapability> {
  const supportedSurfaceEffects: Record<EffectName, EffectCapability> = {
    gradient: "supported",
    noise: "supported",
    lighting: "supported",
    vignette: "supported",
    blur: "supported",
    shadow: "supported",
    glow: "supported"
  };

  if (kind === "background" || kind === "shape" || kind === "image" || kind === "logo" || kind === "screenshot") {
    return supportedSurfaceEffects;
  }

  if (kind === "text" || kind === "badge") {
    return {
      gradient: "disabled",
      noise: "disabled",
      lighting: "disabled",
      vignette: "disabled",
      blur: "supported",
      shadow: "supported",
      glow: "supported"
    };
  }

  return {
    gradient: "disabled",
    noise: "disabled",
    lighting: "disabled",
    vignette: "disabled",
    blur: "disabled",
    shadow: "disabled",
    glow: "disabled"
  };
}

export interface BaseLayer {
  id: string;
  kind: LayerKind;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  skewX?: number;
  skewY?: number;
}

export interface TextLayer extends BaseLayer {
  kind: "text" | "badge";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing?: number;
  stroke?: string;
  strokeWidth?: number;
  effects: LayerEffects;
}

export interface ImageLayer extends BaseLayer {
  kind: "image" | "logo" | "screenshot";
  src: string;
  assetPath?: string;
  fit: "cover" | "contain" | "fill";
  borderRadius: number;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  focalPoint?: {
    x: number;
    y: number;
  };
  perspective?: Array<{ x: number; y: number }>;
  effects: LayerEffects;
}

export interface ShapeLayer extends BaseLayer {
  kind: "background" | "shape";
  shapeType?: "rectangle" | "rounded-rectangle" | "ellipse" | "line" | "frame";
  fill: string;
  radius: number;
  stroke?: string;
  strokeWidth?: number;
  effects: LayerEffects;
}

export interface GroupLayer extends BaseLayer {
  kind: "group";
  children: string[];
}

export type OgLayer = TextLayer | ImageLayer | ShapeLayer | GroupLayer;

export interface OgProject {
  schemaVersion: string;
  projectId: string;
  sessionId?: string;
  name: string;
  sourceRepo?: string;
  strategy: GenerationStrategy;
  generationMode: GenerationMode;
  targetPages: string[];
  canvas: {
    width: number;
    height: number;
    safeInset: number;
    background: string;
  };
  brand: {
    name: string;
    accent: string;
    surface: string;
    text: string;
  };
  sourceArtifacts: OpenGraphCreatorSourceArtifact[];
  layers: OgLayer[];
  activePageId?: string;
  pages?: OgPageVariant[];
  sharedDesign?: {
    name: string;
    description?: string;
    lockedStyleLayerIds?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface OgPageVariant {
  id: string;
  route: string;
  title: string;
  description?: string;
  exportPath: string;
  status: OgPageStatus;
  layers: OgLayer[];
  sourceContext: OgPageSourceContext;
}

export interface OpenGraphCreatorSessionExport {
  path: string;
  format: ExportFormat;
  width: number;
  height: number;
  page?: string;
  fileSizeBytes?: number;
  createdAt: string;
}

export interface OpenGraphCreatorPublishRequest {
  path: string;
  imagePath: string;
  pageImages?: Array<{ page: string; imagePath: string }>;
  framework?: Framework;
  page: string;
  status: "preview" | "confirmed";
  createdAt: string;
}

export interface OpenGraphCreatorAgentRequest {
  path: string;
  prompt: string;
  documentPath: string;
  expectedOutput: string;
  status: "requested" | "resolved";
  createdAt: string;
}

export interface OpenGraphCreatorSession {
  id: string;
  repo: string;
  agent: AgentKind;
  strategy: GenerationStrategy;
  mode: GenerationMode;
  status: SessionStatus;
  activeProjectId?: string;
  activeDocumentPath?: string;
  incomingArtifacts: OpenGraphCreatorSourceArtifact[];
  exports: OpenGraphCreatorSessionExport[];
  publishRequests: OpenGraphCreatorPublishRequest[];
  agentRequests?: OpenGraphCreatorAgentRequest[];
  lastHeartbeatAt: string;
  pendingAction?: string;
  recoverInstructions: string[];
}

export interface OpenGraphCreatorSessionEvent {
  id: string;
  sessionId: string;
  type: string;
  createdAt: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface CreateProjectInput {
  name: string;
  strategy: GenerationStrategy;
  generationMode?: GenerationMode;
  sourceRepo?: string;
  pages?: string[];
  title?: string;
  subtitle?: string;
  sourceArtifacts?: OpenGraphCreatorSourceArtifact[];
}

export type ProjectPreset =
  | "founder-launch"
  | "product-shot"
  | "technical-article"
  | "studio-editorial"
  | "agent-canvas"
  | "release-notes";

export interface CreatePresetProjectInput extends CreateProjectInput {
  preset: ProjectPreset;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface PlatformWarning {
  code: "safe-zone" | "large-file" | "low-contrast" | "empty-text" | "hidden-important-layer";
  severity: "info" | "warning" | "error";
  message: string;
  layerId?: string;
}

export function createDefaultProject(input: CreateProjectInput): OgProject {
  const now = new Date().toISOString();
  const title = input.title ?? input.name;
  const subtitle = input.subtitle ?? "Layered social cards, reviewed before publish.";

  return {
    schemaVersion: "1.0",
    projectId: slugify(`${input.name}-${Date.now().toString(36)}`),
    name: input.name,
    sourceRepo: input.sourceRepo,
    strategy: input.strategy,
    generationMode: input.generationMode ?? "template",
    targetPages: input.pages?.length ? input.pages : ["/"],
    canvas: {
      width: 1200,
      height: 630,
      safeInset: 64,
      background: "#f1f2ef"
    },
    brand: {
      name: input.name,
      accent: "#b33d52",
      surface: "#fbfbf8",
      text: "#171918"
    },
    sourceArtifacts: input.sourceArtifacts ?? [],
    layers: [
      {
        id: "background",
        kind: "background",
        name: "Background",
        x: 0,
        y: 0,
        width: 1200,
        height: 630,
        rotation: 0,
        opacity: 1,
        locked: true,
        hidden: false,
        fill: "#f1f2ef",
        radius: 0,
        effects: { shadow: false, glow: false, blur: 0 }
      },
      {
        id: "brand-mark",
        kind: "logo",
        name: "Logo Placeholder",
        x: 82,
        y: 76,
        width: 64,
        height: 64,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        src: "ogcreator://logo-placeholder",
        fit: "contain",
        borderRadius: 10,
        effects: { shadow: false, glow: false, blur: 0 }
      },
      {
        id: "badge",
        kind: "badge",
        name: "Page Badge",
        x: 164,
        y: 88,
        width: 270,
        height: 36,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        text: input.strategy === "pages" ? "Page-specific OG" : "Open Graph Preview",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 22,
        fontWeight: 700,
        color: "#8a5f35",
        align: "left",
        lineHeight: 1,
        effects: { shadow: false, glow: false, blur: 0 }
      },
      {
        id: "headline",
        kind: "text",
        name: "Headline",
        x: 82,
        y: 204,
        width: 720,
        height: 190,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        text: title,
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 70,
        fontWeight: 800,
        color: "#171918",
        align: "left",
        lineHeight: 1.04,
        effects: { shadow: false, glow: false, blur: 0 }
      },
      {
        id: "subtitle",
        kind: "text",
        name: "Subtitle",
        x: 86,
        y: 416,
        width: 680,
        height: 90,
        rotation: 0,
        opacity: 0.9,
        locked: false,
        hidden: false,
        text: subtitle,
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 30,
        fontWeight: 500,
        color: "#667067",
        align: "left",
        lineHeight: 1.22,
        effects: { shadow: false, glow: false, blur: 0 }
      }
    ],
    createdAt: now,
    updatedAt: now
  };
}

export function createProjectFromPreset(input: CreatePresetProjectInput): OgProject {
  const project = createDefaultProject(input);

  if (input.preset === "founder-launch") {
    return {
      ...project,
      brand: { ...project.brand, accent: "#2f7d6d", surface: "#fbfbf8" },
      canvas: { ...project.canvas, background: "#f1f2ef" },
      layers: project.layers.map((layer) => {
        if (layer.id === "badge" && (layer.kind === "badge" || layer.kind === "text")) {
          return { ...layer, text: "Founder Launch", color: "#2f7d6d" };
        }
        return layer;
      })
    };
  }

  if (input.preset === "product-shot") {
    return {
      ...project,
      brand: { ...project.brand, accent: "#365f9f", surface: "#fbfbf8" },
      canvas: { ...project.canvas, background: "#f1f2ef" },
      layers: project.layers.map((layer) => {
        if (layer.id === "badge" && (layer.kind === "badge" || layer.kind === "text")) {
          return { ...layer, text: "Product Preview", color: "#365f9f" };
        }
        return layer;
      })
    };
  }

  if (input.preset === "technical-article") {
    return {
      ...project,
      brand: { ...project.brand, accent: "#ad7a2f", surface: "#fbfbf8" },
      canvas: { ...project.canvas, background: "#f1f2ef" },
      layers: project.layers.map((layer) => {
        if (layer.id === "badge" && (layer.kind === "badge" || layer.kind === "text")) {
          return { ...layer, text: "Technical Article", color: "#ad7a2f" };
        }
        if (layer.id === "headline" && layer.kind === "text") {
          return { ...layer, fontSize: 68, width: 820 };
        }
        return layer;
      })
    };
  }

  if (input.preset === "studio-editorial") {
    return {
      ...project,
      brand: { ...project.brand, accent: "#8f3f5f", surface: "#fffaf7", text: "#1f1b1a" },
      canvas: { ...project.canvas, background: "#f6f0ea" },
      layers: [
        ...project.layers.map((layer) => {
          if (layer.id === "background" && layer.kind === "background") return { ...layer, fill: "#f6f0ea" };
          if (layer.id === "badge" && (layer.kind === "badge" || layer.kind === "text")) {
            return { ...layer, x: 84, y: 88, text: "Studio Editorial", color: "#8f3f5f" };
          }
          if (layer.id === "headline" && layer.kind === "text") {
            return { ...layer, x: 84, y: 178, width: 650, fontSize: 76, color: "#1f1b1a" };
          }
          if (layer.id === "subtitle" && layer.kind === "text") {
            return { ...layer, x: 88, y: 434, width: 610, color: "#625753" };
          }
          return layer;
        }),
        {
          id: "reference-image",
          kind: "image",
          name: "Reference Image",
          x: 828,
          y: 124,
          width: 240,
          height: 170,
          rotation: 0,
          opacity: 1,
          locked: false,
          hidden: false,
          src: "ogcreator://image-placeholder",
          fit: "cover",
          borderRadius: 6,
          effects: { shadow: false, glow: false, blur: 0 }
        }
      ]
    };
  }

  if (input.preset === "agent-canvas") {
    return {
      ...project,
      brand: { ...project.brand, accent: "#244f74", surface: "#f8fbfb", text: "#121b22" },
      canvas: { ...project.canvas, background: "#e9f0ef" },
      layers: [
        ...project.layers.map((layer) => {
          if (layer.id === "background" && layer.kind === "background") return { ...layer, fill: "#e9f0ef" };
          if (layer.id === "badge" && (layer.kind === "badge" || layer.kind === "text")) {
            return { ...layer, x: 780, y: 90, width: 250, text: "Agent Handoff", color: "#244f74" };
          }
          if (layer.id === "headline" && layer.kind === "text") {
            return { ...layer, x: 90, y: 138, width: 590, fontSize: 68, color: "#121b22" };
          }
          if (layer.id === "subtitle" && layer.kind === "text") {
            return { ...layer, x: 94, y: 402, width: 560, color: "#526068" };
          }
          return layer;
        }),
        {
          id: "generated-preview",
          kind: "screenshot",
          name: "Generated Preview",
          x: 778,
          y: 170,
          width: 294,
          height: 190,
          rotation: 0,
          opacity: 1,
          locked: false,
          hidden: false,
          src: "ogcreator://image-placeholder",
          fit: "cover",
          borderRadius: 8,
          effects: { shadow: true, glow: false, blur: 0 }
        }
      ]
    };
  }

  return {
    ...project,
    brand: { ...project.brand, accent: "#59621f", surface: "#fbfbf8", text: "#191d15" },
    canvas: { ...project.canvas, background: "#eef0df" },
    layers: project.layers.map((layer) => {
      if (layer.id === "badge" && (layer.kind === "badge" || layer.kind === "text")) {
        return { ...layer, x: 92, y: 84, text: "Release Notes", color: "#59621f" };
      }
      if (layer.id === "headline" && layer.kind === "text") {
        return { ...layer, x: 92, y: 156, width: 760, fontSize: 66, color: "#191d15" };
      }
      if (layer.id === "subtitle" && layer.kind === "text") {
        return { ...layer, x: 96, y: 412, width: 670, color: "#5f6654" };
      }
      return layer;
    })
  };
}

export function createPageVariantProjects(project: OgProject): OgProject[] {
  return project.targetPages.map((page) => {
    const title = pageToTitle(page);
    return {
      ...project,
      projectId: slugify(`${project.projectId}-${page === "/" ? "home" : page}`),
      name: `${project.name} - ${title}`,
      targetPages: [page],
      layers: project.layers.map((layer) => {
        if (layer.id === "headline" && layer.kind === "text") {
          return { ...layer, text: title };
        }
        if (layer.id === "badge" && (layer.kind === "badge" || layer.kind === "text")) {
          return { ...layer, text: page === "/" ? "Home" : "Page-specific OG" };
        }
        return layer;
      })
    };
  });
}

export function createMultiPageProject(project: OgProject, contexts: OgPageSourceContext[] = []): OgProject {
  const targetPages = normalizeTargetPages(project.targetPages);
  if (project.strategy === "common" || targetPages.length <= 1) {
    return {
      ...project,
      targetPages,
      activePageId: undefined,
      pages: undefined
    };
  }
  const pages = targetPages.map((route) => {
    const context =
      contexts.find((item) => item.route && normalizeRoute(item.route) === route) ??
      contexts.find((item) => item.routeFile && normalizeRoute(item.routeFile) === route);
    const title = context?.detectedTitle?.trim() || pageToTitle(route);
    const description = context?.detectedDescription?.trim() || (route === "/" ? "Homepage Open Graph preview." : `${title} page Open Graph preview.`);
    return createPageVariant(project, route, { ...context, detectedTitle: title, detectedDescription: description, confidence: context?.confidence ?? "medium" });
  });
  const activePageId = project.activePageId && pages.some((page) => page.id === project.activePageId) ? project.activePageId : pages[0]?.id;
  const active = pages.find((page) => page.id === activePageId) ?? pages[0];
  return {
    ...project,
    targetPages,
    activePageId,
    pages,
    layers: active?.layers ?? project.layers,
    sharedDesign: project.sharedDesign ?? {
      name: `${project.name} OG system`,
      description: "Shared visual system with materialized editable page variants.",
      lockedStyleLayerIds: ["background", "brand-mark"]
    },
    updatedAt: new Date().toISOString()
  };
}

export function getActivePage(project: OgProject): OgPageVariant | undefined {
  if (!project.pages?.length) return undefined;
  return project.pages.find((page) => page.id === project.activePageId) ?? project.pages[0];
}

export function getRenderableProject(project: OgProject, pageIdOrRoute?: string): OgProject {
  const page = getPageVariant(project, pageIdOrRoute) ?? getActivePage(project);
  if (!page) return project;
  return {
    ...project,
    name: `${project.name} - ${page.title}`,
    activePageId: page.id,
    targetPages: [page.route],
    layers: page.layers
  };
}

export function setActivePage(project: OgProject, pageIdOrRoute: string): OgProject {
  const page = getPageVariant(project, pageIdOrRoute);
  if (!page) return project;
  return {
    ...project,
    activePageId: page.id,
    targetPages: project.targetPages,
    layers: page.layers,
    updatedAt: new Date().toISOString()
  };
}

export function updateActivePageLayers(project: OgProject, layers: OgLayer[], status: OgPageStatus = "edited"): OgProject {
  const active = getActivePage(project);
  if (!active || !project.pages?.length) {
    return { ...project, layers, updatedAt: new Date().toISOString() };
  }
  const pages = project.pages.map((page) =>
    page.id === active.id
      ? {
          ...page,
          layers,
          status
        }
      : page
  );
  return {
    ...project,
    pages,
    layers,
    updatedAt: new Date().toISOString()
  };
}

export function createPageVariant(project: OgProject, route: string, context: OgPageSourceContext): OgPageVariant {
  const normalizedRoute = normalizeRoute(route);
  const title = context.detectedTitle?.trim() || pageToTitle(normalizedRoute);
  const description = context.detectedDescription?.trim();
  const layers = project.layers.map((layer) => {
    if (layer.id === "headline" && layer.kind === "text") {
      return { ...layer, text: title };
    }
    if (layer.id === "subtitle" && layer.kind === "text") {
      return { ...layer, text: description || `${title} page Open Graph preview.` };
    }
    if (layer.id === "badge" && (layer.kind === "badge" || layer.kind === "text")) {
      return { ...layer, text: normalizedRoute === "/" ? "Home" : pageToTitle(normalizedRoute) };
    }
    return JSON.parse(JSON.stringify(layer)) as OgLayer;
  });
  return {
    id: routeToPageId(normalizedRoute),
    route: normalizedRoute,
    title,
    description,
    exportPath: getExportPath({ page: normalizedRoute, strategy: project.strategy, format: "png" }),
    status: "draft",
    layers,
    sourceContext: {
      ...context,
      detectedTitle: title,
      detectedDescription: description,
      confidence: context.confidence
    }
  };
}

function getPageVariant(project: OgProject, pageIdOrRoute?: string): OgPageVariant | undefined {
  if (!project.pages?.length || !pageIdOrRoute) return undefined;
  const normalized = normalizeRoute(pageIdOrRoute);
  return project.pages.find((page) => page.id === pageIdOrRoute || page.route === normalized);
}

export function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed || trimmed === ".") return "/";
  const withoutFilePrefix = trimmed
    .replace(/^app\//, "/")
    .replace(/^pages\//, "/")
    .replace(/^src\/pages\//, "/")
    .replace(/\/page\.[tj]sx$/, "")
    .replace(/\.[tj]sx$/, "")
    .replace(/\.astro$/, "")
    .replace(/\/index$/, "");
  const routeLike = withoutFilePrefix.startsWith("/") ? withoutFilePrefix : `/${withoutFilePrefix}`;
  return routeLike.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
}

export function normalizeTargetPages(pages: string[]): string[] {
  const seen = new Set<string>();
  const normalized = pages
    .map((page) => page.trim())
    .filter(Boolean)
    .map(normalizeRoute)
    .filter((page) => {
      if (seen.has(page)) return false;
      seen.add(page);
      return true;
    });
  return normalized.length ? normalized : ["/"];
}

export function pageToTitle(page: string): string {
  if (page === "/") return "Home";
  const segment = page.split("/").filter(Boolean).at(-1) ?? "Page";
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function routeToPageId(route: string): string {
  return `page-${slugifyRoute(route)}`;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function validateProject(project: OgProject): ValidationResult {
  const errors: string[] = [];

  if (!project.name.trim()) errors.push("Project name is required.");
  if (project.canvas.width !== 1200 || project.canvas.height !== 630) {
    errors.push("Default OG canvas must be 1200x630.");
  }
  if (!project.layers.length) errors.push("Project must include at least one editable layer.");
  if (!project.targetPages.length) errors.push("Project must target at least one page.");
  if (project.pages?.length) {
    for (const page of project.pages) {
      if (!page.route) errors.push(`Page variant ${page.id} must include a route.`);
      if (!page.layers.length) errors.push(`Page variant ${page.route} must include at least one editable layer.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function normalizeGlowEffect(glow: LayerEffects["glow"], fallbackColor: string): GlowEffect {
  if (typeof glow === "boolean") {
    return {
      enabled: glow,
      color: fallbackColor,
      radius: 24,
      intensity: glow ? 0.42 : 0.32,
      spread: 0
    };
  }
  return {
    enabled: glow.enabled,
    color: glow.color || fallbackColor,
    radius: clampNumber(glow.radius, 0, 80),
    intensity: clampNumber(glow.intensity, 0, 1),
    spread: clampNumber(glow.spread ?? 0, 0, 24)
  };
}

export function isGlowEffectEnabled(glow: LayerEffects["glow"]): boolean {
  return typeof glow === "boolean" ? glow : glow.enabled && glow.intensity > 0 && glow.radius > 0;
}

export function detectFramework(files: string[]): Framework {
  const normalized = new Set(files.map((file) => file.replaceAll("\\", "/").toLowerCase()));
  const has = (path: string) => normalized.has(path.toLowerCase());
  const anyEndsWith = (suffix: string) => [...normalized].some((file) => file.endsWith(suffix));

  if (has("next.config.js") || has("next.config.mjs") || has("next.config.ts") || has("app/page.tsx")) {
    return "next";
  }
  if (has("astro.config.mjs") || has("astro.config.ts") || anyEndsWith(".astro")) return "astro";
  if (has("nuxt.config.ts") || has("nuxt.config.js") || has("app.vue")) return "nuxt";
  if (has("remix.config.js") || has("app/root.tsx")) return "remix";
  if (has("vite.config.ts") || has("vite.config.js")) return "vite";
  if (has("index.html")) return "html";
  return "unknown";
}

export function getExportPath(input: {
  page: string;
  strategy: GenerationStrategy;
  format: ExportFormat;
}): string {
  if (input.strategy === "common" || input.page === "/") {
    return `public/og.${input.format}`;
  }
  return `public/og/${slugifyRoute(input.page)}.${input.format}`;
}

export function getPlatformWarnings(
  project: OgProject,
  options: { fileSizeBytes?: number } = {}
): PlatformWarning[] {
  const warnings: PlatformWarning[] = [];
  const inset = project.canvas.safeInset;

  for (const layer of project.layers) {
    if (layer.hidden && ["headline", "subtitle", "brand-mark"].includes(layer.id)) {
      warnings.push({
        code: "hidden-important-layer",
        severity: "warning",
        message: `${layer.name} is hidden and may produce a weak social card.`,
        layerId: layer.id
      });
    }

    if (layer.x < inset || layer.y < inset || layer.x + layer.width > project.canvas.width - inset) {
      warnings.push({
        code: "safe-zone",
        severity: "warning",
        message: `${layer.name} is close to a platform crop edge.`,
        layerId: layer.id
      });
    }

    if ((layer.kind === "text" || layer.kind === "badge") && !layer.text.trim()) {
      warnings.push({
        code: "empty-text",
        severity: "warning",
        message: `${layer.name} has no text content.`,
        layerId: layer.id
      });
    }

    if ((layer.kind === "text" || layer.kind === "badge") && contrastRatio(layer.color, project.canvas.background) < 4.5) {
      warnings.push({
        code: "low-contrast",
        severity: "warning",
        message: `${layer.name} may be hard to read on social cards.`,
        layerId: layer.id
      });
    }
  }

  if ((options.fileSizeBytes ?? 0) > 5_000_000) {
    warnings.push({
      code: "large-file",
      severity: "error",
      message: "Export is larger than 5 MB; compress before publishing."
    });
  } else if ((options.fileSizeBytes ?? 0) > 1_000_000) {
    warnings.push({
      code: "large-file",
      severity: "warning",
      message: "Export is larger than 1 MB; consider WebP/JPEG compression."
    });
  }

  return dedupeWarnings(warnings);
}

function dedupeWarnings(warnings: PlatformWarning[]): PlatformWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}-${warning.layerId ?? "project"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function slugifyRoute(route: string): string {
  const clean = route.replace(/^\/+/, "").replace(/\/+$/, "");
  return slugify(clean || "home");
}

function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(parseColor(foreground));
  const bg = relativeLuminance(parseColor(extractFirstHex(background)));
  const light = Math.max(fg, bg);
  const dark = Math.min(fg, bg);
  return (light + 0.05) / (dark + 0.05);
}

function extractFirstHex(value: string): string {
  return value.match(/#[0-9a-fA-F]{3,6}/)?.[0] ?? "#000000";
}

function parseColor(hex: string): [number, number, number] {
  const color = hex.replace("#", "");
  const full =
    color.length === 3
      ? color
          .split("")
          .map((char) => char + char)
          .join("")
      : color.padEnd(6, "0").slice(0, 6);
  return [0, 2, 4].map((index) => Number.parseInt(full.slice(index, index + 2), 16) / 255) as [
    number,
    number,
    number
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const linear = [r, g, b].map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

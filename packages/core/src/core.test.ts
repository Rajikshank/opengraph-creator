import { describe, expect, it } from "vitest";
import {
  createDefaultProject,
  createMultiPageProject,
  createProjectFromPreset,
  createPageVariantProjects,
  detectFramework,
  getActivePage,
  getCanvasEffectCachePadding,
  getCanvasShadowVisual,
  getExportPath,
  getLayerEffectCapabilities,
  createLayerStyleEffect,
  getLayerStyleEffectCapabilities,
  normalizeLayerStyleEffects,
  getNoiseDisplayOpacity,
  getPerspectiveBounds,
  getRenderableProject,
  getPlatformWarnings,
  getSvgShadowVisual,
  hasComposedLayerEffect,
  isGlowEffectEnabled,
  isDefaultPerspectiveQuad,
  normalizePerspectiveQuad,
  normalizeGlowEffect,
  sanitizeGeneratedProjectEffects,
  setActivePage,
  updateActivePageLayers,
  validateProject
} from "./index";

describe("OpenGraphCreator core", () => {
  it("keeps canvas and SVG shadow visuals on one shared effect contract", () => {
    const effects = { shadow: true, glow: false, blur: 0 };

    expect(hasComposedLayerEffect(effects)).toBe(true);
    expect(getCanvasShadowVisual(effects, "#d9a441")).toMatchObject({
      color: "#020617",
      blur: 18,
      opacity: 0.34,
      offsetY: 18
    });
    expect(getSvgShadowVisual(effects, "#d9a441")).toMatchObject({
      color: "#020617",
      stdDeviation: 18,
      floodOpacity: 0.34,
      dy: 18
    });
    expect(getCanvasEffectCachePadding({ shadow: true, glow: false, blur: 8 })).toBeGreaterThanOrEqual(60);
  });

  it("creates an editable hybrid project with a 1200x630 canvas and required layers", () => {
    const project = createDefaultProject({
      name: "Launch site",
      strategy: "hybrid",
      sourceRepo: "D:/apps/launch",
      pages: ["/", "/pricing"]
    });

    expect(project.canvas).toMatchObject({ width: 1200, height: 630 });
    expect(project.schemaVersion).toBe("1.0");
    expect(project.strategy).toBe("hybrid");
    expect(project.generationMode).toBe("template");
    expect(project.targetPages).toEqual(["/", "/pricing"]);
    expect(project.layers.map((layer) => layer.kind)).toEqual(
      expect.arrayContaining(["background", "text", "badge", "logo"])
    );
    expect(validateProject(project).ok).toBe(true);
  });

  it("preserves a pure-image generation mode in editable project JSON", () => {
    const project = createDefaultProject({ name: "Pure", strategy: "common", generationMode: "pure-image" });

    expect(project.generationMode).toBe("pure-image");
  });

  it("tracks generated source artifacts from coding agents", () => {
    const project = createDefaultProject({
      name: "Agent Source",
      strategy: "hybrid",
      sourceArtifacts: [
        {
          kind: "svg",
          origin: "codex",
          path: ".opengraph-creator/generated/og.svg",
          createdAt: "2026-05-26T00:00:00.000Z"
        }
      ]
    });

    expect(project.sourceArtifacts).toEqual([
      {
        kind: "svg",
        origin: "codex",
        path: ".opengraph-creator/generated/og.svg",
        createdAt: "2026-05-26T00:00:00.000Z"
      }
    ]);
    expect(validateProject(project).ok).toBe(true);
  });

  it("serializes rich visual effects for generated layers", () => {
    const project = createDefaultProject({ name: "Effects", strategy: "common" });
    const visual = project.layers.find((layer) => layer.id === "background");
    if (!visual || !("effects" in visual)) throw new Error("background layer is missing effects");

    visual.effects = {
      shadow: true,
      glow: false,
      blur: 0,
      gradient: {
        type: "linear",
        angle: 35,
        stops: [
          { color: "#f8fafc", position: 0, opacity: 1 },
          { color: "#dbeafe", position: 1, opacity: 1 }
        ]
      },
      noise: { amount: 0.08, blendMode: "soft-light" },
      lighting: { type: "spotlight", x: 0.68, y: 0.32, intensity: 0.42, color: "#ffffff" },
      vignette: 0.16
    };

    const serialized = JSON.parse(JSON.stringify(project)) as typeof project;
    const serializedVisual = serialized.layers.find((layer) => layer.id === "background");

    expect(serializedVisual && "effects" in serializedVisual ? serializedVisual.effects.gradient?.type : undefined).toBe("linear");
    expect(serializedVisual && "effects" in serializedVisual ? serializedVisual.effects.noise?.blendMode : undefined).toBe("soft-light");
    expect(serializedVisual && "effects" in serializedVisual ? serializedVisual.effects.lighting?.type : undefined).toBe("spotlight");
    expect(serializedVisual && "effects" in serializedVisual ? serializedVisual.effects.vignette : undefined).toBe(0.16);
  });

  it("uses the editorial production template palette instead of the rejected blue-gray defaults", () => {
    const project = createDefaultProject({ name: "Professional", strategy: "common" });
    const serialized = JSON.stringify(project);

    expect(project.canvas.background).toBe("#f1f2ef");
    expect(project.brand.accent).toBe("#b33d52");
    expect(project.brand.text).toBe("#171918");
    expect(project.layers.find((layer) => layer.id === "headline")).toMatchObject({
      color: "#171918"
    });
    expect(project.layers.find((layer) => layer.id === "badge")).toMatchObject({
      color: "#8a5f35"
    });
    expect(project.layers.some((layer) => layer.id === "visual-card" || layer.name === "Artwork Frame")).toBe(false);
    expect(serialized).not.toContain("#0f172a");
    expect(serialized).not.toContain("#2dd4bf");
    expect(serialized).not.toContain("#a78bfa");
    expect(serialized).not.toContain("#2f5f8f");
    expect(serialized).not.toContain("#f4f5f7");
    expect(serialized).not.toContain("linear-gradient");
    expect(project.layers.every((layer) => !("effects" in layer) || !layer.effects.glow)).toBe(true);
  });

  it("normalizes controlled glow settings while preserving legacy boolean projects", () => {
    expect(normalizeGlowEffect(true, "#f2b35b")).toMatchObject({
      enabled: true,
      color: "#f2b35b",
      radius: 24,
      intensity: 0.42
    });
    expect(isGlowEffectEnabled(true)).toBe(true);

    const custom = normalizeGlowEffect({ enabled: true, color: "#f6c36b", radius: 120, intensity: 1.4 }, "#ffffff");
    expect(custom).toEqual({ enabled: true, color: "#f6c36b", radius: 80, intensity: 1, spread: 0 });
    expect(isGlowEffectEnabled(custom)).toBe(true);
    expect(isGlowEffectEnabled({ ...custom, intensity: 0 })).toBe(false);
  });

  it("defines which visual effects are actually supported per layer kind", () => {
    expect(getLayerEffectCapabilities("shape")).toMatchObject({
      gradient: "supported",
      noise: "supported",
      lighting: "supported",
      vignette: "supported",
      glow: "supported"
    });
    expect(getLayerEffectCapabilities("image")).toMatchObject({
      noise: "supported",
      lighting: "supported",
      vignette: "supported",
      glow: "supported"
    });
    expect(getLayerEffectCapabilities("text")).toMatchObject({
      gradient: "disabled",
      noise: "disabled",
      lighting: "disabled",
      vignette: "disabled",
      blur: "supported",
      shadow: "supported",
      glow: "supported"
    });
    expect(getLayerEffectCapabilities("badge").lighting).toBe("disabled");
    expect(getLayerEffectCapabilities("group").glow).toBe("disabled");
  });

  it("adds a compatible advanced effect stack without breaking legacy effects", () => {
    const project = createDefaultProject({ name: "Advanced Effects", strategy: "common" });
    const layer = project.layers.find((item) => item.id === "background");
    if (!layer || !("effects" in layer)) throw new Error("background layer is missing effects");

    layer.effects.stack = [
      createLayerStyleEffect("color-grade", { id: "grade", intensity: 0.64, params: { brightness: 0.05 } }),
      createLayerStyleEffect("ascii", { id: "ascii", intensity: 0.42, params: { cellSize: 22 } }),
      { id: "broken", kind: "missing-effect", enabled: true, intensity: 8, params: {} } as never
    ];

    const normalized = normalizeLayerStyleEffects(layer.effects);

    expect(normalized.map((effect) => effect.kind)).toEqual(["color-grade", "ascii"]);
    expect(normalized[0]).toMatchObject({
      id: "grade",
      enabled: true,
      intensity: 0.64,
      params: expect.objectContaining({ brightness: 0.05, contrast: 0.12 })
    });
    expect(normalized[1]).toMatchObject({
      id: "ascii",
      intensity: 0.42,
      params: expect.objectContaining({ cellSize: 22, charset: "@#%+=-:. " })
    });
  });

  it("reports advanced effect capabilities per layer kind", () => {
    expect(getLayerStyleEffectCapabilities("image")).toMatchObject({
      "color-grade": "supported",
      "ordered-dither": "supported",
      ascii: "supported",
      displacement: "supported"
    });
    expect(getLayerStyleEffectCapabilities("text")).toMatchObject({
      bloom: "supported",
      "rgb-split": "supported",
      ascii: "disabled",
      halftone: "disabled"
    });
    expect(getLayerEffectCapabilities("text")).toMatchObject({
      bloom: "supported",
      "rgb-split": "supported",
      "color-grade": "disabled"
    });
  });

  it("normalizes noise opacity for canvas and platform preview parity", () => {
    expect(getNoiseDisplayOpacity(0.06)).toBe(0.192);
    expect(getNoiseDisplayOpacity(0.001)).toBe(0.05);
    expect(getNoiseDisplayOpacity(0.5)).toBe(0.56);
  });

  it("normalizes perspective quads and detects default image geometry", () => {
    const normalized = normalizePerspectiveQuad([
      { x: -0.3, y: 0.08 },
      { x: 1.4, y: -0.2 },
      { x: 0.94, y: 1.3 },
      { x: 0.12, y: 0.88 }
    ]);

    expect(normalized).toEqual([
      { x: 0, y: 0.08 },
      { x: 1, y: 0 },
      { x: 0.94, y: 1 },
      { x: 0.12, y: 0.88 }
    ]);
    expect(isDefaultPerspectiveQuad(normalized)).toBe(false);
    expect(isDefaultPerspectiveQuad(normalizePerspectiveQuad(undefined))).toBe(true);
    expect(getPerspectiveBounds({ x: 100, y: 80, width: 300, height: 160 }, normalized)).toEqual({
      x: 100,
      y: 80,
      width: 300,
      height: 160
    });
  });

  it("removes accidental agent-generated noise unless the brief explicitly allows it", () => {
    const project = createMultiPageProject(
      createDefaultProject({ name: "Generated Noise", strategy: "pages", pages: ["/", "/pricing"] })
    );
    const noisyLayers = project.layers.map((layer) =>
      "effects" in layer ? { ...layer, effects: { ...layer.effects, noise: { amount: 0.18, blendMode: "overlay" as const } } } : layer
    );
    const noisyPages = project.pages?.map((page) => ({
      ...page,
      layers: page.layers.map((layer) =>
        "effects" in layer ? { ...layer, effects: { ...layer.effects, noise: { amount: 0.12, blendMode: "soft-light" as const } } } : layer
      )
    }));

    const result = sanitizeGeneratedProjectEffects({ ...project, layers: noisyLayers, pages: noisyPages });

    expect(result.changed).toBe(true);
    expect(result.warnings).toEqual([
      "Removed unapproved generated noise/grain from 15 layer effects. Noise is opt-in and can be added later in Studio."
    ]);
    expect(JSON.stringify(result.project)).not.toContain('"noise"');
  });

  it("preserves but caps generated noise when the brief explicitly allows grain", () => {
    const project = createDefaultProject({ name: "Approved Grain", strategy: "common" });
    const noisyLayers = project.layers.map((layer) =>
      layer.id === "background" && "effects" in layer
        ? { ...layer, effects: { ...layer.effects, noise: { amount: 0.2, blendMode: "soft-light" as const } } }
        : layer
    );

    const result = sanitizeGeneratedProjectEffects({ ...project, layers: noisyLayers }, { allowNoise: true });
    const background = result.project.layers.find((layer) => layer.id === "background");

    expect(result.changed).toBe(true);
    expect(result.warnings).toEqual(["Clamped generated noise/grain on 1 layer effect to 0.025 for social preview readability."]);
    expect(background && "effects" in background ? background.effects.noise : undefined).toEqual({
      amount: 0.025,
      blendMode: "soft-light"
    });
  });

  it("rejects projects without editable layers", () => {
    const project = createDefaultProject({ name: "Broken", strategy: "common" });
    project.layers = [];

    expect(validateProject(project)).toEqual({
      ok: false,
      errors: ["Project must include at least one editable layer."]
    });
  });

  it("detects common web frameworks from repo files", () => {
    expect(detectFramework(["package.json", "next.config.js", "app/page.tsx"])).toBe("next");
    expect(detectFramework(["package.json", "astro.config.mjs", "src/pages/index.astro"])).toBe("astro");
    expect(detectFramework(["package.json", "nuxt.config.ts", "app.vue"])).toBe("nuxt");
    expect(detectFramework(["package.json", "vite.config.ts", "src/main.tsx"])).toBe("vite");
    expect(detectFramework(["index.html"])).toBe("html");
  });

  it("resolves stable export paths for common and page-specific OG images", () => {
    expect(getExportPath({ page: "/", strategy: "common", format: "png" })).toBe("public/og.png");
    expect(getExportPath({ page: "/pricing", strategy: "pages", format: "webp" })).toBe(
      "public/og/pricing.webp"
    );
    expect(getExportPath({ page: "/blog/my-post", strategy: "hybrid", format: "png" })).toBe(
      "public/og/blog-my-post.png"
    );
  });

  it("reports platform warnings for unsafe crop, contrast, and file size", () => {
    const project = createDefaultProject({ name: "Warnings", strategy: "common" });
    project.layers.push({
      id: "edge-title",
      kind: "text",
      name: "Edge title",
      x: 8,
      y: 12,
      width: 400,
      height: 80,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      text: "Too close",
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 700,
      color: "#777777",
      align: "left",
      lineHeight: 1.1,
      effects: { shadow: false, glow: false, blur: 0 }
    });

    const warnings = getPlatformWarnings(project, { fileSizeBytes: 6_000_000 });

    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(["safe-zone", "large-file", "low-contrast"])
    );
  });

  it("warns at the 1 MB export threshold before the hard 5 MB error", () => {
    const project = createDefaultProject({ name: "Warnings", strategy: "common" });

    const warning = getPlatformWarnings(project, { fileSizeBytes: 1_200_000 }).find(
      (item) => item.code === "large-file"
    );
    const error = getPlatformWarnings(project, { fileSizeBytes: 5_200_000 }).find(
      (item) => item.code === "large-file"
    );

    expect(warning).toMatchObject({ severity: "warning" });
    expect(error).toMatchObject({ severity: "error" });
  });

  it("creates distinct editable projects from named presets", () => {
    const launch = createProjectFromPreset({
      preset: "founder-launch",
      name: "Launch",
      strategy: "common"
    });
    const article = createProjectFromPreset({
      preset: "technical-article",
      name: "Article",
      strategy: "pages"
    });

    expect(launch.layers.find((layer) => layer.id === "headline")).toMatchObject({
      kind: "text",
      text: "Launch"
    });
    expect(article.layers.find((layer) => layer.id === "badge")).toMatchObject({
      kind: "badge",
      text: "Technical Article"
    });
    expect(launch.brand.accent).not.toBe(article.brand.accent);
  });

  it("offers multiple meaningfully different design directions for the studio gallery", () => {
    const presets = [
      "founder-launch",
      "product-shot",
      "technical-article",
      "studio-editorial",
      "agent-canvas",
      "release-notes"
    ] as const;

    const projects = presets.map((preset) =>
      createProjectFromPreset({
        preset,
        name: "Direction",
        strategy: "hybrid"
      })
    );
    const accents = new Set(projects.map((project) => project.brand.accent));
    const headlinePositions = new Set(
      projects.map((project) => {
        const headline = project.layers.find((layer) => layer.id === "headline");
        return headline ? `${headline.x}-${headline.y}-${headline.width}` : "missing";
      })
    );

    expect(accents.size).toBeGreaterThanOrEqual(5);
    expect(headlinePositions.size).toBeGreaterThanOrEqual(4);
    expect(projects.some((project) => project.layers.some((layer) => layer.kind === "screenshot"))).toBe(true);
    expect(projects.some((project) => project.layers.some((layer) => layer.kind === "image"))).toBe(true);
  });

  it("creates editable page-specific variants from a base project", () => {
    const base = createDefaultProject({
      name: "Docs",
      strategy: "pages",
      pages: ["/", "/pricing", "/blog/get-started"]
    });

    const variants = createPageVariantProjects(base);

    expect(variants.map((variant) => variant.targetPages)).toEqual([[ "/" ], ["/pricing"], ["/blog/get-started"]]);
    expect(variants[1].name).toBe("Docs - Pricing");
    expect(variants[2].layers.find((layer) => layer.id === "headline")).toMatchObject({
      kind: "text",
      text: "Get Started"
    });
  });

  it("stores per-page OG variants inside one document without breaking common-mode projects", () => {
    const common = createDefaultProject({ name: "Common App", strategy: "common" });
    const multipage = createMultiPageProject(
      createDefaultProject({
        name: "Docs",
        strategy: "pages",
        pages: ["/", "/pricing", "/blog/get-started"]
      }),
      [
        { route: "/", detectedTitle: "Home", detectedDescription: "Welcome home", routeFile: "app/page.tsx", confidence: "high" },
        { route: "/pricing", detectedTitle: "Pricing", detectedDescription: "Simple pricing", routeFile: "app/pricing/page.tsx", confidence: "high" },
        { route: "/blog/get-started", detectedTitle: "Get Started", detectedDescription: "Start here", routeFile: "app/blog/get-started/page.tsx", confidence: "medium" }
      ]
    );

    expect(common.pages).toBeUndefined();
    expect(getActivePage(common)).toBeUndefined();
    expect(getRenderableProject(common).layers).toBe(common.layers);
    expect(multipage.pages).toHaveLength(3);
    expect(multipage.activePageId).toBe("page-home");
    expect(multipage.layers).toEqual(multipage.pages?.[0].layers);
    expect(multipage.pages?.map((page) => [page.route, page.exportPath, page.status])).toEqual([
      ["/", "public/og.png", "draft"],
      ["/pricing", "public/og/pricing.png", "draft"],
      ["/blog/get-started", "public/og/blog-get-started.png", "draft"]
    ]);
    expect(multipage.pages?.[1].sourceContext).toMatchObject({
      routeFile: "app/pricing/page.tsx",
      detectedTitle: "Pricing",
      confidence: "high"
    });
  });

  it("switches and edits active page variants while keeping the common visual system materialized", () => {
    const project = createMultiPageProject(
      createDefaultProject({ name: "SaaS", strategy: "hybrid", pages: ["/", "/features"] }),
      [
        { route: "/", detectedTitle: "Home", confidence: "high" },
        { route: "/features", detectedTitle: "Features", detectedDescription: "Everything teams need", confidence: "high" }
      ]
    );

    const features = setActivePage(project, "page-features");
    const renderable = getRenderableProject(features);
    const editedLayers = renderable.layers.map((layer) =>
      layer.id === "headline" && layer.kind === "text" ? { ...layer, text: "Feature depth" } : layer
    );
    const edited = updateActivePageLayers(features, editedLayers);

    expect(renderable.targetPages).toEqual(["/features"]);
    expect(renderable.layers.find((layer) => layer.id === "headline")).toMatchObject({
      kind: "text",
      text: "Features"
    });
    expect(edited.layers.find((layer) => layer.id === "headline")).toMatchObject({
      kind: "text",
      text: "Feature depth"
    });
    expect(edited.pages?.find((page) => page.id === "page-features")).toMatchObject({
      status: "edited",
      layers: expect.arrayContaining([expect.objectContaining({ id: "headline", text: "Feature depth" })])
    });
    expect(edited.pages?.find((page) => page.id === "page-home")?.layers.find((layer) => layer.id === "headline")).toMatchObject({
      kind: "text",
      text: "Home"
    });
  });
});

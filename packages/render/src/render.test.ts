import { describe, expect, it } from "vitest";
import { createDefaultProject, type ImageLayer } from "@graphforge/core";
import { renderProjectToSvg } from "./index";

describe("GraphForge renderer", () => {
  it("renders layer JSON into a nonblank 1200x630 SVG with editable text content", () => {
    const project = createDefaultProject({
      name: "Renderer",
      strategy: "common",
      title: "Ship better previews",
      subtitle: "Codex generated, human polished"
    });

    const svg = renderProjectToSvg(project);

    expect(svg).toContain("<svg");
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain("Ship better previews");
    expect(svg).toContain("Codex generated, human polished");
    expect(svg).toContain("<defs>");
  });

  it("honors image fit modes in exported SVG image layers", () => {
    const baseProject = createDefaultProject({ name: "Fit Modes", strategy: "common" });
    const imageLayer: ImageLayer = {
      id: "reference",
      kind: "image",
      name: "Reference",
      x: 100,
      y: 100,
      width: 300,
      height: 160,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      src: "data:image/png;base64,abc",
      fit: "contain",
      borderRadius: 0,
      effects: { shadow: false, glow: false, blur: 0 }
    };

    const containSvg = renderProjectToSvg({ ...baseProject, layers: [imageLayer] });
    const coverSvg = renderProjectToSvg({ ...baseProject, layers: [{ ...imageLayer, fit: "cover" }] });
    const fillSvg = renderProjectToSvg({ ...baseProject, layers: [{ ...imageLayer, fit: "fill" }] });

    expect(containSvg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(coverSvg).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(fillSvg).toContain('preserveAspectRatio="none"');
  });

  it("renders rich layer effects as SVG defs and overlays", () => {
    const project = createDefaultProject({ name: "Effects Render", strategy: "common" });
    project.layers = project.layers.map((layer) =>
      layer.id === "background" && "effects" in layer
        ? {
            ...layer,
            effects: {
              ...layer.effects,
              gradient: {
                type: "linear",
                angle: 25,
                stops: [
                  { color: "#ffffff", position: 0, opacity: 1 },
                  { color: "#dfe9e5", position: 1, opacity: 0.85 }
                ]
              },
              noise: { amount: 0.05, blendMode: "soft-light" },
              lighting: { type: "spotlight", x: 0.7, y: 0.3, intensity: 0.4, color: "#ffffff" },
              vignette: 0.2
            }
          }
        : layer
    );

    const svg = renderProjectToSvg(project);

    expect(svg).toContain("gf-gradient-background");
    expect(svg).toContain("gf-noise-background");
    expect(svg).toContain("gf-lighting-background");
    expect(svg).toContain("gf-vignette-background");
    expect(svg).toContain("mix-blend-mode:soft-light");
  });

  it("exports per-layer glow settings instead of a single global glow filter", () => {
    const project = createDefaultProject({ name: "Glow Render", strategy: "common" });
    project.layers = project.layers.map((layer) =>
      layer.id === "headline" && layer.kind === "text"
        ? {
            ...layer,
            effects: {
              ...layer.effects,
              glow: { enabled: true, color: "#f6c36b", radius: 36, intensity: 0.7, spread: 4 }
            }
          }
        : layer
    );

    const svg = renderProjectToSvg(project);

    expect(svg).toContain('id="gf-filter-headline"');
    expect(svg).toContain('stdDeviation="12"');
    expect(svg).toContain('flood-color="#f6c36b"');
    expect(svg).toContain('flood-opacity="0.7"');
    expect(svg).toContain('filter="url(#gf-filter-headline)"');
    expect(svg).not.toContain('id="gf-glow"');
  });

  it("composes blur, shadow, and glow into a single SVG filter for platform preview parity", () => {
    const project = createDefaultProject({ name: "Composed Effects", strategy: "common" });
    project.layers = project.layers.map((layer) =>
      layer.id === "headline" && layer.kind === "text"
        ? {
            ...layer,
            effects: {
              ...layer.effects,
              shadow: true,
              blur: 8,
              glow: { enabled: true, color: "#f6c36b", radius: 30, intensity: 0.6, spread: 2 }
            }
          }
        : layer
    );

    const svg = renderProjectToSvg(project);

    expect(svg).toContain('id="gf-filter-headline"');
    expect(svg).toContain("gf-shadow-headline");
    expect(svg).toContain("gf-glow-color-headline");
    expect(svg).toContain("gf-layer-blur-headline");
    expect(svg).toContain('filter="url(#gf-filter-headline)"');
    expect(svg).not.toContain('style="filter: blur(8px)"');
  });

  it("clips image effects to image layer bounds in platform and export SVG", () => {
    const project = createDefaultProject({ name: "Image Effects", strategy: "common" });
    const imageLayer: ImageLayer = {
      id: "hero-image",
      kind: "image",
      name: "Hero Image",
      x: 180,
      y: 110,
      width: 420,
      height: 260,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      src: "data:image/png;base64,abc",
      fit: "contain",
      borderRadius: 18,
      effects: {
        shadow: false,
        glow: { enabled: true, color: "#f6c36b", radius: 28, intensity: 0.65, spread: 2 },
        blur: 0,
        noise: { amount: 0.12, blendMode: "overlay" },
        lighting: { type: "spotlight", x: 0.42, y: 0.36, intensity: 0.5, color: "#ffffff" },
        vignette: 0.18
      }
    };
    project.layers = [imageLayer];

    const svg = renderProjectToSvg(project);

    expect(svg).toContain('id="gf-image-clip-hero-image"');
    expect(svg).toContain('clip-path="url(#gf-image-clip-hero-image)"');
    expect(svg).toContain('id="gf-noise-hero-image"');
    expect(svg).toContain('id="gf-lighting-hero-image"');
    expect(svg).toContain('id="gf-vignette-hero-image"');
    expect(svg).toContain('id="gf-filter-hero-image"');
    expect(svg).toContain('filter="url(#gf-filter-hero-image)"');
    expect(svg).toContain('mix-blend-mode:overlay');
    expect(svg).toContain('rx="18"');
  });

  it("masks image-only effect overlays to the actual image content for contained transparent assets", () => {
    const project = createDefaultProject({ name: "Masked Image Effects", strategy: "common" });
    const imageLayer: ImageLayer = {
      id: "transparent-logo",
      kind: "image",
      name: "Transparent Logo",
      x: 160,
      y: 120,
      width: 420,
      height: 280,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      src: "data:image/png;base64,transparent",
      fit: "contain",
      borderRadius: 12,
      effects: {
        shadow: false,
        glow: false,
        blur: 0,
        noise: { amount: 0.1, blendMode: "overlay" },
        lighting: { type: "spotlight", x: 0.5, y: 0.38, intensity: 0.45, color: "#ffffff" },
        vignette: 0.16
      }
    };
    project.layers = [imageLayer];

    const svg = renderProjectToSvg(project);

    expect(svg).toContain('id="gf-image-mask-transparent-logo"');
    expect(svg).toContain('mask="url(#gf-image-mask-transparent-logo)"');
    expect(svg).toContain('style="mix-blend-mode:overlay" mask="url(#gf-image-mask-transparent-logo)"');
    expect(svg).not.toContain('style="mix-blend-mode:overlay"/>');
  });

  it("exports edited text styling attributes seen in the Studio canvas", () => {
    const project = createDefaultProject({ name: "Text Style", strategy: "common" });
    project.layers = project.layers.map((layer) =>
      layer.id === "headline" && layer.kind === "text"
        ? {
            ...layer,
            fontStyle: "italic",
            letterSpacing: 2,
            stroke: "#101820",
            strokeWidth: 3
          }
        : layer
    );

    const svg = renderProjectToSvg(project);

    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('letter-spacing="2"');
    expect(svg).toContain('stroke="#101820"');
    expect(svg).toContain('stroke-width="3"');
  });

  it("renders ellipse and line shape tools as distinct SVG primitives", () => {
    const project = createDefaultProject({ name: "Shape Tools", strategy: "common" });
    project.layers = [
      {
        id: "circle-tool",
        kind: "shape",
        name: "Circle",
        x: 100,
        y: 120,
        width: 180,
        height: 180,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        shapeType: "ellipse",
        fill: "#f2eee4",
        radius: 0,
        stroke: "#8f8a7d",
        strokeWidth: 1,
        effects: { shadow: false, glow: false, blur: 0 }
      },
      {
        id: "line-tool",
        kind: "shape",
        name: "Divider",
        x: 320,
        y: 220,
        width: 320,
        height: 4,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        shapeType: "line",
        fill: "#b68a52",
        radius: 0,
        strokeWidth: 0,
        effects: { shadow: false, glow: false, blur: 0 }
      }
    ];

    const svg = renderProjectToSvg(project);

    expect(svg).toContain("<ellipse");
    expect(svg).toContain("<line");
    expect(svg).not.toContain('id="circle-tool"');
  });
});

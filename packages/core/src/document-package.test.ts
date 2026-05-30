import { describe, expect, it } from "vitest";
import {
  createAssetPath,
  createDefaultProject,
  packStudioDocument,
  unpackStudioDocument,
  validateStudioDocument,
  STUDIO_DOCUMENT_EXTENSION
} from "./index";

const encoder = new TextEncoder();

describe("Studio document package", () => {
  it("round-trips a proprietary document package with manifest, project, and assets", async () => {
    const project = createDefaultProject({ name: "Layered Launch", strategy: "hybrid" });
    const assetBytes = encoder.encode("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    project.layers.push({
      id: "generated-bg",
      kind: "image",
      name: "Generated background asset",
      x: 0,
      y: 0,
      width: 1200,
      height: 630,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      src: "assets/generated-bg.svg",
      fit: "cover",
      borderRadius: 0,
      effects: { shadow: false, glow: false, blur: 0 }
    });

    const packageBytes = await packStudioDocument({
      project,
      assets: { "assets/generated-bg.svg": assetBytes }
    });
    const unpacked = await unpackStudioDocument(packageBytes);

    expect(STUDIO_DOCUMENT_EXTENSION).toBe(".ogdoc");
    expect(unpacked.manifest.format).toBe("og-studio-document");
    expect(unpacked.manifest.projectId).toBe(project.projectId);
    expect(unpacked.project.name).toBe("Layered Launch");
    expect(unpacked.assets["assets/generated-bg.svg"]).toEqual(assetBytes);
    expect(unpacked.manifest.assets[0]).toMatchObject({
      path: "assets/generated-bg.svg",
      mediaType: "image/svg+xml"
    });
    expect(unpacked.manifest.assets[0].hash).toMatch(/^sha256:/);
  });

  it("creates stable package asset paths from imported filenames", () => {
    expect(createAssetPath("My Logo FINAL.PNG")).toBe("assets/my-logo-final.png");
    expect(createAssetPath("hero card.svg")).toBe("assets/hero-card.svg");
    expect(createAssetPath("")).toBe("assets/asset.bin");
  });

  it("validates that editable documents keep text as editable layers", () => {
    const project = createDefaultProject({ name: "Baked Text", strategy: "common" });
    project.layers = [
      {
        id: "baked-svg",
        kind: "image",
        name: "Baked SVG",
        x: 0,
        y: 0,
        width: 1200,
        height: 630,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        src: "assets/full-card.svg",
        fit: "contain",
        borderRadius: 0,
        effects: { shadow: false, glow: false, blur: 0 }
      }
    ];

    expect(validateStudioDocument(project, { "assets/full-card.svg": encoder.encode("<svg />") })).toEqual({
      ok: false,
      errors: [
        "Template documents must include at least one editable text or badge layer.",
        "Template documents cannot be a single full-canvas imported image/SVG layer."
      ],
      warnings: []
    });
  });

  it("rejects missing package assets referenced by image layers", () => {
    const project = createDefaultProject({ name: "Missing Asset", strategy: "common" });
    project.layers.push({
      id: "missing-logo",
      kind: "image",
      name: "Missing Logo",
      x: 100,
      y: 100,
      width: 120,
      height: 120,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      src: "assets/logo.png",
      fit: "contain",
      borderRadius: 8,
      effects: { shadow: false, glow: false, blur: 0 }
    });

    expect(validateStudioDocument(project, {})).toMatchObject({
      ok: false,
      errors: ["Missing package asset: assets/logo.png."]
    });
  });

  it("rejects invented internal asset URLs that are not built-in placeholders", () => {
    const project = createDefaultProject({ name: "Invented Asset URL", strategy: "common" });
    project.layers.push({
      id: "fake-emblem",
      kind: "image",
      name: "Fake SVG Emblem",
      x: 780,
      y: 180,
      width: 260,
      height: 260,
      rotation: 0,
      opacity: 0.55,
      locked: false,
      hidden: false,
      src: "ogcreator://svg-emblem",
      fit: "contain",
      borderRadius: 0,
      effects: { shadow: false, glow: false, blur: 0 }
    });

    expect(validateStudioDocument(project, {})).toMatchObject({
      ok: false,
      errors: [
        "Unknown internal asset URL on layer Fake SVG Emblem: ogcreator://svg-emblem. Use a packaged assets/* file, a data URL, or a built-in placeholder."
      ]
    });
  });

  it("allows built-in internal placeholders for manual Studio drafts", () => {
    const project = createDefaultProject({ name: "Built-in Placeholders", strategy: "common" });

    expect(validateStudioDocument(project, {})).toMatchObject({ ok: true, errors: [] });
  });
});

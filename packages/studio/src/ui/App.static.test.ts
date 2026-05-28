import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(join(process.cwd(), "packages", "studio", "src", "ui", "App.tsx"), "utf8");
const stylesSource = readFileSync(join(process.cwd(), "packages", "studio", "src", "styles.css"), "utf8");
const uiDir = join(process.cwd(), "packages", "studio", "src", "ui");
const uiSource = [
  "App.tsx",
  "SessionShell.tsx",
  "ProjectPicker.tsx",
  "SourceRail.tsx",
  "ArtboardEditor.tsx",
  "ToolPalette.tsx",
  "LayerTree.tsx",
  "InspectorPanel.tsx",
  "InspectorTabs.tsx",
  "EffectsPanel.tsx",
  "PlatformPreviewPanel.tsx",
  "ExportPublishPanel.tsx"
]
  .map((file) => readFileSync(join(uiDir, file), "utf8"))
  .join("\n");
const designSystemDir = join(process.cwd(), "packages", "studio", "src", "design-system");
const designSystemSource = ["StudioSlider.tsx", "StudioControls.tsx", "StudioSelect.tsx", "StudioSwitch.tsx", "StudioTooltip.tsx", "StudioField.tsx"]
  .map((file) => readFileSync(join(designSystemDir, file), "utf8"))
  .join("\n");

describe("reengineered studio UI contract", () => {
  it("uses modular session-first Studio surfaces instead of a static demo", () => {
    [
      "SessionShell",
      "ProjectPicker",
      "SourceRail",
      "ArtboardEditor",
      "ToolPalette",
      "LayerTree",
      "InspectorPanel",
      "InspectorTabs",
      "EffectsPanel",
      "PlatformPreviewPanel",
      "PreviewDock",
      "ExportPublishPanel",
      "Import into document",
      "Request agent revision",
      "No active agent session",
      "Open .ogdoc",
      "sessionId = params.get",
      "Ask agent to wire exports",
      "Safe zone",
      "Gradient",
      "Noise",
      "Lighting",
      "Align left",
      "Distribute horizontally",
      "Focal Y",
      "Crop W",
      "Image file",
      "Add badge",
      "Add background",
      "Framework",
      "Line height",
      "Shadow",
      "Blend mode",
      "Stop A",
      "Move layer up",
      "Glow intensity",
      "Glow radius",
      "Glow color"
    ].forEach((token) => expect(uiSource).toContain(token));

    expect(uiSource).toContain("readSessionBundleViaApi");
    expect(appSource).not.toContain("const initialProject");
    expect(appSource).not.toContain("Untitled OG");
    expect(appSource).not.toContain("Demo project loaded");
    expect(appSource).not.toContain("Generation setup");
    expect(appSource).not.toContain("Project Navigator");
    expect(appSource).not.toContain("Production-desk");
    expect(appSource).not.toContain("OPENAI_API_KEY");
  });

  it("defines owned scroll regions and professional creative-tool styling", () => {
    expect(stylesSource).toContain("--stage-bg");
    expect(stylesSource).toContain("--chrome");
    expect(stylesSource).toContain("--accent-focus");
    expect(stylesSource).toContain(".studio-panel-scroll");
    expect(stylesSource).toContain(".canvas-workspace");
    expect(stylesSource).toContain(".preview-dock");
    expect(stylesSource).toContain(".platform-switcher");
    expect(stylesSource).toContain(".platform-preview-body");
    expect(stylesSource).toContain(".studio-slider");
    expect(stylesSource).toContain(".toolbar-source-action");
    expect(stylesSource).toContain(".graphforge-toast");
    expect(stylesSource).toContain(".platform-frame-shell");
    expect(stylesSource).toContain(".platform-preview-image-slot");
    expect(stylesSource).toContain(".stage-mode-tabs");
    expect(stylesSource).toContain(".platform-stage");
    expect(stylesSource).toContain("oklch");
    expect(stylesSource).toContain("scrollbar-color");
    expect(stylesSource).toContain(".source-dropzone");
    expect(stylesSource).toContain(".safe-zone-overlay");
    expect(stylesSource).toContain(".effect-control-grid");
    expect(stylesSource).toContain(".arrange-tools");
    expect(stylesSource).toContain(".perspective-grid");
    expect(stylesSource).not.toContain("radial-gradient");
    expect(stylesSource).not.toContain("linear-gradient(180deg");
    expect(stylesSource).not.toContain("#070a12");
    expect(stylesSource).not.toContain("#a78bfa");
    expect(stylesSource).not.toContain("#8f9cff");
    expect(stylesSource).not.toContain("#236a5b");
    expect(stylesSource).not.toContain("#2f7d6d");
  });

  it("prevents accidental form-style navigation and renders real image layers", () => {
    const buttonsWithoutType = uiSource.match(/<button(?![^>]*\stype=)/g) ?? [];
    expect(buttonsWithoutType).toEqual([]);
    expect(uiSource).toContain("KonvaImage");
    expect(uiSource).toContain("useLayerImage");
  });

  it("uses owned controls instead of raw default form elements for studio editing", () => {
    expect(designSystemSource).toContain("StudioSlider");
    expect(designSystemSource).toContain("StudioSegmentedControl");
    expect(designSystemSource).toContain("StudioSelect");
    expect(designSystemSource).toContain("StudioSwitch");
    expect(designSystemSource).toContain("StudioTooltip");
    expect(designSystemSource).toContain("slider-progress");
    expect(uiSource).toContain("StudioSlider");
    expect(uiSource).toContain("StudioSegmentedControl");
    expect(uiSource).toContain("toolbar-source-action");
    expect(uiSource).toContain("graphforge-toast");
    expect(uiSource).toContain('value: "canvas"');
    expect(uiSource).toContain('value: "preview"');
    expect(uiSource).toContain('title="Add ellipse"');
    expect(uiSource).toContain('addLayer("badge")');
    expect(uiSource).toContain('addLayer("background")');
    expect(uiSource).toContain('addLayer("ellipse")');
    expect(uiSource).toContain('addLayer("line")');
    expect(uiSource).not.toContain('type="range"');
    expect(uiSource).not.toContain("source-peek");
  });

  it("keeps studio slider keyboard and pointer edits wired into React state", () => {
    expect(designSystemSource).toContain("handleSliderChange");
    expect(designSystemSource).toContain("onInput={handleSliderChange}");
    expect(designSystemSource).toContain("onChange={handleSliderChange}");
    expect(designSystemSource).toContain("onKeyUp={handleSliderChange}");
    expect(designSystemSource).toContain("handlePointerDown");
    expect(designSystemSource).toContain("commitValueFromClientX");
    expect(stylesSource).toContain(".slider-shell input {\n  position: absolute;");
    expect(stylesSource).toContain("z-index: 2;");
    expect(stylesSource).toContain("pointer-events: none;");
  });

  it("does not rerun global shell entrance animation for every project edit", () => {
    const sessionShell = readFileSync(join(uiDir, "SessionShell.tsx"), "utf8");
    expect(sessionShell).toContain("hasPlayedEntranceRef");
    expect(sessionShell).not.toContain("}, [project]);");
  });
});

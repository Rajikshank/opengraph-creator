import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(join(process.cwd(), "packages", "studio", "src", "ui", "App.tsx"), "utf8");
const stylesSource = readFileSync(join(process.cwd(), "packages", "studio", "src", "styles.css"), "utf8");
const uiDir = join(process.cwd(), "packages", "studio", "src", "ui");
const uiSource = [
  "App.tsx",
  "SessionShell.tsx",
  "ProjectPicker.tsx",
  "ConnectAgentPanel.tsx",
  "SourceRail.tsx",
  "PageVariantNavigator.tsx",
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
const previewDir = join(process.cwd(), "packages", "studio", "src", "ui", "platform-preview");
const previewFrameSource = [
  "PreviewFrame.tsx",
  "PlatformTabs.tsx",
  "PlatformPreviewImage.tsx",
  "frames/XFrame.tsx",
  "frames/FacebookFrame.tsx",
  "frames/LinkedInFrame.tsx",
  "frames/SlackFrame.tsx",
  "frames/DiscordFrame.tsx",
  "frames/WhatsAppFrame.tsx",
  "frames/IMessageFrame.tsx",
  "frames/BrowserFrame.tsx"
]
  .map((file) => readFileSync(join(previewDir, file), "utf8"))
  .join("\n");
const designSystemDir = join(process.cwd(), "packages", "studio", "src", "design-system");
const designSystemSource = ["StudioSlider.tsx", "StudioControls.tsx", "StudioSelect.tsx", "StudioSwitch.tsx", "StudioTooltip.tsx", "StudioField.tsx"]
  .map((file) => readFileSync(join(designSystemDir, file), "utf8"))
  .join("\n");
const scrollAreaPath = join(designSystemDir, "StudioScrollArea.tsx");
const typographySource = readFileSync(join(process.cwd(), "packages", "studio", "src", "typography", "fonts.ts"), "utf8");

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
      "Publish with agent",
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
      "Framework detection is handled by the coding agent",
      "Line height",
      "Shadow",
      "Blend mode",
      "Stop A",
      "Move layer up",
      "Glow intensity",
      "Glow radius",
      "Glow color",
      "Texture",
      "Depth",
      "Text editor",
      "Segoe UI",
      "Bahnschrift",
      "Text alignment",
      "canvas-text-editor",
      "Edit text layer on canvas",
      "OG Pages",
      "PageVariantNavigator",
      "page-variant-navigator",
      "page-variant-route",
      "page-variant-status",
      "Export all pages",
      "Restart OG generation",
      "Restart from question gate",
      "restartSessionViaApi",
      "restart-confirm-dialog"
    ].forEach((token) => expect(`${uiSource}\n${typographySource}`).toContain(token));

    expect(uiSource).toContain("readSessionBundleViaApi");
    expect(uiSource).toContain("documentRevision");
    expect(uiSource).toContain("Agent update ready");
    expect(uiSource).toContain("Load update");
    expect(uiSource).toContain("Keep current");
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
    expect(stylesSource).toContain(".text-editor-panel");
    expect(stylesSource).toContain(".canvas-text-editor");
    expect(stylesSource).toContain(".effect-control-section");
    expect(stylesSource).toContain(".color-swatch-field");
    expect(stylesSource).toContain(".precise-color-field");
    expect(stylesSource).toContain(".toolbar-source-action");
    expect(stylesSource).toContain(".opengraph-creator-toast");
    expect(stylesSource).toContain(".platform-frame-shell");
    expect(stylesSource).toContain(".platform-preview-image-slot");
    expect(stylesSource).toContain(".platform-tab-list");
    expect(stylesSource).toContain(".platform-preview-viewport");
    expect(stylesSource).toContain(".stage-mode-tabs");
    expect(stylesSource).toContain(".platform-stage");
    expect(stylesSource).toContain("oklch");
    expect(stylesSource).toContain("scrollbar-color");
    expect(stylesSource).toContain(".source-dropzone");
    expect(stylesSource).toContain(".page-variant-navigator");
    expect(stylesSource).toContain(".page-variant-card");
    expect(stylesSource).toContain(".agent-update-banner");
    expect(stylesSource).toContain(".safe-zone-overlay");
    expect(stylesSource).toContain(".effect-control-grid");
    expect(stylesSource).toContain(".arrange-tools");
    expect(stylesSource).toContain(".perspective-grid");
    expect(existsSync(scrollAreaPath)).toBe(true);
    expect(stylesSource).toContain(".studio-scroll-area");
    expect(stylesSource).toContain(".studio-scroll-thumb");
    expect(stylesSource).toContain(".source-rail-body");
    expect(stylesSource).toContain(".agent-connect-card");
    expect(stylesSource).toContain("font-family: var(--font-ui)");
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
    expect(uiSource).toContain("ImagePlaceholderThumbnail");
    expect(uiSource).toContain("Replace with source art");
    expect(uiSource).not.toContain('fill="#292e33"');
  });

  it("uses owned controls instead of raw default form elements for studio editing", () => {
    expect(designSystemSource).toContain("StudioSlider");
    expect(designSystemSource).toContain("StudioSegmentedControl");
    expect(designSystemSource).toContain("StudioSelect");
    expect(designSystemSource).toContain("previewStyle");
    expect(designSystemSource).toContain("StudioSwitch");
    expect(designSystemSource).toContain("StudioTooltip");
    expect(designSystemSource).toContain("slider-progress");
    expect(uiSource).toContain("StudioSlider");
    expect(uiSource).toContain("StudioSegmentedControl");
    expect(uiSource).toContain("StudioScrollArea");
    expect(uiSource).toContain("ConnectAgentPanel");
    expect(uiSource).toContain("repoPath");
    expect(uiSource).toContain("Get connection recipe");
    expect(uiSource).toContain("toolbar-source-action");
    expect(uiSource).toContain("opengraph-creator-toast");
    expect(`${uiSource}\n${previewFrameSource}`).toContain("platform-tab-list");
    expect(uiSource).toContain("platform-preview-viewport");
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

  it("keeps page variants as non-overlapping explicit rows with reachable revision controls", () => {
    const pageNavigator = readFileSync(join(uiDir, "PageVariantNavigator.tsx"), "utf8");
    const sourceRail = readFileSync(join(uiDir, "SourceRail.tsx"), "utf8");

    expect(pageNavigator).toContain("page-variant-title-row");
    expect(pageNavigator).toContain("page-variant-meta-row");
    expect(pageNavigator).toContain("StudioScrollArea");
    expect(pageNavigator).not.toContain("Apply style to all");
    expect(pageNavigator).not.toContain("onApplyStyleToAll");
    expect(sourceRail).toContain("source-rail-body");
    expect(sourceRail).toContain("agent-revision-card");
    expect(sourceRail).not.toContain("applyStyleToAllPages");
    expect(stylesSource).toContain("grid-template-columns: 28px minmax(0, 1fr) auto");
    expect(stylesSource).toContain(".page-variant-list > div");
    expect(stylesSource).not.toContain(".page-variant-status {\n  grid-column: 2;");
  });

  it("keeps publish handoff visible with clear unavailable states and uses the real app logo", () => {
    const sessionShell = readFileSync(join(uiDir, "SessionShell.tsx"), "utf8");
    const exportPanel = readFileSync(join(uiDir, "ExportPublishPanel.tsx"), "utf8");

    expect(sessionShell).toContain("opengraph-creator-logo.png");
    expect(sessionShell).toContain("brand-mark-image");
    expect(exportPanel).toContain("getPublishUnavailableReason");
    expect(exportPanel).toContain("Publish with agent");
    expect(exportPanel).toContain("Agent handoff needs an export first");
    expect(exportPanel).toContain("Exported, ready for agent handoff");
    expect(exportPanel).toContain("No agent session is connected");
    expect(exportPanel).not.toContain("hasConfirmedPublish ? <p className=\"quiet-copy\">");
  });

  it("keeps studio slider keyboard and pointer edits wired into React state", () => {
    expect(designSystemSource).toContain("handleSliderChange");
    expect(designSystemSource).toContain("onInput={handleSliderChange}");
    expect(designSystemSource).toContain("onChange={handleSliderChange}");
    expect(designSystemSource).toContain("onKeyUp={(event) =>");
    expect(designSystemSource).toContain("onValueCommit?.()");
    expect(designSystemSource).toContain("handlePointerDown");
    expect(designSystemSource).toContain("commitValueFromClientX");
    expect(stylesSource).toMatch(/\.slider-shell input\s*\{\s*position:\s*absolute;/);
    expect(stylesSource).toContain("z-index: 2;");
    expect(stylesSource).toContain("pointer-events: none;");
  });

  it("keeps canvas effects, history controls, and tool ownership guarded", () => {
    const artboardSource = readFileSync(join(uiDir, "ArtboardEditor.tsx"), "utf8");
    const layerTreeSource = readFileSync(join(uiDir, "LayerTree.tsx"), "utf8");
    const sessionShell = readFileSync(join(uiDir, "SessionShell.tsx"), "utf8");

    expect(artboardSource).toContain("EffectfulNode");
    expect(artboardSource).toContain("getCanvasEffectCachePadding");
    expect(artboardSource).toContain("getCanvasShadowVisual");
    expect(artboardSource).toContain("hasComposedLayerEffect");
    expect(artboardSource).toContain("CanvasTextEditor");
    expect(artboardSource).toContain("onDblClick");
    expect(artboardSource).toContain("Edit text layer on canvas");
    expect(artboardSource).toContain("Konva.Filters.Blur");
    expect(artboardSource).toContain("node.cache");
    expect(artboardSource).toContain("pixelRatio: window.devicePixelRatio");
    expect(artboardSource).toContain("width: bounds.width + padding * 2");
    expect(artboardSource).not.toContain("effects.blur * 1.5");
    expect(layerTreeSource).not.toContain("Add text layer");
    expect(layerTreeSource).not.toContain("Add image layer");
    expect(layerTreeSource).not.toContain("Add shape layer");
    expect(sessionShell).toContain("Undo2");
    expect(sessionShell).toContain("Redo2");
    expect(sessionShell).toContain("canUndo");
    expect(sessionShell).toContain("event.key.toLowerCase()");
    expect(sessionShell).toContain("key === \"z\"");
  });

  it("normalizes Studio error messages before showing toasts", () => {
    const sessionShell = readFileSync(join(uiDir, "SessionShell.tsx"), "utf8");
    const exportPanel = readFileSync(join(uiDir, "ExportPublishPanel.tsx"), "utf8");

    expect(uiSource).toContain("notifyStudioError");
    expect(uiSource).toContain("normalizeStudioError");
    expect(sessionShell).not.toContain("toast.error(error instanceof Error ? error.message");
    expect(exportPanel).not.toContain("toast.error(error instanceof Error ? error.message");
  });

  it("does not rerun global shell entrance animation for every project edit", () => {
    const sessionShell = readFileSync(join(uiDir, "SessionShell.tsx"), "utf8");
    expect(sessionShell).toContain("hasPlayedEntranceRef");
    expect(sessionShell).not.toContain("}, [project]);");
  });

  it("uses dedicated platform preview frames with a stable inspector viewport", () => {
    expect(uiSource).toContain("PreviewFrame");
    expect(uiSource).toContain("PlatformTabs");
    expect(uiSource).toContain("getPlatformPreviewSpecs");
    [
      "function XFrame",
      "function FacebookFrame",
      "function LinkedInFrame",
      "function SlackFrame",
      "function DiscordFrame",
      "function WhatsAppFrame",
      "function IMessageFrame",
      "function BrowserFrame"
    ].forEach((token) => expect(previewFrameSource).toContain(token));
    expect(previewFrameSource).toContain("platform-preview-inspector");
    expect(previewFrameSource).toContain("platform-preview-device");
    expect(previewFrameSource).toContain("PlatformPreviewImage");
    expect(previewFrameSource).not.toContain("GenericPlatformPreview");
  });

  it("themes Konva transform handles to the Studio accent instead of default blue", () => {
    const artboardSource = readFileSync(join(uiDir, "ArtboardEditor.tsx"), "utf8");

    expect(artboardSource).toContain("STUDIO_TRANSFORM_ACCENT");
    expect(artboardSource).toContain("anchorFill");
    expect(artboardSource).toContain("anchorStroke");
    expect(artboardSource).toContain("borderStroke");
    expect(artboardSource).toContain("rotateAnchorOffset");
    expect(artboardSource).not.toContain("#0000ff");
  });

  it("lets Konva measure text height and scales text by font size during vertical transforms", () => {
    const artboardSource = readFileSync(join(uiDir, "ArtboardEditor.tsx"), "utf8");
    const inspectorSource = readFileSync(join(uiDir, "InspectorPanel.tsx"), "utf8");

    expect(artboardSource).toContain("getTextDisplayMetrics(layer)");
    expect(artboardSource).toContain("estimateTextLineWidth");
    expect(artboardSource).toContain("measureCanvasText");
    expect(artboardSource).toContain("preloadFontFamily");
    expect(artboardSource).toContain("fontReadyVersion");
    expect(artboardSource).toContain("letterSpacing: `${(layer.letterSpacing ?? 0) * scale}px`");
    expect(inspectorSource).toContain("getStudioFontOptions");
    expect(inspectorSource).toContain("ColorTextField");
    expect(inspectorSource).not.toContain("normalizeFontValue");
    expect(artboardSource).toContain('wrap="none"');
    expect(artboardSource).toContain("fontSize: Math.max(6, Math.round(layer.fontSize * scaleY))");
    expect(artboardSource).toContain("fontFamily:");
    expect(artboardSource).toContain("fontWeight:");
    expect(artboardSource).toContain("width={metrics.width}");
    expect(artboardSource).toContain("text={metrics.lines.join");
    expect(artboardSource).not.toContain("height={layer.height}\n          text={layer.text}");
    expect(artboardSource).not.toContain("width={layer.width}\n          text={layer.text}");
  });
});

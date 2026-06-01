import { describe, expect, it } from "vitest";
import { createDefaultProject, createMultiPageProject } from "@opengraph-creator/core";
import {
  addLayer,
  createEditorSession,
  deleteLayer,
  duplicateLayer,
  moveLayerTo,
  nudgeSelectedLayer,
  redo,
  resizeSelectedLayer,
  selectLayer,
  toggleLayerHidden,
  toggleLayerLocked,
  undo,
  attachSourceArtifact,
  alignLayers,
  setLayerEffects,
  setImageCrop,
  setImageFocalPoint,
  setImagePerspective,
  snapLayer,
  distributeLayers,
  updateProjectSettings,
  selectPageVariant,
  updateSelectedLayer,
  commitTransientHistory,
  updateLayerTransient
} from "./editor-model";

describe("editor model", () => {
  it("selects, nudges, resizes, and supports undo/redo", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const session = selectLayer(createEditorSession(project), "headline");
    const nudged = nudgeSelectedLayer(session, { dx: 24, dy: -12 });
    const resized = resizeSelectedLayer(nudged, { width: 640, height: 160 });
    const selected = resized.project.layers.find((layer) => layer.id === "headline");

    expect(selected).toMatchObject({ x: 106, y: 192, width: 640, height: 160 });
    expect(resized.past).toHaveLength(2);

    const undone = undo(resized);
    expect(undone.project.layers.find((layer) => layer.id === "headline")).toMatchObject({ x: 106, y: 192 });

    const redone = redo(undone);
    expect(redone.project.layers.find((layer) => layer.id === "headline")).toMatchObject({ width: 640, height: 160 });
  });

  it("keeps undo history bounded and clears redo after a new edit", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    let session = selectLayer(createEditorSession(project), "headline");

    for (let index = 0; index < 80; index += 1) {
      session = nudgeSelectedLayer(session, { dx: 1, dy: 0 });
    }

    expect(session.past).toHaveLength(60);

    const undone = undo(session);
    expect(undone.future).toHaveLength(1);

    const editedAfterUndo = nudgeSelectedLayer(undone, { dx: 8, dy: 0 });
    expect(editedAfterUndo.future).toHaveLength(0);
    expect(editedAfterUndo.past).toHaveLength(60);
  });

  it("updates the selected text layer without losing history", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const session = selectLayer(createEditorSession(project), "headline");
    const updated = updateSelectedLayer(session, { name: "Hero headline" });

    expect(updated.project.layers.find((layer) => layer.id === "headline")?.name).toBe("Hero headline");
    expect(undo(updated).project.layers.find((layer) => layer.id === "headline")?.name).toBe("Headline");
  });

  it("coalesces continuous layer edits into one undo step and ignores no-op patches", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const session = selectLayer(createEditorSession(project), "headline");
    const noOp = updateSelectedLayer(session, { x: 82 });
    expect(noOp).toBe(session);

    const first = updateLayerTransient(session, "headline", { x: 100 }, "slider:x");
    const second = updateLayerTransient(first, "headline", { x: 120 }, "slider:x");
    const committed = commitTransientHistory(second);

    expect(committed.project.layers.find((layer) => layer.id === "headline")).toMatchObject({ x: 120 });
    expect(committed.past).toHaveLength(1);
    expect(undo(committed).project.layers.find((layer) => layer.id === "headline")).toMatchObject({ x: 82 });
  });

  it("updates generation strategy and mode as undoable project setup", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const session = createEditorSession(project);
    const updated = updateProjectSettings(session, { strategy: "pages", generationMode: "pure-image" });

    expect(updated.project.strategy).toBe("pages");
    expect(updated.project.generationMode).toBe("pure-image");
    const badge = updated.project.layers.find((layer) => layer.id === "badge");
    expect(badge?.kind === "badge" ? badge.text : undefined).toBe("Page-specific OG");
    expect(undo(updated).project.strategy).toBe("common");
  });

  it("normalizes editable target pages as undoable project setup", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "pages", pages: ["/"] });
    const session = createEditorSession(project);
    const updated = updateProjectSettings(session, { targetPages: ["pricing", "/blog/get-started", "", "/pricing"] });

    expect(updated.project.targetPages).toEqual(["/pricing", "/blog/get-started"]);
    expect(undo(updated).project.targetPages).toEqual(["/"]);
  });

  it("switches page variants and edits only the active page in a multi-page document", () => {
    const project = createMultiPageProject(
      createDefaultProject({ name: "Pages", strategy: "pages", pages: ["/", "/pricing"] }),
      [
        { route: "/", detectedTitle: "Home", confidence: "high" },
        { route: "/pricing", detectedTitle: "Pricing", confidence: "high" }
      ]
    );
    const session = selectPageVariant(createEditorSession(project), "page-pricing");
    const updated = updateSelectedLayer(selectLayer(session, "headline"), { text: "Pricing made simple" });

    expect(session.project.activePageId).toBe("page-pricing");
    expect(session.project.layers.find((layer) => layer.id === "headline")).toMatchObject({ text: "Pricing" });
    expect(updated.project.pages?.find((page) => page.id === "page-pricing")).toMatchObject({
      status: "edited",
      layers: expect.arrayContaining([expect.objectContaining({ id: "headline", text: "Pricing made simple" })])
    });
    expect(updated.project.pages?.find((page) => page.id === "page-home")?.layers.find((layer) => layer.id === "headline")).toMatchObject({
      text: "Home"
    });
    expect(undo(updated).project.layers.find((layer) => layer.id === "headline")).toMatchObject({ text: "Pricing" });
  });

  it("moves a layer to an absolute canvas position and clamps it inside the canvas", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const session = selectLayer(createEditorSession(project), "headline");
    const moved = moveLayerTo(session, "headline", { x: 9999, y: -20 });
    const headline = moved.project.layers.find((layer) => layer.id === "headline");

    expect(headline).toMatchObject({ x: 480, y: 0 });
    expect(moved.selectedLayerId).toBe("headline");
    expect(undo(moved).project.layers.find((layer) => layer.id === "headline")).toMatchObject({ x: 82, y: 204 });
  });

  it("does not move locked layers from canvas interactions", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const session = createEditorSession(project);
    const moved = moveLayerTo(session, "background", { x: 100, y: 100 });

    expect(moved).toBe(session);
    expect(moved.project.layers.find((layer) => layer.id === "background")).toMatchObject({ x: 0, y: 0 });
  });

  it("duplicates, toggles, and deletes editable layers with history", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const duplicated = duplicateLayer(selectLayer(createEditorSession(project), "headline"), "headline");
    const copy = duplicated.project.layers.find((layer) => layer.id === duplicated.selectedLayerId);

    expect(copy).toMatchObject({ name: "Headline copy", x: 106, y: 228, locked: false, hidden: false });

    const hidden = toggleLayerHidden(duplicated, copy?.id ?? "");
    expect(hidden.project.layers.find((layer) => layer.id === copy?.id)?.hidden).toBe(true);

    const locked = toggleLayerLocked(hidden, copy?.id ?? "");
    expect(locked.project.layers.find((layer) => layer.id === copy?.id)?.locked).toBe(true);

    const unlocked = toggleLayerLocked(locked, copy?.id ?? "");
    const deleted = deleteLayer(unlocked, copy?.id ?? "");
    expect(deleted.project.layers.some((layer) => layer.id === copy?.id)).toBe(false);
    expect(deleted.selectedLayerId).toBe("headline");
    expect(undo(deleted).project.layers.some((layer) => layer.id === copy?.id)).toBe(true);
  });

  it("adds new editable text, image, badge, background, and distinct shape tools with unique ids and selection history", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const session = createEditorSession(project);
    const withText = addLayer(session, "text");
    const withImage = addLayer(withText, "image");
    const withBadge = addLayer(withImage, "badge");
    const withBackground = addLayer(withBadge, "background");
    const withRectangle = addLayer(withBackground, "rectangle");
    const withEllipse = addLayer(withRectangle, "ellipse");
    const withLine = addLayer(withEllipse, "line");

    expect(withText.project.layers.at(-1)).toMatchObject({
      id: "text-layer",
      kind: "text",
      name: "Text Layer",
      text: "New text"
    });
    expect(withText.selectedLayerId).toBe("text-layer");
    expect(withImage.project.layers.at(-1)).toMatchObject({
      id: "image-layer",
      kind: "image",
      name: "Image Layer",
      src: "ogcreator://image-placeholder",
      fit: "contain"
    });
    expect(withBadge.project.layers.at(-1)).toMatchObject({
      id: "badge-layer",
      kind: "badge",
      name: "Badge Layer",
      text: "New badge"
    });
    expect(withBackground.project.layers[0]).toMatchObject({
      id: "background-layer",
      kind: "background",
      name: "Background Layer",
      width: 1200,
      height: 630
    });
    expect(withBackground.selectedLayerId).toBe("background-layer");
    expect(withRectangle.project.layers.at(-1)).toMatchObject({
      id: "rectangle-layer",
      kind: "shape",
      name: "Rectangle Layer",
      shapeType: "rectangle"
    });
    expect(withEllipse.project.layers.at(-1)).toMatchObject({
      id: "ellipse-layer",
      kind: "shape",
      name: "Circle Layer",
      shapeType: "ellipse",
      width: 180,
      height: 180
    });
    expect(withLine.project.layers.at(-1)).toMatchObject({
      id: "line-layer",
      kind: "shape",
      name: "Divider Layer",
      shapeType: "line",
      height: 4
    });
    expect(withLine.selectedLayerId).toBe("line-layer");
    expect(withLine.project.layers.map((layer) => layer.id)).toEqual(expect.arrayContaining(["text-layer", "image-layer", "badge-layer", "background-layer", "rectangle-layer", "ellipse-layer", "line-layer"]));
    expect(undo(withLine).project.layers.some((layer) => layer.id === "line-layer")).toBe(false);
  });

  it("attaches generated source artifacts and updates rich effects with history", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const session = createEditorSession(project);
    const withSource = attachSourceArtifact(session, {
      kind: "svg",
      origin: "codex",
      path: ".opengraph-creator/generated/og.svg",
      createdAt: "2026-05-26T00:00:00.000Z"
    });
    const withEffects = setLayerEffects(withSource, "background", {
      gradient: {
        type: "radial",
        stops: [
          { color: "#ffffff", position: 0, opacity: 1 },
          { color: "#dfe9e5", position: 1, opacity: 0.8 }
        ]
      },
      noise: { amount: 0.06, blendMode: "overlay" },
      lighting: { type: "spotlight", x: 0.5, y: 0.4, intensity: 0.35, color: "#ffffff" },
      vignette: 0.18
    });
    const visual = withEffects.project.layers.find((layer) => layer.id === "background");

    expect(withSource.project.sourceArtifacts).toHaveLength(1);
    expect(visual && "effects" in visual ? visual.effects.gradient?.type : undefined).toBe("radial");
    expect(visual && "effects" in visual ? visual.effects.noise?.blendMode : undefined).toBe("overlay");
    expect(undo(withEffects).project.sourceArtifacts).toHaveLength(1);
  });

  it("aligns selected editable layers against the shared selection bounds", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const session = createEditorSession({
      ...project,
      layers: project.layers.map((layer) =>
        layer.id === "headline"
          ? { ...layer, x: 160, y: 190, width: 420, height: 100 }
          : layer.id === "subtitle"
            ? { ...layer, x: 300, y: 330, width: 500, height: 70 }
            : layer
      )
    });

    const left = alignLayers(session, ["headline", "subtitle"], "left");
    expect(left.project.layers.find((layer) => layer.id === "headline")).toMatchObject({ x: 160 });
    expect(left.project.layers.find((layer) => layer.id === "subtitle")).toMatchObject({ x: 160 });

    const middle = alignLayers(left, ["headline", "subtitle"], "middle");
    expect(middle.project.layers.find((layer) => layer.id === "headline")).toMatchObject({ y: 245 });
    expect(middle.project.layers.find((layer) => layer.id === "subtitle")).toMatchObject({ y: 260 });
    expect(undo(middle).project.layers.find((layer) => layer.id === "headline")).toMatchObject({ y: 190 });
  });

  it("distributes selected editable layers evenly without moving the outer layers", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const session = createEditorSession({
      ...project,
      layers: project.layers.map((layer) =>
        layer.id === "badge"
          ? { ...layer, x: 100, y: 90, width: 100 }
          : layer.id === "headline"
            ? { ...layer, x: 260, y: 90, width: 100 }
            : layer.id === "subtitle"
              ? { ...layer, x: 620, y: 90, width: 100 }
              : layer
      )
    });

    const distributed = distributeLayers(session, ["badge", "headline", "subtitle"], "horizontal");

    expect(distributed.project.layers.find((layer) => layer.id === "badge")).toMatchObject({ x: 100 });
    expect(distributed.project.layers.find((layer) => layer.id === "headline")).toMatchObject({ x: 360 });
    expect(distributed.project.layers.find((layer) => layer.id === "subtitle")).toMatchObject({ x: 620 });
  });

  it("snaps a selected layer to safe zone, canvas center, or canvas edges", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const session = selectLayer(createEditorSession(project), "headline");

    expect(snapLayer(session, "headline", "safe-zone").project.layers.find((layer) => layer.id === "headline")).toMatchObject({
      x: project.canvas.safeInset,
      y: project.canvas.safeInset
    });
    expect(snapLayer(session, "headline", "canvas-center").project.layers.find((layer) => layer.id === "headline")).toMatchObject({
      x: 240,
      y: 220
    });
    expect(snapLayer(session, "headline", "canvas-bottom-right").project.layers.find((layer) => layer.id === "headline")).toMatchObject({
      x: 480,
      y: 440
    });
  });

  it("updates image crop, focal point, and perspective as clamped undoable image edits", () => {
    const project = createDefaultProject({ name: "Editor", strategy: "common" });
    const withImage = addLayer(createEditorSession(project), "image");
    const imageId = withImage.selectedLayerId;

    const cropped = setImageCrop(withImage, imageId, { x: 0.8, y: 0.75, width: 0.5, height: 0.4 });
    const focused = setImageFocalPoint(cropped, imageId, { x: 2, y: -1 });
    const warped = setImagePerspective(focused, imageId, [
      { x: -0.2, y: 0.1 },
      { x: 1.2, y: 0 },
      { x: 1, y: 1.4 },
      { x: 0.1, y: -0.3 }
    ]);
    const layer = warped.project.layers.find((item) => item.id === imageId);

    expect(layer && "crop" in layer ? layer.crop : undefined).toEqual({ x: 0.5, y: 0.6, width: 0.5, height: 0.4 });
    expect(layer && "focalPoint" in layer ? layer.focalPoint : undefined).toEqual({ x: 1, y: 0 });
    expect(layer && "perspective" in layer ? layer.perspective : undefined).toEqual([
      { x: 0, y: 0.1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0.1, y: 0 }
    ]);
    expect(undo(warped).project.layers.find((item) => item.id === imageId)).toMatchObject({ focalPoint: { x: 1, y: 0 } });
  });
});

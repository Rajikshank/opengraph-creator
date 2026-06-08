import { describe, expect, it } from "vitest";
import { createDefaultProject, createMultiPageProject } from "@opengraph-creator/core";
import { createRenderPlan } from "./render-plan";

describe("render plan", () => {
  it("creates a stable 1200x630 ordered render plan from an editable project", () => {
    const project = createDefaultProject({ name: "Render Plan", strategy: "common" });

    const plan = createRenderPlan(project);

    expect(plan).toMatchObject({
      version: 1,
      canvas: { width: 1200, height: 630 },
      sourceProjectId: project.projectId,
      targetSurface: "social-og"
    });
    expect(plan.nodes.map((node) => node.layerId)).toEqual(project.layers.map((layer) => layer.id));
    expect(plan.nodes.every((node, index) => node.drawIndex === index)).toBe(true);
  });

  it("uses the active page variant as the render source", () => {
    const project = createMultiPageProject(createDefaultProject({ name: "Pages", strategy: "pages", pages: ["/", "/pricing"] }));
    const pricingPage = project.pages?.find((page) => page.route === "/pricing");
    if (!pricingPage) throw new Error("missing pricing page");

    const plan = createRenderPlan({ ...project, activePageId: pricingPage.id });

    expect(plan.activePageId).toBe(pricingPage.id);
    expect(plan.nodes.map((node) => node.layerId)).toEqual(pricingPage.layers.map((layer) => layer.id));
  });

  it("records effect scopes for preview and export parity checks", () => {
    const project = createDefaultProject({ name: "Effects", strategy: "common" });
    const plan = createRenderPlan({
      ...project,
      layers: project.layers.map((layer) =>
        layer.id === "background" && "effects" in layer
          ? {
              ...layer,
              effects: {
                ...layer.effects,
                lighting: { type: "spotlight", x: 0.5, y: 0.4, intensity: 0.3, color: "#d9a441", scope: "canvas" },
                noise: { amount: 0.01, blendMode: "soft-light" }
              }
            }
          : layer
      )
    });

    expect(plan.nodes.find((node) => node.layerId === "background")?.effectScopes).toEqual(["noise:layer", "lighting:canvas"]);
  });
});

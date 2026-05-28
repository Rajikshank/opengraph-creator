import { spawn } from "node:child_process";
import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifactsDir = join(root, ".tmp-smoke", "studio-visual");
const desktopScreenshotPath = join(artifactsDir, "studio-desktop.png");
const compactScreenshotPath = join(artifactsDir, "studio-compact.png");
const previewScreenshotPath = join(artifactsDir, "studio-platform-preview.png");
const transparentPngPath = join(artifactsDir, "transparent-pixel.png");
const wideSvgPath = join(artifactsDir, "wide-image.svg");

await mkdir(artifactsDir, { recursive: true });
await writeFile(transparentPngPath, createTransparentPng());
await writeFile(wideSvgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#f8f0d8"/><circle cx="300" cy="100" r="54" fill="#b87927"/><rect x="36" y="54" width="180" height="90" rx="14" fill="#171918"/></svg>');
const homeDir = await mkdtemp(join(tmpdir(), "graphforge-studio-home-"));

const port = await getFreePort();
const server = spawn(process.execPath, ["packages/cli/dist/index.js", "studio", "--port", String(port), "--home", homeDir], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForServer(`http://127.0.0.1:${port}/`);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const url = `http://127.0.0.1:${port}/`;
  await verifyStudioViewport(page, url, { width: 1440, height: 960 }, desktopScreenshotPath, { dragLayer: true, previewScreenshotPath });
  await verifyStudioViewport(page, url, { width: 390, height: 920 }, compactScreenshotPath, { dragLayer: false });
  await browser.close();

  const desktopScreenshot = await assertScreenshot(desktopScreenshotPath);
  const compactScreenshot = await assertScreenshot(compactScreenshotPath);
  const previewScreenshot = await assertScreenshot(previewScreenshotPath);

  console.log(
    JSON.stringify(
      {
        ok: true,
        url,
        screenshots: {
          desktop: { path: desktopScreenshotPath, bytes: desktopScreenshot.size },
          compact: { path: compactScreenshotPath, bytes: compactScreenshot.size },
          platformPreview: { path: previewScreenshotPath, bytes: previewScreenshot.size }
        }
      },
      null,
      2
    )
  );
} finally {
  server.kill();
}

async function verifyStudioViewport(page, url, viewport, screenshotPath, options) {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByText("Ogloom").first().waitFor({ timeout: 10_000 });
  await page.getByText("No active agent session").waitFor({ timeout: 5_000 });
  await page.getByRole("button", { name: /Open .ogdoc/i }).waitFor({ timeout: 5_000 });
  await page.getByRole("button", { name: /Start manual draft/i }).click();
  await page.getByRole("radio", { name: /Platform Preview/i }).waitFor({ timeout: 5_000 });
  await page.getByRole("radio", { name: /Platform Preview/i }).click();
  await expectCount(page, ".platform-switcher button", 8, "platform switcher buttons");
  await expectCount(page, ".preview-dock", 1, "platform preview dock");
  await expectCount(page, ".platform-stage", 1, "platform preview stage");
  await expectCount(page, ".platform-frame", 1, "platform preview frame");
  await assertPlatformPreviewContained(page);
  await assertPlatformFramesStable(page);
  await assertPlatformImageSlotsStable(page);
  await clickEveryPlatformTab(page);
  await page.getByRole("tab", { name: /Discord/i }).click();
  await page.locator(".preview-dock-header").getByText("Discord", { exact: true }).waitFor({ timeout: 5_000 });
  if (options.previewScreenshotPath) {
    await page.screenshot({ path: options.previewScreenshotPath, fullPage: true });
  }
  await page.getByRole("radio", { name: /^Canvas$/i }).click();
  await expectCount(page, "canvas", 1, "Konva editing canvas");
  await assertCanvasFitsFrame(page);
  await assertServedDesignSystem(page);
  await assertNoHorizontalOverflow(page);

  if (options.dragLayer) {
    await exerciseLiveEffectsOnBackground(page);
    await assertUrlStable(page, async () => {
      await page.getByTitle("Hide source rail").click();
      await assertSourceToggleInToolbar(page);
      await page.getByTitle("Open source rail").click();
    }, "source rail hide/open");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await page.getByText(/Saved /).waitFor({ timeout: 5_000 });
    await assertGraphForgeToast(page);
    await assertManualStudioHasNoSessionAgentRequest(page);

    await page.getByRole("tab", { name: /Layers/i }).click();
    await page.getByTitle("Add text layer").click();
    await page.getByTitle("Add image layer").click();
    await page.getByTitle("Add shape layer").click();
    await page.getByTitle("Add image layer").click();
    await page.getByRole("tab", { name: /Edit/i }).click();
    await page.getByText("Fit").waitFor({ timeout: 5_000 });
    await assertImageNoiseClippedToContainedImage(page);
    await assertTransparentPngDoesNotGetGrayBacking(page);
    await assertUrlStable(page, async () => {
      await page.getByTitle("Add rectangle").click();
      await page.getByTitle("Add ellipse").click();
      await page.getByTitle("Add divider").click();
      await page.getByTitle("Add rectangle").click();
    }, "canvas tool palette");
    await page.waitForFunction(() =>
      [...document.querySelectorAll("input")].some((input) => input instanceof HTMLInputElement && input.value === "Rectangle Layer")
    );
    await page.getByRole("tab", { name: /Layers/i }).click();
    await assertCircleLayerWasCreated(page);
    await exerciseLayerActionButtons(page);
    await exerciseArrangeButtons(page);
    await page.getByRole("tab", { name: /Edit/i }).click();
    await exerciseSnapButtons(page);
    await page.getByText("Width", { exact: true }).waitFor({ timeout: 5_000 });
    await page.getByText("Height", { exact: true }).waitFor({ timeout: 5_000 });
    await page.getByText("Fill", { exact: true }).waitFor({ timeout: 5_000 });
    await page.getByText("Stroke width", { exact: true }).waitFor({ timeout: 5_000 });
    await page.getByRole("tab", { name: /Effects/i }).click();
    await page.locator(".inspector-tab-body").getByText("Effects", { exact: true }).scrollIntoViewIfNeeded();
    await page.getByLabel("Gradient").waitFor({ timeout: 5_000 });
    await page.getByRole("slider", { name: "Noise" }).waitFor({ timeout: 5_000 });
    await page.getByRole("slider", { name: "Lighting" }).waitFor({ timeout: 5_000 });
    await page.getByRole("slider", { name: "Glow intensity" }).waitFor({ timeout: 5_000 });
    await page.getByRole("slider", { name: "Glow radius" }).waitFor({ timeout: 5_000 });
    await page.getByLabel("Glow color").waitFor({ timeout: 5_000 });
    await page.getByRole("switch", { name: "Glow" }).click();
    await setRangeValue(page, "Glow intensity", "0.75");
    await setRangeValue(page, "Glow radius", "36");
    await page.getByRole("tab", { name: /Export/i }).click();
    await page.getByRole("button", { name: /Export OG image/i }).click();
    await page.getByText(/Exported /).waitFor({ timeout: 10_000 });
    await page.getByRole("button", { name: /Ask agent to wire exports/i }).click();
    await page.getByText(/Ask agent to wire exports:/).waitFor({ timeout: 10_000 });
  }

  await page.waitForTimeout(3_500);
  await page.evaluate(() => {
    document.querySelectorAll("[data-sonner-toast]").forEach((toast) => toast.remove());
  });
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

async function assertServedDesignSystem(page) {
  const css = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="stylesheet"]')?.getAttribute("href");
    if (!href) throw new Error("Studio stylesheet link was not found.");
    const response = await fetch(new URL(href, window.location.href).toString());
    return response.text();
  });

  if (!css.includes("--stage-bg")) {
    throw new Error("Served CSS is missing the redesigned studio design tokens.");
  }

  const bannedLegacyTokens = ["#070a12", "#0f172a", "#2dd4bf", "#a78bfa", "#8f9cff", "radial-gradient"];
  const legacyToken = bannedLegacyTokens.find((token) => css.includes(token));
  if (legacyToken) {
    throw new Error(`Served CSS still includes legacy visual token: ${legacyToken}`);
  }
}

async function clickEveryPlatformTab(page) {
  const platformButtons = page.locator(".platform-switcher button");
  const count = await platformButtons.count();
  if (count !== 8) {
    throw new Error(`Expected 8 platform tabs, found ${count}.`);
  }
  const seen = [];
  for (let index = 0; index < count; index += 1) {
    const button = platformButtons.nth(index);
    const label = (await button.innerText()).replace(/\s+/g, " ").trim();
    await assertUrlStable(page, () => button.click(), `platform tab ${label}`);
    const active = await page.locator(".preview-dock-header").innerText();
    seen.push({ label, active });
  }
  if (!seen.some((item) => item.active.includes("Discord")) || !seen.some((item) => item.active.includes("Browser / Search"))) {
    throw new Error(`Platform tabs did not reach expected platform states: ${JSON.stringify(seen)}`);
  }
}

async function exerciseLiveEffectsOnBackground(page) {
  await page.getByRole("tab", { name: /Layers/i }).click();
  await page.locator(".layer-item", { hasText: "Background" }).first().getByRole("button").first().click();
  await page.locator(".layer-item.active", { hasText: "Background" }).waitFor({ timeout: 5_000 });
  await page.getByRole("tab", { name: /Effects/i }).click();
  await page.getByRole("slider", { name: "Noise" }).waitFor({ timeout: 5_000 });
  const noiseBefore = await readCanvasNoiseMetrics(page);
  await selectStudioOption(page, "Blend mode", "Normal");
  await setRangeValue(page, "Noise", "0.2");
  await page.waitForTimeout(160);
  const noiseAfter = await readCanvasNoiseMetrics(page);
  if (noiseAfter.localDiff <= noiseBefore.localDiff + 4) {
    const effectDebug = await readEffectDebugState(page);
    throw new Error(`Noise effect did not create visible grain on the editing canvas: before ${JSON.stringify(noiseBefore)}, after ${JSON.stringify(noiseAfter)}, debug ${JSON.stringify(effectDebug)}.`);
  }
}

async function assertPlatformFramesStable(page) {
  const platformButtons = page.locator(".platform-switcher button");
  const count = await platformButtons.count();
  const frames = [];
  for (let index = 0; index < count; index += 1) {
    await platformButtons.nth(index).click();
    frames.push(
      await page.evaluate(() => {
        const frame = document.querySelector(".platform-frame");
        if (!frame) throw new Error("Platform frame missing.");
        const rect = frame.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      })
    );
  }
  const widths = frames.map((frame) => frame.width);
  const heights = frames.map((frame) => frame.height);
  if (Math.max(...widths) - Math.min(...widths) > 2 || Math.max(...heights) - Math.min(...heights) > 24) {
    throw new Error(`Platform frame sizes are inconsistent: ${JSON.stringify(frames)}`);
  }
}

async function assertPlatformImageSlotsStable(page) {
  const platformButtons = page.locator(".platform-switcher button");
  const count = await platformButtons.count();
  const slots = [];
  for (let index = 0; index < count; index += 1) {
    await platformButtons.nth(index).click();
    slots.push(
      await page.evaluate(() => {
        const slot = document.querySelector(".platform-preview-image-slot");
        const image = document.querySelector(".preview-image-large");
        if (!slot || !image) throw new Error("Platform image slot missing.");
        const slotRect = slot.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();
        return {
          slotWidth: Math.round(slotRect.width),
          slotHeight: Math.round(slotRect.height),
          imageWidth: Math.round(imageRect.width),
          imageHeight: Math.round(imageRect.height)
        };
      })
    );
  }
  const widths = slots.map((slot) => slot.imageWidth);
  const heights = slots.map((slot) => slot.imageHeight);
  if (Math.max(...widths) - Math.min(...widths) > 3 || Math.max(...heights) - Math.min(...heights) > 3) {
    throw new Error(`Platform preview image slots shift between platforms: ${JSON.stringify(slots)}`);
  }
}

async function assertTransparentPngDoesNotGetGrayBacking(page) {
  await page.locator(".file-upload-control input").setInputFiles(transparentPngPath);
  await page.waitForTimeout(250);
  const sample = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Konva canvas was not found.");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context was not available.");
    const scale = canvas.width / 1200;
    const pixel = context.getImageData(Math.round(260 * scale), Math.round(210 * scale), 1, 1).data;
    return { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] };
  });
  if (sample.r < 210 || sample.g < 210 || sample.b < 205) {
    throw new Error(`Transparent PNG is rendering over a gray backing instead of the canvas: ${JSON.stringify(sample)}`);
  }
}

async function assertImageNoiseClippedToContainedImage(page) {
  await page.locator(".file-upload-control input").setInputFiles(wideSvgPath);
  await selectStudioOption(page, "Fit", "Contain");
  await page.getByRole("tab", { name: /Effects/i }).click();
  await selectStudioOption(page, "Blend mode", "Normal");
  await setRangeValue(page, "Noise", "0.2");
  await page.waitForTimeout(200);
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Konva canvas was not found.");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context was not available.");
    const scale = canvas.width / 1200;
    const sampleStrip = (x, y, width, height) => {
      const data = context.getImageData(Math.round(x * scale), Math.round(y * scale), Math.round(width * scale), Math.round(height * scale)).data;
      const values = [];
      for (let index = 0; index < data.length; index += 4) {
        values.push((data[index] + data[index + 1] + data[index + 2]) / 3);
      }
      let localDiff = 0;
      let comparisons = 0;
      const scaledWidth = Math.round(width * scale);
      const scaledHeight = Math.round(height * scale);
      for (let row = 0; row < scaledHeight; row += 1) {
        for (let column = 1; column < scaledWidth; column += 1) {
          localDiff += Math.abs(values[row * scaledWidth + column] - values[row * scaledWidth + column - 1]);
          comparisons += 1;
        }
      }
      return localDiff / Math.max(1, comparisons);
    };
    return {
      outsideImageStrip: sampleStrip(320, 126, 58, 8),
      insideImageStrip: sampleStrip(320, 154, 58, 8)
    };
  });
  if (metrics.outsideImageStrip > 8 || metrics.insideImageStrip < metrics.outsideImageStrip + 5) {
    throw new Error(`Image noise is not clipped to the rendered image bounds: ${JSON.stringify(metrics)}`);
  }
  await assertPlatformPreviewUsesImageEffects(page);
  await setRangeValue(page, "Noise", "0");
  await page.getByRole("tab", { name: /Edit/i }).click();
}

async function assertPlatformPreviewUsesImageEffects(page) {
  await page.getByRole("radio", { name: /Platform Preview/i }).click();
  await page.locator(".preview-image-large svg").waitFor({ timeout: 5_000 });
  const previewState = await page.evaluate(() => {
    const svg = document.querySelector(".preview-image-large svg");
    const imageSlot = document.querySelector(".platform-preview-image-slot");
    if (!svg || !imageSlot) throw new Error("Platform preview SVG or image slot missing.");
    const rect = imageSlot.getBoundingClientRect();
    const markup = svg.outerHTML;
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      hasNoise: markup.includes("gf-noise-"),
      hasImageClip: markup.includes("gf-image-clip-"),
      hasClippedGroup: markup.includes('clip-path="url(#gf-image-clip-')
    };
  });
  if (!previewState.hasNoise || !previewState.hasImageClip || !previewState.hasClippedGroup) {
    throw new Error(`Platform preview is not using the current image effects SVG: ${JSON.stringify(previewState)}`);
  }
  if (previewState.width < 240 || previewState.height < 120) {
    throw new Error(`Platform preview image slot is too small after effects: ${JSON.stringify(previewState)}`);
  }
  await assertPlatformPreviewContained(page);
  await page.getByRole("radio", { name: /^Canvas$/i }).click();
  await page.locator("canvas").waitFor({ timeout: 5_000 });
}

async function assertSourceToggleInToolbar(page) {
  const metrics = await page.evaluate(() => {
    const peek = document.querySelector(".toolbar-source-action");
    const tabs = document.querySelector(".stage-mode-tabs");
    const toolbar = document.querySelector(".stage-toolbar");
    const oldPeek = document.querySelector(".source-peek");
    if (!peek || !tabs || !toolbar) throw new Error("Source toolbar action, stage tabs, or toolbar missing.");
    const peekRect = peek.getBoundingClientRect();
    const tabsRect = tabs.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const overlapsTabs = !(peekRect.right < tabsRect.left || peekRect.left > tabsRect.right || peekRect.bottom < tabsRect.top || peekRect.top > tabsRect.bottom);
    return {
      top: Math.round(peekRect.top),
      left: Math.round(peekRect.left),
      overlapsTabs,
      insideToolbar: peekRect.top >= toolbarRect.top - 1 && peekRect.bottom <= toolbarRect.bottom + 1,
      oldPeekPresent: Boolean(oldPeek)
    };
  });
  if (metrics.overlapsTabs || !metrics.insideToolbar || metrics.oldPeekPresent) {
    throw new Error(`Source rail show button is badly placed: ${JSON.stringify(metrics)}`);
  }
}

async function assertGraphForgeToast(page) {
  const styles = await page.evaluate(() => {
    const toast = document.querySelector(".graphforge-toast");
    if (!toast) throw new Error("GraphForge toast was not rendered with the owned toast class.");
    const computed = getComputedStyle(toast);
    return {
      borderRadius: computed.borderRadius,
      background: computed.backgroundColor,
      color: computed.color,
      boxShadow: computed.boxShadow
    };
  });
  if (styles.borderRadius === "0px" || styles.boxShadow === "none") {
    throw new Error(`GraphForge toast still looks like an unstyled default toast: ${JSON.stringify(styles)}`);
  }
}

async function assertManualStudioHasNoSessionAgentRequest(page) {
  const button = page.getByRole("button", { name: /Agent revision unavailable/i });
  await button.waitFor({ timeout: 5_000 });
  if (await button.isEnabled()) {
    throw new Error("Manual Studio mode should not expose a live session-scoped agent request.");
  }
}

async function assertCircleLayerWasCreated(page) {
  const circle = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".layer-item")];
    const row = rows.find((item) => item.textContent?.includes("Circle Layer"));
    return row?.textContent ?? "";
  });
  if (!circle.includes("Circle Layer") || !circle.includes("ellipse")) {
    throw new Error(`Circle layer was not created as an editable ellipse shape: ${circle}`);
  }
}

async function exerciseLayerActionButtons(page) {
  const circleRow = page.locator(".layer-item", { hasText: "Circle Layer" }).first();
  await circleRow.getByRole("button").first().click();
  await assertUrlStable(page, () => circleRow.getByTitle("Hide layer").click(), "hide layer");
  await page.locator(".layer-item", { hasText: "Circle Layer" }).getByTitle("Show layer").click();
  const visibleCircleRow = page.locator(".layer-item", { hasText: "Circle Layer" }).first();
  await assertUrlStable(page, () => visibleCircleRow.getByTitle("Lock layer").click(), "lock layer");
  await page.locator(".layer-item", { hasText: "Circle Layer" }).getByTitle("Unlock layer").click();
  const unlockedCircleRow = page.locator(".layer-item", { hasText: "Circle Layer" }).first();
  await assertUrlStable(page, () => unlockedCircleRow.getByTitle("Duplicate layer").click(), "duplicate layer");
  await page.locator(".layer-item", { hasText: "Circle Layer copy" }).waitFor({ state: "visible", timeout: 5_000 });
  const copyRow = page.locator(".layer-item", { hasText: "Circle Layer copy" }).first();
  await assertUrlStable(page, () => copyRow.getByTitle("Move layer up").click(), "move layer up");
  await assertUrlStable(page, () => copyRow.getByTitle("Move layer down").click(), "move layer down");
  await assertUrlStable(page, () => copyRow.getByTitle("Delete layer").click(), "delete layer");
}

async function exerciseArrangeButtons(page) {
  const arrangeTitles = [
    "Align left",
    "Align horizontal center",
    "Align right",
    "Align top",
    "Align vertical middle",
    "Align bottom",
    "Distribute horizontally",
    "Distribute vertically"
  ];
  for (const title of arrangeTitles) {
    const button = page.getByTitle(title).first();
    if (await button.isEnabled()) {
      await assertUrlStable(page, () => button.click(), title);
    }
  }
}

async function exerciseSnapButtons(page) {
  const snapTitles = ["Snap to safe zone", "Snap to canvas center", "Snap to top left", "Snap to bottom right"];
  for (const title of snapTitles) {
    await assertUrlStable(page, () => page.getByTitle(title).click(), title);
  }
}

async function assertUrlStable(page, action, label) {
  const before = page.url();
  await action();
  await page.waitForTimeout(80);
  const after = page.url();
  if (before !== after) {
    throw new Error(`${label} changed URL from ${before} to ${after}`);
  }
}

async function assertCanvasFitsFrame(page) {
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const frame = document.querySelector(".konva-frame");
    const workspace = document.querySelector(".canvas-workspace");
    if (!(canvas instanceof HTMLCanvasElement) || !frame || !workspace) {
      throw new Error("Canvas, frame, or workspace missing.");
    }
    const canvasRect = canvas.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    return {
      canvasWidth: canvasRect.width,
      canvasHeight: canvasRect.height,
      frameWidth: frameRect.width,
      frameHeight: frameRect.height,
      workspaceScrollWidth: workspace.scrollWidth,
      workspaceClientWidth: workspace.clientWidth
    };
  });
  if (Math.abs(metrics.canvasWidth - metrics.frameWidth) > 2 || Math.abs(metrics.canvasHeight - metrics.frameHeight) > 2) {
    throw new Error(`Canvas does not fit its frame: ${JSON.stringify(metrics)}`);
  }
  if (metrics.workspaceScrollWidth > metrics.workspaceClientWidth + 2) {
    throw new Error(`Canvas fit mode has unexpected horizontal scroll: ${JSON.stringify(metrics)}`);
  }
}

async function assertPlatformPreviewContained(page) {
  const metrics = await page.evaluate(() => {
    const dock = document.querySelector(".preview-dock");
    const switcher = document.querySelector(".platform-switcher");
    const frame = document.querySelector(".platform-frame");
    if (!dock || !switcher || !frame) throw new Error("Platform preview surface missing.");
    const dockRect = dock.getBoundingClientRect();
    const switcherRect = switcher.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    return {
      dockBottom: dockRect.bottom,
      switcherBottom: switcherRect.bottom,
      frameBottom: frameRect.bottom,
      dockClientHeight: dock.clientHeight,
      dockScrollHeight: dock.scrollHeight,
      dockOverflowY: getComputedStyle(dock).overflowY
    };
  });
  if (metrics.frameBottom > metrics.dockBottom + 2 || metrics.switcherBottom > metrics.dockBottom + 2) {
    throw new Error(`Platform preview content escapes stage: ${JSON.stringify(metrics)}`);
  }
  if (!["auto", "hidden"].includes(metrics.dockOverflowY)) {
    throw new Error(`Platform preview does not own overflow: ${JSON.stringify(metrics)}`);
  }
}

async function readCanvasFingerprint(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Konva canvas was not found.");
    return canvas.toDataURL("image/png").slice(0, 1800);
  });
}

async function readCanvasNoiseMetrics(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Konva canvas was not found.");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context was not available.");
    const scale = canvas.width / 1200;
    const x = Math.round(520 * scale);
    const y = Math.round(150 * scale);
    const width = Math.round(170 * scale);
    const height = Math.round(110 * scale);
    const data = context.getImageData(x, y, width, height).data;
    const values = [];
    for (let index = 0; index < data.length; index += 4) {
      values.push((data[index] + data[index + 1] + data[index + 2]) / 3);
    }
    const mean = values.reduce((total, value) => total + value, 0) / values.length;
    const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
    let localDiff = 0;
    let comparisons = 0;
    for (let row = 0; row < height; row += 1) {
      for (let column = 1; column < width; column += 1) {
        const current = values[row * width + column];
        const previous = values[row * width + column - 1];
        localDiff += Math.abs(current - previous);
        comparisons += 1;
      }
    }
    return { variance, localDiff: localDiff / comparisons };
  });
}

async function readEffectDebugState(page) {
  return page.evaluate(() => {
    const activeLayer = document.querySelector(".layer-item.active")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const noiseInput = [...document.querySelectorAll("input")].find(
      (input) => input instanceof HTMLInputElement && input.getAttribute("aria-label") === "Noise"
    );
    const gradient = document.querySelector("select") instanceof HTMLSelectElement ? document.querySelector("select")?.value : "";
    return {
      activeLayer,
      effectLayer: document.querySelector("[data-selected-layer]")?.getAttribute("data-selected-layer") ?? "",
      noiseValue: noiseInput instanceof HTMLInputElement ? noiseInput.value : "",
      gradient,
      canvases: [...document.querySelectorAll("canvas")].map((canvas, index) => ({
        index,
        width: canvas.width,
        height: canvas.height,
        className: canvas.className,
        opacity: getComputedStyle(canvas).opacity,
        display: getComputedStyle(canvas).display
      }))
    };
  });
}

async function setRangeValue(page, label, value) {
  await page.getByRole("slider", { name: label }).evaluate((input, nextValue) => {
    if (!(input instanceof HTMLInputElement)) throw new Error(`${input} is not an input.`);
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!valueSetter) throw new Error("HTMLInputElement value setter was not available.");
    valueSetter.call(input, String(nextValue));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function selectStudioOption(page, label, option) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  if (overflow.scrollWidth > overflow.clientWidth + 2) {
    throw new Error(`Studio has horizontal overflow: scrollWidth ${overflow.scrollWidth}, viewport ${overflow.clientWidth}.`);
  }
}

async function assertScreenshot(screenshotPath) {
  const screenshot = await stat(screenshotPath);
  if (screenshot.size < 20_000) {
    throw new Error(`Studio screenshot is too small to prove a rendered UI: ${screenshot.size} bytes.`);
  }
  return screenshot;
}

function createTransparentPng() {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateSync(Buffer.from([0, 0, 0, 0, 0]));
  return Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function expectCount(page, selector, minimum, label) {
  const count = await page.locator(selector).count();
  if (count < minimum) {
    throw new Error(`Expected at least ${minimum} ${label}, found ${count}.`);
  }
}

async function waitForServer(url) {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    if (server.exitCode !== null) {
      throw new Error(`Studio server exited early.\n${serverOutput}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`Studio server did not start in time.\n${serverOutput}`);
}

async function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (typeof address === "object" && address) resolvePort(address.port);
        else reject(new Error("Could not allocate a local port."));
      });
    });
  });
}

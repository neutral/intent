import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const state = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("pigment.project.v1")));
const pixels = (p, x, y) =>
  p
    .locator("#canvas")
    .evaluate(
      (c, [x, y]) =>
        Array.from(c.getContext("2d").getImageData(x, y, 1, 1).data),
      [x, y],
    );
const image = (p) => p.locator("#canvas").evaluate((c) => c.toDataURL());
async function ink(p, c) {
  await p.locator("#hex").fill(c);
  await p.locator("#hex").press("Tab");
}
async function drag(p, tool, a, b = a) {
  await p.getByRole("button", { name: tool, exact: true }).click();
  const r = await p.locator("#canvas").boundingBox();
  const xy = (v) => ({
    x: r.x + (v[0] * r.width) / 960,
    y: r.y + (v[1] * r.height) / 640,
  });
  await p.mouse.move(xy(a).x, xy(a).y);
  await p.mouse.down();
  await p.mouse.move(xy(b).x, xy(b).y, { steps: 8 });
  await p.mouse.up();
}
async function rename(p, old, next) {
  const field = p.getByRole("textbox", { name: `Rename ${old}`, exact: true });
  await field.fill(next);
  await field.press("Tab");
}
async function download(p, button) {
  const pending = p.waitForEvent("download");
  await p.getByRole("button", { name: button, exact: true }).click();
  const file = await pending;
  return await readFile(await file.path());
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("initial desktop, tools, pixel output, one edit, zoom alignment and cancellation", async ({
  page: p,
}) => {
  await expect(p.locator("#canvas")).toBeVisible();
  expect(await pixels(p, 400, 300)).toEqual([255, 250, 240, 255]);
  await p.screenshot({
    path: ".local/artifacts/desktop-initial.png",
    fullPage: true,
  });
  await ink(p, "#ff0000");
  await drag(p, "Brush", [100, 100], [200, 100]);
  expect(await pixels(p, 150, 100)).toEqual([255, 0, 0, 255]);
  expect((await state(p)).layers[0].marks).toHaveLength(1);
  await expect(p.locator("#history-count")).toHaveText("1 / 40");
  await drag(p, "Eraser", [150, 90], [150, 110]);
  expect(await pixels(p, 150, 100)).toEqual([255, 250, 240, 255]);
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await pixels(p, 150, 100)).toEqual([255, 0, 0, 255]);
  await p.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await pixels(p, 150, 100)).toEqual([255, 250, 240, 255]);
  await drag(p, "Line", [300, 100], [400, 100]);
  expect(await pixels(p, 350, 100)).toEqual([255, 0, 0, 255]);
  await drag(p, "Rectangle", [100, 200], [250, 300]);
  expect(await pixels(p, 100, 250)).toEqual([255, 0, 0, 255]);
  await drag(p, "Ellipse", [350, 200], [550, 400]);
  expect(await pixels(p, 450, 200)).toEqual([255, 0, 0, 255]);
  await ink(p, "#0000ff");
  await drag(p, "Fill", [175, 250]);
  expect(await pixels(p, 175, 250)).toEqual([0, 0, 255, 255]);
  expect(await pixels(p, 280, 250)).toEqual([255, 250, 240, 255]);
  let before = await state(p);
  await drag(p, "Eyedropper", [175, 250]);
  await expect(p.locator("#hex")).toHaveValue("#0000ff");
  expect(await state(p)).toEqual(before);
  await p.getByRole("button", { name: "Zoom out", exact: true }).click();
  await ink(p, "#00ff00");
  await drag(p, "Brush", [600, 450], [650, 450]);
  expect(await pixels(p, 625, 450)).toEqual([0, 255, 0, 255]);
  before = await state(p);
  const beforeImage = await image(p);
  await p.getByRole("button", { name: "Rectangle", exact: true }).click();
  const r = await p.locator("#canvas").boundingBox();
  await p.mouse.move(r.x + 20, r.y + 20);
  await p.mouse.down();
  await p.mouse.move(r.x + 100, r.y + 100);
  await p.keyboard.press("Escape");
  await p.mouse.up();
  expect(await state(p)).toEqual(before);
  expect(await image(p)).toEqual(beforeImage);
  await p.getByRole("button", { name: "Line", exact: true }).click();
  await p.mouse.move(r.x + 20, r.y + 20);
  await p.mouse.down();
  await p.mouse.move(r.x + 100, r.y + 100);
  await p.locator("#canvas").dispatchEvent("pointercancel", { pointerId: 1 });
  await p.mouse.up();
  expect(await state(p)).toEqual(before);
  expect(await image(p)).toEqual(beforeImage);
  await p.screenshot({
    path: ".local/artifacts/desktop-tools.png",
    fullPage: true,
  });
});
test("overlapping layers: select lower, opacity, visibility, rename, order, delete and undo", async ({
  page: p,
}) => {
  await ink(p, "#ff0000");
  await drag(p, "Brush", [100, 100], [250, 100]);
  await rename(p, "Layer 1", "Red base");
  await p.getByRole("button", { name: "Add layer", exact: true }).click();
  await rename(p, "Layer 2", "Blue top");
  await ink(p, "#0000ff");
  await drag(p, "Brush", [100, 100], [250, 100]);
  expect(await pixels(p, 175, 100)).toEqual([0, 0, 255, 255]);
  await p.locator("#layer-opacity").fill("50");
  await p.locator("#layer-opacity").dispatchEvent("change");
  const blend = await pixels(p, 175, 100);
  expect(Math.abs(blend[0] - 127)).toBeLessThanOrEqual(1);
  expect(Math.abs(blend[2] - 128)).toBeLessThanOrEqual(1);
  expect(blend[1]).toBe(0);
  await p.getByRole("button", { name: "Hide Blue top", exact: true }).click();
  expect(await pixels(p, 175, 100)).toEqual([255, 0, 0, 255]);
  const before = await state(p);
  await drag(p, "Brush", [300, 300], [400, 300]);
  await expect(p.locator("#message")).toContainText("hidden");
  expect(await state(p)).toEqual(before);
  await p.getByRole("button", { name: "Select Red base", exact: true }).click();
  await ink(p, "#00ff00");
  await drag(p, "Brush", [100, 200], [250, 200]);
  expect(await pixels(p, 175, 200)).toEqual([0, 255, 0, 255]);
  expect((await state(p)).layers[1].marks).toHaveLength(1);
  await p.getByRole("button", { name: "Show Blue top", exact: true }).click();
  await p.getByRole("button", { name: "Select Blue top", exact: true }).click();
  await p.getByRole("button", { name: "Move layer down", exact: true }).click();
  expect(await pixels(p, 175, 100)).toEqual([255, 0, 0, 255]);
  await p.getByRole("button", { name: "Move layer up", exact: true }).click();
  expect(await pixels(p, 175, 100)).toEqual(blend);
  const full = await state(p);
  await p.getByRole("button", { name: "Delete layer", exact: true }).click();
  expect((await state(p)).layers).toHaveLength(1);
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await state(p)).toEqual(full);
  await p.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Delete layer", exact: true }),
  ).toBeDisabled();
});
test("reload and downloaded project restore full model and pixels; export ignores zoom and hidden layers", async ({
  page: p,
}) => {
  await rename(p, "Layer 1", "Red base");
  await ink(p, "#ff0000");
  await drag(p, "Brush", [100, 100], [250, 100]);
  await p.getByRole("button", { name: "Add layer", exact: true }).click();
  await rename(p, "Layer 2", "Hidden blue");
  await ink(p, "#0000ff");
  await drag(p, "Brush", [100, 100], [250, 100]);
  await p.locator("#layer-opacity").fill("40");
  await p.locator("#layer-opacity").dispatchEvent("change");
  await p
    .getByRole("button", { name: "Hide Hidden blue", exact: true })
    .click();
  const original = await state(p),
    originalPixels = await image(p);
  await p.reload();
  expect(await state(p)).toEqual(original);
  expect(await image(p)).toEqual(originalPixels);
  const project = await download(p, "Save project");
  expect(JSON.parse(project.toString())).toEqual(original);
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "New", exact: true }).click();
  await p.locator("#file").setInputFiles({
    name: "roundtrip.json",
    mimeType: "application/json",
    buffer: project,
  });
  await expect(p.locator("#message")).toContainText("Project opened");
  expect(await state(p)).toEqual(original);
  expect(await image(p)).toEqual(originalPixels);
  const pngA = await download(p, "Export PNG ↗");
  await p.getByRole("button", { name: "Zoom out", exact: true }).click();
  const pngB = await download(p, "Export PNG ↗");
  expect(pngA.equals(pngB)).toBeTruthy();
  const decoded = await p.evaluate(
    async (data) => {
      const img = await createImageBitmap(await (await fetch(data)).blob());
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      return {
        width: img.width,
        height: img.height,
        pixel: Array.from(c.getContext("2d").getImageData(175, 100, 1, 1).data),
        paper: Array.from(c.getContext("2d").getImageData(500, 500, 1, 1).data),
      };
    },
    "data:image/png;base64," + pngA.toString("base64"),
  );
  expect(decoded).toEqual({
    width: 960,
    height: 640,
    pixel: [255, 0, 0, 255],
    paper: [255, 250, 240, 255],
  });
  await p
    .getByRole("button", { name: "Show Hidden blue", exact: true })
    .click();
  expect(await pixels(p, 175, 100)).not.toEqual([255, 0, 0, 255]);
  await p.screenshot({
    path: ".local/artifacts/desktop-edited.png",
    fullPage: true,
  });
});
test("invalid imports preserve artwork, storage failure remains visible and editing/downloads work", async ({
  page: p,
}) => {
  await drag(p, "Brush", [100, 100], [200, 100]);
  const original = await state(p),
    originalImage = await image(p);
  const invalid = [
    ["broken", "{"],
    ["version", JSON.stringify({ ...original, version: 2 })],
    ["size", " ".repeat(2 * 1024 * 1024 + 1)],
    ["dimensions", JSON.stringify({ ...original, width: 999999 })],
    [
      "coordinates",
      JSON.stringify({
        ...original,
        layers: [
          {
            ...original.layers[0],
            marks: [{ ...original.layers[0].marks[0], points: [[-1, 0]] }],
          },
        ],
      }),
    ],
  ];
  for (const [name, text] of invalid) {
    await p.locator("#file").setInputFiles({
      name: name + ".json",
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
    await expect(p.locator("#message")).toHaveClass(/error/);
    expect(await state(p)).toEqual(original);
    expect(await image(p)).toEqual(originalImage);
  }
  await p.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await drag(p, "Line", [200, 200], [300, 200]);
  await expect(p.locator("#save-status")).toContainText("Autosave failed");
  await expect(p.locator("#message")).toContainText("Save project");
  expect(await pixels(p, 250, 200)).toEqual([49, 93, 88, 255]);
  expect(
    JSON.parse((await download(p, "Save project")).toString()).layers[0].marks,
  ).toHaveLength(2);
  await expect(p.locator("#save-status")).toContainText("Autosave failed");
});
test("shortcuts, controls, cancellation, example, clear, rapid undo/draw and focus", async ({
  page: p,
}) => {
  await p.keyboard.press("e");
  await expect(p.locator("[data-tool=eraser]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await p.keyboard.press("b");
  await expect(p.locator("[data-tool=brush]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await p.locator("#size").fill("30");
  await p.locator("#size").dispatchEvent("input");
  await expect(p.locator("#size-value")).toHaveText("30 px");
  await p.locator("#opacity").fill("50");
  await p.locator("#opacity").dispatchEvent("input");
  await expect(p.locator("#opacity-value")).toHaveText("50%");
  await drag(p, "Brush", [100, 100], [200, 100]);
  const first = await image(p);
  await p.keyboard.press("Control+z");
  expect(await pixels(p, 150, 100)).toEqual([255, 250, 240, 255]);
  await p.keyboard.press("Control+Shift+z");
  expect(await image(p)).toEqual(first);
  await p.keyboard.press("Control+z");
  await drag(p, "Brush", [300, 300], [400, 300]);
  await expect(p.locator("#redo")).toBeDisabled();
  const beforeZoom = await state(p);
  await p.keyboard.press("-");
  const small = await p.locator("#zoom-value").textContent();
  await p.keyboard.press("+");
  expect(await p.locator("#zoom-value").textContent()).not.toBe(small);
  await p.keyboard.press("0");
  expect(await state(p)).toEqual(beforeZoom);
  const name = p.getByRole("textbox", { name: "Rename Layer 1", exact: true });
  await name.fill("");
  await name.pressSequentially("belrofi");
  await expect(p.locator("[data-tool=brush]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await name.press("Tab");
  await p.locator("#document-name").fill("A study");
  await p.locator("#document-name").press("Tab");
  await expect(p.locator("#document-name")).toHaveValue("A study");
  const beforeNew = await state(p);
  p.once("dialog", (d) => d.dismiss());
  await p.getByRole("button", { name: "New", exact: true }).click();
  expect(await state(p)).toEqual(beforeNew);
  const chooser = p.waitForEvent("filechooser");
  await p.getByRole("button", { name: "Open project", exact: true }).click();
  await chooser;
  await p.locator("#file").setInputFiles([]);
  expect(await state(p)).toEqual(beforeNew);
  await p.getByRole("button", { name: "Clear layer", exact: true }).click();
  expect((await state(p)).layers[0].marks).toHaveLength(0);
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await state(p)).toEqual(beforeNew);
  p.once("dialog", (d) => d.accept());
  await p
    .getByRole("button", { name: "Try an example ↗", exact: true })
    .click();
  await expect(p.locator("#document-name")).toHaveValue("Late afternoon");
  expect((await state(p)).layers).toHaveLength(2);
  await p.screenshot({
    path: ".local/artifacts/desktop-example.png",
    fullPage: true,
  });
  await p
    .getByRole("button", { name: "Help and shortcuts", exact: true })
    .click();
  await expect(p.getByRole("dialog")).toBeVisible();
  await p.screenshot({ path: ".local/artifacts/help.png", fullPage: true });
  await p.getByRole("button", { name: "Close help", exact: true }).click();
  await expect(p.getByRole("dialog")).not.toBeVisible();
  await p.keyboard.press("?");
  await expect(p.getByRole("dialog")).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(p.getByRole("dialog")).not.toBeVisible();
  await p.locator("#help").focus();
  expect(
    await p
      .locator("#help")
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
});
test("390px layout: initial and edited views, reachable tools/layers and no page overflow", async ({
  page: p,
}) => {
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({
    path: ".local/artifacts/mobile-initial.png",
    fullPage: true,
  });
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await drag(p, "Brush", [100, 100], [200, 100]);
  expect(await pixels(p, 150, 100)).toEqual([49, 93, 88, 255]);
  await p.getByRole("button", { name: "Add layer", exact: true }).click();
  await rename(p, "Layer 2", "Mobile ink");
  await p.getByRole("button", { name: "Hide Mobile ink", exact: true }).click();
  await p.getByRole("button", { name: "Show Mobile ink", exact: true }).click();
  await p.getByRole("button", { name: "Move layer down", exact: true }).click();
  await p.getByRole("button", { name: "Move layer up", exact: true }).click();
  await p.getByRole("button", { name: "Delete layer", exact: true }).click();
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  await p.screenshot({
    path: ".local/artifacts/mobile-edited.png",
    fullPage: true,
  });
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await p
    .getByRole("button", { name: "Help and shortcuts", exact: true })
    .click();
  await expect(p.getByRole("dialog")).toBeVisible();
  await p.getByRole("button", { name: "Close help", exact: true }).click();
});
test("palette, native color, numeric shortcuts, erasing selected layer only, and zero opacity cycle", async ({
  page: p,
}) => {
  for (const swatch of await p.locator(".swatch").all()) {
    const value = await swatch.getAttribute("title");
    await swatch.click();
    await expect(p.locator("#hex")).toHaveValue(value);
    await expect(swatch).toHaveAttribute("aria-pressed", "true");
  }
  await p.locator("#color").fill("#ff0000");
  await p.locator("#color").dispatchEvent("input");
  await expect(p.locator("#hex")).toHaveValue("#ff0000");
  await p.locator("#hex").fill("broken");
  await p.locator("#hex").press("Tab");
  await expect(p.locator("#message")).toContainText("six-digit");
  await expect(p.locator("#hex")).toHaveValue("#ff0000");
  await drag(p, "Brush", [100, 100], [250, 100]);
  await p.getByRole("button", { name: "Add layer", exact: true }).click();
  await ink(p, "#0000ff");
  await drag(p, "Brush", [100, 100], [250, 100]);
  const upper = structuredClone((await state(p)).layers[1]);
  await p.getByRole("button", { name: "Select Layer 1", exact: true }).click();
  await drag(p, "Eraser", [175, 80], [175, 120]);
  expect((await state(p)).layers[1]).toEqual(upper);
  expect(await pixels(p, 175, 100)).toEqual([0, 0, 255, 255]);
  await p.getByRole("button", { name: "Hide Layer 2", exact: true }).click();
  expect(await pixels(p, 175, 100)).toEqual([255, 250, 240, 255]);
  await p.getByRole("button", { name: "Show Layer 2", exact: true }).click();
  await p.getByRole("button", { name: "Select Layer 2", exact: true }).click();
  await p.locator("#layer-opacity").focus();
  await p.keyboard.press("Home");
  await p.locator("#layer-opacity").press("Tab");
  expect(await pixels(p, 175, 100)).toEqual([255, 250, 240, 255]);
  await p.locator("#layer-opacity").focus();
  await p.keyboard.press("End");
  await p.locator("#layer-opacity").press("Tab");
  expect(await pixels(p, 175, 100)).toEqual([0, 0, 255, 255]);
  await p.locator("#size").focus();
  await p.keyboard.press("b");
  await expect(p.locator("[data-tool=eraser]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await p.keyboard.press("ArrowRight");
  await expect(p.locator("#size-value")).toHaveText("13 px");
  await p.locator("#canvas").focus();
  await p.keyboard.press("]");
  await expect(p.locator("#size-value")).toHaveText("14 px");
  await p.keyboard.press("[");
  await expect(p.locator("#size-value")).toHaveText("13 px");
  await p
    .getByRole("button", { name: "Help and shortcuts", exact: true })
    .focus();
  await p.screenshot({
    path: ".local/artifacts/desktop-focus.png",
    fullPage: true,
  });
});
test("unavailable storage at startup and narrow help remain usable", async ({
  page: p,
  context,
}) => {
  await context.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await p.reload();
  await expect(p.locator("#save-status")).toContainText("Recovery failed");
  await expect(p.locator("#message")).toContainText("Save project");
  await drag(p, "Brush", [100, 100], [200, 100]);
  expect(await pixels(p, 150, 100)).toEqual([49, 93, 88, 255]);
  await expect(p.locator("#save-status")).toContainText("Autosave failed");
  const project = JSON.parse((await download(p, "Save project")).toString());
  expect(project.layers[0].marks).toHaveLength(1);
  await p.setViewportSize({ width: 390, height: 844 });
  await p
    .getByRole("button", { name: "Help and shortcuts", exact: true })
    .click();
  await p.screenshot({
    path: ".local/artifacts/mobile-help.png",
    fullPage: true,
  });
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await p.getByRole("button", { name: "Close help", exact: true }).click();
});

test("sliders expose stable accessible names and support keyboard editing through named controls", async ({
  page: p,
}) => {
  const size = p.getByRole("slider", { name: "Size", exact: true });
  const opacity = p.getByRole("slider", { name: "Opacity", exact: true });
  const layerOpacity = p.getByRole("slider", {
    name: "Layer opacity",
    exact: true,
  });
  await expect(p.getByRole("slider")).toHaveCount(3);
  for (const control of [size, opacity, layerOpacity])
    await expect(control).toBeVisible();
  await size.focus();
  await p.keyboard.press("ArrowRight");
  await expect(size).toHaveValue("13");
  await opacity.focus();
  await p.keyboard.press("ArrowLeft");
  await expect(opacity).toHaveValue("99");
  await layerOpacity.focus();
  await p.keyboard.press("Home");
  await layerOpacity.press("Tab");
  expect((await state(p)).layers[0].opacity).toBe(0);
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(layerOpacity).toHaveValue("100");
  await p.setViewportSize({ width: 390, height: 844 });
  await layerOpacity.scrollIntoViewIfNeeded();
  await expect(layerOpacity).toBeVisible();
  await layerOpacity.focus();
  await p.keyboard.press("ArrowLeft");
  await layerOpacity.press("Tab");
  expect((await state(p)).layers[0].opacity).toBe(0.99);
  await expect(layerOpacity).toHaveAccessibleName("Layer opacity");
});

test("undo/redo feedback matches restored pixels, clears stale errors, and retains current save failures", async ({
  page: p,
}) => {
  await drag(p, "Brush", [100, 100], [200, 100]);
  const painted = await image(p);
  await p.getByRole("button", { name: "Clear layer", exact: true }).click();
  await expect(p.locator("#message")).toContainText("Layer cleared");
  expect(await pixels(p, 150, 100)).toEqual([255, 250, 240, 255]);
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(p.locator("#message")).toHaveText("Undid: Clear layer.");
  expect(await image(p)).toEqual(painted);
  await p.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(p.locator("#message")).toHaveText("Redid: Clear layer.");
  expect(await pixels(p, 150, 100)).toEqual([255, 250, 240, 255]);
  await p.locator("#file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(p.locator("#message")).toHaveClass(/error/);
  await p.keyboard.press("Control+z");
  await expect(p.locator("#message")).toHaveText("Undid: Clear layer.");
  await expect(p.locator("#message")).not.toHaveClass(/error/);
  expect(await image(p)).toEqual(painted);
  await p.keyboard.press("Control+Shift+z");
  await expect(p.locator("#message")).toHaveText("Redid: Clear layer.");
  expect(await pixels(p, 150, 100)).toEqual([255, 250, 240, 255]);
  await p.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await image(p)).toEqual(painted);
  await expect(p.locator("#message")).toHaveClass(/error/);
  await expect(p.locator("#message")).toContainText(
    "Local saving is unavailable",
  );
  await expect(p.locator("#save-status")).toContainText("Autosave failed");
});

test("fill on an empty upper layer crosses lower-art boundaries; erasing reveals lower ink and paper", async ({
  page: p,
}) => {
  await rename(p, "Layer 1", "Red divider");
  await ink(p, "#ff0000");
  await drag(p, "Brush", [480, 0], [480, 640]);
  const lower = (await state(p)).layers[0];
  const lowerImage = await image(p);
  expect(await pixels(p, 480, 320)).toEqual([255, 0, 0, 255]);
  expect(await pixels(p, 100, 320)).toEqual([255, 250, 240, 255]);
  expect(await pixels(p, 800, 320)).toEqual([255, 250, 240, 255]);
  await p.getByRole("button", { name: "Add layer", exact: true }).click();
  await rename(p, "Layer 2", "Blue wash");
  expect((await state(p)).layers[1].marks).toHaveLength(0);
  await ink(p, "#0000ff");
  // The seed is left of a full-height lower-layer divider. The upper layer itself
  // is entirely transparent, so its region must include both sides and the divider.
  await drag(p, "Fill", [100, 320]);
  for (const x of [100, 480, 800])
    expect(await pixels(p, x, 320)).toEqual([0, 0, 255, 255]);
  expect((await state(p)).layers[0]).toEqual(lower);
  expect((await state(p)).layers[1].marks.map((m) => m.tool)).toEqual(["fill"]);
  await drag(p, "Eraser", [400, 320], [560, 320]);
  expect(await pixels(p, 425, 320)).toEqual([255, 250, 240, 255]);
  expect(await pixels(p, 480, 320)).toEqual([255, 0, 0, 255]);
  expect(await pixels(p, 535, 320)).toEqual([255, 250, 240, 255]);
  expect(await pixels(p, 800, 320)).toEqual([0, 0, 255, 255]);
  expect((await state(p)).layers[0]).toEqual(lower);
  const erasedImage = await image(p);
  await p.getByRole("button", { name: "Hide Blue wash", exact: true }).click();
  expect(await image(p)).toEqual(lowerImage);
  await p.getByRole("button", { name: "Show Blue wash", exact: true }).click();
  expect(await image(p)).toEqual(erasedImage);
});

test("New and Open undo/redo restore full documents, pixels and the selected layer", async ({
  page: p,
}) => {
  await rename(p, "Layer 1", "Red base");
  await ink(p, "#ff0000");
  await drag(p, "Brush", [100, 100], [200, 100]);
  await p.getByRole("button", { name: "Add layer", exact: true }).click();
  await rename(p, "Layer 2", "Blue detail");
  await ink(p, "#0000ff");
  await drag(p, "Brush", [300, 300], [400, 300]);
  const historyCount = await p.locator("#history-count").textContent();
  await p.getByRole("button", { name: "Select Red base", exact: true }).click();
  await expect(p.locator("#history-count")).toHaveText(historyCount);
  const portable = await state(p),
    portablePixels = await image(p);
  const project = await download(p, "Save project");
  expect(JSON.parse(project.toString()).active).toBe(portable.layers[0].id);
  await p
    .getByRole("button", { name: "Select Blue detail", exact: true })
    .click();
  await drag(p, "Brush", [600, 450], [700, 450]);
  const current = await state(p),
    currentPixels = await image(p);
  expect(current.active).toBe(current.layers[1].id);
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "New", exact: true }).click();
  const fresh = await state(p),
    freshPixels = await image(p);
  expect(fresh.layers).toHaveLength(1);
  expect(fresh.layers[0].marks).toHaveLength(0);
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await state(p)).toEqual(current);
  expect(await image(p)).toEqual(currentPixels);
  await expect(
    p.getByRole("button", { name: "Select Blue detail", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await p.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await state(p)).toEqual(fresh);
  expect(await image(p)).toEqual(freshPixels);
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  const chooser = p.waitForEvent("filechooser");
  await p.getByRole("button", { name: "Open project", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "selected-base.pigment.json",
    mimeType: "application/json",
    buffer: project,
  });
  await expect(p.locator("#message")).toContainText("Project opened");
  expect(await state(p)).toEqual(portable);
  expect(await image(p)).toEqual(portablePixels);
  await expect(
    p.getByRole("button", { name: "Select Red base", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await state(p)).toEqual(current);
  expect(await image(p)).toEqual(currentPixels);
  await expect(
    p.getByRole("button", { name: "Select Blue detail", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await p.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await state(p)).toEqual(portable);
  expect(await image(p)).toEqual(portablePixels);
  await expect(
    p.getByRole("button", { name: "Select Red base", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

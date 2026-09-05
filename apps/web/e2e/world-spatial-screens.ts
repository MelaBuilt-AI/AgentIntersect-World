import { writeFileSync } from "node:fs";
import { expect, type Page, type TestInfo } from "@playwright/test";

export async function exerciseSpatialScreens(page: Page, testInfo: TestInfo) {
  page.setDefaultTimeout(10_000);
  const room = page.locator("main.world-room");
  const screen = (id: string) => page.locator(`[data-world-screen="${id}"]`);
  await expect(room).toHaveAttribute("data-repository-readiness", "ready", {
    timeout: 30_000,
  });
  await expect(
    page.locator('canvas[data-scene-id="world-room"]'),
  ).toBeVisible();
  await expect(
    page.locator('canvas[data-scene-id="world-room"]'),
  ).toHaveAttribute("data-world-textures-ready", "true");
  await expect(room).toHaveAttribute("data-camera-zoom", "1");
  await page.mouse.move(720, 520);
  await page.mouse.wheel(0, 240);
  await expect
    .poll(async () => Number(await room.getAttribute("data-camera-zoom")))
    .toBeGreaterThan(1);
  await page.mouse.wheel(0, -240);
  await expect
    .poll(async () => Number(await room.getAttribute("data-camera-zoom")))
    .toBeCloseTo(1, 5);
  const palette = page.getByRole("complementary", {
    name: "Repository assets",
  });
  await palette.getByLabel("Search assets").fill("code");
  const searchBox = await palette.getByLabel("Search assets").boundingBox();
  const zoomBeforeScroll = await room.getAttribute("data-camera-zoom");
  await page.mouse.move(searchBox!.x + 5, searchBox!.y + 5);
  await page.mouse.wheel(0, 240);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await room.getAttribute("data-camera-zoom")).toBe(zoomBeforeScroll);
  // Typing does not undock a panel, including an Alt shortcut in the input.
  await palette.getByLabel("Search assets").press("Alt+Digit1");
  await expect(screen("director")).toHaveAttribute("data-screen-mode", "hud");
  await room.focus();
  await page.keyboard.press("Alt+Digit1");
  await expect(screen("director")).toHaveAttribute(
    "data-screen-mode",
    "spatial",
  );
  await expect(screen("director")).toHaveAttribute(
    "data-screen-projected",
    "true",
  );
  await expect(palette.getByLabel("Search assets")).toHaveValue("code");
  await page.screenshot({ path: testInfo.outputPath("director-undocked.png") });
  await palette.getByRole("button", { name: "Director", exact: true }).click();
  await expect(room).toHaveAttribute("data-repository-city-mode", "director");
  await palette.getByRole("button", { name: "Live", exact: true }).click();
  await page.keyboard.press("Alt+Digit1");
  await expect(screen("director")).toHaveAttribute("data-screen-mode", "hud");
  await palette.locator(".world-screen__toggle").click();
  await room.focus();
  await page.keyboard.press("Alt+Digit2");
  await page.keyboard.press("Alt+Digit3");
  for (const id of ["director", "workbench", "preview"]) {
    await expect(screen(id)).toHaveAttribute("data-screen-mode", "spatial");
    await expect(screen(id).locator(".world-screen__object")).toBeVisible();
    await expect(screen(id).locator(".world-screen__object")).toHaveCSS(
      "transform",
      /matrix3d/,
    );
  }
  // Native Edge can drop coplanar iframe content inside preserve-3d even
  // while headless Chromium paints it. Keep the native-proven flat surface.
  await expect(screen("preview").locator(".world-screen__object")).toHaveCSS(
    "transform-style",
    "flat",
  );
  await expect(screen("preview").locator(".world-screen__camera")).toHaveCSS(
    "transform-style",
    "preserve-3d",
  );
  // All cards must contribute to layout before the following Asset Inspector.
  await palette.getByLabel("Search assets").fill("");
  const assetGrid = palette.locator(".repository-assets__grid");
  const cardOverflow = await assetGrid.evaluate((grid) => {
    const gridBottom = grid.getBoundingClientRect().bottom;
    return Math.max(
      ...Array.from(
        grid.querySelectorAll("li"),
        (card) => card.getBoundingClientRect().bottom - gridBottom,
      ),
    );
  });
  expect(cardOverflow).toBeLessThanOrEqual(1);
  await palette.getByLabel("Search assets").fill("code");
  const preview = page.getByRole("region", { name: "World View" });
  await expect(page.getByRole("dialog", { name: "World View" })).toHaveCount(0);
  const iframe = preview.locator("iframe");
  const iframeHandle = await iframe.elementHandle();
  const frame = page.frameLocator(
    'iframe[title="World View preview: Build World View"]',
  );
  await preview.getByRole("button", { name: "Interact with preview" }).click();
  await frame.getByLabel("Preview state").fill("spatial state kept");
  const position = await room.getAttribute("data-user-position-z");
  await frame.getByLabel("Preview state").press("w");
  await expect(room).toHaveAttribute("data-user-position-z", position!);
  await preview.locator(".world-screen__toggle").click();
  await expect(
    preview.getByRole("button", { name: "Return to World", exact: true }),
  ).toBeVisible();
  await preview.locator(".world-screen__toggle").click();
  await preview
    .getByRole("button", { name: "Return to World", exact: true })
    .click();
  await expect(room).toHaveAttribute("data-input-owner", "world");
  const keptValue = await frame.getByLabel("Preview state").inputValue();

  for (const [id, key] of [
    ["director", "1"],
    ["workbench", "2"],
    ["preview", "3"],
  ]) {
    const panel = screen(id!);
    const before = {
      x: await panel.getAttribute("data-screen-x"),
      z: await panel.getAttribute("data-screen-z"),
    };
    // The decorative floor emitter has no drag authority.
    const emitter = await panel.evaluate((element) => {
      const x = Number((element as HTMLElement).dataset.baseClientX);
      const y = Number((element as HTMLElement).dataset.baseClientY);
      // A moved panel can overlay another emitter. Test the World hit target,
      // not a different panel's legitimately draggable footer above it.
      return [0, 12, 24, 36]
        .map((offset) => ({ x, y: y + offset }))
        .find(
          (point) =>
            !document
              .elementFromPoint(point.x, point.y)
              ?.closest(".world-screen__object"),
        );
    });
    expect(emitter).toBeDefined();
    await page.mouse.move(emitter!.x, emitter!.y);
    await page.mouse.down();
    await expect(panel).toHaveAttribute("data-screen-dragging", "false");
    // A hold/move is not a click on a repository object beneath the light.
    await page.mouse.move(emitter!.x + 12, emitter!.y, { steps: 3 });
    await page.mouse.up();
    await expect(page.locator('[data-world-screen="code"]')).toHaveCount(0);
    const handle = panel.locator(".world-screen__base");
    await expect(handle).toContainText("Hold here to move");
    const grab = await handle.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return [0.15, 0.85, 0.35, 0.65]
        .map((fraction) => ({
          x: box.x + box.width * fraction,
          y: box.y + box.height / 2,
        }))
        .find((point) =>
          element.contains(document.elementFromPoint(point.x, point.y)),
        );
    });
    expect(grab).toBeDefined();
    const yawBefore = await panel.getAttribute("data-screen-yaw");
    const zoomBefore = await room.getAttribute("data-camera-zoom");
    await page.mouse.move(grab!.x, grab!.y);
    await page.screenshot({
      path: testInfo.outputPath(`before-drag-${id}.png`),
    });
    await page.mouse.down({ button: "right" });
    await expect(panel).toHaveAttribute("data-screen-dragging", "false");
    await page.mouse.up({ button: "right" });
    await page.mouse.down({ button: "left" });
    await expect(panel).toHaveAttribute("data-screen-dragging", "true");
    await page.mouse.move(grab!.x + 45, grab!.y + 16, { steps: 5 });
    await page.mouse.wheel(0, 60);
    await expect
      .poll(() => panel.getAttribute("data-screen-yaw"))
      .not.toBe(yawBefore);
    const droppedYaw = await panel.getAttribute("data-screen-yaw");
    await page.mouse.move(grab!.x + 48, grab!.y + 18, { steps: 3 });
    await expect(panel).toHaveAttribute("data-screen-yaw", droppedYaw!);
    await expect(room).toHaveAttribute("data-camera-zoom", zoomBefore!);
    await page.mouse.up({ button: "left" });
    await expect(panel).toHaveAttribute("data-screen-dragging", "false");
    await expect
      .poll(() => panel.getAttribute("data-screen-x"))
      .not.toBe(before.x);
    const dropped = {
      x: await panel.getAttribute("data-screen-x"),
      z: await panel.getAttribute("data-screen-z"),
    };
    await room.focus();
    await page.keyboard.press(`Alt+Digit${key}`);
    await expect(panel).toHaveAttribute("data-screen-mode", "hud");
    await page.keyboard.press(`Alt+Digit${key}`);
    await expect(panel).toHaveAttribute("data-screen-mode", "spatial");
    await expect(panel).toHaveAttribute("data-screen-x", dropped.x!);
    await expect(panel).toHaveAttribute("data-screen-z", dropped.z!);
    await expect(panel).toHaveAttribute("data-screen-yaw", droppedYaw!);
  }
  expect(
    await iframe.evaluate((node, original) => node === original, iframeHandle),
  ).toBe(true);
  const grab = screen("director").getByRole("button", {
    name: "Move Live / Director screen",
  });
  const grabBox = await grab.boundingBox();
  await page.mouse.move(
    grabBox!.x + grabBox!.width / 2,
    grabBox!.y + grabBox!.height / 2,
  );
  await page.mouse.down();
  await expect(screen("director")).toHaveAttribute(
    "data-screen-dragging",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(screen("director")).toHaveAttribute(
    "data-screen-dragging",
    "false",
  );
  await page.mouse.up();
  await expect(page.locator(".world-escape-dialog")).toHaveCount(0);
  await expect(frame.getByLabel("Preview state")).toHaveValue(keptValue);
  await expect(palette.getByLabel("Search assets")).toHaveValue("code");
  const bench = page.getByRole("complementary", { name: "Current Workstream" });
  await bench
    .getByRole("button", { name: "Inspect current Workstream" })
    .click();
  await expect(
    bench.getByRole("region", { name: "Work Inspector" }),
  ).toBeVisible();
  await bench.getByRole("button", { name: "Close Work Inspector" }).click();
  await page.screenshot({ path: testInfo.outputPath("spatial-screens.png") });
  // Camera motion changes projection, never the placed object's coordinates.
  const transform = await screen("workbench")
    .locator(".world-screen__object")
    .evaluate((el) => el.style.transform);
  const camera = await screen("workbench")
    .locator(".world-screen__camera")
    .evaluate((el) => el.style.transform);
  await room.focus();
  await page.keyboard.down("a");
  await expect
    .poll(() =>
      screen("workbench")
        .locator(".world-screen__camera")
        .evaluate((el) => el.style.transform),
    )
    .not.toBe(camera);
  await page.keyboard.up("a");
  expect(
    await screen("workbench")
      .locator(".world-screen__object")
      .evaluate((el) => el.style.transform),
  ).toBe(transform);
  // Recover all surfaces through their shortcuts, with the same iframe alive.
  await room.focus();
  for (const key of ["1", "2", "3"])
    await page.keyboard.press(`Alt+Digit${key}`);
  for (const id of ["director", "workbench", "preview"])
    await expect(screen(id)).toHaveAttribute("data-screen-mode", "hud");
  writeFileSync(
    testInfo.outputPath("spatial-screen-evidence.json"),
    JSON.stringify(
      {
        screens: await page
          .locator("[data-world-screen]")
          .evaluateAll((nodes) =>
            nodes.map((node) => ({
              id: (node as HTMLElement).dataset.worldScreen,
              mode: (node as HTMLElement).dataset.screenMode,
              x: (node as HTMLElement).dataset.screenX,
              z: (node as HTMLElement).dataset.screenZ,
              yaw: (node as HTMLElement).dataset.screenYaw,
            })),
          ),
        previewNodePreserved: await iframe.evaluate(
          (node, original) => node === original,
          iframeHandle,
        ),
        previewValue: await frame.getByLabel("Preview state").inputValue(),
        zoom: await room.getAttribute("data-camera-zoom"),
      },
      null,
      2,
    ),
  );
  // Actual context loss returns the mounted surfaces to accessible HUD mode.
  await page.keyboard.press("Alt+Digit1");
  await expect(screen("director")).toHaveAttribute(
    "data-screen-mode",
    "spatial",
  );
  await page.locator('canvas[data-scene-id="world-room"]').evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension)
      throw new Error("Context loss extension unavailable for fallback proof");
    extension.loseContext();
  });
  await expect(room).toHaveAttribute("data-renderer", "semantic");
  for (const id of ["director", "workbench", "preview"]) {
    await expect(screen(id)).toHaveAttribute("data-screen-mode", "hud");
    await expect(screen(id).locator(".world-screen__toggle")).toBeDisabled();
  }
  expect(
    await iframe.evaluate((node, original) => node === original, iframeHandle),
  ).toBe(true);
}

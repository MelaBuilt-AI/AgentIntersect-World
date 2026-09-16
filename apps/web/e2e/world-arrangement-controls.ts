import { expect, type Page, type TestInfo } from "@playwright/test";
import {
  calculateWorldCameraPose,
  projectWorldPointToViewport,
} from "../../../packages/renderer-r3f/src/world-room-imported-canvas.js";

export async function exerciseArrangementControls(
  page: Page,
  testInfo: TestInfo,
) {
  page.setDefaultTimeout(10000);
  // Keep the real prop exposed below the normal preview HUD on Linux fonts.
  // Resize the viewport instead of forcing clicks through or hiding that panel.
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addStyleTag({
    content: ".world-room, .world-room * { font-family: monospace; }",
  });
  const room = page.locator("main.world-room");
  await expect(room).toHaveAttribute("data-repository-readiness", "ready", {
    timeout: 30000,
  });
  const panel = page.locator('[data-world-screen="director"]');
  const palette = panel.getByRole("complementary", {
    name: "Project / Current Work",
  });
  await palette
    .getByRole("button", { name: "Arrange workspace", exact: true })
    .click();
  await room.focus();
  await page.keyboard.press("Alt+Digit1");
  await expect(panel).toHaveAttribute("data-screen-projected", "true");
  const objectSelect = palette.getByRole("combobox", {
    name: "Arrange object",
  });
  await objectSelect.click();
  const objectChoices = palette.getByRole("listbox", {
    name: "Arrange object",
  });
  await expect(objectChoices).toBeVisible();
  await expect(
    objectChoices.getByRole("option", {
      name: "Codex completed the request",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    objectChoices.getByRole("option", {
      name: "Mr Fluff completed the request",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("object-options.png") });
  await objectSelect.press("Escape");
  await expect(objectChoices).toBeHidden();
  await palette.getByText("Visual-only props", { exact: true }).click();
  const category = palette.getByRole("combobox", {
    name: "Category",
    exact: true,
  });
  await category.click();
  const choices = palette.getByRole("listbox", {
    name: "Category",
    exact: true,
  });
  await expect(choices).toBeVisible();
  // Real choices are descendants of the clipped, transformed screen, not OS popups.
  expect(
    await choices.evaluate((element) => {
      const panel = element.closest(".world-screen__object")!;
      const box = element.getBoundingClientRect(),
        outer = panel.getBoundingClientRect();
      return box.left >= outer.left - 1 && box.right <= outer.right + 1;
    }),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("category-options.png") });
  await choices.getByRole("option", { name: "code", exact: true }).click();
  await expect(category).toContainText("code");
  const handle = panel.getByRole("button", {
    name: "Move Project / Current Work screen",
  });
  expect(
    await handle.evaluate((element) => {
      const title = element
        .querySelector(".world-screen__title")!
        .getBoundingClientRect();
      const hint = element
        .querySelector(".world-screen__move-hint")!
        .getBoundingClientRect();
      const rotate = element.querySelector("small")!.getBoundingClientRect();
      return title.right <= hint.left && hint.right <= rotate.left;
    }),
  ).toBe(true);
  // Return to HUD to keep the prop's actual mesh exposed while manipulating it.
  await room.focus();
  await page.keyboard.press("Alt+Digit1");
  await palette.getByLabel("Search assets").fill("Code Slab");
  await palette
    .getByRole("button", { name: "Place prop", exact: true })
    .click();
  const detail = palette.getByRole("region", {
    name: "Selected object details",
  });
  await expect(detail).toContainText("Visual-only prop");
  await detail.getByRole("button", { name: "Focus", exact: true }).click();
  const canvas = page.locator('canvas[data-scene-id="world-room"]');
  await expect(canvas).toHaveAttribute("data-camera-focus", "repository-city");
  // A new GLB enters from below the floor; pick its final position only once
  // the renderer has reported materialization complete, not merely selection.
  await expect(detail).toHaveAttribute("data-object-lifecycle", "idle");
  const original = {
    x: Number(await detail.getAttribute("data-object-x")),
    z: Number(await detail.getAttribute("data-object-z")),
  };
  const bounds = (await canvas.boundingBox())!;
  const pick = projectWorldPointToViewport({
    // The lower face remains exposed below the normal World View HUD.
    point: [original.x, 0.1, original.z],
    camera: calculateWorldCameraPose({
      userPosition: original,
      camera: {
        yaw: Number(await room.getAttribute("data-camera-yaw")),
        pitch: Number(await room.getAttribute("data-camera-pitch")),
        zoom: Number(await room.getAttribute("data-camera-zoom")),
      },
      viewportAspect: bounds.width / bounds.height,
    }),
    viewport: bounds,
    fovDegrees: 46,
  });
  const hit = await page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return {
        isCanvasHost: Boolean(element?.closest(".world-room__canvas-host")),
        tag: element?.tagName,
        className: element?.className,
        rectangle: element?.getBoundingClientRect().toJSON(),
      };
    },
    { x: bounds.x + pick.x, y: bounds.y + pick.y },
  );
  await page.screenshot({ path: testInfo.outputPath("prop-pick.png") });
  expect(hit.isCanvasHost, JSON.stringify({ bounds, pick, hit })).toBe(true);
  await page.mouse.move(bounds.x + pick.x, bounds.y + pick.y);
  await page.mouse.down();
  await expect(room).toHaveAttribute("data-prop-dragging", "true");
  const zoom = await room.getAttribute("data-camera-zoom");
  await page.mouse.move(bounds.x + pick.x + 80, bounds.y + pick.y + 25, {
    steps: 8,
  });
  await expect
    .poll(async () => Number(await detail.getAttribute("data-object-x")))
    .not.toBe(original.x);
  await page.mouse.wheel(0, 240);
  await expect
    .poll(async () => Number(await detail.getAttribute("data-object-yaw")))
    .not.toBe(0);
  expect(await room.getAttribute("data-camera-zoom")).toBe(zoom);
  await page.mouse.up();
  await expect(room).toHaveAttribute("data-prop-dragging", "false");
  const placed = await detail.getAttribute("data-object-x");
  await page.mouse.move(bounds.x + pick.x + 140, bounds.y + pick.y + 30);
  expect(await detail.getAttribute("data-object-x")).toBe(placed);
  await page.screenshot({ path: testInfo.outputPath("prop-placed.png") });
}

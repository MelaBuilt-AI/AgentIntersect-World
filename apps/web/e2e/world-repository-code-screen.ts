import { expect, type Page, type TestInfo } from "@playwright/test";
import { REPOSITORY_ASSET_BY_ID } from "@agentintersect-world/renderer-r3f";
import {
  calculateWorldCameraPose,
  projectWorldPointToViewport,
} from "../../../packages/renderer-r3f/src/world-room-canvas.js";

export async function exerciseRepositoryCodeScreen(
  page: Page,
  testInfo: TestInfo,
) {
  page.setDefaultTimeout(10_000);
  const content = Array.from(
    { length: 200 },
    (_, line) => `export const line${line + 1} = "code-screen-${line + 1}";`,
  ).join("\n");
  await page.route("**/api/repository-code?**", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    await route.fulfill({
      json: {
        data: {
          objectRef: query.get("objectRef"),
          repositoryRef: query.get("repositoryRef"),
          path: "apps/web/src/world-entry/WorldRoom.tsx",
          kind: "file",
          content,
          files: [],
          message: "Current working-file contents · read only",
        },
      },
    });
  });
  const room = page.locator("main.world-room");
  const canvas = page.locator('canvas[data-scene-id="world-room"]');
  await expect(room).toHaveAttribute("data-repository-readiness", "ready", {
    timeout: 30_000,
  });
  await expect(canvas).toBeVisible();
  // First prove the keyboard-equivalent object selection, then actual mesh input.
  await page
    .getByRole("button", { name: "Inspect code: WorldRoom.tsx", exact: true })
    .press("Enter");
  const panel = page.locator('[data-world-screen="code"]');
  await expect(panel).toHaveAttribute("data-screen-mode", "spatial");
  await expect(panel).toContainText("code-screen-1");
  await expect(panel).toHaveAttribute("data-screen-projected", "true");
  const objectId = await panel
    .locator("section")
    .getAttribute("data-code-object");
  const objectPosition = {
    x: Number(await panel.getAttribute("data-screen-x")),
    z:
      Number(await panel.getAttribute("data-screen-z")) -
      REPOSITORY_ASSET_BY_ID.get("01-code-slab")!.footprint[1] / 2 -
      1,
  };
  await panel.getByRole("button", { name: "Close code", exact: true }).click();
  await expect(panel).toHaveCount(0);
  const bounds = (await canvas.boundingBox())!;
  const pick = projectWorldPointToViewport({
    point: [objectPosition.x, 0.6, objectPosition.z],
    camera: calculateWorldCameraPose({
      userPosition: objectPosition,
      camera: { yaw: 0, pitch: 0, zoom: 1 },
      viewportAspect: bounds.width / bounds.height,
    }),
    viewport: bounds,
    fovDegrees: 46,
  });
  await page.mouse.click(bounds.x + pick.x, bounds.y + pick.y);
  await expect(panel.locator("section")).toHaveAttribute(
    "data-code-object",
    objectId!,
  );
  await expect(panel).toHaveAttribute("data-screen-projected", "true");
  await page.screenshot({
    path: testInfo.outputPath("repository-code-open.png"),
  });
  const viewport = panel.getByRole("region", { name: "Source code viewport" });
  const handle = await viewport.elementHandle();
  const unfocusedWidth = (await viewport.boundingBox())!.width;
  await viewport.click();
  await expect(panel.locator("section")).toHaveAttribute(
    "data-code-focused",
    "true",
  );
  await expect
    .poll(async () => (await viewport.boundingBox())!.width)
    .toBeGreaterThan(unfocusedWidth * 1.2);
  await viewport.hover();
  const zoom = await room.getAttribute("data-camera-zoom");
  const position = await room.getAttribute("data-user-position-z");
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(200);
  const top = await viewport.evaluate((element) => element.scrollTop);
  await viewport.press("w");
  await expect(room).toHaveAttribute("data-user-position-z", position!);
  await expect(room).toHaveAttribute("data-camera-zoom", zoom!);
  const pose = await panel.getAttribute("data-screen-z");
  await page.keyboard.press("Alt+Digit4");
  await expect(
    page.getByRole("dialog", { name: "Repository code" }),
  ).toBeVisible();
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBe(top);
  await expect(panel.locator("section")).toHaveCSS("position", "fixed");
  await viewport.hover();
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(top);
  const fullscreenTop = await viewport.evaluate((element) => element.scrollTop);
  await page.screenshot({
    path: testInfo.outputPath("repository-code-fullscreen.png"),
  });
  await page.keyboard.press("Alt+Digit4");
  await expect(panel).toHaveAttribute("data-screen-mode", "spatial");
  await expect(panel).toHaveAttribute("data-screen-z", pose!);
  expect(
    await viewport.evaluate(
      (element, original) => element === original,
      handle,
    ),
  ).toBe(true);
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBe(fullscreenTop);
  await page.screenshot({
    path: testInfo.outputPath("repository-code-spatial.png"),
  });
  await page.keyboard.press("Escape");
  await expect(panel.locator("section")).toHaveAttribute(
    "data-code-focused",
    "false",
  );
  await expect(page.getByRole("dialog", { name: "World menu" })).toHaveCount(0);
  await panel.getByRole("button", { name: "Close code", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(
    page.getByRole("complementary", { name: "Repository assets" }),
  ).toBeVisible();
}

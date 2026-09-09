import { writeFileSync } from "node:fs";
import { expect, type Page, type TestInfo } from "@playwright/test";
import {
  calculateWorldCameraPose,
  projectWorldPointToViewport,
} from "../../../packages/renderer-r3f/src/world-room-imported-canvas.js";

export async function exerciseRepositoryCodeScreen(
  page: Page,
  testInfo: TestInfo,
  exerciseOcclusion = false,
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
  let openingYaw = Number(await room.getAttribute("data-camera-yaw"));
  const openingPitch = await room.getAttribute("data-camera-pitch");
  await page.evaluate(() => {
    const samples: number[] = [];
    Object.assign(window, { codeRevealSamples: samples });
    new MutationObserver((records) => {
      for (const record of records) {
        const element = record.target as HTMLElement;
        if (element.dataset.worldScreen === "code")
          samples.push(Number(element.dataset.screenReveal));
      }
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-screen-reveal"],
    });
  });
  // First prove the keyboard-equivalent object selection, then actual mesh input.
  await page
    .getByRole("button", { name: "Inspect code: WorldRoom.tsx", exact: true })
    .press("Enter");
  const panel = page.locator('[data-world-screen="code"]');
  await expect(panel).toHaveAttribute("data-screen-mode", "spatial");
  await expect(panel).toContainText("code-screen-1");
  await expect(panel).toHaveAttribute("data-screen-projected", "true");
  await expect(panel).toHaveAttribute("data-screen-reveal", "1.000");
  expect(Number(await panel.getAttribute("data-screen-yaw"))).toBeCloseTo(
    -openingYaw,
  );
  await expect(room).toHaveAttribute("data-camera-pitch", openingPitch!);
  expect(Number(await room.getAttribute("data-camera-yaw"))).toBe(openingYaw);
  const revealSamples = await page.evaluate(
    () =>
      (window as unknown as { codeRevealSamples: number[] }).codeRevealSamples,
  );
  expect(revealSamples.every((value) => value === 1)).toBe(true);
  writeFileSync(
    testInfo.outputPath("code-reveal-reduced-motion.json"),
    JSON.stringify(revealSamples),
  );
  const objectId = await panel
    .locator("section")
    .getAttribute("data-code-object");
  const objectPosition = {
    x: Number(await panel.getAttribute("data-screen-x")),
    z: Number(await panel.getAttribute("data-screen-z")),
  };
  await page.screenshot({
    path: testInfo.outputPath("repository-keyboard-open.png"),
  });
  // Keyboard inspection can select an object outside the current camera frustum.
  // Fullscreen is the accessible way to reach it without snapping the camera.
  await page.keyboard.press("Alt+Digit4");
  await panel.getByRole("button", { name: "Close code", exact: true }).click();
  await expect(panel).toHaveCount(0);
  const behind = page.locator('[data-world-screen="director"]');
  if (exerciseOcclusion) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page
      .getByRole("button", { name: /Place Live \/ Director in World/ })
      .click();
    await expect(behind).toHaveAttribute("data-screen-mode", "spatial");
    const mover = behind.getByRole("button", {
      name: "Move Live / Director screen",
    });
    await mover.focus();
    for (const [attribute, target, positive, negative] of [
      ["data-screen-x", objectPosition.x, "ArrowRight", "ArrowLeft"],
      ["data-screen-z", objectPosition.z - 2, "ArrowDown", "ArrowUp"],
    ] as const) {
      for (let step = 0; step < 180; step++) {
        const delta = target - Number(await behind.getAttribute(attribute));
        if (Math.abs(delta) < 0.13) break;
        await page.keyboard.press(delta > 0 ? positive : negative);
      }
    }
  }
  const bounds = (await canvas.boundingBox())!;
  const pick = projectWorldPointToViewport({
    point: [objectPosition.x, 0.6, objectPosition.z],
    camera: calculateWorldCameraPose({
      userPosition: {
        x: Number(await room.getAttribute("data-user-position-x")),
        z: Number(await room.getAttribute("data-user-position-z")),
      },
      camera: {
        yaw: openingYaw,
        pitch: Number(openingPitch),
        zoom: Number(await room.getAttribute("data-camera-zoom")),
      },
      viewportAspect: bounds.width / bounds.height,
    }),
    viewport: bounds,
    fovDegrees: 46,
  });
  await page.mouse.click(bounds.x + pick.x, bounds.y + pick.y);
  // A new object inspection starts spatially, even after closing fullscreen.
  await expect(panel).toHaveAttribute("data-screen-mode", "spatial");
  await expect(panel.locator("section")).toHaveAttribute(
    "data-code-object",
    objectId!,
  );
  await expect(panel).toHaveAttribute("data-screen-projected", "true");
  expect(Number(await panel.getAttribute("data-screen-yaw"))).toBeCloseTo(
    -openingYaw,
  );
  await page.screenshot({
    path: testInfo.outputPath("repository-code-open.png"),
  });
  if (exerciseOcclusion) {
    const assertCodeOverlap = async (name: string) => {
      await expect(panel.locator(".world-screen__object")).toHaveCSS(
        "transform-style",
        "flat",
      );
      expect(
        await panel.evaluate((node) => Number(getComputedStyle(node).zIndex)),
      ).toBeGreaterThan(
        await behind.evaluate((node) => Number(getComputedStyle(node).zIndex)),
      );
      const overlap = await page.evaluate(() => {
        const code = document.querySelector(
          '[data-world-screen="code"] .repository-code-screen',
        )!;
        const rear = document.querySelector(
          '[data-world-screen="director"] .world-screen__object',
        )!;
        const a = code.getBoundingClientRect(),
          b = rear.getBoundingClientRect();
        const left = Math.max(a.left, b.left),
          right = Math.min(a.right, b.right);
        const top = Math.max(a.top, b.top),
          bottom = Math.min(a.bottom, b.bottom);
        return {
          width: right - left,
          height: bottom - top,
          topScreen: document
            .elementFromPoint((left + right) / 2, (top + bottom) / 2)
            ?.closest("[data-world-screen]")
            ?.getAttribute("data-world-screen"),
        };
      });
      expect(overlap.width).toBeGreaterThan(30);
      expect(overlap.height).toBeGreaterThan(30);
      expect(overlap.topScreen).toBe("code");
      await page.screenshot({ path: testInfo.outputPath(name) });
    };
    await assertCodeOverlap("code-opaque-over-rear-screen.png");
    const originalX = Number(await room.getAttribute("data-user-position-x"));
    await room.focus();
    await page.keyboard.down("d");
    try {
      await expect
        .poll(async () =>
          Number(await room.getAttribute("data-user-position-x")),
        )
        .toBeGreaterThan(originalX + 0.8);
    } finally {
      await page.keyboard.up("d");
    }
    await assertCodeOverlap("code-opaque-oblique.png");
    return;
  }
  const viewport = panel.getByRole("region", { name: "Source code viewport" });
  const handle = await viewport.elementHandle();
  const unfocusedWidth = (await viewport.boundingBox())!.width;
  const { openCodeWheel } = await import("./world-code-wheel.js");
  await openCodeWheel(page);
  await viewport.click();
  await expect(panel.locator("section")).toHaveAttribute(
    "data-code-focused",
    "true",
  );
  await expect
    .poll(async () => (await viewport.boundingBox())!.width)
    .toBeGreaterThan(unfocusedWidth * 1.2);
  expect(
    await panel.evaluate((element) => Number(getComputedStyle(element).zIndex)),
  ).toBeGreaterThan(12);
  await expect(
    page.getByRole("group", { name: "Code Wheel", exact: true }),
  ).toHaveCount(1);
  const overlap = await viewport.evaluate((element) => {
    const a = element.getBoundingClientRect();
    const b = document.querySelector(".code-wheel")!.getBoundingClientRect();
    const x = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2;
    const y = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;
    return {
      intersects:
        Math.max(a.left, b.left) < Math.min(a.right, b.right) &&
        Math.max(a.top, b.top) < Math.min(a.bottom, b.bottom),
      codeOnTop: element.contains(document.elementFromPoint(x, y)),
    };
  });
  expect(overlap).toEqual({ intersects: true, codeOnTop: true });
  await page.screenshot({
    path: testInfo.outputPath("focused-code-unoccluded.png"),
  });
  for (let sample = 0; sample < 4; sample += 1) {
    const after = await page.evaluate(() => performance.now() + 1050);
    await page.waitForFunction(
      (deadline) => performance.now() >= deadline,
      after,
    );
    await page.screenshot({
      path: testInfo.outputPath(`focused-sky-held-${sample}.png`),
    });
  }
  const wheel = page.getByRole("group", { name: "Code Wheel", exact: true });
  const roomBox = (await room.boundingBox())!;
  await page.mouse.click(roomBox.x + 10, roomBox.y + 10, { button: "middle" });
  await expect(wheel).toHaveCount(0);
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
  // Changing the actual view while open must not turn this into a billboard.
  await page.mouse.move(720, 610);
  await page.mouse.down({ button: "right" });
  await expect(room).toHaveAttribute("data-mouse-look", "active");
  await expect
    .poll(() => canvas.evaluate((node) => document.pointerLockElement === node))
    .toBe(true);
  await page.mouse.move(680, 610, { steps: 5 });
  await page.mouse.up({ button: "right" });
  await expect
    .poll(async () => Number(await room.getAttribute("data-camera-yaw")))
    .not.toBe(openingYaw);
  expect(Number(await panel.getAttribute("data-screen-yaw"))).toBeCloseTo(
    -openingYaw,
  );
  openingYaw = Number(await room.getAttribute("data-camera-yaw"));
  await page.keyboard.press("Alt+Digit4");
  await panel.getByRole("button", { name: "Close code", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(canvas).toHaveAttribute("data-render-loop", "continuous");
  await page.evaluate(() => {
    (
      window as unknown as { codeRevealSamples: number[] }
    ).codeRevealSamples.length = 0;
  });
  await page
    .getByRole("button", { name: "Inspect code: WorldRoom.tsx", exact: true })
    .press("Enter");
  await expect(panel).toHaveAttribute("data-screen-mode", "spatial");
  expect(Number(await panel.getAttribute("data-screen-yaw"))).toBeCloseTo(
    -openingYaw,
  );
  await expect(panel).toHaveAttribute("data-screen-reveal", "1.000");
  const animatedSamples = await page.evaluate(
    () =>
      (window as unknown as { codeRevealSamples: number[] }).codeRevealSamples,
  );
  expect(animatedSamples.some((value) => value > 0 && value < 1)).toBe(true);
  writeFileSync(
    testInfo.outputPath("code-reveal-animated.json"),
    JSON.stringify(animatedSamples),
  );
  await page.keyboard.press("Alt+Digit4");
  await panel.getByRole("button", { name: "Close code", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(
    page.getByRole("complementary", { name: "Repository assets" }),
  ).toBeVisible();
}

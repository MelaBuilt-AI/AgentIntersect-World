import { writeFileSync } from "node:fs";
import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

async function exposedFooterPoint(handle: Locator) {
  let point: { x: number; y: number } | undefined;
  await expect
    .poll(
      async () => {
        point = await handle.evaluate((element) => {
          const box = element.getBoundingClientRect();
          // A CSS3D footer is a sloped quadrilateral, not its horizontal AABB midline.
          const fractions = Array.from(
            { length: 19 },
            (_, i) => (i + 1) / 20,
          ).sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5));
          for (const fy of fractions)
            for (const fx of fractions) {
              const x = box.x + box.width * fx,
                y = box.y + box.height * fy;
              const hit = document.elementFromPoint(x, y);
              if (hit && element.contains(hit)) return { x, y };
            }
        });
        return point;
      },
      { message: "The projected footer must expose a real pointer target" },
    )
    .toBeDefined();
  return point!;
}

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
  const cameraBeforeUndock = await room.evaluate((element) => ({
    yaw: element.getAttribute("data-camera-yaw"),
    pitch: element.getAttribute("data-camera-pitch"),
    zoom: element.getAttribute("data-camera-zoom"),
    x: element.getAttribute("data-user-position-x"),
    z: element.getAttribute("data-user-position-z"),
  }));
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
  // Wait for real render frames: an effect must not move the camera after spawn.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(
    await room.evaluate((element) => ({
      yaw: element.getAttribute("data-camera-yaw"),
      pitch: element.getAttribute("data-camera-pitch"),
      zoom: element.getAttribute("data-camera-zoom"),
      x: element.getAttribute("data-user-position-x"),
      z: element.getAttribute("data-user-position-z"),
    })),
  ).toEqual(cameraBeforeUndock);
  await expect(palette.getByLabel("Search assets")).toHaveValue("code");
  await page.screenshot({ path: testInfo.outputPath("director-undocked.png") });
  // Exercise the shared decorative-emitter boundary while its World hit is
  // exposed, before other panels can legitimately cover it. All three footers
  // are still drag-tested below with the complete spatial composition present.
  {
    const id = "director";
    const panel = screen(id);
    // The decorative floor emitter has no drag authority.
    const readEmitter = () =>
      panel.evaluate((element) => {
        const x = Number((element as HTMLElement).dataset.baseClientX);
        const y = Number((element as HTMLElement).dataset.baseClientY);
        // A moved panel can overlay another emitter. Test the World hit target,
        // not a different panel's legitimately draggable footer above it.
        return [0, 12, 24, 36]
          .map((offset) => ({ x, y: y + offset }))
          .find((point) => {
            if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
              return false;
            const hit = document.elementFromPoint(point.x, point.y);
            return (
              (hit?.tagName === "CANVAS" || hit?.matches(".world-room")) &&
              !!hit.closest(".world-room") &&
              !hit.closest(".world-screen__object")
            );
          });
      });
    let emitter: { x: number; y: number } | undefined;
    try {
      await expect
        .poll(async () => {
          emitter = await readEmitter();
          return emitter;
        })
        .toBeDefined();
    } catch (error) {
      await testInfo.attach(`emitter-${id}`, {
        contentType: "application/json",
        body: JSON.stringify(
          await panel.evaluate((element) => {
            const x = Number((element as HTMLElement).dataset.baseClientX),
              y = Number((element as HTMLElement).dataset.baseClientY);
            return {
              dataset: { ...(element as HTMLElement).dataset },
              points: [0, 12, 24, 36].map((offset) => ({
                x,
                y: y + offset,
                target: document
                  .elementFromPoint(x, y + offset)
                  ?.outerHTML.slice(0, 500),
              })),
            };
          }),
        ),
      });
      await page.screenshot({
        path: testInfo.outputPath(`emitter-blocked-${id}.png`),
      });
      throw error;
    }
    expect(emitter).toBeDefined();
    await page.mouse.move(emitter!.x, emitter!.y);
    await page.mouse.down();
    await expect(panel).toHaveAttribute("data-screen-dragging", "false");
    // A hold/move is not a click on a repository object beneath the light.
    await page.mouse.move(emitter!.x + 12, emitter!.y, { steps: 3 });
    await page.mouse.up();
    await expect(page.locator('[data-world-screen="code"]')).toHaveCount(0);
  }
  await palette.getByRole("button", { name: "Director", exact: true }).click();
  await expect(room).toHaveAttribute("data-repository-city-mode", "director");
  await palette.getByRole("button", { name: "Live", exact: true }).click();
  await page.keyboard.press("Alt+Digit1");
  await expect(screen("director")).toHaveAttribute("data-screen-mode", "hud");
  await palette.locator(".world-screen__toggle").click();
  await room.focus();
  // This crowded camera view cannot fit Workbench without covering hints or
  // another panel. Verify refusal, then clear optional HUD clutter via real UI.
  await page.keyboard.press("Alt+Digit2");
  await expect(screen("workbench")).toHaveAttribute("data-screen-mode", "hud");
  const roomBounds = (await room.boundingBox())!;
  const wheelPoint = {
    x: roomBounds.x + roomBounds.width * 0.25,
    y: roomBounds.y + roomBounds.height * 0.55,
  };
  await page.mouse.click(wheelPoint.x, wheelPoint.y, { button: "middle" });
  await expect(page.locator(".code-wheel__message")).toContainText(
    "No clear screen space nearby",
  );
  await page.screenshot({
    path: testInfo.outputPath("crowded-placement-refusal.png"),
  });
  await page.mouse.click(wheelPoint.x, wheelPoint.y, { button: "middle" });
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "World menu", exact: true })
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const settings = page.getByRole("dialog", {
    name: "World settings",
    exact: true,
  });
  await settings.getByLabel("Show World control hints").uncheck();
  await settings
    .getByRole("button", { name: "Close World menu", exact: true })
    .click();
  await expect(
    room.getByRole("status", { name: "World controls", exact: true }),
  ).toHaveCount(0);
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
  const spawnBounds = await Promise.all(
    ["director", "workbench", "preview"].map(async (id) => ({
      id,
      box: await screen(id)
        .locator(".world-screen__object")
        .evaluate((element) => element.getBoundingClientRect().toJSON()),
    })),
  );
  const controlHints = room.getByRole("status", {
    name: "World controls",
    exact: true,
  });
  if (await controlHints.isVisible()) {
    spawnBounds.push({
      id: "World controls",
      box: await controlHints.evaluate((element) =>
        element.getBoundingClientRect().toJSON(),
      ),
    });
  }
  const spawnOverlaps = spawnBounds.flatMap((a, i) =>
    spawnBounds
      .slice(i + 1)
      .filter(
        (b) =>
          Math.min(a.box.right, b.box.right) -
            Math.max(a.box.left, b.box.left) >
            1 &&
          Math.min(a.box.bottom, b.box.bottom) -
            Math.max(a.box.top, b.box.top) >
            1,
      )
      .map((b) => `${a.id}/${b.id}`),
  );
  await testInfo.attach("initial-screen-bounds", {
    contentType: "application/json",
    body: JSON.stringify({
      spawnBounds,
      spawnOverlaps,
    }),
  });
  await page.screenshot({
    path: testInfo.outputPath("initial-screen-placement.png"),
  });
  expect(
    spawnOverlaps,
    "New screens must not spawn over existing on-screen panels",
  ).toEqual([]);
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
    const handle = panel.locator(".world-screen__base");
    await expect(handle).toContainText("Hold here to move");
    const grab = await exposedFooterPoint(handle);
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
  const escapeGrab = await exposedFooterPoint(grab);
  await page.mouse.move(escapeGrab.x, escapeGrab.y);
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
  // The movement authority and renderer must share the same expanding floor.
  const canvas = page.locator('canvas[data-scene-id="world-room"]');
  await room.focus();
  await page.keyboard.down("Shift");
  await page.keyboard.down("d");
  try {
    await expect
      .poll(
        async () => Number(await room.getAttribute("data-user-position-x")),
        { timeout: 12_000 },
      )
      .toBeGreaterThan(38);
  } finally {
    await page.keyboard.up("d");
    await page.keyboard.up("Shift");
  }
  await expect(canvas).toHaveAttribute(
    "data-user-position",
    `${await room.getAttribute("data-user-position-x")},${await room.getAttribute("data-user-position-z")}`,
  );
  const expandedFloor = Number(
    await room.getAttribute("data-world-floor-size"),
  );
  expect(expandedFloor).toBeGreaterThan(68);
  await expect(canvas).toHaveAttribute(
    "data-world-floor-size",
    String(expandedFloor),
  );
  await page.keyboard.down("Shift");
  await page.keyboard.down("a");
  try {
    await expect
      .poll(
        async () => Number(await room.getAttribute("data-user-position-x")),
        { timeout: 12_000 },
      )
      .toBeLessThan(5);
  } finally {
    await page.keyboard.up("a");
    await page.keyboard.up("Shift");
  }
  await expect(room).toHaveAttribute(
    "data-world-floor-size",
    String(expandedFloor),
  );

  await page.keyboard.press("Alt+Digit1");
  const motion = () =>
    page.evaluate(() => {
      const data = document.querySelector<HTMLCanvasElement>(
        'canvas[data-scene-id="world-room"]',
      )!.dataset;
      return {
        floor: data.floorTextureOffset,
        screen: data.screenTextureOffset,
        sky: data.skyRotation,
        flow: data.skyFlowTime,
      };
    });
  const reduced = await motion();
  await page.waitForTimeout(400);
  expect(await motion()).toEqual(reduced);
  const resumeStarted = Date.now();
  const resumeSamples: unknown[] = [];
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    resumeSamples.push({
      event: "media-applied",
      elapsedMs: Date.now() - resumeStarted,
    });
    await expect
      .poll(async () => {
        resumeSamples.push({
          event: "poll-start",
          elapsedMs: Date.now() - resumeStarted,
        });
        // One browser call: avoid resolving/adopting/disposing an element handle
        // between frames of this already-mounted canvas. Keep the 5s deadline.
        const sample = await page.evaluate(() => {
          const data = document.querySelector<HTMLCanvasElement>(
            'canvas[data-scene-id="world-room"]',
          )!.dataset;
          return {
            flow: data.skyFlowTime,
            floor: data.floorTextureOffset,
            screen: data.screenTextureOffset,
            renderLoopMode: data.renderLoopMode,
            texturesReady: data.worldTexturesReady,
            reducedMotion: matchMedia("(prefers-reduced-motion: reduce)")
              .matches,
            visibility: document.visibilityState,
            browserTimeMs: performance.now(),
          };
        });
        resumeSamples.push({
          event: "poll-result",
          elapsedMs: Date.now() - resumeStarted,
          ...sample,
        });
        return sample.flow;
      })
      .not.toBe(reduced.flow);
  } finally {
    const evidence = {
      baseline: reduced,
      elapsedMs: Date.now() - resumeStarted,
      samples: resumeSamples,
    };
    writeFileSync(
      testInfo.outputPath("motion-resume.json"),
      JSON.stringify(evidence, null, 2),
    );
    console.info("Motion resume:", JSON.stringify(evidence));
  }
  const movingBefore = await motion();
  await page.screenshot({
    path: testInfo.outputPath("code-motion-before.png"),
  });
  await expect
    .poll(async () => Number((await motion()).flow), { timeout: 8_000 })
    .toBeGreaterThan(Number(movingBefore.flow) + 2);
  const movingAfter = await motion();
  expect(movingAfter.floor).not.toBe(movingBefore.floor);
  expect(movingAfter.screen).not.toBe(movingBefore.screen);
  expect(movingAfter.sky).toBe(movingBefore.sky);
  await expect(canvas).toHaveAttribute("data-sky-layers", "rain,aurora,nebula");
  await page.screenshot({ path: testInfo.outputPath("code-motion-after.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Await React's preference transition before taking the held-state baseline.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const paused = await motion();
  await page.waitForTimeout(500);
  expect(await motion()).toEqual(paused);
  writeFileSync(
    testInfo.outputPath("code-world-motion-navigation.json"),
    JSON.stringify(
      {
        expandedFloor,
        movingBefore,
        movingAfter,
        reduced,
        paused,
      },
      null,
      2,
    ),
  );
  await page.keyboard.press("Alt+Digit1");
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

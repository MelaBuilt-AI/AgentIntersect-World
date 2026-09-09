import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

export async function verifyActivityCloud(
  page: Page,
  sourceBubble: Locator,
  testInfo: TestInfo,
) {
  // Isolated presentation sample of the real DOM/styles. Native activity polling
  // legitimately replaces text on the original, so never race that owner.
  await sourceBubble.evaluate((node) => {
    const sample = node.cloneNode(true) as HTMLElement;
    sample.dataset.cloudSizing = "true";
    sample.style.maskImage = "none";
    node.parentElement!.append(sample);
    (node as HTMLElement).style.opacity = "0";
  });
  const bubble = page.locator('[data-cloud-sizing="true"]');
  await expect(bubble).toHaveCSS("font-size", "14px");
  await expect(bubble).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(bubble).toHaveCSS("pointer-events", "none");
  await expect(bubble).toHaveCSS("font-family", /Consolas/);
  await expect(bubble.locator(".world-activity-cloud__face")).toHaveCSS(
    "background-color",
    "rgba(255, 255, 255, 0.6)",
  );
  await expect(bubble).toHaveCSS("opacity", "1");
  await expect(bubble.locator(".world-activity-cloud__content")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(bubble.locator(".world-activity-cloud__bezel")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(bubble.locator(".world-activity-cloud__bezel")).toHaveCSS(
    "mask-composite",
    "exclude, exclude",
  );
  const tile = await page.request.get(
    "/assets/code-world/activity-cloud-rain.webp",
  );
  expect(tile.ok()).toBe(true);
  expect((await tile.body()).byteLength).toBeLessThan(20_000);
  const cloud = bubble.locator(".world-activity-cloud");
  const text = bubble.locator(".world-activity-cloud__text");
  const original = await text.textContent();
  const sizes = [];
  for (const message of [
    "terminal",
    "Checking homepage 🍅✨",
    "Checking the homepage heading and validating the updated website 🍅 ✅",
  ]) {
    // Presentation-only sizing probe on the actual mounted cloud, not native output.
    await text.evaluate((node, value) => {
      node.textContent = value;
    }, message);
    await expect
      .poll(async () =>
        bubble.evaluate((node) => {
          const outer = node.getBoundingClientRect();
          const content = node.querySelector(".world-activity-cloud__content")!;
          const text = node.querySelector(".world-activity-cloud__text")!;
          const r = text.getBoundingClientRect();
          return (
            Math.abs((r.left + r.right) / 2 - (outer.left + outer.right) / 2) <
              1 &&
            content.scrollWidth <= content.clientWidth + 1 &&
            text.scrollHeight <= text.clientHeight + 1
          );
        }),
      )
      .toBe(true);
    const box = (await bubble.boundingBox())!;
    // DOMRect subtraction after fractional camera projection can add a few
    // floating-point ulps; allow less than one CSS layout unit, not extra room.
    expect(box.width).toBeLessThanOrEqual(260 + 1 / 64);
    expect(box.height).toBeLessThanOrEqual(170);
    expect(box.x).toBeGreaterThanOrEqual(8);
    sizes.push({ message, width: box.width, height: box.height });
    await page.screenshot({
      path: testInfo.outputPath(`cloud-${sizes.length}.png`),
    });
  }
  expect(sizes[0]!.width).toBeLessThan(240);
  expect(sizes[2]!.height).toBeGreaterThan(sizes[0]!.height);
  await text.evaluate((node, value) => {
    node.textContent = value;
  }, original);
  // Deterministic rendered motion, not a "playing" label or a single still.
  const samples = [];
  for (const time of [0, 2400]) {
    samples.push(
      await cloud.evaluate((node, time) => {
        for (const animation of node.getAnimations({ subtree: true })) {
          animation.pause();
          animation.currentTime = time;
        }
        return {
          float: getComputedStyle(node).transform,
          rain: getComputedStyle(
            node.querySelector(".world-activity-cloud__rain")!,
          ).transform,
        };
      }, time),
    );
    await page.screenshot({
      path: testInfo.outputPath(`cloud-motion-${time}.png`),
    });
  }
  expect(samples[0]!.float).not.toBe(samples[1]!.float);
  expect(samples[0]!.rain).not.toBe(samples[1]!.rain);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(cloud).toHaveCSS("animation-name", "none");
  await expect(bubble.locator(".world-activity-cloud__rain")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(cloud).toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await cloud.evaluate((node) =>
    node
      .getAnimations({ subtree: true })
      .forEach((animation) => animation.play()),
  );
  await bubble.evaluate((node) => node.remove());
  await sourceBubble.evaluate((node) => {
    (node as HTMLElement).style.opacity = "1";
  });
  const room = page.locator("main.world-room");
  await room.focus();
  await page.keyboard.press("Alt+Digit2");
  const screen = page.locator('[data-world-screen="workbench"]');
  await expect(screen).toHaveAttribute("data-screen-mode", "spatial");
  await expect(screen).toHaveAttribute("data-screen-projected", "true");
  await expect(sourceBubble).toHaveCSS("mask-image", /polygon/);
  await page.screenshot({
    path: testInfo.outputPath("cloud-spatial-initial.png"),
  });
  await testInfo.attach("cloud-spatial-initial", {
    body: JSON.stringify(
      await page.evaluate(() => ({
        cloud: document.querySelector<HTMLElement>(".world-activity-bubble")
          ?.style.cssText,
        screen: document.querySelector<HTMLElement>(
          '[data-world-screen="workbench"]',
        )?.dataset,
      })),
    ),
    contentType: "application/json",
  });
  // Rotate the held actual screen: its opaque back must cut the same cloud.
  const rotatingFooter = screen.getByRole("button", {
    name: "Move Workbench screen",
  });
  const initialYaw = Number(await screen.getAttribute("data-screen-yaw"));
  await rotatingFooter.hover();
  await page.mouse.down();
  try {
    await expect(screen).toHaveAttribute("data-screen-dragging", "true");
    // Oblique front: retain overlap at the upper/side bezel, not just the face.
    await page.mouse.wheel(0, 100);
    await expect
      .poll(async () => Number(await screen.getAttribute("data-screen-yaw")))
      .toBeCloseTo(initialYaw + 0.25, 3);
    await expect(sourceBubble).toHaveCSS("mask-image", /polygon/);
    await page.screenshot({
      path: testInfo.outputPath("cloud-bezel-front-oblique.png"),
    });
    await page.mouse.wheel(0, -100);
    await page.mouse.wheel(0, Math.PI / 0.0025);
    await expect(screen).toHaveAttribute("data-screen-projected", "false");
    await expect(sourceBubble).toHaveCSS("mask-image", /polygon/);
    await page.screenshot({
      path: testInfo.outputPath("cloud-screen-back-nearer.png"),
    });
    const backYaw = Number(await screen.getAttribute("data-screen-yaw"));
    await page.mouse.wheel(0, 100);
    await expect
      .poll(async () => {
        const yaw = Number(await screen.getAttribute("data-screen-yaw"));
        return Math.atan2(Math.sin(yaw - backYaw), Math.cos(yaw - backYaw));
      })
      .toBeCloseTo(0.25, 3);
    await expect(screen).toHaveAttribute("data-screen-projected", "false");
    await expect(sourceBubble).toHaveCSS("mask-image", /polygon/);
    await page.screenshot({
      path: testInfo.outputPath("cloud-bezel-back-oblique.png"),
    });
    await page.mouse.wheel(0, -100);
    await page.mouse.wheel(0, -Math.PI / 0.0025);
    await expect(screen).toHaveAttribute("data-screen-projected", "true");
  } finally {
    await page.mouse.up();
  }
  // Move the real screen past the distant agent using its ordinary footer.
  // This exercises pose updates and depth reversal without touching agent state.
  const footer = screen.getByRole("button", { name: "Move Workbench screen" });
  await footer.focus();
  for (let step = 0; step < 140; step++) await page.keyboard.press("ArrowUp");
  // Keep visible overlap in the reverse case, not just absence of a mask.
  const object = screen.locator(".world-screen__object");
  for (let step = 0; step < 100; step++) {
    const [s, c] = await Promise.all([
      object.boundingBox(),
      sourceBubble.boundingBox(),
    ]);
    if (s && c && s.x + s.width / 2 >= c.x + c.width / 2) break;
    await page.keyboard.press("ArrowRight");
  }
  const s = (await object.boundingBox())!;
  const c = (await sourceBubble.boundingBox())!;
  expect(
    Math.min(s.x + s.width, c.x + c.width) - Math.max(s.x, c.x),
  ).toBeGreaterThan(30);
  expect(
    Math.min(s.y + s.height, c.y + c.height) - Math.max(s.y, c.y),
  ).toBeGreaterThan(20);
  await expect(screen).toHaveAttribute("data-screen-projected", "true");
  await expect(sourceBubble).toHaveCSS("mask-image", "none");
  await page.screenshot({
    path: testInfo.outputPath("cloud-screen-farther.png"),
  });
  await room.focus();
  await page.keyboard.press("Alt+Digit2");
  await expect(screen).toHaveAttribute("data-screen-mode", "hud");
  await expect(sourceBubble).toHaveCSS("mask-image", "none");
  await testInfo.attach("cloud-sizing-and-motion", {
    body: JSON.stringify({ sizes, samples }),
    contentType: "application/json",
  });
}

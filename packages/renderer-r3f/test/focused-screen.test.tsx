import { expect, it, vi } from "vitest";
import { PerspectiveCamera } from "three";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import type { WorldScreenBinding } from "../src/world-screen-types.js";
const frames = vi.hoisted(
  () =>
    [] as {
      callback: (state?: unknown, delta?: number) => void;
      priority: number;
    }[],
);
const state = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useEffect: () => {},
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => state.value,
  useFrame: (
    callback: (state?: unknown, delta?: number) => void,
    priority = 0,
  ) => frames.push({ callback, priority }),
}));
vi.mock("../src/code-world-texture.js", () => ({ useCodeTexture: () => null }));
import { WorldScreens } from "../src/world-screens.js";

it("shows intermediate reveal frames even when the first render is delayed", () => {
  frames.length = 0;
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 1000);
  camera.updateMatrixWorld();
  const element = () => ({ style: {}, dataset: {}, inert: false });
  const screen = {
    id: "code",
    spatial: true,
    width: 880,
    height: 480,
    pose: { x: 0, y: 2.6, z: -18, yaw: 0 },
    revealStartedAt: 0,
    reducedMotion: false,
    viewport: element(),
    cameraElement: element(),
    element: element(),
  } as unknown as WorldScreenBinding;
  const screens = [screen];
  state.value = {
    camera,
    size: { width: 1440, height: 900 },
    invalidate: vi.fn(),
    gl: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
  };
  const now = vi.spyOn(performance, "now").mockReturnValue(1000);
  try {
    WorldScreens({ screens });
    const tick = (delta: number) =>
      frames.forEach(({ callback }) => callback(undefined, delta));
    tick(1);
    expect(Number(screen.viewport.dataset.screenReveal)).toBe(0);
    now.mockReturnValue(3000);
    tick(2);
    const intermediate = Number(screen.viewport.dataset.screenReveal);
    expect(intermediate).toBeGreaterThan(0);
    expect(intermediate).toBeLessThan(1);
    // Re-registration for focus must not restart the same opening.
    screens[0] = { ...screen, focused: true };
    tick(0.1);
    expect(Number(screen.viewport.dataset.screenReveal)).toBeGreaterThan(
      intermediate,
    );
    for (let frame = 0; frame < 6; frame++) tick(0.1);
    expect(screen.viewport.dataset.screenReveal).toBe("1.000");
    screens[0] = { ...screen, revealStartedAt: 3000, reducedMotion: true };
    tick(1);
    expect(screen.viewport.dataset.screenReveal).toBe("1.000");
  } finally {
    now.mockRestore();
  }
});

it("ranks overlapping ordinary screens without rounded-distance ties", () => {
  frames.length = 0;
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 1000);
  camera.updateMatrixWorld();
  const element = () => ({ style: {}, dataset: {}, inert: false });
  const screens = [-18, -22, -24].map(
    (z, i) =>
      ({
        id: ["code", "workbench", "preview"][i],
        spatial: true,
        width: 880,
        height: 480,
        pose: { x: 0, y: 2.6, z, yaw: 0 },
        viewport: element(),
        cameraElement: element(),
        element: element(),
      }) as unknown as WorldScreenBinding,
  );
  state.value = {
    camera,
    size: { width: 1440, height: 900 },
    invalidate: vi.fn(),
    gl: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
  };
  WorldScreens({ screens });
  frames.forEach(({ callback }) => callback());
  expect(Number(screens[0]!.viewport.style.zIndex)).toBeGreaterThan(
    Number(screens[1]!.viewport.style.zIndex),
  );
  expect(Number(screens[1]!.viewport.style.zIndex)).toBeGreaterThan(
    Number(screens[2]!.viewport.style.zIndex),
  );
  screens[0]!.pose = { ...screens[0]!.pose, z: -30 };
  frames.forEach(({ callback }) => callback());
  expect(Number(screens[0]!.viewport.style.zIndex)).toBeLessThan(
    Number(screens[2]!.viewport.style.zIndex),
  );
});

it("frames focused code before sky sampling and lifts it above scene occluders", () => {
  frames.length = 0;
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 1000);
  const element = () => ({ style: {}, dataset: {}, inert: false });
  const screen = {
    id: "code",
    spatial: true,
    focused: true,
    movable: false,
    width: 880,
    height: 480,
    pose: { x: 2, y: 3.7, z: -6, yaw: 0 },
    viewport: element(),
    cameraElement: element(),
    element: element(),
  } as unknown as WorldScreenBinding;
  state.value = {
    camera,
    size: { width: 1440, height: 900 },
    invalidate: vi.fn(),
    gl: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
  };
  WorldScreens({ screens: [screen] });
  let skyPosition = camera.position.clone();
  frames.unshift({
    priority: 0,
    callback: () => {
      skyPosition = camera.position.clone();
    },
  });
  for (let tick = 0; tick < 4; tick++) {
    camera.position.set(0, 2, 8); // an unrelated status render updates the normal camera
    for (const frame of [...frames].sort((a, b) => a.priority - b.priority))
      frame.callback();
    expect(skyPosition.toArray()).toEqual(camera.position.toArray());
    expect(Number(screen.viewport.style.zIndex)).toBeGreaterThan(12); // open Code Wheel layer
  }
  expect(frames.some((frame) => frame.priority < 0)).toBe(true);
});

it("keeps all four ordinary screen ranks beneath visible cloud pixels", async () => {
  frames.length = 0;
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 1000);
  camera.updateMatrixWorld();
  const element = () => ({ style: {}, dataset: {}, inert: false });
  const screens = ["director", "workbench", "preview", "code"].map(
    (id, index) =>
      ({
        id,
        spatial: true,
        width: 880,
        height: 480,
        pose: { x: 0, y: 2.6, z: -18 - index * 2, yaw: 0 },
        viewport: element(),
        cameraElement: element(),
        element: element(),
      }) as unknown as WorldScreenBinding,
  );
  state.value = {
    camera,
    size: { width: 960, height: 600 },
    invalidate: vi.fn(),
    gl: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
  };
  WorldScreens({ screens });
  frames.forEach(({ callback }) => callback());
  const css = (
    await Promise.all(
      [
        "../../../apps/web/src/styles.css",
        "../../../apps/web/src/world-entry/world-activity-cloud.css",
      ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
    )
  ).join("\n");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 960, height: 600 },
      reducedMotion: "reduce",
    });
    // Composition fixture: actual projector ranks and stylesheet, representative
    // screen/cloud markup. Geometry masks have their separate front/back tests.
    await page.setContent(`<style>${css}</style>
      <main class="world-room" data-spatial-screens="true" style="width:960px;height:600px;position:relative">
        <div class="world-room__canvas-host" style="position:absolute;inset:0">
          <div class="world-activity-bubble" style="position:absolute;left:340px;top:210px;z-index:3;pointer-events:none">
            <div class="world-activity-cloud"><div class="world-activity-cloud__face"></div><div class="world-activity-cloud__content"><div class="world-activity-cloud__heading">Codex</div><div class="world-activity-cloud__text">Completed the homepage update</div></div></div>
          </div>
        </div>
        ${screens.map((screen) => `<div class="world-screen--spatial" data-world-screen="${screen.id}" style="z-index:${screen.viewport.style.zIndex}"><div style="position:absolute;left:250px;top:150px;width:420px;height:260px;background:#071322;border:4px solid cyan;color:white;padding:24px">${screen.id === "director" ? "Project / Current Work" : screen.id}</div></div>`).join("")}
      </main>`);
    const bubble = page.locator(".world-activity-bubble");
    const out =
      process.env.AIW_TEST_EVIDENCE_DIR ??
      `/tmp/aiw-cloud-layers-${process.pid}`;
    await mkdir(out, { recursive: true });
    await page.screenshot({ path: `${out}/four-screen-cloud.png` });
    const box = (await bubble.boundingBox())!;
    const visible = await page.screenshot({ clip: box });
    await bubble.evaluate((node) => {
      (node as HTMLElement).style.visibility = "hidden";
    });
    const hidden = await page.screenshot({ clip: box });
    expect(
      visible.equals(hidden),
      "nearer cloud must paint over the Project / Current Work screen",
    ).toBe(false);
    const canvasLayer = await page
      .locator(".world-room__canvas-host")
      .evaluate((node) => Number(getComputedStyle(node).zIndex));
    for (const screen of screens)
      expect(Number(screen.viewport.style.zIndex)).toBeLessThan(canvasLayer);
    // Focus is deliberately above scene clouds; ordinary depth ranking must not
    // lift the canvas over focused code or the open Code Wheel (layer 12).
    expect(canvasLayer).toBeLessThan(12);
  } finally {
    await browser.close();
  }
}, 20000);

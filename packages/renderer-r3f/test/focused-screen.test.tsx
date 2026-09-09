import { expect, it, vi } from "vitest";
import { PerspectiveCamera } from "three";
import type { WorldScreenBinding } from "../src/world-screen-types.js";
const frames = vi.hoisted(
  () => [] as { callback: () => void; priority: number }[],
);
const state = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useEffect: () => {},
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => state.value,
  useFrame: (callback: () => void, priority = 0) =>
    frames.push({ callback, priority }),
}));
vi.mock("../src/code-world-texture.js", () => ({ useCodeTexture: () => null }));
import { WorldScreens } from "../src/world-screens.js";

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

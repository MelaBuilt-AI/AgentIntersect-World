import { afterEach, expect, it, vi } from "vitest";
import { PerspectiveCamera } from "three";
import type { WorldScreenBinding } from "../src/world-screen-types.js";
const state = vi.hoisted(() => ({
  frames: [] as ((state: unknown) => void)[],
  cleanups: [] as (() => void)[],
  children: [] as HTMLElement[],
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => (() => void) | undefined) => {
    const cleanup = effect();
    if (cleanup) state.cleanups.push(cleanup);
  },
}));
vi.mock("@react-three/fiber", () => ({
  Canvas: () => null,
  useThree: () => ({
    invalidate: vi.fn(),
    gl: {
      domElement: {
        parentElement: {
          append: (element: HTMLElement) => state.children.push(element),
        },
      },
    },
  }),
  useFrame: (callback: (state: unknown) => void) => state.frames.push(callback),
}));
import { AgentActivityBillboard as standard } from "../src/world-room-canvas.js";
import { AgentActivityBillboard as imported } from "../src/world-room-imported-canvas.js";
afterEach(() => vi.unstubAllGlobals());
for (const [name, render] of [
  ["standard", standard],
  ["imported", imported],
] as const) {
  it(`${name} renders crisp DOM text independent of distance and framebuffer DPR`, () => {
    state.frames = [];
    state.cleanups = [];
    state.children = [];
    vi.stubGlobal("document", {
      createElement: () => ({
        style: {},
        dataset: {},
        children: [] as unknown[],
        textContent: "",
        className: "",
        getContext: () => null,
        setAttribute: vi.fn(),
        remove: vi.fn(),
        append(...children: unknown[]) {
          this.children.push(...children);
        },
      }),
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    const pose = { x: 0, z: 4, yaw: 0 };
    const screen = {
      id: "workbench",
      spatial: true,
      pose,
      width: 500,
      height: 1200,
    } as WorldScreenBinding;
    render({
      screens: [screen],
      activity: {
        state: "thinking",
        icon: "…",
        label: "Thinking",
        detail: "",
        progressText: "Checking the homepage heading",
      },
      reducedMotion: true,
      position: [0, 0, 0],
    });
    expect(state.children).toHaveLength(1);
    const bubble = state.children[0]!;
    expect(bubble.className).toBe("world-activity-bubble");
    expect(bubble.dataset.animated).toBe("false");
    const cloud = bubble.children[0]! as HTMLElement;
    expect(cloud.className).toBe("world-activity-cloud");
    const content = cloud.children[2]! as HTMLElement;
    expect(content.className).toBe("world-activity-cloud__content");
    expect(content.children[1]!.textContent).toBe(
      "Checking the homepage heading",
    );
    expect(bubble.style.pointerEvents).toBe("none");
    const camera = new PerspectiveCamera(46, 16 / 9, 0.1, 1000);
    for (const distance of [8, 30, 60]) {
      camera.position.z = distance;
      camera.updateMatrixWorld();
      state.frames.forEach((frame) =>
        frame({
          camera,
          size: { width: 1920, height: 1080 },
          clock: { elapsedTime: 0 },
        }),
      );
      expect(bubble.style.visibility).toBe("visible");
      const coordinates = [
        ...bubble.style.transform.matchAll(/([\d.]+)px/g),
      ].map((match) => Number(match[1]));
      expect(coordinates).toHaveLength(2);
      expect(coordinates.every((value) => value >= 12)).toBe(true);
      expect(bubble.style.maxWidth).toBe("260px");
      expect(bubble.style.maskImage).toContain("polygon");
      pose.z = -4;
      state.frames.forEach((frame) =>
        frame({ camera, size: { width: 1920, height: 1080 } }),
      );
      expect(bubble.style.maskImage).toBe("none");
      pose.z = 4;
    }
    camera.position.z = -8;
    camera.updateMatrixWorld();
    state.frames.forEach((frame) =>
      frame({ camera, size: { width: 360, height: 640 } }),
    );
    expect(bubble.style.visibility).toBe("hidden");
    expect(bubble.dataset.visible).toBe("false");
    state.cleanups.forEach((cleanup) => cleanup());
    expect(bubble.remove).toHaveBeenCalledTimes(1);
  });
}

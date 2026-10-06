import { afterEach, expect, it, vi } from "vitest";
import { act, createRoot, unmountComponentAtNode } from "@react-three/fiber";
import { createWorldRenderer } from "../src/world-renderer.js";

// Exercise the installed reconciler's real canvas-unmount path. The GPU is a
// fixture: these counters prove ownership/disposal, not physical VRAM recovery.
const gpu = vi.hoisted(() => ({
  webgpu: true,
  renderers: [] as {
    dispose: ReturnType<typeof vi.fn>;
    forceContextLoss?: () => void;
  }[],
}));
vi.mock("three/webgpu", async () => {
  const actual = await vi.importActual("three/webgpu");
  return {
    ...actual,
    WebGPURenderer: class {
      library = { addLight: vi.fn() };
      shadowMap = { enabled: false, type: 0 };
      backend = { isWebGPUBackend: gpu.webgpu };
      domElement: HTMLCanvasElement;
      onDeviceLost = vi.fn();
      init = vi.fn(async () => {});
      dispose = vi.fn(async () => {});
      render = vi.fn();
      setSize = vi.fn();
      setPixelRatio = vi.fn();
      constructor({ canvas }: { canvas: HTMLCanvasElement }) {
        this.domElement = canvas;
        gpu.renderers.push(this);
      }
    },
  };
});
afterEach(() => {
  gpu.renderers = [];
  gpu.webgpu = true;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("releases each retired WebGPU renderer through real R3F canvas teardown", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  for (let session = 0; session < 3; session++) {
    gpu.webgpu = session !== 1;
    const canvas = { dataset: {} } as HTMLCanvasElement;
    const root = createRoot(canvas);
    await root.configure({
      gl: createWorldRenderer,
      frameloop: "never",
      dpr: 1,
      size: { width: 64, height: 64, top: 0, left: 0 },
    });
    await act(async () => {
      root.render(null);
    });
    const renderer = gpu.renderers.at(-1)!;
    expect(renderer.dispose).not.toHaveBeenCalled();
    await act(async () => {
      unmountComponentAtNode(canvas);
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(renderer.dispose).toHaveBeenCalledOnce();
    renderer.forceContextLoss?.();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  }
  expect(gpu.renderers).toHaveLength(3);
});

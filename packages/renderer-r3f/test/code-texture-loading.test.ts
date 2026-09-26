import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  ImageBitmapLoader,
  Texture,
  TextureLoader,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
const runtime = vi.hoisted(() => ({
  effects: [] as (() => (() => void) | undefined)[],
  set: vi.fn(),
  invalidate: vi.fn(),
  gl: {
    backend: { isWebGPUBackend: true },
    isWebGPURenderer: true,
    getMaxAnisotropy: () => 16,
  },
}));
vi.mock("react", () => ({
  useEffect: (effect: () => () => void) => runtime.effects.push(effect),
  useState: () => [null, runtime.set],
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => ({ gl: runtime.gl, invalidate: runtime.invalidate }),
  useFrame: () => {},
}));
import { useCodeTexture } from "../src/code-world-texture.js";
let complete: (bitmap: ImageBitmap) => void;
beforeEach(() => {
  runtime.effects = [];
  runtime.set.mockClear();
  runtime.invalidate.mockClear();
  vi.stubGlobal("createImageBitmap", vi.fn());
  vi.spyOn(ImageBitmapLoader.prototype, "load").mockImplementation(
    function (_url, onLoad) {
      complete = onLoad!;
      return this;
    },
  );
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("decodes the full-resolution code artwork before publishing it to WebGPU", () => {
  useCodeTexture("02_terminal_rain");
  const cleanup = runtime.effects[0]!();
  expect(ImageBitmapLoader.prototype.load).toHaveBeenCalledWith(
    "/assets/code-world/02_terminal_rain.webp",
    expect.any(Function),
  );
  expect(TextureLoader.prototype.load).not.toHaveBeenCalled();
  expect(runtime.set).not.toHaveBeenCalled();
  const bitmap = {
    width: 4096,
    height: 4096,
    close: vi.fn(),
  } as unknown as ImageBitmap;
  complete(bitmap);
  const texture = runtime.set.mock.calls[0]![0] as Texture;
  expect(texture.image).toBe(bitmap);
  expect(texture.colorSpace).toBe(SRGBColorSpace);
  expect(texture.wrapS).toBe(RepeatWrapping);
  expect(texture.wrapT).toBe(RepeatWrapping);
  expect(texture.anisotropy).toBe(8);
  cleanup!();
  expect(bitmap.close).toHaveBeenCalledOnce();
});
it("closes a decoded image arriving after unmount without publishing it", () => {
  useCodeTexture("02_terminal_rain");
  const cleanup = runtime.effects[0]!();
  expect(ImageBitmapLoader.prototype.load).toHaveBeenCalledOnce();
  cleanup!();
  const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  complete(bitmap);
  expect(bitmap.close).toHaveBeenCalledOnce();
  expect(runtime.set).not.toHaveBeenCalled();
});

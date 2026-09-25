import { afterEach, expect, it, vi } from "vitest";
import { Texture } from "three";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";
import { prepareEnvironmentTextures } from "../src/environment-resources.js";
afterEach(() => vi.unstubAllGlobals());
it("decodes WebGPU images asynchronously before the paced upload and releases the bitmap", async () => {
  class Image {}
  vi.stubGlobal("HTMLImageElement", Image);
  const blob = new Blob();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }),
  );
  const bitmap = { close: vi.fn() };
  let finish!: (value: unknown) => void;
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const texture = new Texture();
  Object.assign(texture, { image: new Image() });
  const upload = vi.fn();
  const pending = prepareEnvironmentTextures(
    { initTexture: upload, backend: { isWebGPUBackend: true } },
    {
      recipe: ENVIRONMENT_PRESETS[1]!.recipe!,
      textures: { "meadow-ground": texture },
      dispose() {},
    },
    () => true,
    async () => {},
  );
  await vi.waitFor(() => expect(createImageBitmap).toHaveBeenCalledOnce());
  expect(createImageBitmap).toHaveBeenCalledWith(blob, {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  expect(upload).not.toHaveBeenCalled();
  finish(bitmap);
  await pending;
  expect(texture.image).toBe(bitmap);
  expect(upload).toHaveBeenCalledWith(texture);
  texture.dispose();
  expect(bitmap.close).toHaveBeenCalledOnce();
});

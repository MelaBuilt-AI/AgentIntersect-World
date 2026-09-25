import {
  RepeatWrapping,
  ClampToEdgeWrapping,
  SRGBColorSpace,
  TextureLoader,
  LinearFilter,
  type Texture,
} from "three";
import {
  ENVIRONMENT_ASSETS,
  environmentAssetIds,
  type EnvironmentRecipe,
  type EnvironmentAssetId,
} from "@agentintersect-world/world-schema/environment";

export type EnvironmentResources = {
  readonly recipe: EnvironmentRecipe;
  readonly textures: Partial<Record<EnvironmentAssetId, Texture>>;
  readonly dispose: () => void;
  readonly grassCoverage?: Uint8Array;
};

export type EnvironmentPreparer = (
  resources: EnvironmentResources | null,
  current: () => boolean,
) => Promise<void>;

/** Spread first GPU uploads across frames while the previous World still renders. */
export async function prepareEnvironmentTextures(
  gl: {
    initTexture: (texture: Texture) => void;
    backend?: { isWebGPUBackend?: boolean };
  },
  resources: EnvironmentResources | null,
  current: () => boolean,
  frame: () => Promise<void> = () =>
    new Promise((resolve) => requestAnimationFrame(() => resolve())),
): Promise<void> {
  if (!resources) return; // Original stays mounted, including its decoded/GPU textures.
  for (const texture of new Set(Object.values(resources.textures))) {
    if (!texture || !current()) return;
    // HTML-image decode/conversion inside copyExternalImageToTexture can block
    // for an entire 4K upload. Prepare a decoded bitmap off the render turn.
    if (
      gl.backend?.isWebGPUBackend &&
      typeof createImageBitmap === "function" &&
      texture.image instanceof HTMLImageElement
    ) {
      // A bitmap made from an HTML image can itself synchronously copy/decode.
      // Blob decoding keeps that work off the render thread (served from cache).
      const response = await fetch(
        texture.image.currentSrc || texture.image.src,
      );
      if (!response.ok)
        throw new Error("Environment texture could not be prepared.");
      const bitmap = await createImageBitmap(await response.blob(), {
        premultiplyAlpha: "none",
        colorSpaceConversion: "none",
      });
      if (!current()) {
        bitmap.close();
        return;
      }
      texture.image = bitmap;
      texture.needsUpdate = true;
      texture.addEventListener("dispose", () => bitmap.close());
    }
    await frame();
    if (!current()) return;
    gl.initTexture(texture);
  }
  await frame();
}

/** No suspense, no global cache: one owned bundle, disposed on replacement. */
export async function loadEnvironmentResources(
  recipe: EnvironmentRecipe,
): Promise<EnvironmentResources> {
  const textures: Partial<Record<EnvironmentAssetId, Texture>> = {};
  const owned: Texture[] = [];
  const dispose = () => {
    for (const texture of owned) texture.dispose();
  };
  const loader = new TextureLoader();
  const results = await Promise.allSettled(
    environmentAssetIds(recipe).map(
      (id) =>
        new Promise<void>((resolve, reject) => {
          const texture = loader.load(
            ENVIRONMENT_ASSETS[id].src,
            (map) => {
              const asset = ENVIRONMENT_ASSETS[id];
              map.colorSpace = asset.role === "mask" ? "" : SRGBColorSpace;
              map.wrapS =
                "wrapS" in asset && !asset.wrapS
                  ? ClampToEdgeWrapping
                  : RepeatWrapping;
              map.wrapT = (
                "wrapT" in asset ? !asset.wrapT : asset.role !== "ground"
              )
                ? ClampToEdgeWrapping
                : RepeatWrapping;
              map.anisotropy = 4;
              if (asset.role === "fx") {
                map.generateMipmaps = false;
                map.minFilter = map.magFilter = LinearFilter;
              }
              textures[id] = map;
              resolve();
            },
            undefined,
            () =>
              reject(
                new Error(
                  `Could not load ${id}. Your previous World is unchanged.`,
                ),
              ),
          );
          owned.push(texture);
        }),
    ),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") {
    dispose();
    throw failed.reason;
  }
  if (/grass|moss|meadow/.test(recipe.ground.asset)) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      let bitmap: ImageBitmap | null = null;
      try {
        const image = textures[recipe.ground.asset]!.image;
        if (
          typeof createImageBitmap === "function" &&
          image instanceof HTMLImageElement
        ) {
          const response = await fetch(image.currentSrc || image.src);
          if (!response.ok) {
            throw new Error("Environment ground could not be prepared.");
          }
          bitmap = await createImageBitmap(await response.blob());
        }
        context.drawImage(bitmap ?? image, 0, 0, 32, 32);

        const pixels = context.getImageData(0, 0, 32, 32).data;
        const grassCoverage = new Uint8Array(32 * 32);
        for (let i = 0; i < grassCoverage.length; i++) {
          grassCoverage[i] =
            pixels[i * 4 + 1]! > pixels[i * 4]! * 1.04 &&
            pixels[i * 4 + 1]! > pixels[i * 4 + 2]! * 1.15
              ? 1
              : 0;
        }
        return { recipe, textures, dispose, grassCoverage };
      } catch (error) {
        dispose();
        throw error;
      } finally {
        bitmap?.close();
      }
    }
  }
  return { recipe, textures, dispose };
}

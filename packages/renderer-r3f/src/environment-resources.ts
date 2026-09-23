import {
  RepeatWrapping,
  ClampToEdgeWrapping,
  SRGBColorSpace,
  TextureLoader,
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
              map.colorSpace = SRGBColorSpace;
              map.wrapS = RepeatWrapping;
              map.wrapT =
                id === "mountain-horizon"
                  ? ClampToEdgeWrapping
                  : RepeatWrapping;
              map.anisotropy = 4;
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
  if (recipe.ground.asset === "meadow-ground") {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      context.drawImage(textures[recipe.ground.asset]!.image, 0, 0, 32, 32);
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
    }
  }
  return { recipe, textures, dispose };
}

import { z } from "zod";

import {
  ENVIRONMENT_ASSETS,
  ENVIRONMENT_AMBIENCE,
  type EnvironmentAssetId,
} from "./environment-assets.js";
export {
  ENVIRONMENT_ASSETS,
  ENVIRONMENT_AMBIENCE,
  type EnvironmentAssetId,
  type EnvironmentAmbience,
} from "./environment-assets.js";
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const layer = <T extends string>(assets: readonly [T, ...T[]]) =>
  z.strictObject({
    asset: z.enum(assets),
    tint: color,
    opacity: z.number().min(0).max(1),
    speed: z.number().min(-0.015).max(0.015),
  });
export const EnvironmentRecipeSchema = z.strictObject({
  schema: z.literal("aiw.environment/1"),
  name: z.string().trim().min(1).max(60),
  ground: z.strictObject({
    asset: z.enum(["meadow-ground", "mars-ground"]),
    tint: color,
    tileSize: z.number().min(4).max(60),
    roughness: z.number().min(0.5).max(1),
  }),
  sky: z.strictObject({
    background: layer(["day-sky", "space-sky"]),
    middle: layer(["mountain-horizon", "space-planets"]),
    foreground: layer(["day-clouds", "space-gas"]),
  }),
  lighting: z.strictObject({
    sky: color,
    ground: color,
    sun: color,
    intensity: z.number().min(0.1).max(3),
    ambient: z.number().min(0.1).max(2),
    sunVisible: z.boolean(),
    fog: color,
    fogFar: z.number().min(100).max(600),
  }),
  audio: z.strictObject({
    ambience: z.enum(ENVIRONMENT_AMBIENCE),
    gain: z.number().min(0).max(0.6),
  }),
});
export type EnvironmentRecipe = z.infer<typeof EnvironmentRecipeSchema>;
export type EnvironmentPreset = {
  readonly id: string;
  readonly name: string;
  readonly recipe: EnvironmentRecipe | null;
};
export const ENVIRONMENT_PRESETS: readonly EnvironmentPreset[] = [
  { id: "original", name: "Original World", recipe: null },
  {
    id: "sunlit",
    name: "Sunlit Trails",
    recipe: {
      schema: "aiw.environment/1",
      name: "Sunlit Trails",
      ground: {
        asset: "meadow-ground",
        tint: "#ffffff",
        tileSize: 24,
        roughness: 0.95,
      },
      sky: {
        background: {
          asset: "day-sky",
          tint: "#ffffff",
          opacity: 1,
          speed: 0.0002,
        },
        middle: {
          asset: "mountain-horizon",
          tint: "#ffffff",
          opacity: 1,
          speed: 0,
        },
        foreground: {
          asset: "day-clouds",
          tint: "#ffffff",
          opacity: 0.9,
          speed: 0.003,
        },
      },
      lighting: {
        sky: "#b9dcff",
        ground: "#a39369",
        sun: "#fff3ce",
        intensity: 2.4,
        ambient: 1.2,
        sunVisible: true,
        fog: "#c2dff4",
        fogFar: 350,
      },
      audio: { ambience: "blue-sky-sand-grass", gain: 0.38 },
    },
  },
  {
    id: "mars",
    name: "Martian Expanse",
    recipe: {
      schema: "aiw.environment/1",
      name: "Martian Expanse",
      ground: {
        asset: "mars-ground",
        tint: "#ffffff",
        tileSize: 18,
        roughness: 1,
      },
      sky: {
        background: {
          asset: "space-sky",
          tint: "#ffffff",
          opacity: 1,
          speed: 0.0001,
        },
        middle: {
          asset: "space-planets",
          tint: "#ffffff",
          opacity: 1,
          speed: 0,
        },
        foreground: {
          asset: "space-gas",
          tint: "#ffffff",
          opacity: 0.5,
          speed: -0.002,
        },
      },
      lighting: {
        sky: "#92a1d1",
        ground: "#9e492d",
        sun: "#ffd2ad",
        intensity: 1.5,
        ambient: 0.9,
        sunVisible: false,
        fog: "#28191f",
        fogFar: 450,
      },
      audio: { ambience: "mars-swirling-gases", gain: 0.38 },
    },
  },
];
export function environmentWordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}
export function environmentAssetIds(
  recipe: EnvironmentRecipe,
): EnvironmentAssetId[] {
  return [
    recipe.ground.asset,
    recipe.sky.background.asset,
    recipe.sky.middle.asset,
    recipe.sky.foreground.asset,
  ];
}
export const ENVIRONMENT_CAPABILITIES = {
  schema: "aiw.environment-capabilities/1",
  recipeSchema: "aiw.environment/1",
  maxDescriptionWords: 500,
  agentGeneration: "unavailable-until-restricted-connector",
  editable: [
    "ground",
    "sky.background",
    "sky.middle",
    "sky.foreground",
    "lighting",
    "audio",
  ],
  forbidden: [
    "code",
    "commands",
    "file paths",
    "remote URLs",
    "collision",
    "repository",
    "avatars",
  ],
  assets: ENVIRONMENT_ASSETS,
  ambience: ENVIRONMENT_AMBIENCE,
  limitation:
    "Ground images are precomposed. Independent materials/masks await the extension library.",
} as const;

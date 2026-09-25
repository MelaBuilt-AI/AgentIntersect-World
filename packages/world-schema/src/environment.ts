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
function roleIds(role: string): [EnvironmentAssetId, ...EnvironmentAssetId[]] {
  return Object.entries(ENVIRONMENT_ASSETS)
    .filter(([, asset]) => asset.role === role)
    .map(([id]) => id) as [EnvironmentAssetId, ...EnvironmentAssetId[]];
}
const groundIds = roleIds("ground");
export { ENVIRONMENT_FX } from "./environment-expansion.js";
export const WEATHER_PARTICLES = [
  "none",
  "light-rain",
  "heavy-rain",
  "snow",
  "ash",
  "sparkles",
  "wind",
  "leaves",
  "sand",
  "embers",
] as const;
export const EnvironmentWeatherSchema = z.strictObject({
  particles: z.enum(WEATHER_PARTICLES),
  intensity: z.number().min(0).max(1),
  wind: z.number().min(0).max(1),
  lightning: z.enum(["off", "distant", "local", "both"]),
  lightningInterval: z.number().min(8).max(60),
  flashes: z.boolean(),
  horizonLightning: z
    .strictObject({
      density: z.number().min(0).max(1),
      interval: z.number().min(2).max(12),
      elevation: z.number().min(0).max(20),
    })
    .optional(),
});
export type EnvironmentWeather = z.infer<typeof EnvironmentWeatherSchema>;
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
    asset: z.enum(groundIds),
    blend: z
      .strictObject({
        asset: z.enum(groundIds),
        mask: z.enum(roleIds("mask")),
        tint: color,
        tileSize: z.number().min(4).max(60),
        maskSize: z.number().min(8).max(120),
        amount: z.number().min(0).max(1),
      })
      .optional(),
    tint: color,
    tileSize: z.number().min(4).max(60),
    roughness: z.number().min(0.5).max(1),
  }),
  sky: z.strictObject({
    background: layer(roleIds("background")),
    middle: layer(roleIds("middle")),
    foreground: layer(roleIds("foreground")),
  }),
  celestial: z
    .array(
      z.strictObject({
        asset: z.enum(roleIds("celestial")),
        tint: color,
        opacity: z.number().min(0).max(1),
        azimuth: z.number().min(-180).max(180),
        elevation: z.number().min(5).max(85),
        size: z.number().min(5).max(90),
      }),
    )
    .max(3)
    .optional(),
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
  props: z
    .array(
      z.strictObject({
        asset: z.enum(roleIds("prop")),
        count: z.number().int().min(1).max(12),
        size: z.number().min(0.3).max(6),
      }),
    )
    .max(3)
    .optional(),
  weather: EnvironmentWeatherSchema.optional(),
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
    ...new Set([
      recipe.ground.asset,
      ...(recipe.ground.blend
        ? [recipe.ground.blend.asset, recipe.ground.blend.mask]
        : []),
      recipe.sky.background.asset,
      recipe.sky.middle.asset,
      recipe.sky.foreground.asset,
      ...(recipe.celestial ?? []).map((sprite) => sprite.asset),
      ...(recipe.props ?? []).map((prop) => prop.asset),
      ...(recipe.weather?.horizonLightning?.density
        ? ["fx_lightning_strike" as const]
        : []),
      ...(recipe.weather && recipe.weather.lightning !== "off"
        ? roleIds("fx").filter(
            (id) =>
              recipe.weather!.lightning !== "distant" ||
              id.startsWith("fx_lightning"),
          )
        : []),
    ]),
  ];
}
export const ENVIRONMENT_CAPABILITIES = {
  schema: "aiw.environment-capabilities/1",
  recipeSchema: "aiw.environment/1",
  maxDescriptionWords: 500,
  agentGeneration: "capability-negotiated-restricted-turn",
  editable: [
    "ground",
    "sky.background",
    "sky.middle",
    "sky.foreground",
    "lighting",
    "audio",
    "props",
    "weather",
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
  lightning:
    'For sky or skybox lightning: use lightning="distant" for animated bolts/arcs spread across the sky, with no nearby impacts. Use lightning="both" only when sky AND nearby ground strikes are requested; lightning="local" is nearby only. Weather intensity controls 3–8 sky bolts per burst as well as particle density. For many sky bolts choose intensity 0.8–1 and lightningInterval 8–12; for occasional lightning use longer intervals. flashes=true adds soft sky glows/local illumination. Static storm_clouds artwork or thunder ambience alone does not produce lightning. Honor explicit exclusions such as no ground strikes; do not inherit conflicting lightning from the current recipe. FX assets are automatically used by weather; do not put their IDs in sky layers.',
  horizonLightning:
    'For many smaller, quick distant bolts and surrounding glows just above mountains/horizon, add optional weather.horizonLightning:{density:0–1,interval:2–12,elevation:0–20}. Density controls 4–24 distributed regions; interval is seconds between flashes per region, independently staggered, not one synchronized sky burst. Elevation is degrees above the horizon; start near2 to sit just above the visible mountain silhouettes, adjust to the scene/prompt. For a busy storm use density0.8–1 and interval2–3; each small flash lasts about0.42seconds. This is ADDITIONAL to upper-sky lightning and local impacts: preserve weather.lightning and lightningInterval when asked to add this lower layer. For horizon-only lightning, set lightning="off" and include horizonLightning. Omit it or use density0 to disable only the new band. weather.flashes controls the surrounding glows. No local impact or extra thunder event is emitted for these distant flashes.',
  limitation:
    "Library ground materials blend with linear masks. Expanded props are decorative PNG cutouts, not meshes. Weather and lightning are cosmetic; no damage/collision/shelter simulation. Reduced Motion suppresses animated weather/strikes. Generated base art is upscaled, has supplier seam caveats; no PBR/displacement or arbitrary assets.",
} as const;

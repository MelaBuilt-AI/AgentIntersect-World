import {
  EnvironmentRecipeSchema,
  type EnvironmentRecipe,
  type EnvironmentWeather,
} from "@agentintersect-world/world-schema/environment";

export type EnvironmentChoices = {
  particles: "auto" | EnvironmentWeather["particles"];
  lightning: "auto" | EnvironmentWeather["lightning"];
  horizonLightning: "auto" | "off" | "on";
  horizonDensity: number;
  horizonInterval: number;
  horizonElevation: number;
  intensity: number;
  wind: number;
  lightningInterval: number;
  flashes: boolean;
  ground: string;
  horizon: string;
  prop: string;
  ambience: string;
};
export const DEFAULT_ENVIRONMENT_CHOICES: EnvironmentChoices = {
  particles: "auto",
  lightning: "auto",
  horizonLightning: "auto",
  horizonDensity: 0.7,
  horizonInterval: 4,
  horizonElevation: 2,
  intensity: 0.6,
  wind: 0.35,
  lightningInterval: 14,
  flashes: true,
  ground: "auto",
  horizon: "auto",
  prop: "auto",
  ambience: "auto",
};
export function environmentWeatherSummary(
  weather: EnvironmentWeather | undefined,
): string {
  const horizon = weather?.horizonLightning;
  return `${weather?.particles ?? "no particles"}; lightning ${weather?.lightning ?? "off"}${horizon?.density ? `; horizon lightning ${Math.round(horizon.density * 100)}%, ${horizon.interval}s per region, ${horizon.elevation}°` : ""}`;
}
export function applyEnvironmentChoices(
  recipe: EnvironmentRecipe,
  choices: EnvironmentChoices,
): EnvironmentRecipe {
  const explicitWeather =
    choices.particles !== "auto" || choices.lightning !== "auto";
  return EnvironmentRecipeSchema.parse({
    ...recipe,
    ground:
      choices.ground === "auto"
        ? recipe.ground
        : { ...recipe.ground, asset: choices.ground },
    sky:
      choices.horizon === "auto"
        ? recipe.sky
        : {
            ...recipe.sky,
            middle: {
              ...recipe.sky.middle,
              asset: choices.horizon,
              opacity: 1,
              speed: 0,
            },
          },
    ...(choices.prop === "auto"
      ? {}
      : {
          props:
            choices.prop === "none"
              ? []
              : [{ asset: choices.prop, count: 6, size: 2.2 }],
        }),
    audio:
      choices.ambience === "auto"
        ? recipe.audio
        : { ambience: choices.ambience, gain: 0.25 },
    ...(explicitWeather || choices.horizonLightning !== "auto"
      ? {
          weather: {
            particles:
              choices.particles === "auto"
                ? (recipe.weather?.particles ?? "none")
                : choices.particles,
            lightning:
              choices.lightning === "auto"
                ? (recipe.weather?.lightning ?? "off")
                : choices.lightning,
            intensity: explicitWeather
              ? choices.intensity
              : (recipe.weather?.intensity ?? choices.intensity),
            wind: explicitWeather
              ? choices.wind
              : (recipe.weather?.wind ?? choices.wind),
            lightningInterval: explicitWeather
              ? choices.lightningInterval
              : (recipe.weather?.lightningInterval ??
                choices.lightningInterval),
            flashes: explicitWeather
              ? choices.flashes
              : (recipe.weather?.flashes ?? choices.flashes),
            ...(choices.horizonLightning === "on"
              ? {
                  horizonLightning: {
                    density: choices.horizonDensity,
                    interval: choices.horizonInterval,
                    elevation: choices.horizonElevation,
                  },
                }
              : choices.horizonLightning === "auto" &&
                  recipe.weather?.horizonLightning
                ? { horizonLightning: recipe.weather.horizonLightning }
                : {}),
          },
        }
      : {}),
  });
}

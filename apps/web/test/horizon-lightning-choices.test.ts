import { expect, it } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";
import {
  applyEnvironmentChoices,
  DEFAULT_ENVIRONMENT_CHOICES,
  environmentWeatherSummary,
} from "../src/world-entry/environment-choices.js";
import { buildEnvironmentBrief } from "../src/world-entry/environment-authoring.js";
import { EnvironmentSettings } from "../src/world-entry/EnvironmentSettings.js";
import { renderToStaticMarkup } from "react-dom/server";

it("pins horizon lightning independently, preserves upper/local choices, and can remove only the new layer", () => {
  const recipe = {
    ...ENVIRONMENT_PRESETS[1]!.recipe!,
    weather: {
      particles: "heavy-rain" as const,
      intensity: 0.4,
      wind: 0.2,
      lightning: "both" as const,
      lightningInterval: 20,
      flashes: false,
    },
  };
  const added = applyEnvironmentChoices(recipe, {
    ...DEFAULT_ENVIRONMENT_CHOICES,
    horizonLightning: "on",
    horizonDensity: 0.9,
    horizonInterval: 3,
    horizonElevation: 14,
  });
  expect(typeof environmentWeatherSummary).toBe("function");
  expect(
    environmentWeatherSummary({ ...added.weather!, lightning: "off" }),
  ).toContain("horizon lightning 90%");
  expect(added.weather?.horizonLightning).toEqual({
    density: 0.9,
    interval: 3,
    elevation: 14,
  });
  expect({ ...added.weather, horizonLightning: undefined }).toEqual({
    ...recipe.weather,
    horizonLightning: undefined,
  });
  expect(applyEnvironmentChoices(added, DEFAULT_ENVIRONMENT_CHOICES)).toEqual(
    added,
  );
  const removed = applyEnvironmentChoices(added, {
    ...DEFAULT_ENVIRONMENT_CHOICES,
    horizonLightning: "off",
  });
  expect(removed.weather?.horizonLightning).toBeUndefined();
  expect(removed.weather?.lightning).toBe("both");
  expect(
    applyEnvironmentChoices(added, {
      ...DEFAULT_ENVIRONMENT_CHOICES,
      particles: "snow",
    }).weather?.horizonLightning,
  ).toEqual(added.weather?.horizonLightning);
  expect(
    buildEnvironmentBrief(
      "Many small fast bolts above mountains, keeping the higher lightning",
      recipe,
    ),
  ).toContain("horizonLightning");
});

it("exposes separate horizon settings without replacing the existing Lightning control", () => {
  const html = renderToStaticMarkup(
    EnvironmentSettings({
      value: DEFAULT_ENVIRONMENT_CHOICES,
      onChange: () => {},
    }),
  );
  expect(html).toContain('aria-label="Horizon lightning"');
  expect(html).toContain('aria-label="Lightning"');
  expect(html).toContain("Horizon bolt density");
  expect(html).toContain("Seconds between flashes in each region");
});

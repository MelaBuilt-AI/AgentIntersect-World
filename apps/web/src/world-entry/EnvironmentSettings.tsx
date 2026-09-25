import {
  ENVIRONMENT_ASSETS,
  ENVIRONMENT_AMBIENCE,
  WEATHER_PARTICLES,
} from "@agentintersect-world/world-schema/environment";
import type { EnvironmentChoices } from "./environment-choices.js";

const label = (value: string) =>
  value.replaceAll("_", " ").replaceAll("-", " ");
export function EnvironmentSettings({
  value,
  onChange,
}: {
  readonly value: EnvironmentChoices;
  readonly onChange: (value: EnvironmentChoices) => void;
}) {
  const change = <K extends keyof EnvironmentChoices>(
    key: K,
    next: EnvironmentChoices[K],
  ) => onChange({ ...value, [key]: next });
  const explicit = value.particles !== "auto" || value.lightning !== "auto";
  return (
    <details className="hack-world__settings">
      <summary>Weather and expanded scenery</summary>
      <p>
        Describe any combination for your agent, or pin choices here. These
        choices override its recipe and are included in your custom slot.
        Preview these settings below can adjust your current World without
        contacting an agent (Original uses Sunlit Trails as a starting point).
      </p>
      <label>
        Weather particles
        <select
          aria-label="Weather particles"
          value={value.particles}
          onChange={(e) =>
            change(
              "particles",
              e.target.value as EnvironmentChoices["particles"],
            )
          }
        >
          <option value="auto">From description / current recipe</option>
          {WEATHER_PARTICLES.map((id) => (
            <option key={id} value={id}>
              {id === "none" ? "Clear — no particles" : label(id)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Lightning
        <select
          aria-label="Lightning"
          value={value.lightning}
          onChange={(e) =>
            change(
              "lightning",
              e.target.value as EnvironmentChoices["lightning"],
            )
          }
        >
          <option value="auto">From description / current recipe</option>
          <option value="off">Off</option>
          <option value="distant">Sky-wide lightning bolts and arcs</option>
          <option value="local">Local ground strikes and impacts</option>
          <option value="both">Distant sky + local ground strikes</option>
        </select>
      </label>
      <details>
        <summary>Distant horizon lightning</summary>
        <label>
          Horizon lightning
          <select
            aria-label="Horizon lightning"
            value={value.horizonLightning}
            onChange={(e) =>
              change(
                "horizonLightning",
                e.target.value as EnvironmentChoices["horizonLightning"],
              )
            }
          >
            <option value="auto">From description / current recipe</option>
            <option value="off">
              Off — leave upper/local lightning unchanged
            </option>
            <option value="on">
              Add small distant bolts above the horizon
            </option>
          </select>
        </label>
        <label>
          Horizon bolt density — {Math.round(value.horizonDensity * 100)}%
          <input
            aria-label="Horizon bolt density"
            type="range"
            min="0"
            max="1"
            step="0.05"
            disabled={value.horizonLightning !== "on"}
            value={value.horizonDensity}
            onChange={(e) => change("horizonDensity", Number(e.target.value))}
          />
        </label>
        <label>
          Seconds between flashes in each region
          <input
            type="number"
            min="2"
            max="12"
            step="0.5"
            disabled={value.horizonLightning !== "on"}
            value={value.horizonInterval}
            onChange={(e) =>
              change(
                "horizonInterval",
                Math.max(2, Math.min(12, Number(e.target.value) || 4)),
              )
            }
          />
        </label>
        <label>
          Horizon bolt elevation — {value.horizonElevation}°
          <input
            aria-label="Horizon bolt elevation"
            type="range"
            min="0"
            max="20"
            step="1"
            disabled={value.horizonLightning !== "on"}
            value={value.horizonElevation}
            onChange={(e) => change("horizonElevation", Number(e.target.value))}
          />
        </label>
        <p>
          Small, independently staggered flashes above the distant landscape.
          This adds to upper-sky/local lightning, rather than replacing it.
          Reduced Motion suppresses all lightning.
        </p>
      </details>
      <label>
        Weather intensity — {Math.round(value.intensity * 100)}%
        <input
          aria-label="Weather intensity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          disabled={!explicit}
          value={value.intensity}
          onChange={(e) => change("intensity", Number(e.target.value))}
        />
      </label>
      <label>
        Wind strength — {Math.round(value.wind * 100)}%
        <input
          aria-label="Wind strength"
          type="range"
          min="0"
          max="1"
          step="0.05"
          disabled={!explicit}
          value={value.wind}
          onChange={(e) => change("wind", Number(e.target.value))}
        />
      </label>
      <label>
        Seconds between strikes / sky bursts
        <input
          type="number"
          min="8"
          max="60"
          disabled={!explicit}
          value={value.lightningInterval}
          onChange={(e) =>
            change(
              "lightningInterval",
              Math.max(8, Math.min(60, Number(e.target.value) || 14)),
            )
          }
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={value.flashes}
          disabled={!explicit}
          onChange={(e) => change("flashes", e.target.checked)}
        />{" "}
        Soft lightning illumination and sky flashes
      </label>
      <p>
        Cosmetic only: no damage or collision changes. Lightning uses animated
        flashes; Reduced Motion suppresses particles and strikes. Effects mute
        controls weather audio. No camera shake. Intensity also controls 3–8
        bolts per sky burst; choose sky-wide lightning for no nearby impacts.
      </p>
      {(
        [
          ["ground", "Ground texture", "ground"],
          ["horizon", "Horizon overlay", "middle"],
          ["prop", "Decorative cutout", "prop"],
        ] as const
      ).map(([key, title, role]) => (
        <label key={key}>
          {title}
          <select
            aria-label={title}
            value={value[key]}
            onChange={(e) => change(key, e.target.value)}
          >
            <option value="auto">From description / current recipe</option>
            {key === "prop" ? <option value="none">No cutouts</option> : null}
            {Object.entries(ENVIRONMENT_ASSETS)
              .filter(
                ([, a]) => a.role === role && a.src.includes("expansion-v2"),
              )
              .map(([id]) => (
                <option key={id} value={id}>
                  {label(id)}
                </option>
              ))}
          </select>
        </label>
      ))}
      <p>
        The supplied prop pictures are flat decorative cutouts, not 3D meshes.
      </p>
      <label>
        Environment ambience
        <select
          aria-label="Environment ambience"
          value={value.ambience}
          onChange={(e) => change("ambience", e.target.value)}
        >
          <option value="auto">From description / current recipe</option>
          {ENVIRONMENT_AMBIENCE.map((id) => (
            <option key={id} value={id}>
              {label(id)}
            </option>
          ))}
        </select>
      </label>
    </details>
  );
}

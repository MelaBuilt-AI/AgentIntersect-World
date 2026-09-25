import type { EnvironmentWeather } from "@agentintersect-world/world-schema/environment";
import type { AudioCue } from "./catalog.js";

/** Loaded only when a World actually enables weather; not part of entry/onboarding. */
export class EnvironmentWeatherAudio {
  #weather: EnvironmentWeather | null = null;
  #loopId: AudioCue | null = null;
  readonly #timers = new Set<ReturnType<typeof setTimeout>>();
  readonly #effects = new Set<HTMLAudioElement>();
  constructor(
    private readonly audio: {
      active: () => boolean;
      canCue: () => boolean;
      loop: (id: AudioCue, active: boolean, gain: number) => void;
      cue: (id: AudioCue) => HTMLAudioElement | undefined;
      release: (element: HTMLAudioElement) => void;
    },
  ) {}
  setWeather(weather: EnvironmentWeather | null) {
    this.stopEvents();
    this.#weather = weather;
    this.sync();
  }
  stopEvents() {
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers.clear();
    for (const effect of this.#effects) this.audio.release(effect);
    this.#effects.clear();
  }
  sync() {
    const weather = this.#weather;
    const id: AudioCue | null =
      !weather || !this.audio.active() || weather.intensity === 0
        ? null
        : weather.particles === "heavy-rain"
          ? "environment-rain_heavy_environment_loop"
          : weather.particles === "light-rain"
            ? "environment-rain_light_environment_loop"
            : weather.particles === "snow" ||
                weather.particles === "wind" ||
                weather.particles === "leaves"
              ? "environment-snowfield_sheltered_wind_loop"
              : weather.particles === "sand" || weather.particles === "ash"
                ? "environment-desert_soft_sand_loop"
                : null;
    if (this.#loopId && this.#loopId !== id)
      this.audio.loop(this.#loopId, false, 0);
    this.#loopId = id;
    if (id) this.audio.loop(id, true, 0.12 + (weather?.intensity ?? 0) * 0.16);
  }
  strike(strike: { local: boolean; variant: number }) {
    if (
      !this.audio.active() ||
      !this.audio.canCue() ||
      !this.#weather ||
      this.#weather.lightning === "off"
    )
      return;
    this.stopEvents();
    const play = (id: AudioCue, delay = 0) => {
      const cue = () => {
        if (!this.audio.active() || !this.audio.canCue()) return;
        const effect = this.audio.cue(id);
        if (effect) {
          this.#effects.add(effect);
          const remove = () => this.#effects.delete(effect);
          effect.addEventListener("ended", remove, { once: true });
          effect.addEventListener("error", remove, { once: true });
        }
      };
      if (!delay) {
        cue();
        return;
      }
      const timer = setTimeout(() => {
        this.#timers.delete(timer);
        cue();
      }, delay);
      this.#timers.add(timer);
    };
    if (strike.local) {
      play(
        (
          [
            "lightning_strike_dry_crack",
            "lightning_strike_branching_snap",
            "lightning_strike_air_tearing",
          ] as const
        )[strike.variant % 3]!,
      );
      play(
        (
          [
            "lightning_impact_sand_scorch",
            "lightning_impact_stone_sizzle",
            "lightning_impact_wet_earth",
          ] as const
        )[strike.variant % 3]!,
        200,
      );
      play(
        strike.variant % 2
          ? "lightning_scorch_steam_hiss"
          : "lightning_scorch_dry_sizzle",
        1200,
      );
      play("thunder_near_crack_roll", 550);
    } else
      play(
        strike.variant % 2
          ? "thunder_mid_distance_rolling"
          : "thunder_far_horizon_rumble",
        strike.variant % 2 ? 1500 : 3000,
      );
  }
}

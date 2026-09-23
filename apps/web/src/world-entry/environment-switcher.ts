import {
  ENVIRONMENT_PRESETS,
  type EnvironmentPreset,
  type EnvironmentRecipe,
} from "@agentintersect-world/world-schema/environment";
import type { EnvironmentResources } from "@agentintersect-world/renderer-r3f/environment";

type Snapshot = {
  active: EnvironmentPreset;
  resources: EnvironmentResources | null;
  phase: "idle" | "loading" | "out" | "in";
  error: string;
};
type Loader = (recipe: EnvironmentRecipe) => Promise<EnvironmentResources>;
export class EnvironmentSwitcher {
  #state: Snapshot = {
    active: ENVIRONMENT_PRESETS[0]!,
    resources: null,
    phase: "idle",
    error: "",
  };
  #listeners = new Set<() => void>();
  #timers: ReturnType<typeof setTimeout>[] = [];
  #owned = new Set<EnvironmentResources>();
  #disposed = false;
  constructor(
    private readonly load: Loader = async (recipe) =>
      (
        await import("@agentintersect-world/renderer-r3f/environment")
      ).loadEnvironmentResources(recipe),
  ) {}
  snapshot = () => this.#state;
  activate() {
    this.#disposed = false;
  }
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  #update(patch: Partial<Snapshot>) {
    this.#state = { ...this.#state, ...patch };
    this.#listeners.forEach((listener) => listener());
  }
  async select(preset: EnvironmentPreset, reducedMotion: boolean) {
    if (this.#disposed || this.#state.phase !== "idle") return;
    this.#update({ phase: "loading", error: "" });
    try {
      const next = preset.recipe ? await this.load(preset.recipe) : null;
      if (this.#disposed) {
        next?.dispose();
        return;
      }
      if (next) this.#owned.add(next);
      const previous = this.#state.resources;
      this.#update({ phase: "out" });
      this.#timers.push(
        setTimeout(
          () => {
            this.#update({ active: preset, resources: next, phase: "in" });
            this.#timers.push(
              setTimeout(
                () => {
                  if (previous) {
                    previous.dispose();
                    this.#owned.delete(previous);
                  }
                  this.#update({ phase: "idle" });
                },
                reducedMotion ? 200 : 650,
              ),
            );
          },
          reducedMotion ? 200 : 350,
        ),
      );
    } catch (error) {
      if (!this.#disposed)
        this.#update({
          phase: "idle",
          error:
            error instanceof Error
              ? error.message
              : "Environment could not load. Your World is unchanged.",
        });
    }
  }
  dispose() {
    this.#disposed = true;
    this.#timers.forEach(clearTimeout);
    this.#owned.forEach((resources) => resources.dispose());
    this.#owned.clear();
    this.#listeners.clear();
  }
}

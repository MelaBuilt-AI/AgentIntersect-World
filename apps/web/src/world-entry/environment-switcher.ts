import {
  ENVIRONMENT_PRESETS,
  EnvironmentRecipeSchema,
  type EnvironmentPreset,
  type EnvironmentRecipe,
} from "@agentintersect-world/world-schema/environment";
import type {
  EnvironmentResources,
  EnvironmentPreparer,
} from "@agentintersect-world/renderer-r3f/environment";
export type EnvironmentCeremony = {
  id: string;
  name: string;
  phase: "dance" | "bow";
};
export type EnvironmentPhase = "idle" | "generating" | "loading" | "out" | "in";
type Snapshot = {
  active: EnvironmentPreset;
  resources: EnvironmentResources | null;
  phase: EnvironmentPhase;
  error: string;
  ceremony: EnvironmentCeremony | null;
};
type Loader = (recipe: EnvironmentRecipe) => Promise<EnvironmentResources>;
export type EnvironmentGenerator = (
  description: string,
  current: EnvironmentRecipe | null,
  signal: AbortSignal,
) => Promise<{ recipe: EnvironmentRecipe; summary: string }>;

export class EnvironmentSwitcher {
  #state: Snapshot = {
    active: ENVIRONMENT_PRESETS[0]!,
    resources: null,
    phase: "idle",
    error: "",
    ceremony: null,
  };
  #listeners = new Set<() => void>();
  #timers: ReturnType<typeof setTimeout>[] = [];
  #owned = new Set<EnvironmentResources>();
  #disposed = false;
  #generation = 0;
  #abort: AbortController | null = null;
  #prepare: EnvironmentPreparer | null = null;
  setPrepare = (prepare: EnvironmentPreparer | null) => {
    this.#prepare = prepare;
  };
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
    if (this.#disposed || this.#state.phase !== "idle" || this.#state.ceremony)
      return;
    await this.#loadAndSwitch(preset, reducedMotion, ++this.#generation);
  }
  async create(
    actor: { id: string; name: string; bowMs: number },
    description: string,
    reducedMotion: boolean,
    generate: EnvironmentGenerator,
    onComplete: (summary: string, name: string) => void,
  ): Promise<EnvironmentPreset | null> {
    if (this.#disposed || this.#state.phase !== "idle" || this.#state.ceremony)
      return null;
    const generation = ++this.#generation;
    const controller = new AbortController();
    this.#abort = controller;
    this.#update({
      phase: "generating",
      error: "",
      ceremony: { id: actor.id, name: actor.name, phase: "dance" },
    });
    try {
      const proposal = await generate(
        description,
        this.#state.active.recipe,
        controller.signal,
      );
      if (this.#disposed || generation !== this.#generation) return null;
      const recipe = EnvironmentRecipeSchema.parse(proposal.recipe);
      const preset = {
        id: `generated-${generation}`,
        name: recipe.name,
        recipe,
        originalDescription: description,
      };
      const loaded = await this.#loadAndSwitch(
        preset,
        reducedMotion,
        generation,
        () => {
          this.#abort = null;
          this.#update({
            ceremony: { id: actor.id, name: actor.name, phase: "bow" },
          });
          onComplete(proposal.summary, actor.name);
          this.#timers.push(
            setTimeout(
              () => this.#update({ ceremony: null }),
              reducedMotion
                ? 1800
                : Math.max(1000, Math.min(actor.bowMs, 15000)),
            ),
          );
        },
      );
      return loaded ? preset : null;
    } catch (error) {
      if (!this.#disposed && generation === this.#generation)
        this.#update({
          phase: "idle",
          ceremony: null,
          error:
            error instanceof Error
              ? error.message
              : "Creation failed. Your World is unchanged.",
        });
      return null;
    }
  }
  cancelCreation() {
    if (!this.#state.ceremony || this.#state.ceremony.phase === "bow") return;
    this.#generation++;
    this.#abort?.abort();
    this.#abort = null;
    this.#timers.forEach(clearTimeout);
    this.#timers = [];
    for (const resource of this.#owned)
      if (resource !== this.#state.resources) {
        resource.dispose();
        this.#owned.delete(resource);
      }
    this.#update({
      phase: "idle",
      ceremony: null,
      error: "Creation cancelled. Your previous World is unchanged.",
    });
  }
  async #loadAndSwitch(
    preset: EnvironmentPreset,
    reducedMotion: boolean,
    generation: number,
    onCommit?: () => void,
  ): Promise<boolean> {
    this.#update({ phase: "loading", error: "" });
    let next: EnvironmentResources | null = null;
    try {
      next = preset.recipe ? await this.load(preset.recipe) : null;
      if (this.#disposed || generation !== this.#generation) {
        next?.dispose();
        return false;
      }
      if (next) this.#owned.add(next);
      await this.#prepare?.(
        next,
        () => !this.#disposed && generation === this.#generation,
      );
      if (this.#disposed || generation !== this.#generation) {
        if (next && this.#owned.delete(next)) next.dispose();
        return false;
      }
      const previous = this.#state.resources;
      this.#update({ phase: "out" });
      this.#timers.push(
        setTimeout(
          () => {
            this.#update({ active: preset, resources: next, phase: "in" });
            onCommit?.();
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
      return true;
    } catch (error) {
      if (next && this.#owned.delete(next)) next.dispose();
      if (!this.#disposed && generation === this.#generation)
        this.#update({
          phase: "idle",
          ceremony: null,
          error:
            error instanceof Error
              ? error.message
              : "Environment could not load. Your World is unchanged.",
        });
      return false;
    }
  }
  dispose() {
    this.#disposed = true;
    this.#generation++;
    this.#abort?.abort();
    this.#abort = null;
    this.#timers.forEach(clearTimeout);
    this.#timers = [];
    this.#owned.forEach((resources) => resources.dispose());
    this.#owned.clear();
    this.#listeners.clear();
  }
}

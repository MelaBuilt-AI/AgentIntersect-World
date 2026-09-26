import { afterEach, expect, it, vi } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";

afterEach(() => vi.useRealTimers());
it("keeps the previous World and working cue until GPU preparation completes, and cancels safely", async () => {
  vi.useFakeTimers();
  const { EnvironmentSwitcher } =
    await import("../src/world-entry/environment-switcher.js");
  const dispose = vi.fn();
  const switcher = new EnvironmentSwitcher(async (recipe) => ({
    recipe,
    textures: {},
    dispose,
  }));
  expect(switcher).toHaveProperty("setPrepare");
  let finish!: () => void;
  switcher.setPrepare(async (_resource, current) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    expect(current()).toBe(false);
  });
  const pending = switcher.create(
    { id: "one", name: "One", bowMs: 1000 },
    "Snow",
    false,
    async () => ({ recipe: ENVIRONMENT_PRESETS[1]!.recipe!, summary: "ready" }),
    vi.fn(),
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(switcher.snapshot()).toMatchObject({
    phase: "loading",
    active: { id: "original" },
    ceremony: { phase: "dance" },
  });
  switcher.cancelCreation();
  finish();
  await pending;
  await vi.runAllTimersAsync();
  expect(switcher.snapshot()).toMatchObject({
    phase: "idle",
    active: { id: "original" },
  });
  expect(dispose).toHaveBeenCalledTimes(1);
  switcher.dispose();
});
it("holds Dance through generation and asset load, bows on the actual swap, then releases animation ownership", async () => {
  vi.useFakeTimers();
  const { EnvironmentSwitcher } =
    await import("../src/world-entry/environment-switcher.js");
  let finish!: (value: {
    recipe: NonNullable<(typeof ENVIRONMENT_PRESETS)[number]["recipe"]>;
    summary: string;
  }) => void;
  const generate = vi.fn(
    () =>
      new Promise<{
        recipe: NonNullable<(typeof ENVIRONMENT_PRESETS)[number]["recipe"]>;
        summary: string;
      }>((resolve) => {
        finish = resolve;
      }),
  );
  const dispose = vi.fn();
  const switcher = new EnvironmentSwitcher(async (recipe) => ({
    recipe,
    textures: {},
    dispose,
  }));
  const completed = vi.fn();
  expect(typeof switcher.create).toBe("function");
  const result = switcher.create(
    { id: "selected", name: "Beans", bowMs: 2400 },
    "Snow",
    false,
    generate,
    completed,
  );
  expect(switcher.snapshot().ceremony?.phase).toBe("dance");
  expect(switcher.snapshot().phase).toBe("generating");
  finish({ recipe: ENVIRONMENT_PRESETS[2]!.recipe!, summary: "Created Mars" });
  expect((await result)?.originalDescription).toBe("Snow");
  expect(completed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(350);
  expect(switcher.snapshot().ceremony?.phase).toBe("bow");
  expect(completed).toHaveBeenCalledWith("Created Mars", "Beans");
  await vi.advanceTimersByTimeAsync(2400);
  expect(switcher.snapshot().ceremony).toBeNull();
  expect(switcher.snapshot().phase).toBe("idle");
  switcher.dispose();
});
it("cancellation releases effects and ignores a late model response", async () => {
  const { EnvironmentSwitcher } =
    await import("../src/world-entry/environment-switcher.js");
  const load = vi.fn();
  const switcher = new EnvironmentSwitcher(load);
  let finish!: (value: {
    recipe: NonNullable<(typeof ENVIRONMENT_PRESETS)[number]["recipe"]>;
    summary: string;
  }) => void;
  const result = switcher.create(
    { id: "one", name: "One", bowMs: 2000 },
    "World",
    false,
    (_text, _current, signal) =>
      new Promise((resolve) => {
        finish = resolve;
        expect(signal.aborted).toBe(false);
      }),
    vi.fn(),
  );
  switcher.cancelCreation();
  finish({ recipe: ENVIRONMENT_PRESETS[1]!.recipe!, summary: "late" });
  await result;
  expect(load).not.toHaveBeenCalled();
  expect(switcher.snapshot()).toMatchObject({
    phase: "idle",
    ceremony: null,
    active: { id: "original" },
  });
});
it("starts with Original and retains it until loading and the transition complete", async () => {
  vi.useFakeTimers();
  const module =
    await import("../src/world-entry/environment-switcher.js").catch(
      () => null,
    );
  expect(module, "Environment switcher must exist").not.toBeNull();
  const dispose = vi.fn();
  const load = vi.fn(async (recipe) => ({ recipe, textures: {}, dispose }));
  const switcher = new module!.EnvironmentSwitcher(load);
  expect(switcher.snapshot().active.id).toBe("original");
  const result = switcher.select(ENVIRONMENT_PRESETS[1]!, false);
  expect(switcher.snapshot().active.id).toBe("original");
  await result;
  expect(switcher.snapshot().phase).toBe("out");
  await vi.advanceTimersByTimeAsync(350);
  expect(switcher.snapshot().active.id).toBe("sunlit");
  await vi.advanceTimersByTimeAsync(650);
  expect(switcher.snapshot().phase).toBe("idle");
  await switcher.select(ENVIRONMENT_PRESETS[0]!, true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(switcher.snapshot().active.id).toBe("original");
  expect(dispose).toHaveBeenCalledTimes(1);
  switcher.dispose();
});
it("retains the working world on asset failure and refuses overlapping switches", async () => {
  const module =
    await import("../src/world-entry/environment-switcher.js").catch(
      () => null,
    );
  expect(module).not.toBeNull();
  const load = vi.fn(async () => {
    throw new Error("texture missing");
  });
  const switcher = new module!.EnvironmentSwitcher(load);
  const first = switcher.select(ENVIRONMENT_PRESETS[2]!, false);
  await switcher.select(ENVIRONMENT_PRESETS[1]!, false);
  await first;
  expect(load).toHaveBeenCalledTimes(1);
  expect(switcher.snapshot().active.id).toBe("original");
  expect(switcher.snapshot().error).toContain("texture missing");
  expect(switcher.snapshot().phase).toBe("idle");
  switcher.dispose();
});

import { afterEach, expect, it, vi } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";

afterEach(() => vi.useRealTimers());
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

import { expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  ready: new Set<string>(),
  effectIndex: 0,
  effects: [] as {
    deps: readonly unknown[];
    cleanup?: (() => void) | undefined;
  }[],
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useContext: (context: { _currentValue: unknown }) => context._currentValue,
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => {
    const value = typeof initial === "function" ? initial() : initial;
    return [value instanceof Set ? hooks.ready : value, () => {}];
  },
  // Model React's dependency boundary; the real production-browser reload
  // journey independently exercises rendering, assets and the loading overlay.
  useEffect: (effect: () => (() => void) | void, deps: readonly unknown[]) => {
    const index = hooks.effectIndex++;
    const previous = hooks.effects[index];
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
      previous?.cleanup?.();
      hooks.effects[index] = { deps, cleanup: effect() ?? undefined };
    }
  },
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: () => {},
  useThree: () => ({ gl: { domElement: { dataset: {} } } }),
}));
vi.mock("../src/repository-prop-drag.js", () => ({
  useRepositoryPropDrag: () => () => {},
}));
vi.mock("../src/code-world-texture.js", async () => ({
  ...(await vi.importActual("../src/code-world-texture.js")),
  useCodeTexture: () => null,
}));
import { RepositoryCityModels } from "../src/repository-city-canvas.js";
import type { RepositoryCityInstance } from "../src/repository-city-state.js";

it("acknowledges a reconciled already-ready city without bypassing new-model readiness", () => {
  const onReady = vi.fn();
  const instance = { instanceId: "same-object" } as RepositoryCityInstance;
  const first = [instance];
  hooks.ready.add(instance.instanceId);
  const render = (instances: readonly RepositoryCityInstance[]) => {
    hooks.effectIndex = 0;
    RepositoryCityModels({
      instances,
      onReady,
      reducedMotion: true,
      selectedInstanceId: null,
      onSelect: () => {},
      onSettled: () => {},
    });
  };
  try {
    render(first);
    expect(onReady).toHaveBeenCalledTimes(1);
    render(first);
    expect(onReady).toHaveBeenCalledTimes(1);
    // A successful second load can reconcile the same object IDs while the
    // parent has just switched back to loading. It needs a new ready receipt.
    render([...first]);
    expect(onReady).toHaveBeenCalledTimes(2);
    const second = [
      ...first,
      { instanceId: "new-object" } as RepositoryCityInstance,
    ];
    render(second);
    expect(onReady).toHaveBeenCalledTimes(2);
    hooks.ready.add("new-object");
    render(second);
    expect(onReady).toHaveBeenCalledTimes(3);
  } finally {
    for (const effect of hooks.effects) effect.cleanup?.();
  }
});

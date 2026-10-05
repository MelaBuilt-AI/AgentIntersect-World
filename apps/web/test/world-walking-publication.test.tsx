import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_IMPORTED_AVATAR_DRAFT } from "@agentintersect-world/avatar-system/imported-avatar";

const probe = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  publish: vi.fn(),
  live: null as { current: { x: number; z: number } } | null,
}));
vi.mock("react", async (load) => {
  const actual = await load<typeof import("react")>();
  return {
    ...actual,
    useState(initial: unknown) {
      const result = actual.useState(initial === "idle" ? "moving" : initial);
      if (
        initial &&
        typeof initial === "object" &&
        "x" in initial &&
        "z" in initial &&
        Object.keys(initial).length === 2
      )
        return [result[0], probe.publish];
      return result;
    },
    useRef(initial: unknown) {
      const ref = actual.useRef(initial);
      if (initial instanceof Set) initial.add("w");
      if (
        initial &&
        typeof initial === "object" &&
        "x" in initial &&
        "z" in initial &&
        Object.keys(initial).length === 2
      )
        probe.live = ref as typeof probe.live;
      return ref;
    },
    useEffect(effect: () => void | (() => void), deps: unknown[]) {
      if (deps?.length === 1 && deps[0] === "moving")
        probe.effects.push(effect);
    },
  };
});
import { WorldRoom } from "../src/world-entry/WorldRoom.js";

afterEach(() => {
  vi.unstubAllGlobals();
  probe.effects = [];
  probe.publish.mockClear();
  probe.live = null;
});

it("keeps live walking at every frame while bounding React publication and flushing the final pose", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("window", {
    location: { search: "" },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++id, callback);
      return id;
    },
    cancelAnimationFrame: (handle: number) => frames.delete(handle),
  });
  vi.stubGlobal("document", { activeElement: null });
  function Probe() {
    WorldRoom({
      floor: "blank",
      objects: [],
      reducedMotion: false,
      forceNoWebGL: true,
      userName: "Aaron",
      agentName: "Agent",
      userAvatar: DEFAULT_IMPORTED_AVATAR_DRAFT,
      agentAvatar: DEFAULT_IMPORTED_AVATAR_DRAFT,
      activity: { state: "idle", icon: "", label: "idle", detail: "" },
    });
    return null;
  }
  renderToStaticMarkup(<Probe />);
  const cleanups = probe.effects.map((effect) => effect());
  expect(frames.size).toBe(1);
  const positions: { x: number; z: number }[] = [];
  for (let t = 0; t <= 250; t += 10) {
    const [handle, callback] = [...frames.entries()][0]!;
    frames.delete(handle);
    callback(t);
    positions.push({ ...probe.live!.current });
  }
  expect(new Set(positions.map((p) => `${p.x},${p.z}`)).size).toBe(26);
  expect(probe.publish.mock.calls.length).toBeLessThanOrEqual(3);
  cleanups.forEach((cleanup) => cleanup?.());
  expect(probe.publish).toHaveBeenLastCalledWith(probe.live!.current);
  expect(frames.size).toBe(0);
});

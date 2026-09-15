import type { RootState, RootStore } from "@react-three/fiber";
import { expect, it, vi } from "vitest";
import { createAvatarPreviewPointerEvents } from "../src/imported-avatar-canvas.js";

it("ignores cleared/detached preview targets while retaining normal pointer connection and cleanup", () => {
  const state = {
    events: {},
    set: (update: (current: RootState) => Partial<RootState>) => {
      Object.assign(state, update(state));
    },
  } as RootState;
  const store = { getState: () => state } as RootStore;
  state.events = createAvatarPreviewPointerEvents(store);
  const target = {
    isConnected: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  state.events.connect!(null as unknown as HTMLElement);
  state.events.connect!(target as unknown as HTMLElement);
  expect(target.addEventListener).not.toHaveBeenCalled();
  expect(state.events.connected).toBeUndefined();

  target.isConnected = true;
  state.events.connect!(target as unknown as HTMLElement);
  expect(state.events.connected).toBe(target);
  expect(target.addEventListener).toHaveBeenCalledTimes(
    Object.keys(state.events.handlers!).length,
  );
  expect(target.addEventListener).toHaveBeenCalledWith(
    "pointerdown",
    state.events.handlers!.onPointerDown,
    { passive: true },
  );

  target.isConnected = false;
  state.events.disconnect!();
  expect(target.removeEventListener).toHaveBeenCalledTimes(
    target.addEventListener.mock.calls.length,
  );
  expect(state.events.connected).toBeUndefined();
});

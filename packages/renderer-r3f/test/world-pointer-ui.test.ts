import { afterEach, describe, expect, it, vi } from "vitest";
import type { RootStore } from "@react-three/fiber";

const handlers = vi.hoisted(() => ({
  onClick: vi.fn(),
  onPointerDown: vi.fn(),
}));
vi.mock("@react-three/fiber", async (original) => ({
  ...(await original<typeof import("@react-three/fiber")>()),
  events: () => ({ handlers: { ...handlers }, connect: vi.fn() }),
}));
import { createWorldPointerEvents } from "../src/world-room-canvas.js";

// Minimal Element boundary: a nested target resolves its matching ancestor.
class TargetElement {
  constructor(readonly ancestorSelector: string) {}
  closest(selectors: string) {
    return selectors
      .split(",")
      .map((value) => value.trim())
      .includes(this.ancestorSelector)
      ? this
      : null;
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("shared World pointer/UI boundary", () => {
  it.each([
    "button",
    '[role="button"]',
    "[data-world-ui]",
    ".world-screen__object",
    "input",
    "form",
  ])("does not send nested %s UI hits to the 3D scene", (ancestor) => {
    vi.stubGlobal("Element", TargetElement);
    const events = createWorldPointerEvents({} as RootStore);
    const event = {
      target: new TargetElement(ancestor),
    } as unknown as PointerEvent;
    events.handlers!.onClick!(event);
    events.handlers!.onPointerDown!(event);
    expect(handlers.onClick).not.toHaveBeenCalled();
    expect(handlers.onPointerDown).not.toHaveBeenCalled();
  });
  it("preserves normal scene/object pointer events", () => {
    vi.stubGlobal("Element", TargetElement);
    const events = createWorldPointerEvents({} as RootStore);
    const event = {
      target: new TargetElement("canvas"),
    } as unknown as PointerEvent;
    events.handlers!.onClick!(event);
    expect(handlers.onClick).toHaveBeenCalledExactlyOnceWith(event);
  });
});

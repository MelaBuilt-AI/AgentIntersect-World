import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorldBloom } from "../../../packages/renderer-r3f/src/world-atmosphere-effects.js";

const captured = vi.hoisted(() => ({
  resources: [] as {
    scenePass: { renderTarget: { samples: number } };
    glow: object | null;
    dispose: () => void;
  }[],
}));
vi.mock(
  "../../../packages/renderer-r3f/node_modules/@react-three/fiber",
  () => ({
    useThree: () => ({
      gl: {},
      scene: {},
      camera: {},
      size: { width: 800, height: 600 },
      invalidate: () => {},
    }),
    useFrame: () => {},
  }),
);
vi.mock(
  "../../../packages/renderer-r3f/src/world-postprocessing.js",
  async () => {
    const actual = await vi.importActual<
      typeof import("../../../packages/renderer-r3f/src/world-postprocessing.js")
    >("../../../packages/renderer-r3f/src/world-postprocessing.js");
    return {
      ...actual,
      createWorldPipeline: (
        ...args: Parameters<typeof actual.createWorldPipeline>
      ) => {
        const resource = actual.createWorldPipeline(...args);
        captured.resources.push(resource);
        return resource;
      },
    };
  },
);
afterEach(() => {
  for (const resource of captured.resources.splice(0)) resource.dispose();
});
describe("World postprocessing anti-aliasing", () => {
  it.each([true, false])(
    "uses a switchable multisample target with bloom=%s",
    (bloom) => {
      const component = WorldBloom as ComponentType<{
        bloom: boolean;
        antialiasing: boolean;
      }>;
      renderToStaticMarkup(
        createElement(component, { bloom, antialiasing: true }),
      );
      expect(captured.resources[0]?.scenePass.renderTarget.samples).toBe(4);
      expect(Boolean(captured.resources[0]?.glow)).toBe(bloom);
      renderToStaticMarkup(
        createElement(component, { bloom, antialiasing: false }),
      );
      expect(captured.resources[1]?.scenePass.renderTarget.samples).toBe(0);
      expect(Boolean(captured.resources[1]?.glow)).toBe(bloom);
    },
  );
});

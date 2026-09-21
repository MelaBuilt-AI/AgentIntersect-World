import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorldBloom } from "../../../packages/renderer-r3f/src/world-atmosphere-effects.js";

const captured = vi.hoisted(() => ({
  targets: [] as { samples: number }[],
  passes: [] as object[],
}));
vi.mock(
  "../../../packages/renderer-r3f/node_modules/@react-three/fiber",
  () => ({
    useThree: () => ({
      gl: { capabilities: { maxSamples: 4 } },
      scene: {},
      camera: {},
      size: { width: 800, height: 600 },
      invalidate: () => {},
    }),
    useFrame: () => {},
  }),
);
vi.mock(
  "../../../packages/renderer-r3f/node_modules/three/examples/jsm/postprocessing/EffectComposer.js",
  () => ({
    EffectComposer: class {
      constructor(_gl: unknown, target: { samples: number }) {
        captured.targets.push(target);
      }
      addPass(pass: object) {
        captured.passes.push(pass);
      }
    },
  }),
);
beforeEach(() => {
  captured.targets.length = 0;
  captured.passes.length = 0;
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
      expect(captured.targets[0]?.samples).toBe(4);
      expect(captured.passes).toHaveLength(bloom ? 3 : 2);
      renderToStaticMarkup(
        createElement(component, { bloom, antialiasing: false }),
      );
      expect(captured.targets[1]?.samples).toBe(0);
    },
  );
});

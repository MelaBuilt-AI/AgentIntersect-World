import { describe, expect, it } from "vitest";
import { Texture } from "three";
import * as code from "../src/code-world-texture.js";

describe("flowing code artwork", () => {
  it("advances the sky clock without rotating the dome and holds Reduced Motion", () => {
    const sky = { rotation: { y: 0 } };
    const time = { value: 0 };
    for (let frame = 0; frame < 600; frame++)
      code.animateCodeSky(sky, time, 0.1, false);
    expect(sky.rotation.y).toBe(0);
    expect(time.value).toBeCloseTo(60);
    const held = time.value;
    code.animateCodeSky(sky, time, 10, true);
    expect(time.value).toBe(held);
    expect(sky.rotation.y).toBe(0);
  });

  it("orders transparent rain behind aurora behind nebula, with rain at 25 percent", () => {
    const layers = (
      code as unknown as {
        CODE_SKY_LAYERS: readonly {
          kind: string;
          texture: string;
          opacity: number;
          radius: number;
          renderOrder: number;
        }[];
      }
    ).CODE_SKY_LAYERS;
    expect(layers).toBeDefined();
    expect(layers.map((layer) => [layer.kind, layer.texture])).toEqual([
      ["rain", "02_terminal_rain"],
      ["aurora", "17_aurora_code_sky"],
      ["nebula", "15_code_nebula_sky"],
    ]);
    expect(layers[0]!.opacity).toBe(0.25);
    expect(
      layers.every((layer) => layer.opacity > 0 && layer.opacity < 1),
    ).toBe(true);
    expect(layers[0]!.radius).toBeGreaterThan(layers[1]!.radius);
    expect(layers[1]!.radius).toBeGreaterThan(layers[2]!.radius);
    expect(layers[0]!.renderOrder).toBeLessThan(layers[1]!.renderOrder);
    expect(layers[1]!.renderOrder).toBeLessThan(layers[2]!.renderOrder);
  });

  it("gives each streaming layer its own shader mode on the same reduced-motion clock", () => {
    const time = { value: 20 };
    for (const [index, layer] of code.CODE_SKY_LAYERS.entries()) {
      const shader = {
        uniforms: {},
        fragmentShader: "void main() {\n#include <map_fragment>\n}",
      };
      code.configureCodeSky(shader, time, layer.kind);
      expect(shader.uniforms).toEqual({
        aiwSkyTime: time,
        aiwSkyLayer: { value: index },
      });
      expect(shader.fragmentShader).toContain("aiwStreamingUv(vMapUv)");
      expect(shader.fragmentShader).toContain("diffuseColor.a *=");
      expect(shader.fragmentShader).not.toContain("aiwConstellationUv");
      expect(shader.fragmentShader).not.toContain("aiwStarLayer");
    }
  });

  it("moves existing floor and screen maps without changing their images or repeat density", () => {
    for (const kind of ["floor", "screen"] as const) {
      const texture = new Texture();
      texture.repeat.set(6, 6);
      const source = texture.source;
      code.animateCodeTexture(texture, kind, 1, false);
      expect(texture.offset.y).not.toBe(0);
      const first = texture.offset.clone();
      code.animateCodeTexture(texture, kind, 1, false);
      expect(texture.offset.y).not.toBe(first.y);
      expect(texture.source).toBe(source);
      expect(texture.repeat.toArray()).toEqual([6, 6]);
      const held = texture.offset.clone();
      code.animateCodeTexture(texture, kind, 10, true);
      expect(texture.offset).toEqual(held);
    }
  });
});

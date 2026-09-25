import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createWorldSun } from "../src/world-renderer.js";
import {
  weatherMaterial,
  terminalRainMaterial,
} from "../src/world-node-materials.js";
import { Color, Texture } from "three";
import { sparkMaterial } from "../src/repository-node-materials.js";

const source = (name: string) =>
  readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
describe("r186 World renderer contract", () => {
  it("uploads terminal-rain colors as RGB rather than undefined vector coordinates", () => {
    const color = new Color("#ff2d2d");
    const material = terminalRainMaterial(
      {
        rainMap: { value: new Texture() },
        rainTime: { value: 0 },
        rainHeight: { value: 440 },
        rainReach: { value: 1 },
        rainSpark: { value: 0 },
        rainVisible: { value: 1 },
        rainPulse: { value: 0.5 },
        rainStrength: { value: 1 },
        rainColor: { value: color },
      },
      {},
    );
    const node = material.fragmentNode.node.rawInputs.at(-1);
    expect(node.nodeType).toBe("color");
    expect(node.value).toBe(color);
    material.dispose();
  });
  it("pins r186 and makes both World canvases explicitly choose supported shadows", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    expect(pkg.dependencies.three).toBe("0.186.0");
    for (const file of [
      "world-room-canvas.tsx",
      "world-room-imported-canvas.tsx",
    ]) {
      expect(source(file)).toContain('shadows="percentage"');
      expect(source(file)).toContain("gl={createWorldRenderer}");
    }
  });
  it("creates a real two-cascade SunLight with direction, bounded coverage and no inherited negative bias", () => {
    const sun = createWorldSun("#e2f5ff", 2.1, [12, 18, 8]);
    expect(sun.isSunLight).toBe(true);
    expect(sun.castShadow).toBe(true);
    expect(sun.position.toArray()).toEqual([12, 18, 8]);
    expect(sun.shadow.getViewportCount()).toBe(2);
    expect(sun.shadow.camera.far).toBe(100);
    expect(sun.shadow.bias).toBe(0);
    sun.dispose();
  });
  it("uses genuine instance-step attributes, not a per-vertex interleaved buffer", () => {
    const values = new Float32Array([1, 2, 3, 4, 5, 6]);
    const weather = weatherMaterial(values, {
      time: { value: 0 },
      wind: { value: 0.5 },
      kind: { value: 2 },
      viewport: { value: 720 },
    });
    const attribute = weather.positionNode.node.rawInputs[0].attribute;
    expect(attribute.isInstancedBufferAttribute).toBe(true);
    expect(attribute.isInterleavedBufferAttribute).not.toBe(true);
    expect(attribute.count).toBe(2);
    expect(attribute.array).toBe(values);
    const sparks = sparkMaterial(values, { value: 0 });
    expect(sparks.isSpriteNodeMaterial).toBe(true);
    weather.dispose();
    sparks.dispose();
  });
});

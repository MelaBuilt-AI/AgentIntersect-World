import { expect, it } from "vitest";
import { AdditiveBlending, Color, DoubleSide, Texture } from "three";
import { shaftMaterial } from "../src/repository-node-materials.js";
import { terminalRainMaterial } from "../src/world-node-materials.js";

it("draws crossed additive city shafts in one two-sided pass without changing their shading", () => {
  const material = shaftMaterial();
  expect(material.forceSinglePass).toBe(true);
  expect(material.side).toBe(DoubleSide);
  expect(material.blending).toBe(AdditiveBlending);
  expect(material.transparent).toBe(true);
  expect(material.depthWrite).toBe(false);
  expect(material.fragmentNode).toBeDefined();
  material.dispose();
});

it("draws terminal-rain ribbons once with unchanged full-density shader uniforms", () => {
  const uniforms = {
    rainMap: { value: new Texture() },
    rainTime: { value: 12 },
    rainHeight: { value: 440 },
    rainReach: { value: 1 },
    rainSpark: { value: 0 },
    rainVisible: { value: 1 },
    rainPulse: { value: 0.5 },
    rainStrength: { value: 0.8 },
    rainColor: { value: new Color("#008bff") },
  };
  const material = terminalRainMaterial(uniforms, {
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  expect(material.forceSinglePass).toBe(true);
  expect(material.side).toBe(DoubleSide);
  expect(material.blending).toBe(AdditiveBlending);
  expect(material.positionNode).toBeDefined();
  expect(material.fragmentNode).toBeDefined();
  material.dispose();
  uniforms.rainMap.value.dispose();
});

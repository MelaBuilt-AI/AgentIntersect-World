import { expect, it } from "vitest";
import { Texture } from "three";
import { codeSkyMaterial } from "../src/world-node-materials.js";

it.each([0, 1, 2])(
  "applies Original sky layer %i density once, including after TSL resampling",
  (layer) => {
    const map = new Texture();
    // A texture transform must not be applied again after authored sky UVs.
    map.repeat.set(6, 3);
    const material = codeSkyMaterial(map, { value: 2 }, layer, {
      opacity: 0.8,
    });
    const [source, coordinates] = material.colorNode.node.node.rawInputs;
    const sampled = source.sample(coordinates);
    expect(sampled.updateMatrix).toBe(false);
    expect(coordinates.node.op).toBe("*");
    expect(coordinates.node.bNode.node.value.toArray()).toEqual([8, 4]);
    expect(sampled.value).toBe(map);
    expect(map.repeat.toArray()).toEqual([6, 3]);
    material.dispose();
    map.dispose();
  },
);

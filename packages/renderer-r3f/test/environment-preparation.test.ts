import { expect, it } from "vitest";
import { Texture } from "three";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";
import * as resources from "../src/environment-resources.js";

it("uploads only one candidate texture per yielded frame before allowing the swap", async () => {
  const api = resources as typeof resources & {
    prepareEnvironmentTextures?: (
      gl: { initTexture: (texture: Texture) => void },
      bundle: unknown,
      current: () => boolean,
      frame: () => Promise<void>,
    ) => Promise<void>;
  };
  expect(api.prepareEnvironmentTextures).toBeTypeOf("function");
  if (!api.prepareEnvironmentTextures) return;
  const a = new Texture(),
    b = new Texture();
  const events: unknown[] = [];
  const frame = async () => {
    events.push("frame");
  };
  const upload = (texture: Texture) => {
    events.push(texture);
  };
  await api.prepareEnvironmentTextures(
    { initTexture: upload },
    {
      recipe: ENVIRONMENT_PRESETS[1]!.recipe,
      textures: { "meadow-ground": a, "day-sky": b },
      dispose() {},
    },
    () => true,
    frame,
  );
  expect(events).toEqual(["frame", a, "frame", b, "frame"]);
  events.length = 0;
  await api.prepareEnvironmentTextures(
    { initTexture: upload },
    { textures: { "meadow-ground": a } },
    () => false,
    frame,
  );
  expect(events.filter((e) => e instanceof Texture)).toEqual([]);
});

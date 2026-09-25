import { expect, it, vi } from "vitest";
import { Group, Scene } from "three";
import * as preparation from "../src/world-preparation.js";

it("precompiles staged scenery into the compositor context without leaking temporary state across await", async () => {
  expect(preparation.compileWorldEnvironment).toBeTypeOf("function");
  const object = new Group();
  object.visible = false;
  const passTarget = {};
  let target: unknown = null;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const get = vi.fn();
  const renderer = {
    _renderContexts: { get },
    getRenderTarget: () => target,
    setRenderTarget: (value: unknown) => {
      target = value;
    },
    compileAsync: vi.fn(() => {
      expect(object.visible).toBe(true);
      expect(target).toBe(passTarget);
      renderer._renderContexts.get(target, null);
      return pending;
    }),
  };
  const owner = preparation.createWorldPreparation(
    renderer,
    () => {},
    passTarget,
  );
  const compiled = preparation.compileWorldEnvironment(
    renderer,
    object,
    null,
    new Scene(),
  );
  expect(get).toHaveBeenCalledWith(passTarget, null, 1);
  expect(renderer._renderContexts.get).toBe(get);
  expect(object.visible).toBe(false);
  expect(target).toBeNull();
  finish();
  await compiled;
  owner.dispose();
});

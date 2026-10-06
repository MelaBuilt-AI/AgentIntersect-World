import { afterEach, expect, it, vi } from "vitest";
import { createElement, StrictMode } from "react";
import {
  act,
  createRoot,
  extend,
  _roots,
  useLoader,
  unmountComponentAtNode,
} from "@react-three/fiber";
import {
  Bone,
  BoxGeometry,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Texture,
} from "three";
import {
  ImportedAvatarGLTFLoader,
  ImportedAvatarWorldModel,
  type ImportedAvatarWorldSelection,
} from "../src/imported-avatar-canvas.js";

// Real React/Fiber component lifecycle, cached-loader and GPU fixtures only.
// No browser navigation, physical GPU allocation, or native harness dispatch.
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("releases replaced avatar instances and sources while preserving a shared active avatar", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  extend({ Group });
  const texture = new Texture();
  const geometry = new BoxGeometry();
  geometry.computeBoundingBox();
  const material = new MeshStandardMaterial({ map: texture });
  const source = new Group();
  const mesh = new SkinnedMesh(geometry, material);
  const bone = new Bone();
  mesh.add(bone);
  mesh.bind(new Skeleton([bone]));
  mesh.boundingBox = geometry.boundingBox;
  source.add(mesh);
  const sourceTexture = vi.spyOn(texture, "dispose");
  const url = "fixture-avatar-lifecycle.glb";
  vi.spyOn(ImportedAvatarGLTFLoader.prototype, "load").mockImplementation(
    (_url, loaded) => {
      loaded({ scene: source, animations: [] } as never);
    },
  );
  const selection: ImportedAvatarWorldSelection = {
    assetId: "fixture",
    assetUrl: url,
    rotation: [0, 0, 0],
    scale: 1,
    groundOffset: 0,
    resolvedClip: {
      clipIndex: -1,
      clipName: "",
      locomotion: "Idle",
      semantic: "Idle",
      oneShot: false,
      durationSeconds: 0,
      verification: "evidence-refused",
      error: "no fixture clip",
    },
  };
  const avatar = (key: string) =>
    createElement(ImportedAvatarWorldModel, {
      key,
      role: "agent",
      selection,
      action: "Idle",
      animate: false,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
      onReady: () => {},
      animationGeneration: 0,
    });
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const renderer = {
    render() {},
    setSize() {},
    setPixelRatio() {},
    shadowMap: {},
  };
  const root = createRoot(canvas);
  await root.configure({
    gl: renderer as never,
    frameloop: "never",
    dpr: 1,
    size: { width: 64, height: 64, top: 0, left: 0 },
  });
  try {
    await act(async () => {
      root.render(
        createElement(StrictMode, null, avatar("one"), avatar("two")),
      );
    });
    await vi.advanceTimersByTimeAsync(0);
    const scene = _roots.get(canvas)!.store.getState().scene;
    const clones: SkinnedMesh[] = [];
    scene.traverse((object) => {
      if (object instanceof SkinnedMesh) clones.push(object);
    });
    expect(clones).toHaveLength(2);
    clones.forEach((clone) => clone.skeleton.computeBoneTexture());
    const first = vi.spyOn(clones[0]!.skeleton.boneTexture!, "dispose");
    const second = vi.spyOn(clones[1]!.skeleton.boneTexture!, "dispose");
    await act(async () => {
      root.render(createElement(StrictMode, null, avatar("two")));
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    expect(sourceTexture).not.toHaveBeenCalled();
    await act(async () => {
      root.render(null);
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(second).toHaveBeenCalledOnce();
    expect(sourceTexture).toHaveBeenCalledOnce();
    // The cached source remains loadable after its GPU resources were released.
    await act(async () => {
      root.render(avatar("reused"));
    });
    expect(scene.children).toHaveLength(1);
  } finally {
    await act(async () => {
      unmountComponentAtNode(canvas);
    });
    await vi.advanceTimersByTimeAsync(500);
    useLoader.clear(ImportedAvatarGLTFLoader, url);
  }
});

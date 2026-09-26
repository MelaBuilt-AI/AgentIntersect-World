import { createContext } from "react";
import { compileWorldPass } from "./world-preparation.js";
import {
  DepthTexture,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Mesh,
  NearestFilter,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";

/** One lazy capture shared by all city mist volumes, never by the reflector. */
export function createRepositoryFogDepth() {
  let target: WebGLRenderTarget | null = null;
  let captured = false;
  const size = new Vector2();
  let captureCamera: Camera | null = null;
  const opaque = new MeshBasicMaterial({ color: "#ffffff" });
  opaque.fog = false;
  opaque.toneMapped = false;

  // Compilation must see exactly the same target, camera, lighting and
  // arrival/discard materials as the later depth draw, not the main compositor.
  const withDepthPass = <T>(
    gl: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    action: (camera: Camera) => T,
  ): T => {
    gl.getDrawingBufferSize(size);
    target ??= new WebGLRenderTarget(size.x, size.y, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthTexture: new DepthTexture(size.x, size.y),
    });
    target.texture.name = "repository-fog-scene";
    target.setSize(size.x, size.y);
    const hidden: Object3D[] = [];
    const replaced: [Mesh, Material | Material[]][] = [];
    scene.traverse((object) => {
      const material = (object as Mesh).material;
      const materials = Array.isArray(material) ? material : [material];
      if (
        object.visible &&
        (("isLight" in object && object.isLight) ||
          object.name === "repository-local-atmosphere" ||
          object.name === "world-wet-floor-reflection" ||
          object.name.startsWith("repository-terminal-rain:") ||
          (material && materials.every((item) => !item.depthWrite)))
      ) {
        hidden.push(object);
        object.visible = false;
      } else if (
        object instanceof Mesh &&
        material &&
        materials.every(
          (item) =>
            (item instanceof MeshStandardMaterial ||
              item instanceof MeshBasicMaterial) &&
            !item.transparent &&
            item.opacity === 1 &&
            item.alphaTest === 0 &&
            item.depthTest &&
            item.side === opaque.side &&
            item.onBeforeCompile === Material.prototype.onBeforeCompile,
        )
      ) {
        // Keep custom arrival/discard shaders and alpha masks exactly as-is.
        replaced.push([object, material]);
        object.material = opaque;
      }
    });
    const previous = gl.getRenderTarget();
    const autoClear = gl.autoClear;
    const shadowAutoUpdate = gl.shadowMap.autoUpdate;
    try {
      gl.autoClear = true;
      gl.shadowMap.autoUpdate = false;
      gl.setRenderTarget(target);
      captureCamera ??= camera.clone(false);
      captureCamera.copy(camera, false);
      return action(captureCamera);
    } finally {
      gl.setRenderTarget(previous);
      gl.autoClear = autoClear;
      gl.shadowMap.autoUpdate = shadowAutoUpdate;
      for (const object of hidden) object.visible = true;
      for (const [object, material] of replaced) object.material = material;
    }
  };
  return {
    beginFrame() {
      captured = false;
    },
    compile(
      gl: WebGLRenderer,
      scene: Scene,
      camera: Camera,
      objects: readonly Object3D[],
    ) {
      return withDepthPass(gl, scene, camera, (view) =>
        Promise.all(
          objects.map((object) => compileWorldPass(gl, object, view, scene)),
        ),
      );
    },
    capture(gl: WebGLRenderer, scene: Scene, camera: Camera) {
      if (target && captured) return target;
      withDepthPass(gl, scene, camera, (view) => gl.render(scene, view));
      captured = true;
      return target!;
    },
    dispose() {
      target?.dispose();
      opaque.dispose();
      target = null;
      captured = false;
    },
  };
}

export const RepositoryFogDepthContext = createContext<ReturnType<
  typeof createRepositoryFogDepth
> | null>(null);

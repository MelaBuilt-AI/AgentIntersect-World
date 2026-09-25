import { createContext } from "react";
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
  return {
    // Three advances its counter for nested reflections and postprocessing too.
    // Invalidate once from the owning R3F frame, not on each gl.render call.
    beginFrame() {
      captured = false;
    },
    capture(gl: WebGLRenderer, scene: Scene, camera: Camera) {
      if (target && captured) return target;
      gl.getDrawingBufferSize(size);
      if (!target) {
        target = new WebGLRenderTarget(size.x, size.y, {
          minFilter: NearestFilter,
          magFilter: NearestFilter,
          depthTexture: new DepthTexture(size.x, size.y),
        });
        target.texture.name = "repository-fog-scene";
      }
      target.setSize(size.x, size.y);
      const hidden: Object3D[] = [];
      const replaced: [Mesh, Material | Material[]][] = [];
      scene.traverse((object) => {
        const material = (object as Mesh).material;
        const materials = Array.isArray(material) ? material : [material];
        if (
          object.visible &&
          // This pass consumes depth and alpha only. WebGPU SunLight ignores
          // the legacy renderer.shadowMap.autoUpdate flag; exclude lighting
          // here so it does not render two unused cascade maps per frame.
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
          // Capture depth/coverage, not lighting or the high-resolution artwork.
          // Keep custom arrival/discard shaders and alpha masks exactly as-is.
          replaced.push([object as Mesh, material]);
          (object as Mesh).material = opaque;
        }
      });
      const previous = gl.getRenderTarget();
      const autoClear = gl.autoClear;
      const shadowAutoUpdate = gl.shadowMap.autoUpdate;
      try {
        gl.autoClear = true;
        gl.shadowMap.autoUpdate = false;
        gl.setRenderTarget(target);
        // Keep real opaque/alpha-tested geometry and the transparent-black
        // spatial-screen masks. Their color alpha lets mist preserve DOM holes.
        // Modern render lists are keyed by scene/camera. A nested capture must
        // not truncate the main pass's active list. Retain one distinct camera.
        captureCamera ??= camera.clone(false);
        captureCamera.copy(camera, false);
        gl.render(scene, captureCamera);
      } finally {
        gl.setRenderTarget(previous);
        gl.autoClear = autoClear;
        gl.shadowMap.autoUpdate = shadowAutoUpdate;
        for (const object of hidden) object.visible = true;
        for (const [object, material] of replaced) object.material = material;
      }
      captured = true;
      return target;
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

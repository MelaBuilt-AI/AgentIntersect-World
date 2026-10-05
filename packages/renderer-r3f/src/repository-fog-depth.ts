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
  const hidden: Object3D[] = [];
  const replacedMeshes: Mesh[] = [];
  const replacedMaterials: (Material | Material[])[] = [];
  const skipsDepth = (material: Material) => !material.depthWrite;
  const usesPlainDepth = (material: Material) =>
    (material instanceof MeshStandardMaterial ||
      material instanceof MeshBasicMaterial) &&
    !material.transparent &&
    material.opacity === 1 &&
    material.alphaTest === 0 &&
    material.depthTest &&
    material.side === opaque.side &&
    material.onBeforeCompile === Material.prototype.onBeforeCompile;
  // This traversal runs every frame, including on bones/groups with no
  // material. Avoid temporary material arrays and replacement tuples per node.
  const prepareDepthObject = (object: Object3D) => {
    const material = (object as Mesh).material;
    if (
      object.visible &&
      (("isLight" in object && object.isLight) ||
        object.name === "repository-local-atmosphere" ||
        object.name === "world-wet-floor-reflection" ||
        object.name.startsWith("repository-terminal-rain:") ||
        (material &&
          (Array.isArray(material)
            ? material.every(skipsDepth)
            : skipsDepth(material))))
    ) {
      hidden.push(object);
      object.visible = false;
    } else if (
      object instanceof Mesh &&
      material &&
      (Array.isArray(material)
        ? material.every(usesPlainDepth)
        : usesPlainDepth(material))
    ) {
      // Keep custom arrival/discard shaders and alpha masks exactly as-is.
      replacedMeshes.push(object);
      replacedMaterials.push(material);
      object.material = opaque;
    }
  };

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
    scene.traverse(prepareDepthObject);
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
      for (let i = 0; i < replacedMeshes.length; i++) {
        replacedMeshes[i]!.material = replacedMaterials[i]!;
      }
      hidden.length = 0;
      replacedMeshes.length = 0;
      replacedMaterials.length = 0;
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

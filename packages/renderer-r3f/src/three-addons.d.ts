declare module "three/examples/jsm/postprocessing/EffectComposer.js" {
  import type { WebGLRenderer } from "three";
  export class EffectComposer {
    constructor(renderer: WebGLRenderer);
    addPass(pass: unknown): void;
    setSize(width: number, height: number): void;
    setPixelRatio(ratio: number): void;
    render(delta?: number): void;
    dispose(): void;
  }
}
declare module "three/examples/jsm/postprocessing/RenderPass.js" {
  import type { Object3D } from "three";
  export class RenderPass {
    constructor(scene: Object3D, camera: Object3D);
    dispose(): void;
  }
}
declare module "three/examples/jsm/postprocessing/OutputPass.js" {
  export class OutputPass {
    dispose(): void;
  }
}
declare module "three/examples/jsm/postprocessing/UnrealBloomPass.js" {
  import type { Vector2, ShaderMaterial } from "three";
  export class UnrealBloomPass {
    constructor(
      resolution: Vector2,
      strength: number,
      radius: number,
      threshold: number,
    );
    blendMaterial: ShaderMaterial;
    setSize(width: number, height: number): void;
    dispose(): void;
  }
}
declare module "three/examples/jsm/objects/Reflector.js" {
  import {
    Mesh,
    type BufferGeometry,
    type WebGLRenderer,
    type Object3D,
    type ShaderMaterial,
  } from "three";
  export class Reflector extends Mesh {
    constructor(
      geometry: BufferGeometry,
      options: {
        textureWidth: number;
        textureHeight: number;
        multisample: number;
        clipBias: number;
        color: number;
      },
    );
    material: ShaderMaterial;
    geometry: BufferGeometry;
    raycast: () => void;
    onBeforeRender: (
      renderer: WebGLRenderer,
      scene: Object3D,
      camera: Object3D,
    ) => void;
    dispose(): void;
  }
}

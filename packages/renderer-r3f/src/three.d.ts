declare module "three" {
  export type ColorRepresentation = string | number;
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    fromArray(array: ArrayLike<number>, offset?: number): this;
  }
  export class Object3D {
    position: Vector3;
    name: string;
    visible: boolean;
    clone(recursive?: boolean): this;
    traverse(callback: (object: Object3D) => void): void;
    getObjectByName(name: string): Object3D | undefined;
  }
  export class Group extends Object3D {}
  export class Material {}
  export class Texture {
    minFilter: unknown;
    dispose(): void;
  }
  export class CanvasTexture extends Texture {
    constructor(canvas: HTMLCanvasElement);
  }
  export const LinearFilter: unknown;
  export class SpriteMaterial extends Material {
    constructor(parameters?: {
      map?: Texture;
      transparent?: boolean;
      depthTest?: boolean;
    });
    map: Texture | null;
    dispose(): void;
  }
  export class Sprite extends Object3D {
    constructor(material?: SpriteMaterial);
    material: SpriteMaterial;
    scale: Vector3;
    renderOrder: number;
  }
  export class Mesh extends Object3D {
    constructor(geometry?: unknown, material?: unknown);
    material: Material | Material[];
  }
  export class BoxGeometry {
    constructor(width?: number, height?: number, depth?: number);
  }
  export class BufferGeometry {
    setFromPoints(points: readonly Vector3[]): this;
  }
  export class SphereGeometry {
    constructor(
      radius?: number,
      widthSegments?: number,
      heightSegments?: number,
    );
  }
  export class MeshStandardMaterial {
    constructor(parameters?: {
      color?: ColorRepresentation;
      roughness?: number;
    });
    color: Color;
    roughness: number;
  }
  export class MeshBasicMaterial {
    color: Color;
    wireframe: boolean;
  }
  export class LineBasicMaterial {
    constructor(parameters?: {
      color?: ColorRepresentation;
      transparent?: boolean;
      opacity?: number;
    });
  }
  export class LineSegments extends Object3D {
    constructor(geometry?: unknown, material?: unknown);
  }
  export class Color {
    constructor(color?: ColorRepresentation);
  }
  export class AmbientLight extends Object3D {
    intensity: number;
  }
  export class DirectionalLight extends Object3D {
    intensity: number;
  }
  export class GridHelper extends Object3D {
    constructor(
      size?: number,
      divisions?: number,
      colorCenterLine?: ColorRepresentation,
      colorGrid?: ColorRepresentation,
    );
  }

  export class Matrix4 {
    fromArray(array: ArrayLike<number>, offset?: number): this;
  }

  export class InstancedMesh extends Mesh {
    constructor(geometry?: unknown, material?: unknown, count?: number);
    readonly instanceMatrix: { needsUpdate: boolean };
    setMatrixAt(index: number, matrix: Matrix4): void;
  }
  export class AnimationClip {
    name: string;
  }
  export class AnimationAction {
    time: number;
    paused: boolean;
    reset(): this;
    play(): this;
    stop(): this;
    fadeIn(duration: number): this;
    fadeOut(duration: number): this;
    setEffectiveWeight(weight: number): this;
  }
  export class AnimationMixer {
    constructor(root: Object3D);
    clipAction(clip: AnimationClip): AnimationAction;
    update(delta: number): void;
  }
}

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  import type { AnimationClip, Group } from "three";
  export interface GLTF {
    scene: Group;
    animations: AnimationClip[];
  }
  export class GLTFLoader {
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (error: unknown) => void,
    ): void;
  }
}

declare module "three/examples/jsm/utils/SkeletonUtils.js" {
  import type { Group } from "three";
  export function clone<T extends Group>(source: T): T;
}

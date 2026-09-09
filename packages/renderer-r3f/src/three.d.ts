declare module "three" {
  export type ColorRepresentation = string | number | Color;
  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
    clone(): Vector2;
    toArray(): number[];
    set(x: number, y: number): this;
  }
  export class Plane {
    constructor(normal?: Vector3, constant?: number);
  }
  export class Raycaster {
    ray: { intersectPlane(plane: Plane, target: Vector3): Vector3 | null };
    setFromCamera(coords: Vector2, camera: Object3D): void;
  }
  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    clone(): Vector3;
    lerp(value: Vector3, alpha: number): this;
    applyMatrix4(matrix: Matrix4): this;
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    copy(value: Vector3): this;
    fromArray(array: ArrayLike<number>, offset?: number): this;
  }
  export class Euler {
    x: number;
    y: number;
    z: number;
  }
  export class Quaternion {
    setFromAxisAngle(axis: Vector3, angle: number): this;
    x: number;
    y: number;
    z: number;
    w: number;
  }
  export class Object3D {
    uuid: string;
    parent: Object3D | null;
    position: Vector3;
    rotation: Euler;
    quaternion: Quaternion;
    name: string;
    visible: boolean;
    scale: Vector3;
    castShadow: boolean;
    receiveShadow: boolean;
    userData: Record<string, unknown>;
    clone(recursive?: boolean): this;
    add(...objects: Object3D[]): this;
    remove(...objects: Object3D[]): this;
    traverse(callback: (object: Object3D) => void): void;
    getObjectByName(name: string): Object3D | undefined;
    updateMatrixWorld(force?: boolean): void;
  }
  export class Group extends Object3D {}
  export const NoBlending: number;
  export const DoubleSide: number;
  export const BackSide: number;
  export const AdditiveBlending: number;
  export const RepeatWrapping: number;
  export const SRGBColorSpace: string;
  export class Material {
    onBeforeCompile(
      shader: { uniforms: Record<string, unknown>; fragmentShader: string },
      renderer: WebGLRenderer,
    ): void;
    customProgramCacheKey(): string;
    needsUpdate: boolean;
    blending: number;
    side: number;
    depthWrite: boolean;
    fog: boolean;
    toneMapped: boolean;
    name: string;
    opacity: number;
    transparent: boolean;
    userData: Record<string, unknown>;
    clone(): this;
    dispose(): void;
  }
  export class Texture {
    minFilter: unknown;
    magFilter: unknown;
    generateMipmaps: boolean;
    colorSpace: string;
    wrapS: number;
    wrapT: number;
    repeat: Vector2;
    offset: Vector2;
    source: unknown;
    anisotropy: number;
    needsUpdate: boolean;
    dispose(): void;
  }
  export class TextureLoader {
    load(url: string, onLoad?: (texture: Texture) => void): Texture;
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
    renderOrder: number;
    constructor(geometry?: unknown, material?: unknown);
    material: Material | Material[];
  }
  export class BufferGeometry {
    dispose(): void;
    setFromPoints(points: readonly Vector3[]): this;
    rotateX(angle: number): this;
  }
  export class PlaneGeometry extends BufferGeometry {
    constructor(width?: number, height?: number);
  }
  export class BoxGeometry extends BufferGeometry {
    constructor(
      width?: number,
      height?: number,
      depth?: number,
      widthSegments?: number,
      heightSegments?: number,
      depthSegments?: number,
    );
  }
  export class ConeGeometry extends BufferGeometry {
    constructor(radius?: number, height?: number, radialSegments?: number);
  }
  export class CylinderGeometry extends BufferGeometry {
    constructor(
      radiusTop?: number,
      radiusBottom?: number,
      height?: number,
      radialSegments?: number,
      heightSegments?: number,
      openEnded?: boolean,
    );
  }
  export class IcosahedronGeometry extends BufferGeometry {
    constructor(radius?: number, detail?: number);
  }
  export class OctahedronGeometry extends BufferGeometry {
    constructor(radius?: number, detail?: number);
  }
  export class TorusGeometry extends BufferGeometry {
    constructor(
      radius?: number,
      tube?: number,
      radialSegments?: number,
      tubularSegments?: number,
    );
  }
  export class RingGeometry extends BufferGeometry {
    constructor(
      innerRadius?: number,
      outerRadius?: number,
      thetaSegments?: number,
    );
  }
  export class SphereGeometry {
    constructor(
      radius?: number,
      widthSegments?: number,
      heightSegments?: number,
    );
  }
  export class MeshStandardMaterial extends Material {
    map: Texture | null;
    emissiveMap: Texture | null;
    constructor(parameters?: {
      color?: ColorRepresentation;
      roughness?: number;
      metalness?: number;
      emissive?: ColorRepresentation;
      emissiveIntensity?: number;
    });
    color: Color;
    emissive: Color;
    emissiveIntensity: number;
    roughness: number;
    metalness: number;
  }
  export class MeshBasicMaterial extends Material {
    map: Texture | null;
    constructor(parameters?: {
      color?: ColorRepresentation;
      transparent?: boolean;
      opacity?: number;
    });
    color: Color;
    wireframe: boolean;
  }
  export class LineBasicMaterial extends Material {
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
    set(color: ColorRepresentation): this;
    getHexString(): string;
  }
  export class Box3 {
    setFromObject(object: Object3D): this;
    getCenter(target: Vector3): Vector3;
    getSize(target: Vector3): Vector3;
  }
  export class Scene extends Group {}
  export class PerspectiveCamera extends Object3D {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    lookAt(target: Vector3): void;
  }
  export class WebGLRenderTarget {
    constructor(width: number, height: number);
    texture: Texture;
    dispose(): void;
  }
  export class WebGLRenderer {
    capabilities: { getMaxAnisotropy(): number };
    domElement: HTMLCanvasElement;
    getContext(): WebGLRenderingContext | WebGL2RenderingContext;
    getRenderTarget(): WebGLRenderTarget | null;
    setRenderTarget(target: WebGLRenderTarget | null): void;
    getClearColor(target: Color): Color;
    getClearAlpha(): number;
    setClearColor(color: ColorRepresentation, alpha?: number): void;
    clear(): void;
    render(scene: Object3D, camera: Object3D): void;
  }
  export class AmbientLight extends Object3D {
    constructor(color?: ColorRepresentation, intensity?: number);
    intensity: number;
  }
  export class DirectionalLight extends Object3D {
    target: Object3D;
    constructor(color?: ColorRepresentation, intensity?: number);
    intensity: number;
  }
  export class GridHelper extends Object3D {
    geometry: BufferGeometry;
    material: Material | Material[];
    constructor(
      size?: number,
      divisions?: number,
      colorCenterLine?: ColorRepresentation,
      colorGrid?: ColorRepresentation,
    );
  }

  export class Matrix4 {
    elements: number[];
    compose(position: Vector3, quaternion: Quaternion, scale: Vector3): this;
    fromArray(array: ArrayLike<number>, offset?: number): this;
  }

  export class InstancedMesh extends Mesh {
    constructor(geometry?: unknown, material?: unknown, count?: number);
    readonly instanceMatrix: { needsUpdate: boolean };
    setMatrixAt(index: number, matrix: Matrix4): void;
  }
  export class AnimationClip {
    name: string;
    duration: number;
    tracks: KeyframeTrack[];
    clone(): AnimationClip;
  }
  export class KeyframeTrack {
    name: string;
    times: ArrayLike<number>;
    values: {
      readonly length: number;
      [index: number]: number;
    };
    getValueSize(): number;
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
    time: number;
    constructor(root: Object3D);
    clipAction(clip: AnimationClip): AnimationAction;
    update(delta: number): void;
    setTime(timeInSeconds: number): this;
    stopAllAction(): this;
    uncacheRoot(root: Object3D): void;
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

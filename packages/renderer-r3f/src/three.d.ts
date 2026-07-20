declare module "three" {
  export type ColorRepresentation = string | number;
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
  }
  export class Object3D {
    position: Vector3;
    name: string;
  }
  export class Mesh extends Object3D {
    constructor(geometry?: unknown, material?: unknown);
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
}

export type RenderObjectKind = "package" | "directory" | "file";
export type RenderEvidenceOutcome =
  "created" | "modified" | "deleted" | "renamed" | "binary" | "reported";

export type RepositoryRenderObject = {
  readonly ref: string;
  readonly kind: RenderObjectKind;
  readonly name: string;
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly bounds: {
    readonly x: number;
    readonly z: number;
    readonly width: number;
    readonly depth: number;
  };
  readonly evidenceOutcome?: RenderEvidenceOutcome;
};

export type PreparedInstanceGroup = {
  readonly count: number;
  readonly refs: readonly string[];
  readonly matrices: Float32Array;
};

export type PreparedRepositoryInstances = {
  readonly groups: Readonly<Record<RenderObjectKind, PreparedInstanceGroup>>;
  readonly total: number;
  readonly overview: { readonly width: number; readonly depth: number };
  readonly evidenceMarkers: readonly {
    readonly ref: string;
    readonly outcome: RenderEvidenceOutcome;
    readonly position: readonly [number, number, number];
  }[];
};

const renderKinds: readonly RenderObjectKind[] = [
  "package",
  "directory",
  "file",
];

function matrixFor(
  object: RepositoryRenderObject,
  target: Float32Array,
  offset: number,
) {
  const height =
    object.kind === "package" ? 2.4 : object.kind === "directory" ? 1.4 : 0.7;
  const width = Math.max(0.4, object.bounds.width * 0.82);
  const depth = Math.max(0.4, object.bounds.depth * 0.82);
  target.set(
    [
      width,
      0,
      0,
      0,
      0,
      height,
      0,
      0,
      0,
      0,
      depth,
      0,
      object.position.x,
      object.position.y + height / 2,
      object.position.z,
      1,
    ],
    offset,
  );
}

export function prepareRepositoryInstances(
  objects: readonly RepositoryRenderObject[],
): PreparedRepositoryInstances {
  const counts: Record<RenderObjectKind, number> = {
    package: 0,
    directory: 0,
    file: 0,
  };
  let width = 1;
  let depth = 1;
  for (const object of objects) {
    counts[object.kind] += 1;
    width = Math.max(width, object.bounds.x + object.bounds.width);
    depth = Math.max(depth, object.bounds.z + object.bounds.depth);
  }
  const mutable = Object.fromEntries(
    renderKinds.map((kind) => [
      kind,
      {
        refs: new Array<string>(counts[kind]),
        matrices: new Float32Array(counts[kind] * 16),
        cursor: 0,
      },
    ]),
  ) as Record<
    RenderObjectKind,
    { refs: string[]; matrices: Float32Array; cursor: number }
  >;
  for (const object of objects) {
    const group = mutable[object.kind];
    group.refs[group.cursor] = object.ref;
    matrixFor(object, group.matrices, group.cursor * 16);
    group.cursor += 1;
  }
  return {
    groups: {
      package: {
        count: counts.package,
        refs: mutable.package.refs,
        matrices: mutable.package.matrices,
      },
      directory: {
        count: counts.directory,
        refs: mutable.directory.refs,
        matrices: mutable.directory.matrices,
      },
      file: {
        count: counts.file,
        refs: mutable.file.refs,
        matrices: mutable.file.matrices,
      },
    },
    total: objects.length,
    overview: { width, depth },
    evidenceMarkers: objects
      .filter(
        (
          object,
        ): object is RepositoryRenderObject & {
          evidenceOutcome: RenderEvidenceOutcome;
        } => object.evidenceOutcome !== undefined,
      )
      .slice(0, 256)
      .map((object) => {
        const height =
          object.kind === "package"
            ? 2.4
            : object.kind === "directory"
              ? 1.4
              : 0.7;
        return {
          ref: object.ref,
          outcome: object.evidenceOutcome,
          position: [
            object.position.x,
            object.position.y + height / 2 + 1.55,
            object.position.z,
          ] as const,
        };
      }),
  };
}

export function measureRepositoryPreparation(
  objects: readonly RepositoryRenderObject[],
): {
  readonly prepared: PreparedRepositoryInstances;
  readonly durationMs: number;
} {
  const started = performance.now();
  const prepared = prepareRepositoryInstances(objects);
  return { prepared, durationMs: performance.now() - started };
}

export function boundedSemanticObjects<T>(
  objects: readonly T[],
  limit = 160,
): readonly T[] {
  return objects.slice(0, Math.max(0, Math.min(limit, 500)));
}

export type WebGLFallbackReason =
  "disabled" | "creation-failed" | "context-lost";
export type WebGLCapability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: WebGLFallbackReason };

export function resolveWebGLCapability(
  options: {
    readonly forceDisabled?: boolean;
    readonly createContext?: () => unknown;
  } = {},
): WebGLCapability {
  if (options.forceDisabled) return { available: false, reason: "disabled" };
  const createContext =
    options.createContext ??
    (() => {
      if (typeof document === "undefined") return null;
      const canvas = document.createElement("canvas");
      return canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    });
  try {
    return createContext() === null
      ? { available: false, reason: "creation-failed" }
      : { available: true };
  } catch {
    return { available: false, reason: "creation-failed" };
  }
}

export function projectToMinimap(
  object: RepositoryRenderObject,
  overview: { readonly width: number; readonly depth: number },
) {
  return {
    x: Math.min(
      100,
      Math.max(0, (object.position.x / Math.max(1, overview.width)) * 100),
    ),
    y: Math.min(
      100,
      Math.max(0, (object.position.z / Math.max(1, overview.depth)) * 100),
    ),
  };
}

export const RENDERER_CAPABILITY = {
  package: "renderer-r3f",
  phase: "repository-island",
  threeDimensionalRenderingAvailable: true,
  demandRendered: true,
} as const;

export { RepositoryIslandCanvas } from "./repository-island-canvas.js";

export type RenderObjectKind = "package" | "directory" | "file" | "symbol";
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
  readonly dependencyBridges: readonly PreparedDependencyBridge[];
};

export type PreparedDependencyBridge = {
  readonly ref: string;
  readonly sourceRef: string;
  readonly targetRef: string;
  readonly start: readonly [number, number, number];
  readonly end: readonly [number, number, number];
};

export type DependencyRelationship = {
  readonly ref: string;
  readonly sourceRef: string;
  readonly targetRefs: readonly string[];
  readonly confidence: readonly string[];
};

export const RENDER_OBJECT_KINDS = [
  "package",
  "directory",
  "file",
  "symbol",
] as const satisfies readonly RenderObjectKind[];

function matrixFor(
  object: RepositoryRenderObject,
  target: Float32Array,
  offset: number,
) {
  const height =
    object.kind === "package"
      ? 2.4
      : object.kind === "directory"
        ? 1.4
        : object.kind === "symbol"
          ? 0.35
          : 0.7;
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
    symbol: 0,
  };
  let width = 1;
  let depth = 1;
  for (const object of objects) {
    counts[object.kind] += 1;
    width = Math.max(width, object.bounds.x + object.bounds.width);
    depth = Math.max(depth, object.bounds.z + object.bounds.depth);
  }
  const mutable = Object.fromEntries(
    RENDER_OBJECT_KINDS.map((kind) => [
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
      symbol: {
        count: counts.symbol,
        refs: mutable.symbol.refs,
        matrices: mutable.symbol.matrices,
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
    dependencyBridges: [],
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

function retainSelection<T extends { readonly ref: string }>(
  values: readonly T[],
  limit: number,
  selectedRef: string | null,
): readonly T[] {
  if (values.length <= limit) return values;
  const selected = values.find((value) => value.ref === selectedRef);
  if (!selected || limit < 1) return values.slice(0, limit);
  const prefix = values.slice(0, limit);
  if (prefix.some((value) => value.ref === selected.ref)) return prefix;
  return [...values.slice(0, limit - 1), selected];
}

export function preparePhase10VisibleDetail(input: {
  readonly baseObjects: readonly RepositoryRenderObject[];
  readonly focusedFile: RepositoryRenderObject;
  readonly symbols: readonly { readonly ref: string; readonly name: string }[];
  readonly dependencies: readonly {
    readonly ref: string;
    readonly sourceFileRef: string;
    readonly candidateRefs: readonly string[];
    readonly confidence: readonly string[];
  }[];
  readonly selectedRef: string | null;
}): {
  readonly prepared: PreparedRepositoryInstances;
  readonly semanticSymbols: readonly {
    readonly ref: string;
    readonly name: string;
  }[];
  readonly visibleDependencyRefs: readonly string[];
  readonly dependencyBridges: readonly PreparedDependencyBridge[];
  readonly selectedRef: string | null;
  readonly symbolsTruncated: boolean;
  readonly dependenciesTruncated: boolean;
  readonly wholeRepositoryDetailMaterialized: false;
} {
  const visibleSymbols = retainSelection(input.symbols, 512, input.selectedRef);
  const symbolObjects: RepositoryRenderObject[] = visibleSymbols.map(
    (symbol, index) => {
      const column = index % 32;
      const row = Math.floor(index / 32);
      return {
        ref: symbol.ref,
        kind: "symbol",
        name: symbol.name,
        position: {
          x: input.focusedFile.position.x + column * 0.32,
          y: input.focusedFile.position.y + 1,
          z: input.focusedFile.position.z + row * 0.32,
        },
        bounds: {
          x: input.focusedFile.bounds.x + column * 0.32,
          z: input.focusedFile.bounds.z + row * 0.32,
          width: 0.24,
          depth: 0.24,
        },
      };
    },
  );
  const baseLimit = Math.max(0, 2_000 - symbolObjects.length);
  const base = retainSelection(
    input.baseObjects,
    baseLimit,
    input.focusedFile.ref,
  );
  const prepared = prepareRepositoryInstances([...base, ...symbolObjects]);
  const dependencyBridges = projectDependencyBridges(
    [...base, ...symbolObjects],
    input.dependencies.map((edge) => ({
      ref: edge.ref,
      sourceRef: edge.sourceFileRef,
      targetRefs: edge.candidateRefs,
      confidence: edge.confidence,
    })),
  );
  const preparedWithBridges = { ...prepared, dependencyBridges };
  return {
    prepared: preparedWithBridges,
    semanticSymbols: retainSelection(input.symbols, 200, input.selectedRef),
    visibleDependencyRefs: input.dependencies
      .slice(0, 1_024)
      .map((edge) => edge.ref),
    dependencyBridges,
    selectedRef: input.selectedRef,
    symbolsTruncated: input.symbols.length > 512,
    dependenciesTruncated: input.dependencies.length > 1_024,
    wholeRepositoryDetailMaterialized: false,
  };
}

function projectDependencyBridges(
  objects: readonly RepositoryRenderObject[],
  dependencies: readonly DependencyRelationship[],
): PreparedDependencyBridge[] {
  const byRef = new Map(objects.map((object) => [object.ref, object]));
  const bridges: PreparedDependencyBridge[] = [];
  for (const dependency of dependencies) {
    if (
      !dependency.confidence.some(
        (confidence) =>
          confidence === "exact_file" ||
          confidence === "exact_workspace_package",
      )
    )
      continue;
    const source = byRef.get(dependency.sourceRef);
    if (!source) continue;
    for (const targetRef of dependency.targetRefs) {
      const target = byRef.get(targetRef);
      if (!target) continue;
      bridges.push({
        ref: dependency.ref,
        sourceRef: dependency.sourceRef,
        targetRef,
        start: [source.position.x, source.position.y + 1, source.position.z],
        end: [target.position.x, target.position.y + 1, target.position.z],
      });
      if (bridges.length >= 1_024) return bridges;
    }
  }
  return bridges;
}

export function preparePhase10AggregateView(
  baseObjects: readonly RepositoryRenderObject[],
  dependencies: readonly {
    readonly key: string;
    readonly sourceRef: string;
    readonly targetRef: string | null;
    readonly confidence: readonly string[];
  }[],
): PreparedRepositoryInstances {
  const visibleObjects = baseObjects.slice(0, 2_000);
  const prepared = prepareRepositoryInstances(visibleObjects);
  return {
    ...prepared,
    dependencyBridges: projectDependencyBridges(
      visibleObjects,
      dependencies.slice(0, 1_024).map((edge) => ({
        ref: edge.key,
        sourceRef: edge.sourceRef,
        targetRefs: edge.targetRef === null ? [] : [edge.targetRef],
        confidence: edge.confidence,
      })),
    ),
  };
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
export { AvatarKitCanvas, AvatarKitRosterCanvas } from "./avatar-kit-canvas.js";

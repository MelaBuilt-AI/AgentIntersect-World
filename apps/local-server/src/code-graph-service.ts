import { createHash } from "node:crypto";

import {
  CodeGraphGenerationEngine,
  type CodeGraphGenerationResult,
} from "@agentintersect-world/spatial-code-graph/node";
import {
  CODE_GRAPH_MAX_AGGREGATE_EDGES,
  CODE_GRAPH_MAX_FOCUSED_SYMBOL_NODES,
  CODE_GRAPH_SCHEMA_VERSION,
  CodeGraphAggregateDataSchema,
  CodeGraphCurrentDataSchema,
  CodeGraphStatusSchema,
  FocusedFileGraphSchema,
  type CodeGraphAggregateData,
  type CodeGraphCurrentData,
  type CodeGraphSnapshot,
  type FocusedFileGraph,
  type RepositoryGeneration,
  type WorldObjectRef,
  type WorldSnapshot,
} from "@agentintersect-world/world-schema";

export class CodeGraphServiceError extends Error {
  override readonly name = "CodeGraphServiceError";
  constructor(
    readonly code: "not_found" | "validation" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

const confidenceOrder = [
  "exact_file",
  "exact_workspace_package",
  "external",
  "ambiguous",
  "unresolved",
  "unsupported",
  "unavailable",
] as const;

export class CodeGraphService {
  readonly #engine: CodeGraphGenerationEngine;
  #buildingGenerationId: string | null = null;
  #lastError: CodeGraphCurrentData["lastError"] = null;
  #world: WorldSnapshot | null = null;
  #task: Promise<CodeGraphGenerationResult> | null = null;

  constructor(engine: CodeGraphGenerationEngine) {
    this.#engine = engine;
  }

  async initialize(): Promise<void> {
    const loaded = await this.#engine.initialize();
    if (loaded.needsRebuild) this.#lastError = "cache_rebuild_required";
  }

  indexGeneration(
    generation: RepositoryGeneration,
    world: WorldSnapshot,
  ): Promise<CodeGraphGenerationResult> {
    this.#buildingGenerationId = generation.id;
    this.#lastError = null;
    const task = this.#engine.generate(generation, world);
    this.#task = task;
    void task.then(
      () => {
        if (this.#task !== task) return;
        this.#world = world;
        this.#buildingGenerationId = null;
        this.#lastError = null;
      },
      (error: unknown) => {
        if (this.#task !== task) return;
        this.#buildingGenerationId = null;
        this.#lastError =
          error instanceof Error && /superseded|cancelled/iu.test(error.message)
            ? "cancelled"
            : "generation_failed";
      },
    );
    return task;
  }

  status(): CodeGraphCurrentData {
    return CodeGraphCurrentDataSchema.parse({
      current: this.#summary(this.#engine.current()),
      previous: this.#summary(this.#engine.previous()),
      buildingGenerationId: this.#buildingGenerationId,
      lastError: this.#lastError,
    });
  }

  aggregate(lod: number, limit: number): CodeGraphAggregateData {
    const graph = this.#requireCurrent();
    if (
      !Number.isInteger(lod) ||
      lod < 0 ||
      lod > 2 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > CODE_GRAPH_MAX_AGGREGATE_EDGES
    )
      throw new CodeGraphServiceError(
        "validation",
        "Aggregate edge limit is out of range",
      );
    const worldByRef = new Map(
      (this.#world?.objects ?? []).map((object) => [object.ref, object]),
    );
    const projectRef = (ref: WorldObjectRef): WorldObjectRef => {
      if (lod === 2) return ref;
      if (lod === 0) return graph.repositoryRef;
      return worldByRef.get(ref)?.parentRef ?? graph.repositoryRef;
    };
    const groups = new Map<
      string,
      {
        sourceRef: WorldObjectRef;
        targetRef: WorldObjectRef | null;
        count: number;
        confidence: Set<(typeof confidenceOrder)[number]>;
        cycles: Set<string>;
      }
    >();
    for (const edge of graph.dependencies) {
      const targets =
        edge.candidateRefs.length > 0 ? edge.candidateRefs : [null];
      for (const candidate of targets) {
        const sourceRef = projectRef(edge.sourceFileRef);
        const targetRef = candidate === null ? null : projectRef(candidate);
        const key = `${sourceRef}\0${targetRef ?? edge.confidence.join("+")}`;
        const group = groups.get(key) ?? {
          sourceRef,
          targetRef,
          count: 0,
          confidence: new Set(),
          cycles: new Set<string>(),
        };
        group.count += 1;
        for (const confidence of edge.confidence)
          group.confidence.add(confidence);
        if (edge.cycleGroupId) group.cycles.add(edge.cycleGroupId);
        groups.set(key, group);
      }
    }
    const all = [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([groupKey, group]) => ({
        key: createHash("sha256").update(groupKey).digest("hex").slice(0, 32),
        sourceRef: group.sourceRef,
        targetRef: group.targetRef,
        count: group.count,
        confidence: confidenceOrder.filter((value) =>
          group.confidence.has(value),
        ),
        cycleGroupId:
          group.cycles.size === 1 ? ([...group.cycles][0] ?? null) : null,
      }));
    return CodeGraphAggregateDataSchema.parse({
      schema: CODE_GRAPH_SCHEMA_VERSION,
      generationId: graph.generationId,
      lod,
      edges: all.slice(0, limit),
      totalEdges: all.length,
      truncated: all.length > limit,
    });
  }

  focused(fileRef: WorldObjectRef): FocusedFileGraph {
    const graph = this.#requireCurrent();
    const coverage = graph.coverage.find(
      (record) => record.fileRef === fileRef,
    );
    if (!coverage)
      throw new CodeGraphServiceError(
        "not_found",
        "Focused file is not in the current graph",
      );
    const symbols = graph.symbols.filter(
      (symbol) => symbol.fileRef === fileRef,
    );
    const dependencies = graph.dependencies.filter(
      (edge) => edge.sourceFileRef === fileRef,
    );
    return FocusedFileGraphSchema.parse({
      schema: CODE_GRAPH_SCHEMA_VERSION,
      generationId: graph.generationId,
      state: graph.state,
      fileRef,
      coverage,
      symbols,
      dependencies,
      visibleSymbolNodes: symbols.slice(0, CODE_GRAPH_MAX_FOCUSED_SYMBOL_NODES),
      truncated:
        symbols.length > CODE_GRAPH_MAX_FOCUSED_SYMBOL_NODES ||
        dependencies.length > CODE_GRAPH_MAX_AGGREGATE_EDGES,
    });
  }

  async close(): Promise<void> {
    await this.#engine.close();
    await this.#task?.catch(() => undefined);
  }

  #requireCurrent(): CodeGraphSnapshot {
    const graph = this.#engine.current();
    if (!graph)
      throw new CodeGraphServiceError(
        this.#buildingGenerationId ? "unavailable" : "not_found",
        this.#buildingGenerationId
          ? "Code graph generation is still in progress"
          : "No verified code graph is available",
      );
    return graph;
  }

  #summary(graph: CodeGraphSnapshot | null) {
    if (!graph) return null;
    return CodeGraphStatusSchema.parse({
      schema: graph.schema,
      repositoryRef: graph.repositoryRef,
      generationId: graph.generationId,
      state: graph.state,
      degraded: graph.degraded,
      coverage: graph.coverage,
      counts: graph.counts,
      limits: graph.limits,
    });
  }
}

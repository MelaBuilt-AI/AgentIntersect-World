import {
  CodeGraphAggregateDataSchema,
  CodeGraphCurrentDataSchema,
  FocusedFileGraphSchema,
  type FocusedFileGraph,
} from "@agentintersect-world/world-schema";

import { PHASE5_WORLD_FIXTURE } from "./phase5-world.js";

const generationId = "10101010-1010-4010-8010-101010101010";
const files = PHASE5_WORLD_FIXTURE.objects.filter(
  (object) => object.kind === "file",
);

const coverage = files.map((file, index) => ({
  fileRef: file.ref,
  language: index === 1 ? null : "typescript",
  state: index === 1 ? "fallback" : "parsed",
  confidence: index === 1 ? ["unsupported"] : ["exact_file"],
  fallbackReason: index === 1 ? "unsupported_extension" : null,
  symbolCount: index === 1 ? 0 : index === 0 ? 3 : 1,
  dependencyCount: index === 0 ? 2 : 0,
  diagnostics: index === 1 ? [{ code: "unsupported_extension", count: 1 }] : [],
}));

export const PHASE10_CODE_GRAPH_STATUS = CodeGraphCurrentDataSchema.parse({
  current: {
    schema: "aiw.code-graph/0.10",
    repositoryRef: PHASE5_WORLD_FIXTURE.repositoryRef,
    generationId,
    state: "current",
    degraded: true,
    coverage,
    counts: { files: 3, parsedFiles: 2, symbols: 4, dependencies: 2 },
    limits: {
      maxSymbolsPerFile: 2000,
      maxDependenciesPerFile: 2000,
      maxAggregateEdges: 1024,
      maxFocusedSymbolNodes: 512,
    },
  },
  previous: {
    schema: "aiw.code-graph/0.10",
    repositoryRef: PHASE5_WORLD_FIXTURE.repositoryRef,
    generationId: "09090909-0909-4909-8909-090909090909",
    state: "previous",
    degraded: false,
    coverage: coverage.filter((record) => record.state === "parsed"),
    counts: { files: 2, parsedFiles: 2, symbols: 4, dependencies: 2 },
    limits: {
      maxSymbolsPerFile: 2000,
      maxDependenciesPerFile: 2000,
      maxAggregateEdges: 1024,
      maxFocusedSymbolNodes: 512,
    },
  },
  buildingGenerationId: null,
  lastError: null,
});

export const PHASE10_CODE_GRAPH_AGGREGATE = CodeGraphAggregateDataSchema.parse({
  schema: "aiw.code-graph/0.10",
  generationId,
  lod: 2,
  edges: [
    {
      key: "11111111111111111111111111111111",
      sourceRef: files[0]!.ref,
      targetRef: files[2]!.ref,
      count: 1,
      confidence: ["exact_file"],
      cycleGroupId: "cccccccccccccccccccccccccccccccc",
    },
    {
      key: "22222222222222222222222222222222",
      sourceRef: files[0]!.ref,
      targetRef: null,
      count: 1,
      confidence: ["external"],
      cycleGroupId: null,
    },
  ],
  totalEdges: 2,
  truncated: false,
});

export const PHASE10_CODE_GRAPH_10K_STATUS = CodeGraphCurrentDataSchema.parse({
  current: {
    schema: "aiw.code-graph/0.10",
    repositoryRef: PHASE5_WORLD_FIXTURE.repositoryRef,
    generationId: "15151515-1515-4515-8515-151515151515",
    state: "current",
    degraded: false,
    coverage: Array.from({ length: 500 }, (_, index) => ({
      fileRef: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      language: (["typescript", "tsx", "javascript", "jsx"] as const)[
        index % 4
      ],
      state: "parsed",
      confidence: ["exact_file"],
      fallbackReason: null,
      symbolCount: 16,
      dependencyCount: 3,
      diagnostics: [],
    })),
    counts: {
      files: 500,
      parsedFiles: 500,
      symbols: 8_000,
      dependencies: 1_500,
    },
    limits: {
      maxSymbolsPerFile: 2000,
      maxDependenciesPerFile: 2000,
      maxAggregateEdges: 1024,
      maxFocusedSymbolNodes: 512,
    },
  },
  previous: null,
  buildingGenerationId: null,
  lastError: null,
});

export const PHASE10_CODE_GRAPH_100K_STATUS = CodeGraphCurrentDataSchema.parse({
  current: {
    schema: "aiw.code-graph/0.10",
    repositoryRef: PHASE5_WORLD_FIXTURE.repositoryRef,
    generationId: "20202020-2020-4020-8020-202020202020",
    state: "current",
    degraded: false,
    coverage: Array.from({ length: 5_000 }, (_, index) => ({
      fileRef: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      language: (["typescript", "tsx", "javascript", "jsx"] as const)[
        index % 4
      ],
      state: "parsed",
      confidence: ["exact_file"],
      fallbackReason: null,
      symbolCount: 16,
      dependencyCount: 3,
      diagnostics: [],
    })),
    counts: {
      files: 5_000,
      parsedFiles: 5_000,
      symbols: 80_000,
      dependencies: 15_000,
    },
    limits: {
      maxSymbolsPerFile: 2000,
      maxDependenciesPerFile: 2000,
      maxAggregateEdges: 1024,
      maxFocusedSymbolNodes: 512,
    },
  },
  previous: null,
  buildingGenerationId: null,
  lastError: null,
});

export function createPhase10FocusedFixture(fileRef: string): FocusedFileGraph {
  const fileCoverage =
    coverage.find((record) => record.fileRef === fileRef) ?? coverage[0]!;
  const symbols =
    fileCoverage.state === "fallback"
      ? []
      : ["start", "resolve", "render"]
          .slice(0, fileCoverage.symbolCount)
          .map((name, index) => ({
            schema: "aiw.symbol/0.10",
            id: `${index + 1}`.padStart(32, "a"),
            ref: `aiw://symbol/${`${index + 1}`.padStart(32, "a")}`,
            fileRef,
            language: "typescript",
            kind: "function",
            name,
            qualifiedName: `Fixture.${name}`,
            duplicateOrdinal: 0,
            duplicateGroupKey: `${index + 1}`.padStart(32, "b"),
            exported: index === 0,
            range: {
              start: { line: index * 4 + 1, column: 0 },
              end: { line: index * 4 + 3, column: 1 },
            },
            confidence: ["exact_file"],
          }));
  const dependencies =
    fileRef === files[0]?.ref
      ? [
          {
            schema: "aiw.dependency/0.10",
            id: "11111111111111111111111111111111",
            ref: "aiw://dependency/11111111111111111111111111111111",
            sourceFileRef: fileRef,
            kind: "import",
            specifier: "./signals.xyzzy",
            occurrenceOrdinal: 0,
            candidateRefs: [files[2]!.ref],
            confidence: ["exact_file"],
            cycleGroupId: "cccccccccccccccccccccccccccccccc",
          },
          {
            schema: "aiw.dependency/0.10",
            id: "22222222222222222222222222222222",
            ref: "aiw://dependency/22222222222222222222222222222222",
            sourceFileRef: fileRef,
            kind: "import",
            specifier: "external-only",
            occurrenceOrdinal: 1,
            candidateRefs: [],
            confidence: ["external"],
            cycleGroupId: null,
          },
        ]
      : [];
  return FocusedFileGraphSchema.parse({
    schema: "aiw.code-graph/0.10",
    generationId,
    state: "current",
    fileRef,
    coverage: fileCoverage,
    symbols,
    dependencies,
    visibleSymbolNodes: symbols,
    truncated: false,
  });
}

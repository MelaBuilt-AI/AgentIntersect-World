import { describe, expect, it } from "vitest";

import {
  CodeGraphSnapshotSchema,
  DependencyEdgeSchema,
  FocusedFileGraphSchema,
  SymbolRecordSchema,
} from "../src/index.js";

const fileRef = "aiw://object/11111111111111111111111111111111";
const symbolRef = "aiw://symbol/22222222222222222222222222222222";

describe("Phase 10 code graph schemas", () => {
  it("accepts strict path-private symbols and rejects bodies and absolute paths", () => {
    const symbol = {
      schema: "aiw.symbol/0.10",
      id: "22222222222222222222222222222222",
      ref: symbolRef,
      fileRef,
      language: "typescript",
      kind: "function",
      name: "run",
      qualifiedName: "Worker.run",
      duplicateOrdinal: 0,
      duplicateGroupKey: "33333333333333333333333333333333",
      exported: true,
      range: {
        start: { line: 4, column: 2 },
        end: { line: 7, column: 3 },
      },
      confidence: ["exact_file"],
    };
    expect(SymbolRecordSchema.parse(symbol)).toEqual(symbol);
    expect(
      SymbolRecordSchema.safeParse({ ...symbol, sourceBody: "secret" }).success,
    ).toBe(false);
    expect(
      SymbolRecordSchema.safeParse({ ...symbol, qualifiedName: "/home/me/x" })
        .success,
    ).toBe(false);
  });

  it("preserves explicit ambiguous/cyclic dependency truth", () => {
    const edge = {
      schema: "aiw.dependency/0.10",
      id: "44444444444444444444444444444444",
      ref: "aiw://dependency/44444444444444444444444444444444",
      sourceFileRef: fileRef,
      kind: "import",
      specifier: "./target",
      occurrenceOrdinal: 0,
      candidateRefs: [
        "aiw://object/55555555555555555555555555555555",
        "aiw://object/66666666666666666666666666666666",
      ],
      confidence: ["ambiguous"],
      cycleGroupId: "77777777777777777777777777777777",
    };
    expect(DependencyEdgeSchema.parse(edge)).toEqual(edge);
  });

  it("requires coverage for every file and denies whole-repository detail shapes", () => {
    const graph = {
      schema: "aiw.code-graph/0.10",
      repositoryRef: "aiw://object/88888888888888888888888888888888",
      generationId: "11111111-1111-4111-8111-111111111111",
      state: "current",
      degraded: true,
      coverage: [
        {
          fileRef,
          language: "typescript",
          state: "fallback",
          confidence: ["unavailable"],
          fallbackReason: "grammar_unavailable",
          symbolCount: 0,
          dependencyCount: 0,
          diagnostics: [{ code: "grammar_unavailable", count: 1 }],
        },
      ],
      symbols: [],
      dependencies: [],
      counts: { files: 1, parsedFiles: 0, symbols: 0, dependencies: 0 },
      limits: {
        maxSymbolsPerFile: 2000,
        maxDependenciesPerFile: 2000,
        maxAggregateEdges: 1024,
        maxFocusedSymbolNodes: 512,
      },
    };
    expect(CodeGraphSnapshotSchema.parse(graph)).toEqual(graph);
    expect(
      FocusedFileGraphSchema.safeParse({ ...graph, allDetail: true }).success,
    ).toBe(false);
  });
});

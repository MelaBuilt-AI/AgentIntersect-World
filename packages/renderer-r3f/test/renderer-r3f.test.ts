import { describe, expect, it } from "vitest";

import {
  RENDER_OBJECT_KINDS,
  boundedSemanticObjects,
  preparePhase10AggregateView,
  preparePhase10VisibleDetail,
  prepareRepositoryInstances,
  resolveWebGLCapability,
} from "../src/index.js";

describe("repository renderer preparation", () => {
  it("mounts every prepared instance kind, including focused symbols, in the shared R3F lane", () => {
    expect(RENDER_OBJECT_KINDS).toEqual([
      "package",
      "directory",
      "file",
      "symbol",
    ]);
  });

  it("prepares 10,000 deterministic transforms without DOM materialization", () => {
    const objects = Array.from({ length: 10_000 }, (_, index) => ({
      ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      kind: "file" as const,
      name: `file-${index}.unknown`,
      position: { x: index % 100, y: 0, z: Math.floor(index / 100) },
      bounds: {
        x: index % 100,
        z: Math.floor(index / 100),
        width: 1,
        depth: 1,
      },
    }));
    const started = performance.now();
    const prepared = prepareRepositoryInstances(objects);
    const durationMs = performance.now() - started;
    expect(prepared.groups.file.count).toBe(10_000);
    expect(prepared.groups.file.matrices).toHaveLength(160_000);
    expect(durationMs).toBeLessThan(250);
    expect(boundedSemanticObjects(objects, 120)).toHaveLength(120);
  });

  it("reports disabled and creation-failure fallbacks truthfully", () => {
    expect(resolveWebGLCapability({ forceDisabled: true })).toEqual({
      available: false,
      reason: "disabled",
    });
    expect(resolveWebGLCapability({ createContext: () => null })).toEqual({
      available: false,
      reason: "creation-failed",
    });
  });

  it("retains bounded persistent evidence markers independently of motion", () => {
    const prepared = prepareRepositoryInstances([
      {
        ref: "aiw://object/00000000000000000000000000000001",
        kind: "file",
        name: "changed.ts",
        position: { x: 4, y: 0, z: 6 },
        bounds: { x: 3, z: 5, width: 2, depth: 2 },
        evidenceOutcome: "modified",
      },
      {
        ref: "aiw://object/00000000000000000000000000000002",
        kind: "file",
        name: "unchanged.ts",
        position: { x: 8, y: 0, z: 6 },
        bounds: { x: 7, z: 5, width: 2, depth: 2 },
      },
    ]);
    expect(prepared.evidenceMarkers).toEqual([
      {
        ref: "aiw://object/00000000000000000000000000000001",
        outcome: "modified",
        position: [4, 1.9, 6],
      },
    ]);
  });

  it("caps focus-only Phase 10 symbols, edges, total instances, and semantic rows", () => {
    const base = Array.from({ length: 2_000 }, (_, index) => ({
      ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      kind: "file" as const,
      name: `file-${index}.ts`,
      position: { x: index % 100, y: 0, z: Math.floor(index / 100) },
      bounds: {
        x: index % 100,
        z: Math.floor(index / 100),
        width: 1,
        depth: 1,
      },
    }));
    const symbols = Array.from({ length: 2_000 }, (_, index) => ({
      ref: `aiw://symbol/${index.toString(16).padStart(32, "0")}`,
      name: `symbol-${index}`,
    }));
    const detail = preparePhase10VisibleDetail({
      baseObjects: base,
      focusedFile: base[0]!,
      symbols,
      dependencies: Array.from({ length: 2_000 }, (_, index) => ({
        ref: `edge-${index}`,
        sourceFileRef: base[0]!.ref,
        candidateRefs: [],
        confidence: ["external"],
      })),
      selectedRef: symbols[700]!.ref,
    });
    expect(detail.prepared.total).toBeLessThanOrEqual(2_000);
    expect(detail.prepared.groups.symbol.count).toBe(512);
    expect(detail.visibleDependencyRefs).toHaveLength(1_024);
    expect(detail.semanticSymbols).toHaveLength(200);
    expect(detail.symbolsTruncated).toBe(true);
    expect(detail.dependenciesTruncated).toBe(true);
    expect(detail.selectedRef).toBe(symbols[700]!.ref);
    expect(detail.wholeRepositoryDetailMaterialized).toBe(false);
  });

  it("projects only bounded drawable exact dependency bridges", () => {
    const source = {
      ref: "aiw://object/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      kind: "file" as const,
      name: "source.ts",
      position: { x: 1, y: 0, z: 2 },
      bounds: { x: 1, z: 2, width: 1, depth: 1 },
    };
    const target = {
      ref: "aiw://object/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      kind: "file" as const,
      name: "target.ts",
      position: { x: 8, y: 0, z: 9 },
      bounds: { x: 8, z: 9, width: 1, depth: 1 },
    };
    const detail = preparePhase10VisibleDetail({
      baseObjects: [source, target],
      focusedFile: source,
      symbols: [],
      dependencies: [
        {
          ref: "aiw://dependency/11111111111111111111111111111111",
          sourceFileRef: source.ref,
          candidateRefs: [target.ref],
          confidence: ["exact_file"],
        },
        {
          ref: "aiw://dependency/22222222222222222222222222222222",
          sourceFileRef: source.ref,
          candidateRefs: [],
          confidence: ["external"],
        },
      ],
      selectedRef: source.ref,
    });
    expect(detail.dependencyBridges).toEqual([
      expect.objectContaining({
        ref: "aiw://dependency/11111111111111111111111111111111",
        sourceRef: source.ref,
        targetRef: target.ref,
      }),
    ]);
    expect(detail.visibleDependencyRefs).toHaveLength(2);
  });

  it("caps aggregate repository objects and dependency bridges", () => {
    const objects = Array.from({ length: 2_500 }, (_, index) => ({
      ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      kind: "file" as const,
      name: `file-${index}.ts`,
      position: { x: index, y: 0, z: 0 },
      bounds: { x: index, z: 0, width: 1, depth: 1 },
    }));
    const prepared = preparePhase10AggregateView(
      objects,
      Array.from({ length: 1_100 }, (_, index) => ({
        key: `edge-${index}`,
        sourceRef: objects[index]!.ref,
        targetRef: objects[index + 1]!.ref,
        confidence: ["exact_file"],
      })),
    );
    expect(prepared.total).toBe(2_000);
    expect(prepared.dependencyBridges).toHaveLength(1_024);
  });

  it("reuses the decimated 100k aggregate instead of repeating full frame work", () => {
    const objects = Array.from({ length: 100_000 }, (_, index) => ({
      ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      kind: "file" as const,
      name: `file-${index}.ts`,
      position: { x: index % 500, y: 0, z: Math.floor(index / 500) },
      bounds: {
        x: index % 500,
        z: Math.floor(index / 500),
        width: 1,
        depth: 1,
      },
    }));
    const dependencies: never[] = [];
    const first = preparePhase10AggregateView(objects, dependencies);
    const samples: number[] = [];
    let latest = first;
    for (let frame = 0; frame < 120; frame += 1) {
      const started = performance.now();
      latest = preparePhase10AggregateView(objects, dependencies);
      samples.push(performance.now() - started);
    }
    const p95 = [...samples].sort((left, right) => left - right)[113]!;

    expect(latest).toBe(first);
    expect(latest.total).toBe(2_000);
    expect(p95).toBeLessThanOrEqual(33.3);
  });
});

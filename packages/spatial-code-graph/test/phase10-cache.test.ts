import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { CodeGraphCacheStore } from "@agentintersect-world/spatial-code-graph/node";
import {
  CODE_GRAPH_SCHEMA_VERSION,
  CodeGraphSnapshotSchema,
  type CodeGraphSnapshot,
} from "@agentintersect-world/world-schema";

const roots: string[] = [];
const generationA = "11111111-1111-4111-8111-111111111111";
const generationB = "22222222-2222-4222-8222-222222222222";

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

function graph(generationId: string): CodeGraphSnapshot {
  return CodeGraphSnapshotSchema.parse({
    schema: CODE_GRAPH_SCHEMA_VERSION,
    repositoryRef: "aiw://object/88888888888888888888888888888888",
    generationId,
    state: "current",
    degraded: false,
    coverage: [],
    symbols: [],
    dependencies: [],
    counts: { files: 0, parsedFiles: 0, symbols: 0, dependencies: 0 },
    limits: {
      maxSymbolsPerFile: 2000,
      maxDependenciesPerFile: 2000,
      maxAggregateEdges: 1024,
      maxFocusedSymbolNodes: 512,
    },
  });
}

describe("Phase 10 checksum cache and last-good recovery", () => {
  it("atomically retains current plus one previous verified generation", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-cache-"));
    roots.push(root);
    const store = new CodeGraphCacheStore(root);
    await store.commit({ graph: graph(generationA), entries: [] });
    await store.commit({ graph: graph(generationB), entries: [] });
    const loaded = await store.load();
    expect(loaded.current?.graph.generationId).toBe(generationB);
    expect(loaded.previous?.graph.generationId).toBe(generationA);
    expect(loaded.recovered).toBe(false);
  });

  it("fails closed to the previous verified graph after current corruption", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-corrupt-"));
    roots.push(root);
    const store = new CodeGraphCacheStore(root);
    await store.commit({ graph: graph(generationA), entries: [] });
    await store.commit({ graph: graph(generationB), entries: [] });
    await writeFile(join(root, "current.json"), '{"payload":{"secret":"bad"}}');
    const recovered = await store.load();
    expect(recovered.current?.graph.generationId).toBe(generationA);
    expect(recovered.current?.graph.state).toBe("previous");
    expect(recovered.previous).toBeNull();
    expect(recovered.recovered).toBe(true);
    expect(recovered.needsRebuild).toBe(true);
  });

  it("rejects incompatible schema/extractor state instead of reinterpreting it", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-incompatible-"));
    roots.push(root);
    const store = new CodeGraphCacheStore(root);
    await store.commit({ graph: graph(generationA), entries: [] });
    await writeFile(
      join(root, "current.json"),
      JSON.stringify({
        payload: { schema: "aiw.code-graph/0.09" },
        checksum: "0".repeat(64),
      }),
    );
    const loaded = await store.load();
    expect(loaded.current).toBeNull();
    expect(loaded.needsRebuild).toBe(true);
  });

  it("discards a cancelled staged commit without mutating either last-good snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-cancelled-stage-"));
    roots.push(root);
    const store = new CodeGraphCacheStore(root);
    await store.commit({ graph: graph(generationA), entries: [] });
    await store.commit({ graph: graph(generationB), entries: [] });
    let checks = 0;
    await expect(
      store.commit(
        {
          graph: graph("33333333-3333-4333-8333-333333333333"),
          entries: [],
        },
        () => {
          checks += 1;
          return checks === 1;
        },
      ),
    ).rejects.toThrow(/superseded|cancelled/u);
    const loaded = await store.load();
    expect(loaded.current?.graph.generationId).toBe(generationB);
    expect(loaded.previous?.graph.generationId).toBe(generationA);
  });
});

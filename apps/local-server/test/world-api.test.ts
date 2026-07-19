import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
  ApiResultSchema,
  CurrentWorldSnapshotDataSchema,
  type RepositoryFile,
  type RepositoryGeneration,
  WorldTileQueryResponseSchema,
} from "@agentintersect-world/world-schema";
import { projectRepositoryGeneration } from "@agentintersect-world/spatial-code-graph";

import { createLocalServer } from "../src/server.js";

const roots: string[] = [];
const servers: Array<ReturnType<typeof createLocalServer>> = [];
const correlationId = "7dc2d8ec-7710-49aa-a3ee-517d68dc5ff1";
const config = {
  networkScope: "loopback" as const,
  host: "127.0.0.1",
  port: 3770,
  instanceName: "World API Test",
  demoOperationMaxMs: 500,
  repositoryMaxFiles: 2_500,
};

async function indexedServer() {
  const root = await mkdtemp(join(tmpdir(), "aiw-phase4-server-"));
  roots.push(root);
  await writeFile(join(root, "index.ts"), "export const ok = true;\n");
  const server = createLocalServer({ config });
  servers.push(server);
  const created = await server.inject({
    method: "POST",
    url: "/repository-indexes",
    headers: { "idempotency-key": "phase4-world" },
    payload: { rootPath: root },
  });
  const id = created.json().data.id as string;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const operation = await server.inject({
      method: "GET",
      url: `/repository-indexes/${id}`,
    });
    if (operation.json().data.status === "succeeded") return { server, root };
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("repository index did not settle");
}

const HASH = "a".repeat(64);
const validTileQuery = "lod=4&minX=0&maxX=15&minZ=0&maxZ=15&limit=16";

function metadataGeneration(
  rootPath: string,
  paths: string[],
  id: string,
  fingerprintCharacter: string,
): RepositoryGeneration {
  const files: RepositoryFile[] = paths.map((path) => ({
    path,
    size: 12,
    fileKind: "source",
    language: "TypeScript",
    binary: false,
    oversized: false,
    contentHash: HASH,
    gitStatus: null,
  }));
  return {
    id,
    fingerprint: fingerprintCharacter.repeat(64),
    rootPath,
    repositoryName: "fixture",
    startedAt: "2026-07-19T12:00:00.000Z",
    completedAt: "2026-07-19T12:00:01.000Z",
    durationMs: 1_000,
    git: { present: false, branch: null, head: null, dirty: false },
    directories: [
      { path: "", fileCount: files.length },
      { path: "src", fileCount: files.length },
    ],
    files,
    packages: [],
    coverage: {
      discoveredFiles: files.length,
      indexedFiles: files.length,
      prunedEntries: 0,
      skippedSymlinks: 0,
      directories: 2,
      packages: 0,
      binaryFiles: 0,
      oversizedFiles: 0,
      bytesHashed: files.length * 12,
    },
  };
}

function metadataServer(generations: RepositoryGeneration[]) {
  const queue = generations.slice();
  const server = createLocalServer({
    config,
    repositoryIndexer: async () => {
      const generation = queue.shift();
      if (!generation) throw new Error("no injected generation remains");
      return generation;
    },
  });
  servers.push(server);
  return server;
}

async function indexMetadataGeneration(
  server: ReturnType<typeof createLocalServer>,
  key: string,
  rootPath: string,
) {
  const created = await server.inject({
    method: "POST",
    url: "/repository-indexes",
    headers: { "idempotency-key": key },
    payload: { rootPath },
  });
  const id = created.json().data.id as string;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const operation = await server.inject({
      method: "GET",
      url: `/repository-indexes/${id}`,
    });
    if (operation.json().data.status !== "running")
      return operation.json().data;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("injected repository index did not settle");
}

const worldFile = (snapshot: ReturnType<typeof projectRepositoryGeneration>) =>
  snapshot.objects.find((object) => object.kind === "file");

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Phase 4 read-only World API", () => {
  it("returns a correlated truthful not-found response without a generation", async () => {
    const server = createLocalServer({ config });
    servers.push(server);
    const response = await server.inject({
      method: "GET",
      url: "/world/current",
      headers: { "x-correlation-id": correlationId },
    });
    expect(response.statusCode).toBe(404);
    expect(response.headers["x-correlation-id"]).toBe(correlationId);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "not_found",
        message: "No successful repository generation is available",
        retryable: false,
      },
      meta: { correlationId, schema: "aiw.api/0.3" },
    });
  });

  it.each([
    "lod=5&minX=0&maxX=15&minZ=0&maxZ=15&limit=1",
    "lod=4&minX=4&maxX=3&minZ=0&maxZ=15&limit=1",
    "lod=4&minX=0&maxX=15&minZ=0&maxZ=15&limit=129",
    "lod=4&minX=0&maxX=15&minZ=0&maxZ=15&limit=1&rootPath=%2Fprivate",
  ])(
    "rejects an invalid bounded tile query before projection: %s",
    async (query) => {
      const server = createLocalServer({ config });
      servers.push(server);
      const response = await server.inject({
        method: "GET",
        url: `/world/tiles?${query}`,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        ok: false,
        error: { code: "validation", retryable: false },
      });
      expect(response.body).not.toContain("/private");
    },
  );

  it("returns strict correlated private snapshot and bounded tile envelopes", async () => {
    const { server, root } = await indexedServer();
    const current = await server.inject({
      method: "GET",
      url: "/world/current",
      headers: { "x-correlation-id": correlationId },
    });
    expect(current.statusCode).toBe(200);
    const currentBody = ApiResultSchema(CurrentWorldSnapshotDataSchema).parse(
      current.json(),
    );
    expect(currentBody.data.snapshot.schema).toBe("aiw.world/0.4");
    expect(currentBody.meta.correlationId).toBe(correlationId);
    expect(current.body).not.toContain(root);
    expect(current.body).not.toContain("rootPath");

    const tiles = await server.inject({
      method: "GET",
      url: "/world/tiles?lod=4&minX=0&maxX=15&minZ=0&maxZ=15&limit=2",
      headers: { "x-correlation-id": correlationId },
    });
    expect(tiles.statusCode).toBe(200);
    const tileBody = ApiResultSchema(WorldTileQueryResponseSchema).parse(
      tiles.json(),
    );
    expect(tileBody.data.tiles.length).toBeLessThanOrEqual(2);
    expect(tileBody.data.snapshotId).toBe(currentBody.data.snapshot.snapshotId);
    expect(tiles.body).not.toContain(root);
    expect(tiles.body).not.toContain("rootPath");
  });

  it("preserves rename continuity without an intermediate World read", async () => {
    const rootPath = "/private/operator/workspaces/continuity";
    const firstGeneration = metadataGeneration(
      rootPath,
      ["src/old.ts"],
      "88c22eef-64c8-493e-ad67-87ed41f64661",
      "1",
    );
    const renamedGeneration = metadataGeneration(
      rootPath,
      ["src/new.ts"],
      "88c22eef-64c8-493e-ad67-87ed41f64662",
      "2",
    );
    const expectedId = worldFile(
      projectRepositoryGeneration(firstGeneration),
    )?.id;
    const server = metadataServer([firstGeneration, renamedGeneration]);
    expect(
      (await indexMetadataGeneration(server, "continuity-a", rootPath)).status,
    ).toBe("succeeded");
    expect(
      (await indexMetadataGeneration(server, "continuity-b", rootPath)).status,
    ).toBe("succeeded");

    const response = await server.inject({
      method: "GET",
      url: "/world/current",
    });
    const snapshot = response.json().data.snapshot;
    const renamed = snapshot.objects.find(
      (object: { kind: string }) => object.kind === "file",
    );
    expect(renamed).toMatchObject({ id: expectedId, path: "src/new.ts" });
    expect(renamed.pathHistory.at(-1)).toMatchObject({
      path: "src/old.ts",
      confidence: "exact-content",
    });
  });

  it("keeps unchanged generations cached and blocks cross-root identity donation", async () => {
    const firstRoot = "/private/operator/workspaces/unchanged";
    const first = metadataGeneration(
      firstRoot,
      ["src/a.ts"],
      "88c22eef-64c8-493e-ad67-87ed41f64663",
      "3",
    );
    const unchanged = metadataGeneration(
      firstRoot,
      ["src/a.ts"],
      "88c22eef-64c8-493e-ad67-87ed41f64664",
      "4",
    );
    const unchangedServer = metadataServer([first, unchanged]);
    await indexMetadataGeneration(unchangedServer, "unchanged-a", firstRoot);
    await indexMetadataGeneration(unchangedServer, "unchanged-b", firstRoot);
    const firstRead = await unchangedServer.inject({
      method: "GET",
      url: "/world/current",
    });
    const repeatedRead = await unchangedServer.inject({
      method: "GET",
      url: "/world/current",
    });
    expect(repeatedRead.json().data.snapshot).toEqual(
      firstRead.json().data.snapshot,
    );
    expect(
      firstRead
        .json()
        .data.snapshot.objects.find(
          (object: { kind: string }) => object.kind === "file",
        ).id,
    ).toBe(worldFile(projectRepositoryGeneration(first))?.id);

    const otherRoot = "/private/operator/workspaces/other";
    const switched = metadataGeneration(
      otherRoot,
      ["src/renamed.ts"],
      "88c22eef-64c8-493e-ad67-87ed41f64665",
      "5",
    );
    const switchedServer = metadataServer([first, switched]);
    await indexMetadataGeneration(switchedServer, "switch-a", firstRoot);
    await indexMetadataGeneration(switchedServer, "switch-b", otherRoot);
    const switchedSnapshot = (
      await switchedServer.inject({ method: "GET", url: "/world/current" })
    ).json().data.snapshot;
    expect(
      switchedSnapshot.objects.find(
        (object: { kind: string }) => object.kind === "file",
      ).id,
    ).toBe(worldFile(projectRepositoryGeneration(switched))?.id);
  });

  it("does not let a projection failure poison the prior good projection", async () => {
    const rootPath = "/private/operator/workspaces/projection-failure";
    const first = metadataGeneration(
      rootPath,
      ["src/old.ts"],
      "88c22eef-64c8-493e-ad67-87ed41f64666",
      "6",
    );
    const invalid = metadataGeneration(
      rootPath,
      ["/absolute.ts"],
      "88c22eef-64c8-493e-ad67-87ed41f64667",
      "7",
    );
    const recovered = metadataGeneration(
      rootPath,
      ["src/recovered.ts"],
      "88c22eef-64c8-493e-ad67-87ed41f64668",
      "8",
    );
    const expectedId = worldFile(projectRepositoryGeneration(first))?.id;
    const server = metadataServer([first, invalid, recovered]);
    await indexMetadataGeneration(server, "failure-a", rootPath);
    await indexMetadataGeneration(server, "failure-b", rootPath);
    const failedProjection = await server.inject({
      method: "GET",
      url: "/world/current",
    });
    expect(failedProjection.statusCode).toBe(400);
    expect(failedProjection.body).not.toContain(rootPath);
    await indexMetadataGeneration(server, "failure-c", rootPath);
    const snapshot = (
      await server.inject({ method: "GET", url: "/world/current" })
    ).json().data.snapshot;
    const recoveredFile = snapshot.objects.find(
      (object: { kind: string }) => object.kind === "file",
    );
    expect(recoveredFile.id).toBe(expectedId);
    expect(recoveredFile.pathHistory.at(-1).path).toBe("src/old.ts");
  });

  it("advertises both read-only World operations and bounded query metadata", async () => {
    const server = createLocalServer({ config });
    servers.push(server);
    const response = await server.inject({
      method: "GET",
      url: "/openapi.json",
    });
    const paths = response.json().paths;
    expect(paths["/world/current"].get.responses).toMatchObject({
      "200": expect.any(Object),
      "404": expect.any(Object),
    });
    expect(paths["/world/tiles"].get).toMatchObject({
      parameters: expect.arrayContaining([
        expect.objectContaining({ name: "lod", in: "query", required: true }),
        expect.objectContaining({ name: "limit", in: "query", required: true }),
      ]),
      responses: {
        "200": expect.any(Object),
        "400": expect.any(Object),
        "404": expect.any(Object),
      },
    });
  });

  it("keeps every supported World runtime status in OpenAPI parity", async () => {
    const rootPath = "/private/operator/workspaces/status-parity";
    const valid = metadataGeneration(
      rootPath,
      ["src/a.ts"],
      "88c22eef-64c8-493e-ad67-87ed41f64669",
      "9",
    );
    const invalid = metadataGeneration(
      rootPath,
      ["/absolute.ts"],
      "88c22eef-64c8-493e-ad67-87ed41f64670",
      "a",
    );
    const collision = metadataGeneration(
      rootPath,
      ["src/a.ts", "src\\a.ts"],
      "88c22eef-64c8-493e-ad67-87ed41f64671",
      "b",
    );
    const emptyServer = metadataServer([]);
    const validServer = metadataServer([valid]);
    const invalidServer = metadataServer([invalid]);
    const collisionServer = metadataServer([collision]);
    await indexMetadataGeneration(validServer, "status-valid", rootPath);
    await indexMetadataGeneration(invalidServer, "status-invalid", rootPath);
    await indexMetadataGeneration(
      collisionServer,
      "status-collision",
      rootPath,
    );

    const actualCurrentStatuses = new Set([
      (await emptyServer.inject({ method: "GET", url: "/world/current" }))
        .statusCode,
      (await validServer.inject({ method: "GET", url: "/world/current" }))
        .statusCode,
      (await invalidServer.inject({ method: "GET", url: "/world/current" }))
        .statusCode,
      (await collisionServer.inject({ method: "GET", url: "/world/current" }))
        .statusCode,
    ]);
    const actualTileStatuses = new Set([
      (
        await emptyServer.inject({
          method: "GET",
          url: `/world/tiles?${validTileQuery}`,
        })
      ).statusCode,
      (
        await validServer.inject({
          method: "GET",
          url: `/world/tiles?${validTileQuery}`,
        })
      ).statusCode,
      (
        await invalidServer.inject({
          method: "GET",
          url: `/world/tiles?${validTileQuery}`,
        })
      ).statusCode,
      (
        await collisionServer.inject({
          method: "GET",
          url: `/world/tiles?${validTileQuery}`,
        })
      ).statusCode,
    ]);
    const openapi = (
      await emptyServer.inject({ method: "GET", url: "/openapi.json" })
    ).json();
    const advertisedStatuses = (route: "/world/current" | "/world/tiles") =>
      new Set(
        Object.keys(openapi.paths[route].get.responses).map((value) =>
          Number(value),
        ),
      );
    expect(actualCurrentStatuses).toEqual(new Set([200, 400, 404, 409]));
    expect(actualTileStatuses).toEqual(new Set([200, 400, 404, 409]));
    expect(advertisedStatuses("/world/current")).toEqual(actualCurrentStatuses);
    expect(advertisedStatuses("/world/tiles")).toEqual(actualTileStatuses);
  });
});

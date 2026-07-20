import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLocalServer } from "../src/server.js";

const servers: Array<ReturnType<typeof createLocalServer>> = [];
const roots: string[] = [];

const config = {
  networkScope: "loopback" as const,
  host: "127.0.0.1",
  port: 3770,
  instanceName: "Phase 10 API Test",
  demoOperationMaxMs: 500,
  repositoryMaxFiles: 2_500,
  presentationSync: {
    dataDir: "/tmp/aiw-phase10-presentation",
    allowedOrigin: "http://127.0.0.1:5173",
    allowedHost: "127.0.0.1:5173",
  },
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

async function indexedServer() {
  const root = await mkdtemp(join(tmpdir(), "aiw-phase10-api-repo-"));
  const cache = await mkdtemp(join(tmpdir(), "aiw-phase10-api-cache-"));
  roots.push(root, cache);
  await writeFile(
    join(root, "index.ts"),
    'import value from "external-only";\nexport function run() { return value; }\n',
  );
  const server = createLocalServer({ config, codeGraphDataDir: cache });
  servers.push(server);
  const created = await server.inject({
    method: "POST",
    url: "/repository-indexes",
    headers: { "idempotency-key": "phase10-graph" },
    payload: { rootPath: root },
  });
  expect(created.statusCode).toBe(202);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const status = await server.inject({
      method: "GET",
      url: "/code-graph/current",
    });
    if (status.json().data.current !== null) return { server, root, status };
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("code graph did not settle");
}

describe("Phase 10 code graph API", () => {
  it("returns coverage/aggregates/focused symbols with path privacy and caps", async () => {
    const { server, root, status } = await indexedServer();
    expect(status.statusCode).toBe(200);
    expect(status.json().data.current).toMatchObject({
      schema: "aiw.code-graph/0.10",
      state: "current",
      counts: { files: 1, parsedFiles: 1, symbols: 1, dependencies: 1 },
    });
    expect(JSON.stringify(status.json())).not.toContain(root);
    const aggregate = await server.inject({
      method: "GET",
      url: "/code-graph/aggregates?lod=2&limit=1024",
    });
    expect(aggregate.statusCode).toBe(200);
    expect(aggregate.json().data).toMatchObject({
      lod: 2,
      totalEdges: 1,
      truncated: false,
    });
    const world = await server.inject({ method: "GET", url: "/world/current" });
    const fileRef = world
      .json()
      .data.snapshot.objects.find(
        (object: { kind: string }) => object.kind === "file",
      ).ref as string;
    const focus = await server.inject({
      method: "GET",
      url: `/code-graph/files/${fileRef.split("/").at(-1)}?lod=4`,
    });
    expect(focus.statusCode).toBe(200);
    expect(focus.json().data).toMatchObject({
      fileRef,
      coverage: { state: "parsed" },
      truncated: false,
    });
    expect(focus.json().data.symbols).toHaveLength(1);
    expect(JSON.stringify(focus.json())).not.toContain(root);
  });

  it("structurally denies whole-repository detail and keeps OpenAPI statuses in parity", async () => {
    const { server } = await indexedServer();
    const denied = await server.inject({
      method: "GET",
      url: "/code-graph/aggregates?lod=2&limit=1024&allDetail=true",
    });
    expect(denied.statusCode).toBe(400);
    expect(denied.json().error.message).toMatch(
      /whole-repository symbol detail is forbidden/iu,
    );
    const openapi = await server.inject({
      method: "GET",
      url: "/openapi.json",
    });
    for (const route of [
      "/code-graph/current",
      "/code-graph/aggregates",
      "/code-graph/files/{fileId}",
    ])
      expect(
        Object.keys(openapi.json().paths[route].get.responses).sort(),
      ).toEqual(["200", "400", "404", "503"]);
  });

  it("loads the verified persisted graph before a restarted server is ready", async () => {
    const { server, status } = await indexedServer();
    const cache = roots.at(-1)!;
    const generationId = status.json().data.current.generationId as string;
    await server.close();
    servers.splice(servers.indexOf(server), 1);

    const restarted = createLocalServer({ config, codeGraphDataDir: cache });
    servers.push(restarted);
    const loaded = await restarted.inject({
      method: "GET",
      url: "/code-graph/current",
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json().data).toMatchObject({
      current: { generationId, state: "current" },
      buildingGenerationId: null,
      lastError: null,
    });
  });

  it("exposes recovered previous truth and rebuild status after current corruption", async () => {
    const { server, root, status } = await indexedServer();
    const cache = roots.at(-1)!;
    const previousGenerationId = status.json().data.current
      .generationId as string;
    await writeFile(
      join(root, "index.ts"),
      'import value from "external-only";\nexport function changed() { return value; }\n',
    );
    const refreshed = await server.inject({
      method: "POST",
      url: "/repository-indexes",
      headers: { "idempotency-key": "phase10-graph-refresh" },
      payload: { rootPath: root },
    });
    expect(refreshed.statusCode).toBe(202);
    let settledGenerationId: string | undefined;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const next = await server.inject({
        method: "GET",
        url: "/code-graph/current",
      });
      const nextGenerationId = next.json().data.current?.generationId;
      if (nextGenerationId && nextGenerationId !== previousGenerationId) {
        settledGenerationId = nextGenerationId;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(settledGenerationId).toBeDefined();
    await server.close();
    servers.splice(servers.indexOf(server), 1);
    await writeFile(join(cache, "current.json"), '{"corrupt":true}');

    const restarted = createLocalServer({ config, codeGraphDataDir: cache });
    servers.push(restarted);
    const recovered = await restarted.inject({
      method: "GET",
      url: "/code-graph/current",
    });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json().data).toMatchObject({
      current: { generationId: previousGenerationId, state: "previous" },
      previous: null,
      buildingGenerationId: null,
      lastError: "cache_rebuild_required",
    });
  });
});

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { indexRepository } from "@agentintersect-world/repo-indexer";

import { createLocalServer } from "../src/server.js";

const roots: string[] = [];
const servers: Array<ReturnType<typeof createLocalServer>> = [];
const config = {
  networkScope: "loopback" as const,
  host: "127.0.0.1",
  port: 3770,
  instanceName: "Index Test",
  demoOperationMaxMs: 500,
  repositoryMaxFiles: 2500,
  presentationSync: {
    dataDir: "/tmp/aiw-index-presentation",
    allowedOrigin: "http://127.0.0.1:5173",
    allowedHost: "127.0.0.1:5173",
  },
};

async function root() {
  const value = await mkdtemp(join(tmpdir(), "aiw-phase3-server-"));
  roots.push(value);
  await writeFile(join(value, "index.ts"), "export const ok = true;\n");
  return value;
}
async function waitForTerminal(
  server: ReturnType<typeof createLocalServer>,
  id: string,
) {
  for (let index = 0; index < 100; index += 1) {
    const response = await server.inject({
      method: "GET",
      url: `/repository-indexes/${id}`,
    });
    if (response.json().data.status !== "running") return response.json().data;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("index did not settle");
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    roots.splice(0).map((value) => rm(value, { recursive: true, force: true })),
  );
});

describe("repository index API/service", () => {
  it("creates, replays, conflicts, lists, gets, and activates the last good generation", async () => {
    const selected = await root();
    const server = createLocalServer({ config });
    servers.push(server);
    const create = (key: string, rootPath = selected) =>
      server.inject({
        method: "POST",
        url: "/repository-indexes",
        headers: { "idempotency-key": key },
        payload: { rootPath },
      });
    const first = await create("index-key");
    const replay = await create("index-key");
    const conflict = await create("index-key", join(selected, "different"));
    expect(first.statusCode).toBe(202);
    expect(replay.statusCode).toBe(200);
    expect(replay.headers["x-idempotent-replay"]).toBe("true");
    expect(replay.json().data.id).toBe(first.json().data.id);
    expect(conflict.statusCode).toBe(409);
    const terminal = await waitForTerminal(server, first.json().data.id);
    expect(terminal.status).toBe("succeeded");
    const current = await server.inject({
      method: "GET",
      url: "/repository-indexes/current",
    });
    expect(current.json().data.generation.fingerprint).toBe(
      terminal.generation.fingerprint,
    );
    const list = await server.inject({
      method: "GET",
      url: "/repository-indexes",
    });
    expect(list.json().data.operations[0].id).toBe(first.json().data.id);
  });

  it("cancels idempotently, preserves last good, bounds records, and cleans active work on close", async () => {
    const selected = await root();
    const server = createLocalServer({ config });
    servers.push(server);
    const goodResponse = await server.inject({
      method: "POST",
      url: "/repository-indexes",
      headers: { "idempotency-key": "good" },
      payload: { rootPath: selected },
    });
    const good = await waitForTerminal(server, goodResponse.json().data.id);
    expect(good.status).toBe("succeeded");
    for (let index = 0; index < 400; index += 1)
      await writeFile(
        join(selected, `many-${index}.ts`),
        `export const n=${index}`,
      );
    const running = await server.inject({
      method: "POST",
      url: "/repository-indexes",
      headers: { "idempotency-key": "cancel" },
      payload: { rootPath: selected },
    });
    const cancel = await server.inject({
      method: "POST",
      url: `/repository-indexes/${running.json().data.id}/cancel`,
    });
    const again = await server.inject({
      method: "POST",
      url: `/repository-indexes/${running.json().data.id}/cancel`,
    });
    expect(cancel.json().data.status).toBe("cancelled");
    expect(again.json().data.status).toBe("cancelled");
    const current = await server.inject({
      method: "GET",
      url: "/repository-indexes/current",
    });
    expect(current.json().data.generation.id).toBe(good.generation.id);
    await server.close();
    servers.splice(servers.indexOf(server), 1);
    expect(server.repositoryIndexService.activeCount).toBe(0);
  });

  it("exposes all five generated OpenAPI paths", async () => {
    const server = createLocalServer({ config });
    servers.push(server);
    const current = await server.inject({
      method: "GET",
      url: "/repository-indexes/current",
    });
    expect(current.json().data).toEqual({ generation: null });
    const response = await server.inject({
      method: "GET",
      url: "/openapi.json",
    });
    expect(response.json().paths).toMatchObject({
      "/repository-indexes": expect.any(Object),
      "/repository-indexes/current": expect.any(Object),
      "/repository-indexes/{id}": expect.any(Object),
      "/repository-indexes/{id}/cancel": expect.any(Object),
    });
  });

  it("preserves last good after an injected failure and keeps at most 20 newest records", async () => {
    const selected = await root();
    let calls = 0;
    const server = createLocalServer({
      config,
      repositoryIndexer: async (options) => {
        calls += 1;
        if (calls === 2) throw new Error("injected index failure");
        return await indexRepository(options);
      },
    });
    servers.push(server);
    const create = async (key: string) => {
      const response = await server.inject({
        method: "POST",
        url: "/repository-indexes",
        headers: { "idempotency-key": key },
        payload: { rootPath: selected },
      });
      return await waitForTerminal(server, response.json().data.id);
    };
    const good = await create("record-0");
    const failed = await create("record-1");
    expect(failed).toMatchObject({
      status: "failed",
      error: "injected index failure",
    });
    for (let index = 2; index < 22; index += 1) await create(`record-${index}`);
    const list = (
      await server.inject({ method: "GET", url: "/repository-indexes" })
    ).json().data.operations;
    expect(list).toHaveLength(20);
    expect(list[0].status).toBe("succeeded");
    const current = (
      await server.inject({ method: "GET", url: "/repository-indexes/current" })
    ).json().data.generation;
    expect(current.id).not.toBe(good.generation.id);
    expect(current.fingerprint).toBe(good.generation.fingerprint);
  });
});

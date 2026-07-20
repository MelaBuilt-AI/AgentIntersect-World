import { afterEach, describe, expect, it } from "vitest";

import { createLocalServer } from "../src/server.js";

const config = {
  networkScope: "loopback" as const,
  host: "127.0.0.1",
  port: 3770,
  instanceName: "Operation Test",
  demoOperationMaxMs: 500,
  repositoryMaxFiles: 2_500,
  presentationSync: {
    dataDir: "/tmp/aiw-operations-presentation",
    allowedOrigin: "http://127.0.0.1:5173",
    allowedHost: "127.0.0.1:5173",
  },
};

describe("bounded demo-delay operations", () => {
  const servers: Array<ReturnType<typeof createLocalServer>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(async (server) => server.close()));
  });

  function server() {
    const instance = createLocalServer({ config });
    servers.push(instance);
    return instance;
  }

  async function create(
    instance: ReturnType<typeof createLocalServer>,
    key: string,
    durationMs = 200,
    label = "Focused demo",
  ) {
    return await instance.inject({
      method: "POST",
      url: "/operations",
      headers: { "idempotency-key": key },
      payload: { kind: "demo-delay", durationMs, label },
    });
  }

  it("replays the same key/request and conflicts on different input", async () => {
    const instance = server();
    const first = await create(instance, "same-request");
    const replay = await create(instance, "same-request");
    const conflict = await create(instance, "same-request", 300);

    expect(first.statusCode).toBe(202);
    expect(replay.statusCode).toBe(200);
    expect(replay.headers["x-idempotent-replay"]).toBe("true");
    expect(replay.json().data).toEqual(first.json().data);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      ok: false,
      error: { code: "conflict", retryable: false },
      meta: { correlationId: expect.any(String), schema: "aiw.api/0.3" },
    });
  });

  it("validates the idempotency key and configured duration bound", async () => {
    const instance = server();
    const missingKey = await instance.inject({
      method: "POST",
      url: "/operations",
      payload: { kind: "demo-delay", durationMs: 100 },
    });
    const tooLong = await create(instance, "too-long", 501);

    expect(missingKey.statusCode).toBe(400);
    expect(missingKey.json().error.code).toBe("validation");
    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json().error.code).toBe("validation");
  });

  it("lists newest first, gets records, and returns stable not found", async () => {
    const instance = server();
    const first = (await create(instance, "first", 400, "First")).json().data;
    const second = (await create(instance, "second", 400, "Second")).json()
      .data;
    const list = await instance.inject({ method: "GET", url: "/operations" });
    const get = await instance.inject({
      method: "GET",
      url: `/operations/${first.id}`,
    });
    const missing = await instance.inject({
      method: "GET",
      url: "/operations/7dc2d8ec-7710-49aa-a3ee-517d68dc5ff1",
    });

    expect(list.statusCode).toBe(200);
    expect(
      list.json().data.operations.map(({ id }: { id: string }) => id),
    ).toEqual([second.id, first.id]);
    expect(get.json().data).toEqual(first);
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("not_found");
  });

  it("cancels a running operation idempotently", async () => {
    const instance = server();
    const operation = (await create(instance, "cancel", 400)).json().data;
    const first = await instance.inject({
      method: "POST",
      url: `/operations/${operation.id}/cancel`,
    });
    const replay = await instance.inject({
      method: "POST",
      url: `/operations/${operation.id}/cancel`,
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().data).toMatchObject({
      id: operation.id,
      status: "cancelled",
      result: "Demo operation cancelled",
    });
    expect(replay.json().data).toEqual(first.json().data);
  });

  it("completes a running operation and clears timers when the server closes", async () => {
    const instance = server();
    const operation = (await create(instance, "complete", 50)).json().data;
    await new Promise((resolve) => setTimeout(resolve, 80));
    const complete = await instance.inject({
      method: "GET",
      url: `/operations/${operation.id}`,
    });
    expect(complete.json().data).toMatchObject({
      status: "succeeded",
      result: "Demo operation completed",
    });

    const pending = (await create(instance, "cleanup", 500)).json().data;
    await instance.close();
    servers.splice(servers.indexOf(instance), 1);
    expect(instance.operationService.activeTimerCount).toBe(0);
    expect(instance.operationService.get(pending.id)?.status).toBe("cancelled");
  });
});

import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLocalServer, type LocalServer } from "../src/server.js";
import {
  PHASE14_DISPOSABLE_ROOT,
  Phase14Service,
} from "../src/phase14-service.js";

let server: LocalServer | null = null;
let service: Phase14Service | null = null;

function create() {
  service = new Phase14Service({
    fixtureRoot: resolve("examples/phase14-magic-slice"),
    storePath: resolve(
      PHASE14_DISPOSABLE_ROOT,
      "state",
      `api-${randomUUID()}.json`,
    ),
  });
  server = createLocalServer({ phase14Service: service });
  return { server, service };
}

afterEach(async () => {
  await server?.close();
  await service?.dispose();
  server = null;
  service = null;
});

async function post(server: LocalServer, url: string, payload: object = {}) {
  return server.inject({ method: "POST", url, payload });
}

describe("Phase 14 strict local API", () => {
  it("runs the exact numbered real-process journey through narrow routes", async () => {
    const { server } = create();
    const created = await post(server, "/phase14/journeys");
    expect(created.statusCode).toBe(201);
    const operationId = created.json().operationId as string;

    expect(
      (await post(server, `/phase14/journeys/${operationId}/inspect`)).json()
        .step,
    ).toBe(3);
    const edit = (
      await post(server, `/phase14/journeys/${operationId}/edit/preview`)
    ).json();
    expect(edit.step).toBe(4);
    const approval = (
      await post(server, `/phase14/journeys/${operationId}/approval`, {
        patchDigest: edit.patchDigest,
      })
    ).json();
    expect(approval.step).toBe(5);
    expect(
      (
        await post(server, `/phase14/journeys/${operationId}/edit/apply`, {
          approvalId: approval.approvalId,
        })
      ).json().step,
    ).toBe(7);
    expect(
      (await post(server, `/phase14/journeys/${operationId}/test`)).json(),
    ).toMatchObject({
      step: 8,
      state: "succeeded",
    });
    expect(
      (
        await post(server, `/phase14/journeys/${operationId}/preview/start`)
      ).json(),
    ).toMatchObject({
      step: 9,
      state: "ready",
    });
    expect(
      (
        await post(server, `/phase14/journeys/${operationId}/preview/stop`)
      ).json(),
    ).toMatchObject({
      step: 10,
      state: "stopped",
      portClosed: true,
    });

    const current = await server.inject({
      method: "GET",
      url: `/phase14/journeys/${operationId}`,
    });
    expect(current.json()).toMatchObject({ status: "completed", step: 10 });
    expect(
      (
        await server.inject({
          method: "GET",
          url: `/phase14/journeys/${operationId}/events`,
        })
      ).json().events.length,
    ).toBeGreaterThanOrEqual(15);
  }, 20_000);

  it("rejects unknown fields and maps conflicting event replay to HTTP 409", async () => {
    const { server, service } = create();
    expect(
      (await post(server, "/phase14/journeys", { root: "/tmp/other" }))
        .statusCode,
    ).toBe(400);
    const journey = await service.createJourney();
    await service.inspect(journey.operationId);
    const original = service.events(journey.operationId)[0];
    expect(original).toBeDefined();
    const firstReplay = await post(
      server,
      "/phase14/tool-events",
      original as object,
    );
    expect(firstReplay.statusCode).toBe(200);
    expect(firstReplay.json()).toEqual({ kind: "duplicate" });
    const conflict = await post(server, "/phase14/tool-events", {
      ...original,
      digest: "f".repeat(64),
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({ kind: "conflict", statusCode: 409 });
  });

  it("documents the dedicated routes without exposing arbitrary root selection", async () => {
    const { server } = create();
    const openapi = (
      await server.inject({ method: "GET", url: "/openapi.json" })
    ).json();
    expect(openapi.paths).toHaveProperty("/phase14/journeys");
    expect(openapi.paths).toHaveProperty("/phase14/tool-events");
    expect(JSON.stringify(openapi.paths["/phase14/journeys"])).not.toContain(
      "rootPath",
    );
  });
});

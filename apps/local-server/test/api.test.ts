import { afterEach, describe, expect, it } from "vitest";

import { createLocalServer } from "../src/server.js";

const config = {
  networkScope: "loopback" as const,
  host: "127.0.0.1",
  port: 3770,
  instanceName: "Test World",
  demoOperationMaxMs: 2_000,
  repositoryMaxFiles: 2_500,
};
const suppliedCorrelationId = "7dc2d8ec-7710-49aa-a3ee-517d68dc5ff1";
const generatedCorrelationId = "d4b0469f-bfb8-4574-a933-d8a398459907";

describe("Phase 6 authority inspection API", () => {
  const servers: Array<ReturnType<typeof createLocalServer>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(async (server) => server.close()));
  });

  function server() {
    const instance = createLocalServer({
      config,
      generateCorrelationId: () => generatedCorrelationId,
    });
    servers.push(instance);
    return instance;
  }

  it.each(["/ready", "/config", "/doctor"])(
    "returns a correlated success envelope from %s",
    async (url) => {
      const response = await server().inject({
        method: "GET",
        url,
        headers: { "x-correlation-id": suppliedCorrelationId },
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-correlation-id"]).toBe(suppliedCorrelationId);
      expect(body).toMatchObject({
        ok: true,
        meta: {
          correlationId: suppliedCorrelationId,
          schema: "aiw.api/0.3",
        },
      });
    },
  );

  it("reports safe config and useful doctor checks", async () => {
    const configResponse = await server().inject({
      method: "GET",
      url: "/config",
    });
    expect(configResponse.json().data).toEqual({
      phase: "Phase 6",
      version: "0.6.0-phase6",
      instanceName: "Test World",
      networkScope: "loopback",
      host: "127.0.0.1",
      port: 3770,
      demoOperationMaxMs: 2_000,
      repositoryMaxFiles: 2_500,
      agentIntersectReadEnabled: false,
    });

    const doctorResponse = await server().inject({
      method: "GET",
      url: "/doctor",
    });
    expect(doctorResponse.json().data.checks).toEqual([
      expect.objectContaining({ name: "runtime", status: "pass" }),
      expect.objectContaining({ name: "configuration", status: "pass" }),
      expect.objectContaining({ name: "operation-service", status: "pass" }),
    ]);
  });

  it("generates Phase 6 OpenAPI JSON with the operation routes", async () => {
    const response = await server().inject({
      method: "GET",
      url: "/openapi.json",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      openapi: "3.0.3",
      info: { version: "0.6.0-phase6" },
      paths: {
        "/ready": expect.any(Object),
        "/operations": expect.any(Object),
        "/operations/{id}": expect.any(Object),
        "/operations/{id}/cancel": expect.any(Object),
      },
    });
  });

  it("generates a correlation ID for an invalid header and returns a stable not-found error", async () => {
    const response = await server().inject({
      method: "GET",
      url: "/missing",
      headers: { "x-correlation-id": "not-a-uuid" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.headers["x-correlation-id"]).toBe(generatedCorrelationId);
    expect(response.json()).toEqual({
      ok: false,
      error: {
        code: "not_found",
        message: "Route not found",
        retryable: false,
      },
      meta: {
        correlationId: generatedCorrelationId,
        schema: "aiw.api/0.3",
      },
    });
  });

  it("preserves health while propagating a valid correlation header", async () => {
    const response = await server().inject({
      method: "GET",
      url: "/health",
      headers: { "x-correlation-id": suppliedCorrelationId },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-correlation-id"]).toBe(suppliedCorrelationId);
    expect(response.json()).toMatchObject({
      status: "ok",
      version: "0.6.0-phase6",
      correlationId: suppliedCorrelationId,
    });
  });
});

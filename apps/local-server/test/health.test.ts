import { HealthResponseSchema } from "@agentintersect-world/world-schema";
import { afterEach, describe, expect, it } from "vitest";

import { createLocalServer } from "../src/server.js";

describe("GET /health", () => {
  const servers: Array<ReturnType<typeof createLocalServer>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(async (server) => server.close()));
  });

  it("returns the shared typed and schema-valid health contract", async () => {
    const server = createLocalServer({
      generateCorrelationId: () => "7dc2d8ec-7710-49aa-a3ee-517d68dc5ff1",
    });
    servers.push(server);

    const response = await server.inject({ method: "GET", url: "/health" });
    const health = HealthResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-correlation-id"]).toBe(health.correlationId);
    expect(health).toMatchObject({
      service: "agentintersect-world-local-server",
      status: "ok",
      version: "0.9.0-phase9",
      runtime: { name: "node" },
    });
  });
});

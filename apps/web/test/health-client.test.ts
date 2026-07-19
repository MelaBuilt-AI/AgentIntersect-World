import { describe, expect, it, vi } from "vitest";

import { loadHealth } from "../src/health-client.js";

describe("loadHealth", () => {
  it("returns validated health", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          service: "agentintersect-world-local-server",
          status: "ok",
          version: "0.2.0-phase2",
          runtime: { name: "node", version: "v24.18.0" },
          correlationId: "7dc2d8ec-7710-49aa-a3ee-517d68dc5ff1",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(loadHealth(fetcher)).resolves.toMatchObject({
      status: "healthy",
      health: { status: "ok" },
    });
  });

  it("returns a clear unavailable state when the server cannot be reached", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("connection refused"));

    await expect(loadHealth(fetcher)).resolves.toEqual({
      status: "unavailable",
      message: "Local server unavailable",
    });
  });
});

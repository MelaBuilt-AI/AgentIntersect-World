import { describe, expect, it, vi } from "vitest";

const correlationId = "7dc2d8ec-7710-49aa-a3ee-517d68dc5ff1";
const operation = {
  id: "d4b0469f-bfb8-4574-a933-d8a398459907",
  kind: "demo-delay",
  durationMs: 500,
  label: "Browser demo",
  status: "running",
  createdAt: "2026-07-19T14:00:00.000Z",
  updatedAt: "2026-07-19T14:00:00.000Z",
  result: "Demo operation running",
};

describe("Phase 2 operator API client", () => {
  it("loads validated readiness and safe configuration", async () => {
    const client = (await import("../src/health-client.js")) as Record<
      string,
      unknown
    >;
    expect(client.loadAuthority).toBeTypeOf("function");
    if (typeof client.loadAuthority !== "function") return;

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            service: "agentintersect-world-local-server",
            status: "ready",
            version: "0.2.0-phase2",
            runtime: { name: "node", version: "v24.18.0" },
            config: {
              phase: "Phase 2",
              version: "0.2.0-phase2",
              instanceName: "Browser Test",
              networkScope: "loopback",
              host: "127.0.0.1",
              port: 3770,
              demoOperationMaxMs: 5000,
            },
          },
          meta: { correlationId, schema: "aiw.api/0.2" },
        }),
        { status: 200 },
      ),
    );
    const result = await (
      client.loadAuthority as (fetcher: typeof fetch) => Promise<unknown>
    )(fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/ready",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result).toMatchObject({
      status: "ready",
      ready: { config: { networkScope: "loopback" } },
    });
  });

  it("creates a demo operation with an idempotency key", async () => {
    const client = (await import("../src/health-client.js")) as Record<
      string,
      unknown
    >;
    expect(client.startDemoOperation).toBeTypeOf("function");
    if (typeof client.startDemoOperation !== "function") return;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: operation,
          meta: { correlationId, schema: "aiw.api/0.2" },
        }),
        { status: 202 },
      ),
    );

    const result = await (
      client.startDemoOperation as (
        durationMs: number,
        label: string,
        key: string,
        fetcher: typeof fetch,
      ) => Promise<unknown>
    )(500, "Browser demo", "browser-key", fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/operations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "idempotency-key": "browser-key" }),
        body: JSON.stringify({
          kind: "demo-delay",
          durationMs: 500,
          label: "Browser demo",
        }),
      }),
    );
    expect(result).toEqual({ status: "ok", data: operation });
  });

  it("returns useful API error and unavailable states", async () => {
    const client = (await import("../src/health-client.js")) as Record<
      string,
      unknown
    >;
    expect(client.getOperation).toBeTypeOf("function");
    if (typeof client.getOperation !== "function") return;
    const getOperation = client.getOperation as (
      id: string,
      fetcher: typeof fetch,
    ) => Promise<unknown>;
    const conflict = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "conflict",
            message: "Operation changed",
            retryable: false,
          },
          meta: { correlationId, schema: "aiw.api/0.2" },
        }),
        { status: 409 },
      ),
    );
    const unavailable = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("connection refused"));

    await expect(getOperation(operation.id, conflict)).resolves.toEqual({
      status: "error",
      message: "Operation changed",
    });
    await expect(getOperation(operation.id, unavailable)).resolves.toEqual({
      status: "unavailable",
      message: "Local server unavailable",
    });
  });
});

import { describe, expect, it, vi } from "vitest";

describe("browser repository index client", () => {
  it("creates and validates a repository index operation", async () => {
    const client = await import("../src/repository-index-client.js");
    const operation = {
      id: "d4b0469f-bfb8-4574-a933-d8a398459907",
      rootPath: "/tmp/repo",
      status: "running",
      createdAt: "2026-07-19T14:00:00.000Z",
      updatedAt: "2026-07-19T14:00:00.000Z",
      progress: {
        phase: "discovering",
        discoveredFiles: 1,
        indexedFiles: 0,
        bytesHashed: 0,
      },
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: operation,
          meta: {
            correlationId: "7dc2d8ec-7710-49aa-a3ee-517d68dc5ff1",
            schema: "aiw.api/0.3",
          },
        }),
        { status: 202 },
      ),
    );
    await expect(
      client.startRepositoryIndex("/tmp/repo", "key", fetcher),
    ).resolves.toEqual({ status: "ok", data: operation });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/repository-indexes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ rootPath: "/tmp/repo" }),
      }),
    );
  });

  it("returns invalid-response and unavailable states", async () => {
    const client = await import("../src/repository-index-client.js");
    const invalid = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const unavailable = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("offline"));
    await expect(
      client.getCurrentRepositoryIndex(invalid),
    ).resolves.toMatchObject({ status: "error" });
    await expect(
      client.getCurrentRepositoryIndex(unavailable),
    ).resolves.toEqual({
      status: "unavailable",
      message: "Local server unavailable",
    });
  });
});

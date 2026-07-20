import { describe, expect, it, vi } from "vitest";

import {
  deletePresentationDocument,
  exportPresentationDocument,
  getPresentationStatus,
  issuePresentationTicket,
  loadPresentationAuthority,
} from "../src/presentation/presentation-client.js";
import { PHASE5_WORLD_FIXTURE } from "../src/fixtures/phase5-world.js";

const envelope = (data: unknown) => ({
  ok: true,
  data,
  meta: {
    correlationId: "7dc2d8ec-7710-49aa-a3ee-517d68dc5ff1",
    schema: "aiw.api/0.3",
  },
});

describe("Phase 9 presentation HTTP client", () => {
  it("derives live object labels and owned-agent IDs from strict World and roster responses", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(envelope({ snapshot: PHASE5_WORLD_FIXTURE })),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            envelope({
              roster: [
                {
                  id: "upstream worker 42",
                  harness: "codex",
                  status: "running",
                },
              ],
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const authority = await loadPresentationAuthority(fetcher);

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/world/current",
      "/api/integration/roster",
    ]);
    expect(authority.selectedObjectId).toBe("00000000000000000000000000000005");
    expect(
      authority.authoritativeObjects.get("00000000000000000000000000000005"),
    ).toBe("main.ts");
    expect([...authority.authoritativeObjects.values()]).not.toContain(
      "src/main.ts",
    );
    expect(authority.ownedAgentIds).toEqual([
      expect.stringMatching(/^agent_[a-f0-9]{32}$/),
    ]);
    expect(authority.ownedAgentIds).not.toContain("upstream worker 42");
  });

  it("does not invent an owned agent for an empty roster and rejects roster extensions", async () => {
    const emptyFetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(envelope({ snapshot: PHASE5_WORLD_FIXTURE })),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(envelope({ roster: [] }))),
      );
    await expect(
      loadPresentationAuthority(emptyFetcher),
    ).resolves.toMatchObject({ ownedAgentIds: [] });

    const extendedFetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(envelope({ snapshot: PHASE5_WORLD_FIXTURE })),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            envelope({ roster: [{ id: "worker", command: "run tests" }] }),
          ),
        ),
      );
    await expect(loadPresentationAuthority(extendedFetcher)).rejects.toThrow(
      "invalid presentation roster response",
    );
  });

  it("loads strict capability status and issues a ticket without URL credentials", async () => {
    const documentId = "doc_0123456789abcdef0123456789abcdef";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            envelope({
              schema: "aiw.presentation/0.9",
              documentId,
              networkScope: "loopback",
              provider: "local-self-hosted",
              commandAuthority: false,
              maximumPeers: 16,
              heartbeatMs: 10_000,
              awarenessExpiryMs: 30_000,
              transport: "ws/http",
              encrypted: false,
              unencryptedLanWarning: false,
              limits: { maxExportBytes: 1_048_576 },
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            envelope({
              ticket: "ticket_" + "a".repeat(48),
              expiresAt: "2026-07-20T14:01:00.000Z",
              documentId,
              websocketPath: "/presentation-sync",
            }),
          ),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      );

    await expect(getPresentationStatus(fetcher)).resolves.toMatchObject({
      status: "ok",
      data: { documentId, commandAuthority: false },
    });
    await expect(
      issuePresentationTicket(documentId, undefined, fetcher),
    ).resolves.toMatchObject({
      status: "ok",
      data: { ticket: expect.stringMatching(/^ticket_/) },
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe("/api/presentation/tickets");
    expect(String(fetcher.mock.calls[1]?.[0])).not.toContain("ticket_");
  });

  it("keeps LAN bearer in the authorization header and supports export/delete", async () => {
    const documentId = "doc_0123456789abcdef0123456789abcdef";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            envelope({
              ticket: "ticket_" + "b".repeat(48),
              expiresAt: "2026-07-20T14:01:00.000Z",
              documentId,
              websocketPath: "/presentation-sync",
            }),
          ),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response('{"schema":"aiw.presentation/0.9"}\n'),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(envelope({ documentId, deleted: true }))),
      );
    await issuePresentationTicket(
      documentId,
      "lan-presentation-bearer",
      fetcher,
    );
    await expect(
      exportPresentationDocument(
        documentId,
        "lan-presentation-bearer",
        fetcher,
      ),
    ).resolves.toContain("aiw.presentation/0.9");
    await expect(
      deletePresentationDocument(
        documentId,
        "lan-presentation-bearer",
        fetcher,
      ),
    ).resolves.toMatchObject({ status: "ok" });
    for (const call of fetcher.mock.calls) {
      expect(String(call[0])).not.toContain("lan-presentation-bearer");
    }
    expect(
      (fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>)
        .authorization,
    ).toBe("Bearer lan-presentation-bearer");
  });
});

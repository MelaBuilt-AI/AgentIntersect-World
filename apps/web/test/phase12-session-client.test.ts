import { describe, expect, it, vi } from "vitest";

import {
  AgentSessionClient,
  type WorldAgentSession,
} from "../src/sessions/session-client.js";

describe("Phase 12 browser client", () => {
  it("uses only World APIs and never accepts or forwards a Hermes bearer", async () => {
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
      expect(input).toMatch(/^\/api\/(?:agent-sessions|guided-build)/);
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      return new Response(
        JSON.stringify({
          ok: true,
          data: [],
          meta: { correlationId: crypto.randomUUID(), schema: "aiw.api/0.3" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const client = new AgentSessionClient(fetcher as typeof fetch);
    await client.capabilities();
    await client.nativeSessions("hermes");
    await client.designs();
    await client.status("11111111-1111-4111-8111-111111111111");
    await client.history("11111111-1111-4111-8111-111111111111");
    await client.avatarProposal("11111111-1111-4111-8111-111111111111");
    await client.avatarConsent(
      "11111111-1111-4111-8111-111111111111",
      "declined",
      { proposalId: "fixture" },
    );
    await client.revokeAvatarConsent("11111111-1111-4111-8111-111111111111");
    expect(fetcher).toHaveBeenCalledTimes(8);
  });

  it("parses fragmented same-origin SSE progressively without exposing native details", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const event = (
      sequence: number,
      type: string,
      payload: Record<string, unknown>,
      redaction = { applied: false, count: 0 },
    ) => ({
      schema: "aiw.agent-event/0.12",
      eventId: `${String(sequence).padStart(8, "0")}-1111-4111-8111-111111111111`,
      sessionId,
      sequence,
      occurredAt: "2026-07-21T05:00:00.000Z",
      correlationId: "22222222-2222-4222-8222-222222222222",
      type,
      payload,
      redaction,
    });
    const body = [
      `event: world.event\ndata: ${JSON.stringify(event(1, "message.user-accepted", { text: "hello" }))}\n\n`,
      `event: world.event\ndata: ${JSON.stringify(event(2, "message.assistant-delta", { text: "live " }))}\n\n`,
      `event: world.event\ndata: ${JSON.stringify(event(3, "tool.started", { toolName: "terminal" }, { applied: true, count: 2 }))}\n\n`,
      `event: world.event\ndata: ${JSON.stringify(event(4, "message.assistant-delta", { text: "reply" }))}\n\n`,
      `event: world.event\ndata: ${JSON.stringify(event(5, "message.assistant-final", { text: "live reply" }))}\n\n`,
      `event: world.final\ndata: ${JSON.stringify({ schema: "aiw.agent-stream-terminal/0.12", sessionId, status: "completed", finalText: "live reply" })}\n\n`,
      `event: world.done\ndata: ${JSON.stringify({ schema: "aiw.agent-stream-terminal/0.12", sessionId, status: "completed" })}\n\n`,
    ].join("");
    const bytes = new TextEncoder().encode(body);
    const chunks = Array.from(bytes, (byte) => new Uint8Array([byte]));
    const fetcher = vi.fn(async (_input: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            const chunk = chunks.shift();
            if (chunk) controller.enqueue(chunk);
            else controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    });
    const session = {
      schema: "aiw.agent-session/0.12",
      sessionId,
      adapterId: "hermes",
      adapterSessionRef: "native",
      profile: "default",
      workspaceId: "ws_fixture",
      repositoryRef: "repo_fixture",
      mode: "explore",
      permissionRevision: 0,
      capabilitySnapshotHash: "a".repeat(64),
      continuity: "current",
      status: "ready",
    } satisfies WorldAgentSession;
    const observed: unknown[] = [];
    const client = new AgentSessionClient(fetcher as typeof fetch);
    const result = await client.stream(session, "hello", {
      onEvent: (value) => observed.push(value),
    });
    expect(result.finalText).toBe("live reply");
    expect(observed).toHaveLength(5);
    expect(observed[1]).toMatchObject({
      type: "message.assistant-delta",
      payload: { text: "live " },
    });
    expect(observed[2]).toMatchObject({
      type: "tool.started",
      payload: { toolName: "terminal" },
    });
    expect(JSON.stringify(observed)).not.toMatch(/args|preview|RAW_|Bearer/i);
  });
});

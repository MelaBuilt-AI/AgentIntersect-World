import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createWorldEntryClient } from "../src/world-entry/world-entry-client.js";
import { AgentSessionClient } from "../src/sessions/session-client.js";

const mutation = {
  worldInstanceId: "old-world",
  expectedRevision: 8,
  idempotencyKey: "reset-one",
};
const fresh = {
  projection: { worldInstanceId: "new-world", agents: [], revision: 0 },
  terminalOutcomes: [],
  unavailableReason: null,
};

function clientWith(sessionClient: Record<string, unknown>) {
  return createWorldEntryClient({ sessionClient } as never);
}

describe("World reset client", () => {
  it("wires Reset Session to teardown and clears occupied selection state", () => {
    const source = fs.readFileSync(
      new URL("../src/world-entry/WorldEntryExperience.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("onResetSession={() => void resetWorldSession()}");
    const reset = source.slice(
      source.indexOf("const resetWorldSession ="),
      source.indexOf("const inWorld ="),
    );
    expect(reset).toContain("await client.resetSession(");
    expect(reset.indexOf("await client.resetSession(")).toBeLessThan(
      reset.indexOf('leaveWorld("session_select")'),
    );
    for (const clear of [
      "setConstellation(next.projection)",
      "setAcceptedAgentAvatars({})",
      "setSelectedRecipientId(null)",
      'setSelectedConnectionId("")',
      "setRosterMovementRequests({})",
      "setRosterWorkFocus({})",
    ])
      expect(reset).toContain(clear);
  });
  it("waits for authoritative reset before returning the empty roster", async () => {
    const resetConstellation = vi.fn().mockResolvedValue(fresh);
    const client = clientWith({ resetConstellation });
    expect(await client.resetSession(mutation)).toEqual(fresh);
    expect(resetConstellation).toHaveBeenCalledWith(mutation);
  });

  it("ends a single World-owned attachment before rolling the World", async () => {
    const calls: string[] = [];
    const endWorldSession = vi.fn(async () => {
      calls.push("end");
    });
    const client = clientWith({
      endWorldSession,
      resetConstellation: async () => {
        calls.push("reset");
        return fresh;
      },
    });
    await client.resetSession(mutation, {
      sessionId: "single",
      adapterId: "codex",
    } as never);
    expect(endWorldSession).toHaveBeenCalledWith("single", "old-world");
    expect(calls).toEqual(["end", "reset"]);
  });

  it("preserves operator-persistent Hermes but closes saved World-owned Hermes", async () => {
    const endWorldSession = vi.fn();
    const client = clientWith({
      endWorldSession,
      resetConstellation: async () => fresh,
    });
    await client.resetSession(mutation, {
      sessionId: "operator",
      adapterId: "hermes",
    } as never);
    expect(endWorldSession).not.toHaveBeenCalled();
    await client.resetSession(mutation, {
      sessionId: "owned",
      adapterId: "hermes",
      connectionId: "saved-hermes",
    } as never);
    expect(endWorldSession).toHaveBeenCalledWith("owned", "old-world");
  });

  it("does not report success or rotate after a single attachment fails to end", async () => {
    const resetConstellation = vi.fn();
    const client = clientWith({
      endWorldSession: async () => {
        throw new Error("active turn");
      },
      resetConstellation,
    });
    await expect(
      client.resetSession(mutation, {
        sessionId: "single",
        adapterId: "codex",
      } as never),
    ).rejects.toThrow("active turn");
    expect(resetConstellation).not.toHaveBeenCalled();
  });

  it("posts reset identity to the actual reset route", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ ok: true, data: fresh }), {
          status: 200,
        }),
    );
    const client = new AgentSessionClient(fetcher as typeof fetch);
    expect(await client.resetConstellation(mutation)).toEqual(fresh);
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/constellation/reset");
  });
});

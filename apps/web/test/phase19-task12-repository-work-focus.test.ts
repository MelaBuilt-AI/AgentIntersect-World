import { describe, expect, it } from "vitest";

import {
  deriveAgentRepositoryWorkState,
  type AgentWorkArrival,
  type BrowserAgentWorkFocus,
} from "../src/world-entry/agent-work-focus-model.js";
import { AgentSessionClient } from "../src/sessions/session-client.js";

const focus = (rosterId: string): BrowserAgentWorkFocus => ({
  activityId: `activity-${rosterId}`,
  rosterId,
  worldSessionId: `session-${rosterId}`,
  objectRef: `aiw://object/file-${rosterId}`,
  repositoryPath: `src/${rosterId}.ts`,
  layoutGeneration: `layout-${"a".repeat(64)}`,
  movementRequestId: `movement-${rosterId}`,
  source: "structured-tool-event",
  state: "navigating",
});

const arrival = (current: BrowserAgentWorkFocus): AgentWorkArrival => ({
  activityId: current.activityId,
  requestId: current.movementRequestId as string,
  actorId: current.worldSessionId,
  objectRef: current.objectRef,
  layoutGeneration: current.layoutGeneration,
  atSafeApproachPoint: true,
});

describe("Phase 19 Task 12 browser work-focus gate", () => {
  it("keeps two roster agents independent and unlocks Dig only after exact arrival", () => {
    const a = focus("a");
    const b = focus("b");
    expect(
      deriveAgentRepositoryWorkState(a, arrival(a), a.layoutGeneration),
    ).toMatchObject({
      state: "coding",
      action: "Work",
      codingSemantic: "Dig",
    });
    expect(
      deriveAgentRepositoryWorkState(b, arrival(a), b.layoutGeneration),
    ).toMatchObject({ state: "navigating", action: "Walk" });
  });

  it("rejects stale generations, old requests, moved-away actors, and terminal focus", () => {
    const current = focus("a");
    expect(
      deriveAgentRepositoryWorkState(
        current,
        arrival(current),
        `layout-${"b".repeat(64)}`,
      ).state,
    ).toBe("stale");
    expect(
      deriveAgentRepositoryWorkState(
        current,
        { ...arrival(current), requestId: "movement-old" },
        current.layoutGeneration,
      ).state,
    ).toBe("navigating");
    expect(
      deriveAgentRepositoryWorkState(
        current,
        { ...arrival(current), atSafeApproachPoint: false },
        current.layoutGeneration,
      ).state,
    ).toBe("navigating");
    expect(
      deriveAgentRepositoryWorkState(
        { ...current, state: "completed" },
        arrival(current),
        current.layoutGeneration,
      ),
    ).toMatchObject({ state: "idle", action: "Idle" });
  });

  it("retains accessible static coding semantics under reduced motion", () => {
    const current = focus("a");
    expect(
      deriveAgentRepositoryWorkState(
        current,
        arrival(current),
        current.layoutGeneration,
        true,
      ),
    ).toEqual({
      state: "coding",
      action: "Idle",
      codingSemantic: "Dig",
      mixerPaused: true,
      objectRef: current.objectRef,
      repositoryPath: current.repositoryPath,
    });
  });

  it("never promotes a workstream-only recovery hint to coding", () => {
    const current = { ...focus("a"), source: "workstream-binding" as const };
    expect(
      deriveAgentRepositoryWorkState(
        current,
        arrival(current),
        current.layoutGeneration,
      ),
    ).toMatchObject({
      state: "idle",
      action: "Idle",
      codingSemantic: null,
    });
  });

  it("fails closed on an unbounded or non-canonical public focus response", async () => {
    const client = new AgentSessionClient(
      (async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              focus: {
                ...focus("a"),
                schema: "aiw.agent-work-focus/0.19",
                repositoryRef: "aiw://object/repository-main",
                objectKind: "file",
                source: "structured-tool-event",
                rawArgs: { secret: true },
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )) as typeof fetch,
    );
    await expect(client.workFocus("session-a")).rejects.toThrow(/focus/i);
  });
});

import { describe, expect, it } from "vitest";

import {
  AcceptedVoiceTextSchema,
  AgentRepositoryWorkFocusSchema,
  ConstellationMessageGroupSchema,
  ConstellationProjectionSchema,
  MessageTargetSchema,
  assertCurrentAgentWorkFocus,
  deriveConstellationEntryReady,
  isConstellationMessageGroupComplete,
  resolveMessageRecipients,
  teardownConstellation,
} from "../src/index.js";

const WORLD_ID = "world-phase19";
const NOW = "2026-08-11T22:05:00.000Z";

function agent(addedOrder: number, overrides: Record<string, unknown> = {}) {
  const adapterId = ["hermes", "openclaw", "codex", "claude-code"][addedOrder];
  return {
    rosterId: `roster-${addedOrder}`,
    adapterId,
    sessionOwnership:
      adapterId === "hermes" ? "operator-persistent" : "world-owned",
    worldSessionId: `11111111-1111-4111-8111-11111111111${addedOrder}`,
    worldInstanceId: WORLD_ID,
    nativeRootSessionRef: `native-${addedOrder}`,
    displayName: `Agent ${addedOrder}`,
    continuity: "current",
    connection: "connected",
    avatar: {
      status: "accepted",
      profileId: `avatar-${addedOrder}`,
      sessionId: `avatar-session-${addedOrder}`,
    },
    addedOrder,
    ...overrides,
  };
}

function projection(
  agents: ReadonlyArray<ReturnType<typeof agent>>,
  overrides: Record<string, unknown> = {},
) {
  return {
    schema: "aiw.constellation/0.19",
    mode: "multi-agent",
    worldInstanceId: WORLD_ID,
    lifecycle: "active",
    revision: 3,
    agents,
    entryReady: deriveConstellationEntryReady(agents),
    truth: "current",
    ...overrides,
  };
}

function messageGroup(overrides: Record<string, unknown> = {}) {
  return {
    schema: "aiw.constellation-message/0.19",
    groupId: "21111111-1111-4111-8111-111111111111",
    requestId: "31111111-1111-4111-8111-111111111111",
    correlationId: "41111111-1111-4111-8111-111111111111",
    text: "Inspect the repository city.",
    target: { kind: "broadcast" },
    recipientRosterIds: ["roster-0", "roster-1"],
    recipients: [
      {
        rosterId: "roster-0",
        worldSessionId: "11111111-1111-4111-8111-111111111110",
        state: "completed",
        finalText: "Done.",
        errorLabel: null,
      },
      {
        rosterId: "roster-1",
        worldSessionId: "11111111-1111-4111-8111-111111111111",
        state: "unavailable",
        finalText: null,
        errorLabel: "Harness unavailable",
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function workFocus(overrides: Record<string, unknown> = {}) {
  return {
    schema: "aiw.agent-work-focus/0.19",
    activityId: "activity-19",
    rosterId: "roster-0",
    worldSessionId: "11111111-1111-4111-8111-111111111110",
    repositoryRef: "repository-main",
    objectRef: "aiw://object/source-index",
    objectKind: "file",
    repositoryPath: "src/index.ts",
    layoutGeneration: `layout-${"7".repeat(64)}`,
    movementRequestId: "movement-19",
    source: "structured-tool-event",
    state: "coding",
    ...overrides,
  };
}

describe("Phase 19 constellation protocol", () => {
  it("bounds the roster and rejects only duplicate adapter/native-root bindings", () => {
    const four = [agent(0), agent(1), agent(2), agent(3)];
    expect(
      ConstellationProjectionSchema.parse(projection(four)).agents,
    ).toHaveLength(4);
    expect(
      ConstellationProjectionSchema.safeParse(
        projection([...four, agent(4, { adapterId: "codex" })]),
      ).success,
    ).toBe(false);

    const sameHarnessDistinctRoots = [
      agent(0),
      agent(1, { adapterId: "hermes", sessionOwnership: "world-owned" }),
    ];
    expect(
      ConstellationProjectionSchema.safeParse(
        projection(sameHarnessDistinctRoots),
      ).success,
    ).toBe(true);
    expect(
      ConstellationProjectionSchema.safeParse(
        projection([
          agent(0),
          agent(1, {
            adapterId: "hermes",
            sessionOwnership: "world-owned",
            nativeRootSessionRef: "native-0",
          }),
        ]),
      ).success,
    ).toBe(false);
  });

  it("derives and validates readiness from every retained agent", () => {
    expect(deriveConstellationEntryReady([agent(0)])).toBe(false);
    expect(deriveConstellationEntryReady([agent(0), agent(1)])).toBe(true);
    expect(
      ConstellationProjectionSchema.safeParse(
        projection([agent(0), agent(1)], { entryReady: false }),
      ).success,
    ).toBe(false);

    for (const incomplete of [
      agent(1, { continuity: "stale" }),
      agent(1, { continuity: "unavailable" }),
      agent(1, { connection: "connecting" }),
      agent(1, { connection: "stale" }),
      agent(1, { connection: "unavailable" }),
      agent(1, {
        avatar: { status: "missing", profileId: null, sessionId: null },
      }),
      agent(1, {
        avatar: { status: "editing", profileId: null, sessionId: null },
      }),
      agent(1, {
        avatar: { status: "accepted", profileId: null, sessionId: null },
      }),
    ]) {
      expect(deriveConstellationEntryReady([agent(0), incomplete])).toBe(false);
    }
    expect(
      deriveConstellationEntryReady([
        agent(0),
        agent(1, { continuity: "previous-recovered" }),
      ]),
    ).toBe(true);
  });

  it("enforces identity ownership, exact world binding, and stable added order", () => {
    expect(
      ConstellationProjectionSchema.safeParse(
        projection([
          agent(0),
          agent(1, { sessionOwnership: "operator-persistent" }),
        ]),
      ).success,
    ).toBe(false);
    expect(
      ConstellationProjectionSchema.safeParse(
        projection([agent(0), agent(1, { worldInstanceId: "other-world" })]),
      ).success,
    ).toBe(false);
    expect(
      ConstellationProjectionSchema.safeParse(
        projection([agent(0), agent(1, { addedOrder: 0 })]),
      ).success,
    ).toBe(false);
    expect(
      ConstellationProjectionSchema.safeParse(projection([agent(1), agent(0)]))
        .success,
    ).toBe(false);
    expect(
      ConstellationProjectionSchema.safeParse(
        projection([agent(0, { adapterId: "gemini" }), agent(1)]),
      ).success,
    ).toBe(false);
  });

  it("resolves immutable broadcast and targeted recipients in roster order", () => {
    const roster = [agent(0), agent(1), agent(2)];
    expect(resolveMessageRecipients({ kind: "broadcast" }, roster)).toEqual([
      "roster-0",
      "roster-1",
      "roster-2",
    ]);
    expect(
      resolveMessageRecipients({ kind: "agent", rosterId: "roster-1" }, roster),
    ).toEqual(["roster-1"]);
    expect(() =>
      resolveMessageRecipients({ kind: "agent", rosterId: "unknown" }, roster),
    ).toThrow(/unknown/i);
    expect(() =>
      resolveMessageRecipients({ kind: "broadcast" }, [
        agent(0),
        agent(1, { rosterId: "roster-0" }),
      ]),
    ).toThrow(/duplicate/i);
    expect(MessageTargetSchema.safeParse({ kind: "all" }).success).toBe(false);
  });

  it("validates immutable ordered group recipients and terminal truth", () => {
    const terminal = ConstellationMessageGroupSchema.parse(messageGroup());
    expect(isConstellationMessageGroupComplete(terminal)).toBe(true);
    for (const state of ["queued", "streaming"] as const) {
      expect(
        isConstellationMessageGroupComplete(
          ConstellationMessageGroupSchema.parse(
            messageGroup({
              recipients: [
                terminal.recipients[0],
                { ...terminal.recipients[1], state },
              ],
            }),
          ),
        ),
      ).toBe(false);
    }
    expect(
      ConstellationMessageGroupSchema.safeParse(
        messageGroup({ recipientRosterIds: ["roster-0", "roster-0"] }),
      ).success,
    ).toBe(false);
    expect(
      ConstellationMessageGroupSchema.safeParse(
        messageGroup({
          recipients: [
            messageGroup().recipients[1],
            messageGroup().recipients[0],
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("bounds accepted text, final text, and error labels by UTF-8 bytes", () => {
    expect(
      ConstellationMessageGroupSchema.safeParse(
        messageGroup({ text: "😀".repeat(4_097) }),
      ).success,
    ).toBe(false);
    expect(
      ConstellationMessageGroupSchema.safeParse(
        messageGroup({
          recipients: [
            {
              ...messageGroup().recipients[0],
              finalText: "😀".repeat(8_193),
            },
            messageGroup().recipients[1],
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      ConstellationMessageGroupSchema.safeParse(
        messageGroup({
          recipients: [
            messageGroup().recipients[0],
            {
              ...messageGroup().recipients[1],
              errorLabel: "😀".repeat(61),
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("ends a World idempotently without mutating retained native bindings", () => {
    for (const lifecycle of ["assembling", "active", "ending"] as const) {
      const current = ConstellationProjectionSchema.parse(
        projection([agent(0), agent(1)], {
          lifecycle,
          entryReady: lifecycle !== "ending",
        }),
      );
      const ended = teardownConstellation(current);
      expect(ended).toMatchObject({ lifecycle: "ended", entryReady: false });
      expect(ended.agents).toEqual(current.agents);
      expect(teardownConstellation(ended)).toEqual(ended);
    }
  });

  it("accepts only exact current structured repository work focus", () => {
    const parsed = AgentRepositoryWorkFocusSchema.parse(workFocus());
    const expected = {
      repositoryRef: "repository-main",
      objectRef: "aiw://object/source-index",
      layoutGeneration: `layout-${"7".repeat(64)}`,
    };
    expect(assertCurrentAgentWorkFocus(parsed, expected)).toEqual(parsed);
    for (const mismatch of [
      { ...expected, repositoryRef: "repository-other" },
      { ...expected, objectRef: "aiw://object/similar-name" },
      { ...expected, layoutGeneration: `layout-${"8".repeat(64)}` },
    ]) {
      expect(() => assertCurrentAgentWorkFocus(parsed, mismatch)).toThrow(
        /mismatch/i,
      );
    }
    expect(
      AgentRepositoryWorkFocusSchema.safeParse({
        ...workFocus(),
        source: "assistant-prose",
      }).success,
    ).toBe(false);
  });

  it("routes accepted voice text through the shared target without audio payloads", () => {
    const target = MessageTargetSchema.parse({
      kind: "agent",
      rosterId: "roster-1",
    });
    const accepted = {
      schema: "aiw.voice-accepted-text/0.19",
      worldInstanceId: WORLD_ID,
      requestId: "51111111-1111-4111-8111-111111111111",
      correlationId: "61111111-1111-4111-8111-111111111111",
      acceptedText: "Please inspect this symbol.",
      target,
      acceptedAt: NOW,
    };
    expect(AcceptedVoiceTextSchema.parse(accepted).target).toEqual(target);
    expect(
      AcceptedVoiceTextSchema.safeParse({
        ...accepted,
        rawAudio: "base64-wav",
      }).success,
    ).toBe(false);
  });
});

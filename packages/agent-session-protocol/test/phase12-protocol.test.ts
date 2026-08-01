import { describe, expect, it } from "vitest";

import {
  AgentAvatarProposalSchema,
  AgentCapabilityManifestSchema,
  AgentSessionEventSchema,
  AgentSessionSchema,
  EventProjection,
  assertTurnBinding,
  capabilitySnapshotHash,
  modeTransition,
  sanitizeDisplayText,
} from "../src/index.js";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const CORRELATION_ID = "33333333-3333-4333-8333-333333333333";
const HASH = "a".repeat(64);

function session() {
  return {
    schema: "aiw.agent-session/0.12",
    sessionId: SESSION_ID,
    adapterId: "hermes",
    adapterSessionRef: "20260721_011618_330489c8",
    profile: "default",
    workspaceId: "ws_0123456789abcdef0123456789abcdef",
    repositoryRef: "repo_0123456789abcdef0123456789abcdef",
    worktreeRef: null,
    mode: "explore",
    permissionRevision: 2,
    capabilitySnapshotHash: HASH,
    avatarProfileRef: null,
    status: "ready",
    continuity: "current",
    currentFocusObjectIds: [],
    currentTaskRef: null,
    activeRunId: null,
    lastEventSequence: 0,
    createdAt: "2026-07-21T05:00:00.000Z",
    updatedAt: "2026-07-21T05:00:00.000Z",
  } as const;
}

function event(sequence = 1, eventId = EVENT_ID) {
  return {
    schema: "aiw.agent-event/0.12",
    eventId,
    sessionId: SESSION_ID,
    sequence,
    occurredAt: "2026-07-21T05:00:01.000Z",
    correlationId: CORRELATION_ID,
    type: "message.assistant-final",
    payload: { text: "bounded answer" },
    redaction: { applied: false, count: 0 },
  } as const;
}

describe("Phase 12 agent-session protocol", () => {
  it("accepts only strict bound session identity and explicit continuity truth", () => {
    expect(AgentSessionSchema.parse(session())).toEqual(session());
    expect(
      AgentSessionSchema.safeParse({ ...session(), secret: "never" }).success,
    ).toBe(false);
    expect(
      AgentSessionSchema.safeParse({
        ...session(),
        adapterSessionRef: "x".repeat(257),
      }).success,
    ).toBe(false);
  });

  it("bounds ordered payloads and rejects prohibited Phase 13+ event types", () => {
    expect(AgentSessionEventSchema.parse(event())).toEqual(event());
    expect(
      AgentSessionEventSchema.safeParse({
        ...event(),
        payload: { text: "x".repeat(16_385) },
      }).success,
    ).toBe(false);
    expect(
      AgentSessionEventSchema.safeParse({
        ...event(),
        type: "world-actions.proposed",
      }).success,
    ).toBe(false);
  });

  it("deduplicates event IDs and fails closed across gaps until reset", () => {
    const projection = new EventProjection(SESSION_ID, 0);
    expect(projection.accept(event()).kind).toBe("accepted");
    expect(projection.accept(event()).kind).toBe("duplicate");
    expect(
      projection.accept(event(3, "44444444-4444-4444-8444-444444444444")),
    ).toMatchObject({ kind: "gap", expectedSequence: 2, receivedSequence: 3 });
    expect(projection.state).toMatchObject({ truth: "gap", lastSequence: 1 });
    expect(
      projection.accept(event(2, "55555555-5555-4555-8555-555555555555")).kind,
    ).toBe("blocked");
    projection.reset(8);
    expect(projection.state).toMatchObject({
      truth: "reset-required",
      lastSequence: 8,
    });
  });

  it("requires confirmation only for more-permissive mode transitions", () => {
    expect(modeTransition("explore", "collaborate", false)).toEqual({
      allowed: false,
      confirmationRequired: true,
    });
    expect(modeTransition("collaborate", "explore", false)).toEqual({
      allowed: true,
      confirmationRequired: false,
    });
    expect(modeTransition("explore", "autonomous", true).allowed).toBe(false);
    expect(modeTransition("explore", "guided-build", true).allowed).toBe(false);
  });

  it("binds every turn to exact profile/session/repository/permission/capability identity", () => {
    expect(() => assertTurnBinding(session(), session())).not.toThrow();
    expect(() =>
      assertTurnBinding(session(), { ...session(), permissionRevision: 3 }),
    ).toThrow(/permission revision/i);
    expect(() =>
      assertTurnBinding(session(), {
        ...session(),
        repositoryRef: "repo_wrong",
      }),
    ).toThrow(/repository/i);
  });

  it("validates a truthful Hermes capability manifest and hashes canonically", () => {
    const manifest = AgentCapabilityManifestSchema.parse({
      schema: "aiw.agent-capabilities/0.12",
      adapterId: "hermes",
      adapterVersion: "0.18.2-f7c9feb3",
      transport: "loopback-http-sse",
      origin: "local",
      auth: "server-bearer",
      supportedModes: ["explore", "collaborate"],
      ordering: "per-session-strict",
      resume: "session-api",
      shutdownOwner: "hermes",
      maxInputBytes: 16_384,
      maxEventBytes: 32_768,
      capabilities: {
        attach: true,
        sendText: true,
        streamDeltas: true,
        toolStatus: true,
        approvals: false,
        interrupt: true,
        avatarProposal: true,
        skillsDisclosure: true,
      },
      unavailable: {
        approvals: "Selected session stream does not advertise run_approval.",
      },
    });
    expect(capabilitySnapshotHash(manifest)).toMatch(/^[a-f0-9]{64}$/);
    expect(capabilitySnapshotHash(manifest)).toBe(
      capabilitySnapshotHash(manifest),
    );
  });

  it("allows only bounded avatar display fields and strips canaries", () => {
    expect(
      AgentAvatarProposalSchema.parse({
        schema: "aiw.avatar-proposal/0.12",
        proposalId: "66666666-6666-4666-8666-666666666666",
        sessionId: SESSION_ID,
        displayName: "Hermes",
        species: "cat",
        head: "cat",
        hands: "paws",
        feet: "paws",
        fur: "short",
        tail: "cat",
        markings: "tuxedo",
        bodyColor: "charcoal",
        shirt: "Hermes",
        movementStyle: "shared-biped-core",
        sourceDisclosure:
          "Derived locally by the Hermes plugin from allowlisted persona traits.",
        rationale: "A bounded visual proposal awaiting operator consent.",
        createdAt: "2026-07-21T05:00:00.000Z",
      }).displayName,
    ).toBe("Hermes");
    expect(
      AgentAvatarProposalSchema.parse({
        schema: "aiw.avatar-proposal/0.12",
        proposalId: "66666666-6666-4666-8666-666666666666",
        sessionId: SESSION_ID,
        displayName: "Hermes",
        species: "cat",
        head: "cat",
        hands: "paws",
        feet: "paws",
        fur: "short",
        tail: "cat",
        markings: "tuxedo",
        bodyColor: "charcoal",
        shirt: "Hermes",
        movementStyle: "shared-biped-core",
        sourceDisclosure: "Bounded local imported selection.",
        rationale: "Explicit operator-selected imported avatar.",
        createdAt: "2026-07-21T05:00:00.000Z",
        avatarSource: {
          kind: "imported",
          version: 2,
          mode: "original",
          modelId: "cat-agent-01",
        },
      }).avatarSource,
    ).toEqual({
      kind: "imported",
      version: 2,
      mode: "original",
      modelId: "cat-agent-01",
    });
    expect(() =>
      AgentAvatarProposalSchema.parse({
        schema: "aiw.avatar-proposal/0.12",
        proposalId: "66666666-6666-4666-8666-666666666666",
        sessionId: SESSION_ID,
        displayName: "Hermes",
        species: "cat",
        head: "cat",
        hands: "paws",
        feet: "paws",
        fur: "short",
        tail: "cat",
        markings: "tuxedo",
        bodyColor: "charcoal",
        shirt: "Hermes",
        movementStyle: "shared-biped-core",
        sourceDisclosure: "Bounded local imported selection.",
        rationale: "Explicit operator-selected imported avatar.",
        createdAt: "2026-07-21T05:00:00.000Z",
        avatarSource: {
          kind: "imported",
          version: 2,
          mode: "original",
          modelId: "cat-agent",
        },
      }),
    ).toThrow();
    expect(() =>
      AgentAvatarProposalSchema.parse({
        schema: "aiw.avatar-proposal/0.12",
        proposalId: "66666666-6666-4666-8666-666666666666",
        sessionId: SESSION_ID,
        displayName: "Hermes",
        species: "human",
        head: "round",
        hands: "hands",
        feet: "feet",
        fur: "none",
        tail: "none",
        markings: "solid",
        bodyColor: "warm-light",
        shirt: "Hermes",
        movementStyle: "shared-biped-core",
        sourceDisclosure: "Bounded local imported selection.",
        rationale: "Role-invalid agent selection must be rejected.",
        createdAt: "2026-07-21T05:00:00.000Z",
        avatarSource: {
          kind: "imported",
          version: 2,
          mode: "original",
          modelId: "user-male-01",
        },
      }),
    ).toThrow();
    const cleaned = sanitizeDisplayText(
      "hello sk-supersecret /home/operator/private SOUL.md memory transcript",
      160,
    );
    expect(cleaned.text).not.toMatch(
      /supersecret|\/home\/operator|SOUL\.md|memory|transcript/i,
    );
    expect(cleaned.redaction.count).toBeGreaterThan(0);
  });
});

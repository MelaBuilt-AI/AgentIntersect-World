import { createHash } from "node:crypto";

import { z } from "zod";

const Utf8Bounded = (minimum: number, maximum: number) =>
  z
    .string()
    .min(minimum)
    .refine((value) => Buffer.byteLength(value, "utf8") <= maximum, {
      message: `Must be at most ${maximum} UTF-8 bytes`,
    });

const LocalOpaqueRef = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const WorldRef = z
  .string()
  .min(1)
  .max(256)
  .regex(
    /^(?:[A-Za-z0-9][A-Za-z0-9._:-]*|aiw:\/\/(?:object|path)\/[A-Za-z0-9][A-Za-z0-9._:-]*)$/,
  );
const SessionModeSchema = z.enum([
  "explore",
  "collaborate",
  "autonomous",
  "guided-build",
]);

export const AgentSessionSchema = z
  .object({
    schema: z.literal("aiw.agent-session/0.12"),
    sessionId: z.string().uuid(),
    adapterId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    adapterSessionRef: LocalOpaqueRef,
    adapterRootSessionRef: LocalOpaqueRef.optional(),
    adapterPreviousSessionRef: LocalOpaqueRef.nullable().optional(),
    profile: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
    workspaceId: WorldRef,
    repositoryRef: WorldRef,
    worktreeRef: WorldRef.nullable(),
    mode: SessionModeSchema,
    permissionRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
    capabilitySnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    avatarProfileRef: WorldRef.nullable(),
    status: z.enum([
      "connecting",
      "ready",
      "thinking",
      "using-tool",
      "waiting-approval",
      "paused",
      "offline",
      "error",
      "closed",
    ]),
    continuity: z.enum([
      "current",
      "previous-recovered",
      "offline",
      "missing",
      "reset-required",
    ]),
    currentFocusObjectIds: z.array(WorldRef).max(16),
    currentTaskRef: WorldRef.nullable(),
    activeRunId: LocalOpaqueRef.nullable(),
    lastEventSequence: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type AgentSession = z.infer<typeof AgentSessionSchema>;
export type SessionMode = z.infer<typeof SessionModeSchema>;

const EventPayloadSchema = z
  .record(z.string().min(1).max(64), z.json())
  .superRefine((payload, context) => {
    if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 16_384) {
      context.addIssue({
        code: "custom",
        message: "Event payload exceeds 16384 UTF-8 bytes",
      });
    }
  });

export const AgentSessionEventSchema = z
  .object({
    schema: z.literal("aiw.agent-event/0.12"),
    eventId: z.string().uuid(),
    sessionId: z.string().uuid(),
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    occurredAt: z.string().datetime(),
    correlationId: z.string().uuid(),
    type: z.enum([
      "session.connected",
      "session.capabilities",
      "session.status",
      "session.reset-required",
      "message.user-accepted",
      "message.assistant-delta",
      "message.assistant-final",
      "tool.started",
      "tool.completed",
      "tool.failed",
      "approval.requested",
      "approval.resolved",
      "session.interrupted",
      "session.closed",
      "session.error",
    ]),
    payload: EventPayloadSchema,
    redaction: z
      .object({
        applied: z.boolean(),
        count: z.number().int().nonnegative().max(10_000),
      })
      .strict(),
  })
  .strict();

export type AgentSessionEvent = z.infer<typeof AgentSessionEventSchema>;

const CapabilityKeySchema = z.enum([
  "attach",
  "sendText",
  "streamDeltas",
  "toolStatus",
  "approvals",
  "interrupt",
  "avatarProposal",
  "skillsDisclosure",
  "worldActions",
]);

const WorldActionCapabilitySchema = z
  .object({
    enabled: z.boolean(),
    protocol: z.literal("aiw.world-action/0.13"),
    proposalHelper: z.literal("propose_world_action"),
    maximumBatchActions: z.literal(8),
    maximumEnvelopeBytes: z.literal(16_384),
    defaultTtlMs: z.literal(30_000),
    maximumTtlMs: z.literal(120_000),
    rateActionsPerSecond: z.literal(4),
    rateBurstActions: z.literal(8),
    maximumQueuedActions: z.literal(32),
    unavailableReason: z.string().min(1).max(240).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.enabled && !value.unavailableReason) {
      context.addIssue({
        code: "custom",
        path: ["unavailableReason"],
        message: "Disabled World Actions require an explanation",
      });
    }
  });

const DisabledWorldActionCapability = {
  enabled: false,
  protocol: "aiw.world-action/0.13",
  proposalHelper: "propose_world_action",
  maximumBatchActions: 8,
  maximumEnvelopeBytes: 16_384,
  defaultTtlMs: 30_000,
  maximumTtlMs: 120_000,
  rateActionsPerSecond: 4,
  rateBurstActions: 8,
  maximumQueuedActions: 32,
  unavailableReason:
    "Structured World Actions are unavailable; persistent chat and manual navigation remain available.",
} as const;

const CapabilityValuesSchema = z
  .object({
    attach: z.boolean(),
    sendText: z.boolean(),
    streamDeltas: z.boolean(),
    toolStatus: z.boolean(),
    approvals: z.boolean(),
    interrupt: z.boolean(),
    avatarProposal: z.boolean(),
    skillsDisclosure: z.boolean(),
    worldActions: z.boolean().default(false),
  })
  .strict();

export const AgentCapabilityManifestSchema = z
  .object({
    schema: z.literal("aiw.agent-capabilities/0.12"),
    adapterId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    adapterVersion: z.string().min(1).max(64),
    transport: z.literal("loopback-http-sse"),
    origin: z.literal("local"),
    auth: z.literal("server-bearer"),
    supportedModes: z.array(SessionModeSchema).min(1).max(4),
    ordering: z.literal("per-session-strict"),
    resume: z.enum(["session-api", "unavailable"]),
    shutdownOwner: z.enum(["hermes", "world", "external"]),
    maxInputBytes: z.number().int().min(1).max(65_536),
    maxEventBytes: z.number().int().min(1).max(65_536),
    capabilities: CapabilityValuesSchema,
    unavailable: z.partialRecord(
      CapabilityKeySchema,
      z.string().min(1).max(240),
    ),
    worldActions: WorldActionCapabilitySchema.default(
      DisabledWorldActionCapability,
    ),
  })
  .strict()
  .superRefine((manifest, context) => {
    for (const key of CapabilityKeySchema.options) {
      if (key === "worldActions") continue;
      if (!manifest.capabilities[key] && !manifest.unavailable[key]) {
        context.addIssue({
          code: "custom",
          path: ["unavailable", key],
          message: `Unavailable capability ${key} requires an explanation`,
        });
      }
    }
    if (manifest.capabilities.worldActions !== manifest.worldActions.enabled) {
      context.addIssue({
        code: "custom",
        path: ["worldActions", "enabled"],
        message: "World Action capability and protocol declaration disagree",
      });
    }
  });

export type AgentCapabilityManifest = z.infer<
  typeof AgentCapabilityManifestSchema
>;

export const AgentAvatarProposalSchema = z
  .object({
    schema: z.literal("aiw.avatar-proposal/0.12"),
    proposalId: z.string().uuid(),
    sessionId: z.string().uuid(),
    displayName: Utf8Bounded(1, 64),
    species: z.enum(["human", "dog", "cat"]),
    head: z.enum(["round", "angular", "dog", "cat"]),
    hands: z.enum(["hands", "paws", "claws"]),
    feet: z.enum(["feet", "paws", "claws"]),
    fur: z.enum(["none", "short", "long"]),
    tail: z.enum(["none", "dog", "cat"]),
    markings: z.enum(["solid", "tuxedo", "points", "patches"]),
    bodyColor: z.enum([
      "warm-light",
      "warm-medium",
      "warm-dark",
      "cool-light",
      "cool-medium",
      "cool-dark",
      "charcoal",
      "cream",
      "golden",
      "brown",
      "grey",
      "black",
    ]),
    shirt: z.enum(["Codex", "Hermes", "AgentIntersect", "World"]),
    movementStyle: z.literal("shared-biped-core"),
    sourceDisclosure: Utf8Bounded(1, 240),
    rationale: Utf8Bounded(1, 240),
    createdAt: z.string().datetime(),
  })
  .strict();

export type AgentAvatarProposal = z.infer<typeof AgentAvatarProposalSchema>;

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}

export function capabilitySnapshotHash(
  manifest: AgentCapabilityManifest,
): string {
  const parsed = AgentCapabilityManifestSchema.parse(manifest);
  return createHash("sha256").update(canonical(parsed)).digest("hex");
}

export type EventProjectionTruth = "current" | "gap" | "reset-required";

export class EventProjection {
  readonly #sessionId: string;
  readonly #seen = new Set<string>();
  #lastSequence: number;
  #truth: EventProjectionTruth = "current";

  constructor(sessionId: string, lastSequence: number) {
    this.#sessionId = z.string().uuid().parse(sessionId);
    this.#lastSequence = z.number().int().nonnegative().parse(lastSequence);
  }

  get state() {
    return { truth: this.#truth, lastSequence: this.#lastSequence } as const;
  }

  accept(
    input: unknown,
  ):
    | { kind: "accepted"; event: AgentSessionEvent }
    | { kind: "duplicate" }
    | { kind: "blocked" }
    | { kind: "gap"; expectedSequence: number; receivedSequence: number } {
    const event = AgentSessionEventSchema.parse(input);
    if (event.sessionId !== this.#sessionId)
      throw new Error("Event session identity does not match projection");
    if (this.#seen.has(event.eventId)) return { kind: "duplicate" };
    if (this.#truth !== "current") return { kind: "blocked" };
    const expectedSequence = this.#lastSequence + 1;
    if (event.sequence !== expectedSequence) {
      this.#truth = "gap";
      return {
        kind: "gap",
        expectedSequence,
        receivedSequence: event.sequence,
      };
    }
    this.#seen.add(event.eventId);
    this.#lastSequence = event.sequence;
    return { kind: "accepted", event };
  }

  reset(lastSequence: number): void {
    this.#lastSequence = z.number().int().nonnegative().parse(lastSequence);
    this.#truth = "reset-required";
  }
}

const MODE_RANK: Readonly<Record<SessionMode, number>> = {
  explore: 0,
  collaborate: 1,
  autonomous: 2,
  "guided-build": 2,
};

export function modeTransition(
  current: SessionMode,
  next: SessionMode,
  confirmed: boolean,
): { allowed: boolean; confirmationRequired: boolean } {
  if (next === "autonomous" || next === "guided-build")
    return { allowed: false, confirmationRequired: false };
  const escalation = MODE_RANK[next] > MODE_RANK[current];
  return {
    allowed: !escalation || confirmed,
    confirmationRequired: escalation && !confirmed,
  };
}

export function assertTurnBinding(
  persisted: AgentSession,
  requested: AgentSession,
): void {
  const left = AgentSessionSchema.parse(persisted);
  const right = AgentSessionSchema.parse(requested);
  const checks: ReadonlyArray<[keyof AgentSession, string]> = [
    ["adapterId", "adapter"],
    ["profile", "profile"],
    ["workspaceId", "workspace"],
    ["repositoryRef", "repository"],
    ["worktreeRef", "worktree"],
    ["permissionRevision", "permission revision"],
    ["capabilitySnapshotHash", "capability snapshot"],
  ];
  const leftRoot = left.adapterRootSessionRef ?? left.adapterSessionRef;
  const rightRoot = right.adapterRootSessionRef ?? right.adapterSessionRef;
  if (leftRoot !== rightRoot) throw new Error("Turn adapter session mismatch");
  for (const [key, label] of checks) {
    if (left[key] !== right[key]) throw new Error(`Turn ${label} mismatch`);
  }
}

const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:sk|api|token|bearer)[-_][A-Za-z0-9._-]{6,}\b/gi,
  /(?:^|\s)(?:\/[A-Za-z0-9._-]+){2,}/g,
  /\bSOUL\.md\b/gi,
  /\b(?:raw\s+)?(?:persona|memory|transcript|private reasoning)\b/gi,
];

export function sanitizeDisplayText(
  input: string,
  maxBytes: number,
): { text: string; redaction: { applied: boolean; count: number } } {
  let text = [...String(input)]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return (
        code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)
      );
    })
    .join("");
  let count = 0;
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (match) => {
      count += 1;
      return match.startsWith(" ") ? " [redacted]" : "[redacted]";
    });
  }
  while (Buffer.byteLength(text, "utf8") > maxBytes) text = text.slice(0, -1);
  return {
    text,
    redaction: { applied: count > 0, count },
  };
}

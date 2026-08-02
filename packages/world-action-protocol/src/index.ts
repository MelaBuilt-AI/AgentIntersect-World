import { z } from "zod";

export const WORLD_ACTION_PROTOCOL = "aiw.world-action/0.13" as const;
export const AGENT_MOVEMENT_PROTOCOL = "aiw.agent-movement/1" as const;
export const WORLD_ACTION_LIMITS = Object.freeze({
  minimumBatchActions: 1,
  maximumBatchActions: 8,
  defaultTtlMs: 30_000,
  maximumTtlMs: 120_000,
  maximumEnvelopeBytes: 16_384,
  acceptedActionsPerSecond: 4,
  rateBurstActions: 8,
  maximumQueuedActions: 32,
  dedupeIds: 1_024,
  dedupeMs: 10 * 60_000,
  maximumTimelineActions: 200,
  timelineRetentionMs: 7 * 24 * 60 * 60_000,
  maximumPins: 32,
  maximumTraceObjects: 256,
  maximumTraceEdges: 512,
  maximumConfirmedHops: 24,
  maximumVisibleTimelineRows: 50,
  maximumAgentMovementDistance: 30,
  maximumAgentMovementSpeed: 12,
  minimumAgentStoppingRadius: 0.25,
  maximumAgentStoppingRadius: 5,
});

const byteLength = (value: string) => {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
};
const IdentifierSchema = z.string().uuid();
const OpaqueRefSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const WorldObjectRefSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^aiw:\/\/object\/[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const GenerationSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const WorldActionTargetSchema = z
  .object({
    repositoryRef: WorldObjectRefSchema,
    objectRef: WorldObjectRefSchema,
    requestedPath: z.string().min(1).max(512).optional(),
  })
  .strict();

const targetAction = <T extends string>(kind: T) =>
  z.object({ kind: z.literal(kind), target: WorldActionTargetSchema }).strict();

const NavigateSchema = targetAction("navigate");
const FocusSchema = targetAction("focus");
const InspectSchema = targetAction("inspect");
const HighlightSchema = targetAction("highlight");
const PointAtSchema = targetAction("point-at");
const FollowSchema = targetAction("follow");
const TraceSchema = z
  .object({
    kind: z.literal("trace"),
    target: WorldActionTargetSchema,
    destination: WorldActionTargetSchema,
  })
  .strict();
const CompareSchema = z
  .object({
    kind: z.literal("compare"),
    target: WorldActionTargetSchema,
    destination: WorldActionTargetSchema,
  })
  .strict();
const AnnotationSchema = z
  .object({
    kind: z.literal("annotate-temporary"),
    target: WorldActionTargetSchema,
    text: z
      .string()
      .min(1)
      .refine(
        (value) => byteLength(value) <= 2_048,
        "Annotation exceeds 2048 UTF-8 bytes",
      ),
    ttlSeconds: z.number().int().min(1).max(120),
  })
  .strict();
const EvidenceSchema = z
  .object({
    kind: z.literal("present-evidence"),
    target: WorldActionTargetSchema,
    relationshipRefs: z
      .array(OpaqueRefSchema)
      .max(WORLD_ACTION_LIMITS.maximumTraceEdges),
  })
  .strict();
const ClearSchema = z
  .object({
    kind: z.literal("clear"),
    scope: z.enum(["presentation", "timeline-unpinned", "all-clearable"]),
  })
  .strict();
const CancelSchema = z
  .object({
    kind: z.literal("cancel"),
    targetType: z.enum(["action", "batch"]),
    targetId: IdentifierSchema,
  })
  .strict();

const FiniteWorldCoordinateSchema = z.number().finite().min(-15).max(15);
const StoppingRadiusSchema = z
  .number()
  .finite()
  .min(WORLD_ACTION_LIMITS.minimumAgentStoppingRadius)
  .max(WORLD_ACTION_LIMITS.maximumAgentStoppingRadius)
  .optional();
export const AgentMovementTargetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("coordinate"),
      x: FiniteWorldCoordinateSchema,
      z: FiniteWorldCoordinateSchema,
      stoppingRadius: StoppingRadiusSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("relative"),
      direction: z.enum(["forward", "backward", "left", "right"]),
      distance: z
        .number()
        .finite()
        .positive()
        .max(WORLD_ACTION_LIMITS.maximumAgentMovementDistance),
      stoppingRadius: StoppingRadiusSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("follow-user"),
      stoppingRadius: z
        .number()
        .finite()
        .min(WORLD_ACTION_LIMITS.minimumAgentStoppingRadius)
        .max(WORLD_ACTION_LIMITS.maximumAgentStoppingRadius),
    })
    .strict(),
  z
    .object({
      kind: z.literal("repository-object"),
      objectId: WorldObjectRefSchema,
      layoutGeneration: GenerationSchema,
      stoppingRadius: StoppingRadiusSchema,
    })
    .strict(),
]);
export type AgentMovementTarget = z.infer<typeof AgentMovementTargetSchema>;

const MoveAgentSchema = z
  .object({
    kind: z.literal("move-agent"),
    schema: z.literal(AGENT_MOVEMENT_PROTOCOL),
    actorId: OpaqueRefSchema,
    source: z.enum(["user-directed", "agent-autonomous"]),
    speed: z
      .number()
      .finite()
      .positive()
      .max(WORLD_ACTION_LIMITS.maximumAgentMovementSpeed),
    target: AgentMovementTargetSchema,
  })
  .strict();

export const WorldActionIntentSchema = z.discriminatedUnion("kind", [
  NavigateSchema,
  FocusSchema,
  InspectSchema,
  HighlightSchema,
  TraceSchema,
  CompareSchema,
  PointAtSchema,
  FollowSchema,
  AnnotationSchema,
  EvidenceSchema,
  ClearSchema,
  CancelSchema,
  MoveAgentSchema,
]);

export const WorldActionProposalSchema = z
  .object({
    actions: z
      .array(WorldActionIntentSchema)
      .min(WORLD_ACTION_LIMITS.minimumBatchActions)
      .max(WORLD_ACTION_LIMITS.maximumBatchActions),
    ttlMs: z
      .number()
      .int()
      .min(1_000)
      .max(WORLD_ACTION_LIMITS.maximumTtlMs)
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      byteLength(JSON.stringify(value)) >
      WORLD_ACTION_LIMITS.maximumEnvelopeBytes
    ) {
      context.addIssue({
        code: "custom",
        message: "Proposal exceeds 16384 UTF-8 bytes",
      });
    }
  });

export type WorldActionIntent = z.infer<typeof WorldActionIntentSchema>;
export type WorldActionProposal = z.infer<typeof WorldActionProposalSchema>;

const AssignedActionSchema = z.intersection(
  WorldActionIntentSchema,
  z.object({ actionId: IdentifierSchema }).strict(),
);

export const WorldActionEnvelopeSchema = z
  .object({
    schema: z.literal(WORLD_ACTION_PROTOCOL),
    requestId: IdentifierSchema,
    batchId: IdentifierSchema,
    sessionId: IdentifierSchema,
    adapterSessionRef: OpaqueRefSchema,
    repositoryRef: WorldObjectRefSchema,
    worldGeneration: GenerationSchema,
    layoutGeneration: GenerationSchema,
    graphGeneration: IdentifierSchema.nullable(),
    capabilitySnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    createdAt: z.string().datetime({ offset: false }),
    expiresAt: z.string().datetime({ offset: false }),
    actions: z
      .array(AssignedActionSchema)
      .min(WORLD_ACTION_LIMITS.minimumBatchActions)
      .max(WORLD_ACTION_LIMITS.maximumBatchActions),
  })
  .strict()
  .superRefine((value, context) => {
    const created = Date.parse(value.createdAt);
    const expires = Date.parse(value.expiresAt);
    if (
      expires <= created ||
      expires - created > WORLD_ACTION_LIMITS.maximumTtlMs
    ) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "TTL is outside protocol bounds",
      });
    }
    if (
      new Set(value.actions.map(({ actionId }) => actionId)).size !==
      value.actions.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["actions"],
        message: "Action IDs must be unique",
      });
    }
    if (
      value.actions.some(
        (action) =>
          action.kind !== "move-agent" &&
          "target" in action &&
          action.target.repositoryRef !== value.repositoryRef,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["actions"],
        message: "Action target crosses repository binding",
      });
    }
    if (
      value.actions.some(
        (action) =>
          "destination" in action &&
          action.destination.repositoryRef !== value.repositoryRef,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["actions"],
        message: "Action destination crosses repository binding",
      });
    }
    if (
      byteLength(JSON.stringify(value)) >
      WORLD_ACTION_LIMITS.maximumEnvelopeBytes
    ) {
      context.addIssue({
        code: "custom",
        message: "Envelope exceeds 16384 UTF-8 bytes",
      });
    }
  });

export type WorldActionEnvelope = z.infer<typeof WorldActionEnvelopeSchema>;
export type WorldAction = WorldActionEnvelope["actions"][number];

export const WorldActionBindingSchema = z
  .object({
    sessionId: IdentifierSchema,
    adapterSessionRef: OpaqueRefSchema,
    repositoryRef: WorldObjectRefSchema,
    worldGeneration: GenerationSchema,
    layoutGeneration: GenerationSchema,
    graphGeneration: IdentifierSchema.nullable(),
    capabilitySnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type WorldActionBinding = z.infer<typeof WorldActionBindingSchema>;

export function assignWorldActionEnvelope(
  input: unknown,
  bindingInput: unknown,
  authority: {
    readonly sequence: number;
    readonly now?: Date;
    readonly requestId?: string;
    readonly id: () => string;
  },
): WorldActionEnvelope {
  const proposal = WorldActionProposalSchema.parse(input);
  const binding = WorldActionBindingSchema.parse(bindingInput);
  const now = authority.now ?? new Date();
  const ttl = proposal.ttlMs ?? WORLD_ACTION_LIMITS.defaultTtlMs;
  return WorldActionEnvelopeSchema.parse({
    schema: WORLD_ACTION_PROTOCOL,
    requestId: authority.requestId ?? authority.id(),
    batchId: authority.id(),
    ...binding,
    sequence: z.number().int().positive().parse(authority.sequence),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
    actions: proposal.actions.map((action) => ({
      ...action,
      actionId: authority.id(),
    })),
  });
}

export type WorldActionRejection =
  | "invalid"
  | "binding-mismatch"
  | "expired"
  | "duplicate"
  | "sequence-gap"
  | "rate-limited"
  | "queue-full"
  | "capability-unavailable";

type Queued = WorldAction & { readonly batchId: string };

export class WorldActionGate {
  readonly #binding: WorldActionBinding;
  readonly #now: () => number;
  readonly #seen = new Map<string, number>();
  readonly #cancelled = new Set<string>();
  #expectedSequence = 1;
  #tokens: number = WORLD_ACTION_LIMITS.rateBurstActions;
  #tokenUpdatedAt: number;
  #queue: Queued[] = [];
  #active: Queued | null = null;

  constructor(
    binding: unknown,
    options: {
      readonly now?: () => number;
      readonly initialSequence?: number;
    } = {},
  ) {
    this.#binding = WorldActionBindingSchema.parse(binding);
    this.#now = options.now ?? Date.now;
    this.#tokenUpdatedAt = this.#now();
    this.#expectedSequence = options.initialSequence ?? 1;
    if (
      !Number.isSafeInteger(this.#expectedSequence) ||
      this.#expectedSequence < 1
    ) {
      throw new Error("Initial World Action sequence is invalid");
    }
  }

  get queuedActions(): number {
    return this.#queue.length;
  }

  accept(input: unknown):
    | { accepted: true; queuedActions: number; superseded: readonly string[] }
    | {
        accepted: false;
        reason: WorldActionRejection;
        expectedSequence?: number;
      } {
    const parsed = WorldActionEnvelopeSchema.safeParse(input);
    if (!parsed.success) return { accepted: false, reason: "invalid" };
    const envelope = parsed.data;
    const now = this.#now();
    this.#pruneSeen(now);
    if (
      [
        envelope.requestId,
        envelope.batchId,
        ...envelope.actions.map(({ actionId }) => actionId),
      ].some((id) => this.#seen.has(id))
    ) {
      return { accepted: false, reason: "duplicate" };
    }
    if (!this.#matchesBinding(envelope))
      return { accepted: false, reason: "binding-mismatch" };
    if (Date.parse(envelope.expiresAt) < now)
      return { accepted: false, reason: "expired" };
    if (envelope.sequence !== this.#expectedSequence) {
      return {
        accepted: false,
        reason: "sequence-gap",
        expectedSequence: this.#expectedSequence,
      };
    }
    this.#refill(now);
    if (this.#tokens < envelope.actions.length)
      return { accepted: false, reason: "rate-limited" };
    if (envelope.actions.length > WORLD_ACTION_LIMITS.maximumQueuedActions) {
      return { accepted: false, reason: "queue-full" };
    }

    const superseded = [
      ...(this.#active ? [this.#active.actionId] : []),
      ...this.#queue.map(({ actionId }) => actionId),
    ];
    this.#queue = [];
    this.#active = null;
    this.#tokens -= envelope.actions.length;
    this.#expectedSequence += 1;
    const ids = [
      envelope.requestId,
      envelope.batchId,
      ...envelope.actions.map(({ actionId }) => actionId),
    ];
    for (const id of ids) this.#seen.set(id, now);
    this.#trimSeen();
    this.#queue.push(
      ...envelope.actions.map((action) => ({
        ...action,
        batchId: envelope.batchId,
      })),
    );
    return { accepted: true, queuedActions: this.#queue.length, superseded };
  }

  startNext(): Queued | undefined {
    if (this.#active) return this.#active;
    const next = this.#queue.shift();
    this.#active = next ?? null;
    return next;
  }

  completeActive(): void {
    this.#active = null;
  }

  cancel(
    targetType: "action" | "batch",
    targetId: string,
  ): { cancelled: boolean; idempotent: boolean } {
    IdentifierSchema.parse(targetId);
    if (this.#cancelled.has(targetId))
      return { cancelled: true, idempotent: true };
    let found = false;
    if (
      this.#active &&
      (targetType === "action"
        ? this.#active.actionId === targetId
        : this.#active.batchId === targetId)
    ) {
      this.#cancelled.add(this.#active.actionId);
      this.#active = null;
      found = true;
    }
    const retained: Queued[] = [];
    for (const action of this.#queue) {
      const matches =
        targetType === "action"
          ? action.actionId === targetId
          : action.batchId === targetId;
      if (matches) {
        this.#cancelled.add(action.actionId);
        found = true;
      } else retained.push(action);
    }
    this.#queue = retained;
    if (found) this.#cancelled.add(targetId);
    return { cancelled: found, idempotent: false };
  }

  #matchesBinding(envelope: WorldActionEnvelope): boolean {
    return (
      Object.keys(this.#binding) as Array<keyof WorldActionBinding>
    ).every((key) => envelope[key] === this.#binding[key]);
  }

  #refill(now: number): void {
    const elapsed = Math.max(0, now - this.#tokenUpdatedAt);
    this.#tokens = Math.min(
      WORLD_ACTION_LIMITS.rateBurstActions,
      this.#tokens +
        (elapsed / 1_000) * WORLD_ACTION_LIMITS.acceptedActionsPerSecond,
    );
    this.#tokenUpdatedAt = now;
  }

  #pruneSeen(now: number): void {
    for (const [id, timestamp] of this.#seen) {
      if (now - timestamp > WORLD_ACTION_LIMITS.dedupeMs) this.#seen.delete(id);
    }
  }

  #trimSeen(): void {
    while (this.#seen.size > WORLD_ACTION_LIMITS.dedupeIds) {
      const oldest = this.#seen.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#seen.delete(oldest);
    }
  }
}

export type WorldActionExecutionState =
  | "requested"
  | "attention"
  | "path-planned"
  | "moving"
  | "arrived"
  | "blocked"
  | "interrupted"
  | "superseded"
  | "cancelled";

export type WorldActionExecutionSnapshot = {
  readonly actionId: string;
  readonly requestedTarget: z.infer<typeof WorldActionTargetSchema>;
  readonly state: WorldActionExecutionState;
  readonly attention: boolean;
  readonly arrived: boolean;
  readonly continuity: "current" | "previous-recovered";
  readonly pathId?: string;
  readonly reason?: string;
};

const terminalStates = new Set<WorldActionExecutionState>([
  "arrived",
  "blocked",
  "interrupted",
  "superseded",
  "cancelled",
]);

export class WorldActionStateMachine {
  #snapshot: WorldActionExecutionSnapshot;

  constructor(actionId: string, requestedTarget: unknown) {
    this.#snapshot = {
      actionId: IdentifierSchema.parse(actionId),
      requestedTarget: WorldActionTargetSchema.parse(requestedTarget),
      state: "requested",
      attention: false,
      arrived: false,
      continuity: "current",
    };
  }

  static recover(
    snapshot: WorldActionExecutionSnapshot,
  ): WorldActionStateMachine {
    const recovered = new WorldActionStateMachine(
      snapshot.actionId,
      snapshot.requestedTarget,
    );
    recovered.#snapshot = {
      ...snapshot,
      state: "interrupted",
      attention: false,
      arrived: false,
      continuity: "previous-recovered",
      reason: "restart-recovery",
    };
    return recovered;
  }

  get snapshot(): WorldActionExecutionSnapshot {
    return { ...this.#snapshot };
  }

  attend(): void {
    this.#assertActive();
    this.#snapshot = { ...this.#snapshot, state: "attention", attention: true };
  }

  pathPlanned(pathId: string): void {
    this.#assertActive();
    this.#snapshot = {
      ...this.#snapshot,
      state: "path-planned",
      pathId: OpaqueRefSchema.parse(pathId),
      arrived: false,
    };
  }

  moving(): void {
    this.#assertActive();
    if (!this.#snapshot.pathId)
      throw new Error("Movement requires a canonical planned path");
    this.#snapshot = { ...this.#snapshot, state: "moving", arrived: false };
  }

  arrive(insideInteractionZone: boolean): void {
    this.#assertActive();
    if (!insideInteractionZone)
      throw new Error(
        "Arrival requires physical entry into the interaction zone",
      );
    this.#snapshot = { ...this.#snapshot, state: "arrived", arrived: true };
  }

  block(reason: string): void {
    this.#assertActive();
    this.#snapshot = {
      ...this.#snapshot,
      state: "blocked",
      arrived: false,
      reason: reason.slice(0, 240),
    };
  }

  interrupt(
    reason:
      | "operator-movement"
      | "escape"
      | "cancel"
      | "capability-loss"
      | "invalid-target",
  ): void {
    if (terminalStates.has(this.#snapshot.state)) return;
    this.#snapshot = {
      ...this.#snapshot,
      state: "interrupted",
      arrived: false,
      reason,
    };
  }

  supersede(): void {
    if (terminalStates.has(this.#snapshot.state)) return;
    this.#snapshot = {
      ...this.#snapshot,
      state: "superseded",
      arrived: false,
      reason: "newer-batch",
    };
  }

  cancel(): void {
    if (this.#snapshot.state === "cancelled") return;
    if (terminalStates.has(this.#snapshot.state)) return;
    this.#snapshot = {
      ...this.#snapshot,
      state: "cancelled",
      arrived: false,
      reason: "cancelled",
    };
  }

  #assertActive(): void {
    if (terminalStates.has(this.#snapshot.state))
      throw new Error("Cannot transition a terminal World Action");
  }
}

type TraceEdgeInput = {
  readonly ref: string;
  readonly sourceRef: string;
  readonly targetRef: string;
  readonly confidence: string;
  readonly evidenceRef: string;
};

export function validateTraceEvidence(input: {
  readonly graphGeneration: string;
  readonly objects: readonly string[];
  readonly edges: readonly TraceEdgeInput[];
  readonly confirmedPath: readonly string[];
  readonly totalObjects: number;
  readonly totalEdges: number;
}) {
  const objects = input.objects.slice(
    0,
    WORLD_ACTION_LIMITS.maximumTraceObjects,
  );
  const edges = input.edges
    .slice(0, WORLD_ACTION_LIMITS.maximumTraceEdges)
    .map((edge) => ({
      ...edge,
      status:
        edge.confidence === "exact_file" ||
        edge.confidence === "exact_workspace_package"
          ? ("confirmed" as const)
          : ["unresolved", "unsupported", "unavailable", "stale"].includes(
                edge.confidence,
              )
            ? ("unavailable" as const)
            : ("candidate" as const),
    }));
  const confirmedRefs = new Set(
    edges.filter(({ status }) => status === "confirmed").map(({ ref }) => ref),
  );
  const confirmedPath = input.confirmedPath
    .filter((ref) => confirmedRefs.has(ref))
    .slice(0, WORLD_ACTION_LIMITS.maximumConfirmedHops);
  const truncated =
    input.totalObjects > objects.length ||
    input.totalEdges > edges.length ||
    input.confirmedPath.length > confirmedPath.length;
  return {
    graphGeneration: IdentifierSchema.parse(input.graphGeneration),
    objects,
    edges,
    confirmedPath,
    truncation: truncated
      ? {
          shownObjects: objects.length,
          totalObjects: input.totalObjects,
          shownEdges: edges.length,
          totalEdges: input.totalEdges,
          reason: "phase13-rich-graph-limit" as const,
        }
      : null,
  };
}

export type ActionTimelineEntry = {
  readonly actionId: string;
  readonly batchId: string;
  readonly kind: WorldActionIntent["kind"];
  readonly objectRef?: string;
  readonly state: WorldActionExecutionState;
  readonly continuity: "current" | "previous-recovered";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly pinned: boolean;
  readonly requestedPath?: string;
  readonly currentPath?: string;
  readonly confidence?: string;
  readonly truncation?: string;
};

export class BoundedActionTimeline {
  readonly #now: () => number;
  #entries: ActionTimelineEntry[] = [];

  constructor(
    options: {
      readonly now?: () => number;
      readonly initial?: readonly ActionTimelineEntry[];
    } = {},
  ) {
    this.#now = options.now ?? Date.now;
    for (const entry of options.initial ?? []) {
      const recovered = [
        "requested",
        "attention",
        "path-planned",
        "moving",
      ].includes(entry.state)
        ? ({
            ...entry,
            state: "interrupted",
            continuity: "previous-recovered",
            updatedAt: new Date(this.#now()).toISOString(),
          } as const)
        : entry;
      this.#entries.push(recovered);
    }
    this.#prune();
  }

  get all(): readonly ActionTimelineEntry[] {
    return this.#entries.map((entry) => ({ ...entry }));
  }

  get visible(): readonly ActionTimelineEntry[] {
    return this.all.slice(0, WORLD_ACTION_LIMITS.maximumVisibleTimelineRows);
  }

  append(entry: ActionTimelineEntry): void {
    IdentifierSchema.parse(entry.actionId);
    IdentifierSchema.parse(entry.batchId);
    if (this.#entries.some(({ actionId }) => actionId === entry.actionId))
      throw new Error("Duplicate timeline action ID");
    this.#entries.push({ ...entry });
    this.#prune();
  }

  pin(actionId: string): void {
    const pinnedCount = this.#entries.filter(({ pinned }) => pinned).length;
    const index = this.#entries.findIndex(
      (entry) => entry.actionId === actionId,
    );
    if (index < 0) throw new Error("Timeline action is missing");
    if (
      !this.#entries[index]!.pinned &&
      pinnedCount >= WORLD_ACTION_LIMITS.maximumPins
    ) {
      throw new Error("Timeline supports at most 32 pinned actions");
    }
    this.#entries[index] = { ...this.#entries[index]!, pinned: true };
  }

  unpin(actionId: string): void {
    const index = this.#entries.findIndex(
      (entry) => entry.actionId === actionId,
    );
    if (index >= 0)
      this.#entries[index] = { ...this.#entries[index]!, pinned: false };
  }

  clear(): void {
    this.#entries = this.#entries.filter(({ pinned }) => pinned);
  }

  #prune(): void {
    const cutoff = this.#now() - WORLD_ACTION_LIMITS.timelineRetentionMs;
    this.#entries = this.#entries
      .filter((entry) => entry.pinned || Date.parse(entry.createdAt) >= cutoff)
      .sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
          left.actionId.localeCompare(right.actionId),
      );
    if (this.#entries.length <= WORLD_ACTION_LIMITS.maximumTimelineActions)
      return;
    const pinned = this.#entries.filter(({ pinned }) => pinned);
    const unpinned = this.#entries.filter(({ pinned }) => !pinned);
    this.#entries = [
      ...pinned,
      ...unpinned.slice(
        0,
        WORLD_ACTION_LIMITS.maximumTimelineActions - pinned.length,
      ),
    ].sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
        left.actionId.localeCompare(right.actionId),
    );
  }
}

export function toWorldActionPresentationProjection(
  entry: ActionTimelineEntry,
) {
  return {
    actionId: entry.actionId,
    kind: entry.kind,
    ...(entry.objectRef ? { objectRef: entry.objectRef } : {}),
    state: entry.state,
    pinned: entry.pinned,
  } as const;
}

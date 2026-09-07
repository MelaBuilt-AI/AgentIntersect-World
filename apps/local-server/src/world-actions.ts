import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  TargetResolver,
  isInsideInteractionZone,
  planNavigationPath,
  replayCanonicalPath,
  type NavigationMesh,
  type NavigationPoint,
  type TargetRecord,
} from "@agentintersect-world/navigation";
import {
  WORLD_ACTION_LIMITS,
  WorldActionGate,
  WorldActionStateMachine,
  assignWorldActionEnvelope,
  validateTraceEvidence,
  type WorldActionBinding,
  type WorldActionEnvelope,
  type WorldActionExecutionSnapshot,
  type WorldActionIntent,
  type WorldActionProposal,
} from "@agentintersect-world/world-action-protocol";

export type WorldActionContext = {
  readonly binding: WorldActionBinding;
  readonly worldActionsEnabled: boolean;
  readonly targets: readonly TargetRecord[];
  readonly navigationMesh: NavigationMesh;
  readonly positions: ReadonlyMap<
    string,
    NavigationPoint & { readonly interactionRadius: number }
  >;
  readonly actorPosition?: NavigationPoint;
  readonly lookup?: (objectRef: string) => Promise<TargetRecord | null>;
  readonly relationships?: readonly {
    readonly ref: string;
    readonly sourceRef: string;
    readonly targetRef: string;
    readonly confidence: string;
    readonly evidenceRef: string;
  }[];
};

export type WorldActionOutcome = Omit<
  WorldActionExecutionSnapshot,
  "requestedTarget"
> & {
  readonly requestedTarget: string | null;
  readonly kind: WorldActionIntent["kind"];
  readonly currentPath?: string;
  readonly requestedPath?: string;
  readonly trace?: ReturnType<typeof validateTraceEvidence>;
};

export type WorldActionSourceAuthority = {
  readonly requestId: string;
  readonly sourceStreamId?: string;
  readonly sequence: number;
  readonly createdAt: string;
};

export type WorldActionProposalResult =
  | {
      readonly accepted: true;
      readonly envelope: WorldActionEnvelope;
      readonly outcomes: readonly WorldActionOutcome[];
      readonly superseded: readonly string[];
      readonly paths: Readonly<Record<string, readonly NavigationPoint[]>>;
    }
  | { readonly accepted: false; readonly reason: string };

type StoredAction = {
  readonly sessionId: string;
  readonly envelope: WorldActionEnvelope;
  readonly actionIndex: number;
  readonly outcome: WorldActionOutcome;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly pinned: boolean;
  readonly leaseExpiresAt?: string;
};
type StorePayload = {
  readonly schema: "aiw.world-action-store/0.13";
  readonly actions: readonly StoredAction[];
  readonly sources?: readonly SourceProposalRecord[];
  readonly sourceCursors?: readonly SourceCursorRecord[];
};
type StoreEnvelope = {
  readonly schema: "aiw.world-action-store-envelope/0.13";
  readonly checksum: string;
  readonly payload: StorePayload;
};

const activeStates = new Set([
  "requested",
  "attention",
  "path-planned",
  "moving",
]);
const MOVEMENT_LEASE_MS = 30_000;
const MAXIMUM_SOURCE_CURSORS = 1_024;
type SourceProposalRecord = {
  readonly sessionId: string;
  readonly proposalId: string;
  readonly sourceStreamId: string;
  readonly sequence: number;
  readonly acceptedAt: string;
};
type SourceCursorRecord = {
  readonly sessionId: string;
  readonly sourceStreamId: string;
  readonly lastSequence: number;
  readonly updatedAt: string;
};
const checksum = (payload: StorePayload) =>
  createHash("sha256").update(JSON.stringify(payload)).digest("hex");

function readStore(file: string): {
  readonly actions: StoredAction[];
  readonly sources: SourceProposalRecord[];
  readonly sourceCursors: SourceCursorRecord[];
} {
  if (!fs.existsSync(file))
    return { actions: [], sources: [], sourceCursors: [] };
  const input: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    (input as StoreEnvelope).schema !== "aiw.world-action-store-envelope/0.13"
  )
    throw new Error("World Action store envelope is invalid");
  const envelope = input as StoreEnvelope;
  if (
    envelope.payload?.schema !== "aiw.world-action-store/0.13" ||
    !Array.isArray(envelope.payload.actions) ||
    checksum(envelope.payload) !== envelope.checksum
  )
    throw new Error("World Action store checksum is invalid");
  const sources = Array.isArray(envelope.payload.sources)
    ? envelope.payload.sources.map((source) => ({ ...source }))
    : [];
  const sourceCursors = Array.isArray(envelope.payload.sourceCursors)
    ? envelope.payload.sourceCursors.map((cursor) => ({ ...cursor }))
    : Array.from(
        sources
          .reduce((cursors, source) => {
            const key = `${source.sessionId}\u0000${source.sourceStreamId}`;
            const current = cursors.get(key);
            if (!current || source.sequence > current.lastSequence)
              cursors.set(key, {
                sessionId: source.sessionId,
                sourceStreamId: source.sourceStreamId,
                lastSequence: source.sequence,
                updatedAt: source.acceptedAt,
              });
            return cursors;
          }, new Map<string, SourceCursorRecord>())
          .values(),
      );
  return {
    actions: envelope.payload.actions.map((action) => ({ ...action })),
    sources,
    sourceCursors,
  };
}

export class WorldActionService {
  readonly #directory: string;
  readonly #file: string;
  readonly #now: () => number;
  readonly #id: () => string;
  readonly #gates = new Map<
    string,
    { readonly bindingKey: string; readonly gate: WorldActionGate }
  >();
  readonly #paths = new Map<string, readonly NavigationPoint[]>();
  #actions: StoredAction[];
  #sources: SourceProposalRecord[];
  #sourceCursors: SourceCursorRecord[];
  #proposalTail: Promise<void> = Promise.resolve();

  constructor(
    directory: string,
    options: { readonly now?: () => number; readonly id?: () => string } = {},
  ) {
    this.#directory = path.resolve(directory);
    this.#file = path.join(this.#directory, "world-actions.json");
    this.#now = options.now ?? Date.now;
    this.#id = options.id ?? randomUUID;
    fs.mkdirSync(this.#directory, { recursive: true, mode: 0o700 });
    fs.chmodSync(this.#directory, 0o700);
    const stored = readStore(this.#file);
    this.#actions = stored.actions.map((record) =>
      activeStates.has(record.outcome.state)
        ? {
            ...record,
            outcome: {
              ...record.outcome,
              state: "interrupted",
              attention: false,
              arrived: false,
              continuity: "previous-recovered",
              reason: "restart-recovery",
            },
            updatedAt: new Date(this.#now()).toISOString(),
          }
        : record,
    );
    this.#sources = stored.sources;
    this.#sourceCursors = stored.sourceCursors;
    this.#prune();
    if (this.#actions.length > 0) this.#write();
  }

  async propose(
    sessionId: string,
    proposal: unknown,
    context: WorldActionContext,
    sourceAuthority?: WorldActionSourceAuthority,
  ): Promise<WorldActionProposalResult> {
    let release!: () => void;
    const previous = this.#proposalTail;
    this.#proposalTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await this.#propose(sessionId, proposal, context, sourceAuthority);
    } finally {
      release();
    }
  }

  async #propose(
    sessionId: string,
    proposal: unknown,
    context: WorldActionContext,
    sourceAuthority?: WorldActionSourceAuthority,
  ): Promise<WorldActionProposalResult> {
    if (!context.worldActionsEnabled)
      return { accepted: false, reason: "capability-unavailable" };
    if (sessionId !== context.binding.sessionId)
      return { accepted: false, reason: "binding-mismatch" };
    const resolver = new TargetResolver(
      {
        repositoryRef: context.binding.repositoryRef,
        worldGeneration: context.binding.worldGeneration,
        layoutGeneration: context.binding.layoutGeneration,
        graphGeneration: context.binding.graphGeneration,
      },
      context.targets,
      context.lookup ? { lookup: context.lookup } : {},
    );
    let parsed: WorldActionProposal;
    try {
      const protocol =
        await import("@agentintersect-world/world-action-protocol");
      parsed = protocol.WorldActionProposalSchema.parse(proposal);
    } catch {
      return { accepted: false, reason: "invalid" };
    }
    const repositoryActions = parsed.actions.filter(
      (action) => action.kind !== "move-agent",
    );
    const resolved = await resolver.prevalidate(repositoryActions);
    if (!resolved.ok) return { accepted: false, reason: resolved.reason };
    const sourceStreamId = sourceAuthority
      ? (sourceAuthority.sourceStreamId ??
        createHash("sha256")
          .update(context.binding.adapterSessionRef)
          .digest("hex"))
      : null;
    if (
      sourceAuthority &&
      (!sourceStreamId || !/^[0-9a-f]{64}$/.test(sourceStreamId))
    )
      return { accepted: false, reason: "invalid" };
    if (
      sourceAuthority &&
      parsed.actions.some(
        (action) =>
          action.kind === "move-agent" && action.source === "user-directed",
      )
    )
      return { accepted: false, reason: "invalid" };
    if (
      parsed.actions.some(
        (action) =>
          action.kind === "move-agent" && action.actorId !== sessionId,
      )
    )
      return { accepted: false, reason: "binding-mismatch" };
    if (
      parsed.actions.some(
        (action) =>
          action.kind === "move-agent" && action.source === "agent-autonomous",
      ) &&
      this.#actions.some(
        (record) =>
          record.sessionId === sessionId &&
          record.outcome.kind === "move-agent" &&
          record.outcome.reason === "user-directed" &&
          activeStates.has(record.outcome.state),
      )
    )
      return { accepted: false, reason: "user-directed-active" };
    if (
      sourceAuthority &&
      (this.#sources.some(
        (record) =>
          record.sessionId === sessionId &&
          record.proposalId === sourceAuthority.requestId,
      ) ||
        this.#actions.some(
          (record) => record.envelope.requestId === sourceAuthority.requestId,
        ))
    )
      return { accepted: false, reason: "duplicate" };
    if (sourceAuthority) {
      if (
        !Number.isSafeInteger(sourceAuthority.sequence) ||
        sourceAuthority.sequence < 1
      )
        return { accepted: false, reason: "invalid" };
      const sourceCursor = this.#sourceCursors.find(
        (record) =>
          record.sessionId === sessionId &&
          record.sourceStreamId === sourceStreamId,
      );
      if (
        sourceCursor &&
        sourceAuthority.sequence !== sourceCursor.lastSequence + 1
      )
        return { accepted: false, reason: "sequence-gap" };
      if (
        Date.parse(sourceAuthority.createdAt) +
          (parsed.ttlMs ?? WORLD_ACTION_LIMITS.defaultTtlMs) <
        this.#now()
      )
        return { accepted: false, reason: "expired" };
    }
    const sequence = this.#nextSequence(sessionId);
    let envelope: WorldActionEnvelope;
    try {
      envelope = assignWorldActionEnvelope(parsed, context.binding, {
        sequence,
        now: new Date(this.#now()),
        id: this.#id,
      });
    } catch {
      return { accepted: false, reason: "invalid" };
    }
    const gate = this.#gate(sessionId, context.binding);
    const accepted = gate.accept(envelope);
    if (!accepted.accepted) return { accepted: false, reason: accepted.reason };
    if (accepted.superseded.length > 0) {
      const cancellations = envelope.actions.flatMap((action) =>
        action.kind === "cancel" ? [action] : [],
      );
      this.#actions = this.#actions.map((record) =>
        record.sessionId === sessionId && activeStates.has(record.outcome.state)
          ? {
              ...record,
              outcome: {
                ...record.outcome,
                state: cancellations.some((cancellation) =>
                  cancellation.targetType === "action"
                    ? cancellation.targetId === record.outcome.actionId
                    : cancellation.targetId === record.envelope.batchId,
                )
                  ? "cancelled"
                  : "superseded",
                arrived: false,
                reason: cancellations.some((cancellation) =>
                  cancellation.targetType === "action"
                    ? cancellation.targetId === record.outcome.actionId
                    : cancellation.targetId === record.envelope.batchId,
                )
                  ? "cancelled"
                  : "newer-batch",
              },
              updatedAt: new Date(this.#now()).toISOString(),
            }
          : record,
      );
      for (const actionId of accepted.superseded) this.#paths.delete(actionId);
    }
    const outcomes = envelope.actions.map((action) =>
      this.#initialOutcome(action, resolved.targets, context),
    );
    if (
      envelope.actions.some(
        (action) => action.kind === "clear" && action.scope !== "presentation",
      )
    ) {
      this.#actions = this.#actions.filter(
        (record) => record.sessionId !== sessionId || record.pinned,
      );
    }
    const now = new Date(this.#now()).toISOString();
    this.#actions.push(
      ...outcomes.map((outcome, actionIndex) => ({
        sessionId,
        envelope,
        actionIndex,
        outcome,
        createdAt: now,
        updatedAt: now,
        pinned: false,
      })),
    );
    if (sourceAuthority && sourceStreamId) {
      this.#sources.push({
        sessionId,
        proposalId: sourceAuthority.requestId,
        sourceStreamId,
        sequence: sourceAuthority.sequence,
        acceptedAt: now,
      });
      const cursorIndex = this.#sourceCursors.findIndex(
        (record) =>
          record.sessionId === sessionId &&
          record.sourceStreamId === sourceStreamId,
      );
      const cursor = {
        sessionId,
        sourceStreamId,
        lastSequence: sourceAuthority.sequence,
        updatedAt: now,
      };
      if (cursorIndex === -1) this.#sourceCursors.push(cursor);
      else this.#sourceCursors[cursorIndex] = cursor;
    }
    this.#prune();
    this.#write();
    return {
      accepted: true,
      envelope,
      outcomes,
      superseded: accepted.superseded,
      paths: Object.fromEntries(
        envelope.actions.flatMap((action) => {
          const points = this.#paths.get(action.actionId);
          return points ? [[action.actionId, points] as const] : [];
        }),
      ),
    };
  }

  timeline(sessionId: string): readonly (WorldActionOutcome & {
    readonly batchId: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly pinned: boolean;
  })[] {
    this.#expireMovementLeases();
    return this.#actions
      .filter((record) => record.sessionId === sessionId)
      .sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
          right.envelope.sequence - left.envelope.sequence ||
          right.actionIndex - left.actionIndex,
      )
      .slice(0, WORLD_ACTION_LIMITS.maximumVisibleTimelineRows)
      .map((record) => ({
        ...record.outcome,
        batchId: record.envelope.batchId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        pinned: record.pinned,
      }));
  }

  movementExecutions(sessionId: string): readonly WorldActionProposalResult[] {
    const grouped = new Map<string, StoredAction[]>();
    for (const record of this.#actions) {
      if (
        record.sessionId !== sessionId ||
        record.outcome.kind !== "move-agent" ||
        !activeStates.has(record.outcome.state)
      )
        continue;
      const records = grouped.get(record.envelope.batchId) ?? [];
      records.push(record);
      grouped.set(record.envelope.batchId, records);
    }
    return [...grouped.values()].map((records) => ({
      accepted: true,
      envelope: records[0]!.envelope,
      outcomes: records.map(({ outcome }) => outcome),
      superseded: [],
      paths: {},
    }));
  }

  isBatchExecutable(sessionId: string, batchId: string): boolean {
    return this.#actions.some(
      (record) =>
        record.sessionId === sessionId &&
        record.envelope.batchId === batchId &&
        activeStates.has(record.outcome.state),
    );
  }

  transition(
    sessionId: string,
    actionId: string,
    event: "moving" | "arrived" | "blocked" | "semantic-focus",
    context: WorldActionContext,
  ): void {
    this.#expireMovementLeases();
    const index = this.#actions.findIndex(
      (record) =>
        record.sessionId === sessionId && record.outcome.actionId === actionId,
    );
    if (index < 0) throw new Error("World Action is missing");
    const record = this.#actions[index]!;
    if (!this.#bindingMatches(record.envelope, context.binding)) {
      this.#invalidateBatch(record.envelope.batchId, "invalid-target");
      return;
    }
    if (record.outcome.requestedTarget) {
      const resolver = new TargetResolver(
        {
          repositoryRef: context.binding.repositoryRef,
          worldGeneration: context.binding.worldGeneration,
          layoutGeneration: context.binding.layoutGeneration,
          graphGeneration: context.binding.graphGeneration,
        },
        context.targets,
      );
      const validity = resolver.validateDuringRun(
        record.outcome.requestedTarget,
        {
          repositoryRef: context.binding.repositoryRef,
          worldGeneration: context.binding.worldGeneration,
          layoutGeneration: context.binding.layoutGeneration,
          graphGeneration: context.binding.graphGeneration,
        },
      );
      if (!validity.valid) {
        this.#invalidateBatch(record.envelope.batchId, "invalid-target");
        return;
      }
    }
    let outcome: WorldActionOutcome;
    if (event === "moving") {
      const action = record.envelope.actions[record.actionIndex];
      const followHeartbeat =
        record.outcome.state === "moving" &&
        action?.kind === "move-agent" &&
        action.target.kind === "follow-user";
      if (record.outcome.state !== "path-planned" && !followHeartbeat)
        throw new Error("Movement requires a planned path");
      outcome = { ...record.outcome, state: "moving", arrived: false };
    } else if (event === "arrived") {
      if (record.outcome.state !== "moving")
        throw new Error("Arrival requires active movement");
      if (record.outcome.kind === "move-agent") {
        if (
          !context.actorPosition ||
          !Number.isFinite(context.actorPosition.x) ||
          !Number.isFinite(context.actorPosition.z) ||
          Math.abs(context.actorPosition.x) >
            WORLD_ACTION_LIMITS.maximumWorldCoordinate ||
          Math.abs(context.actorPosition.z) >
            WORLD_ACTION_LIMITS.maximumWorldCoordinate
        )
          throw new Error(
            "Agent movement arrival is outside the supported coordinate range",
          );
        outcome = { ...record.outcome, state: "arrived", arrived: true };
      } else {
        const target = record.outcome.requestedTarget
          ? context.positions.get(record.outcome.requestedTarget)
          : undefined;
        if (
          !target ||
          !context.actorPosition ||
          !isInsideInteractionZone(
            context.actorPosition,
            target,
            target.interactionRadius,
          )
        ) {
          throw new Error(
            "Arrival requires physical entry into the interaction zone",
          );
        }
        outcome = { ...record.outcome, state: "arrived", arrived: true };
      }
    } else if (event === "blocked") {
      if (
        record.outcome.state !== "path-planned" &&
        record.outcome.state !== "moving"
      )
        throw new Error("Blocked requires active movement");
      outcome = {
        ...record.outcome,
        state: "blocked",
        arrived: false,
        reason: "static-collision",
      };
    } else {
      if (record.outcome.state !== "path-planned")
        throw new Error("Semantic focus requires a planned semantic target");
      outcome = {
        ...record.outcome,
        state: "attention",
        attention: true,
        arrived: false,
        reason: "semantic-only",
      };
    }
    this.#actions[index] = {
      ...record,
      outcome,
      updatedAt: new Date(this.#now()).toISOString(),
      ...(event === "moving"
        ? {
            leaseExpiresAt: new Date(
              this.#now() + MOVEMENT_LEASE_MS,
            ).toISOString(),
          }
        : {}),
    };
    if (event !== "moving") this.#paths.delete(actionId);
    this.#write();
  }

  interrupt(
    sessionId: string,
    reason:
      | "operator-movement"
      | "escape"
      | "cancel"
      | "capability-loss"
      | "invalid-target",
  ): void {
    const now = new Date(this.#now()).toISOString();
    for (const record of this.#actions)
      if (
        record.sessionId === sessionId &&
        activeStates.has(record.outcome.state)
      )
        this.#paths.delete(record.outcome.actionId);
    this.#actions = this.#actions.map((record) =>
      record.sessionId === sessionId && activeStates.has(record.outcome.state)
        ? {
            ...record,
            outcome: {
              ...record.outcome,
              state: "interrupted",
              arrived: false,
              reason,
            },
            updatedAt: now,
          }
        : record,
    );
    this.#write();
  }

  cancel(
    sessionId: string,
    actionId: string,
  ): { readonly cancelled: boolean; readonly idempotent: boolean } {
    const index = this.#actions.findIndex(
      (record) =>
        record.sessionId === sessionId && record.outcome.actionId === actionId,
    );
    if (index < 0) return { cancelled: false, idempotent: false };
    const record = this.#actions[index]!;
    if (record.outcome.state === "cancelled")
      return { cancelled: true, idempotent: true };
    if (!activeStates.has(record.outcome.state))
      return { cancelled: false, idempotent: false };
    this.#paths.delete(record.outcome.actionId);
    this.#actions[index] = {
      ...record,
      outcome: {
        ...record.outcome,
        state: "cancelled",
        arrived: false,
        reason: "cancelled",
      },
      updatedAt: new Date(this.#now()).toISOString(),
    };
    this.#write();
    return { cancelled: true, idempotent: false };
  }

  async replay(
    sessionId: string,
    actionId: string,
    context: WorldActionContext,
  ) {
    const stored = this.#actions.find(
      (record) =>
        record.sessionId === sessionId && record.outcome.actionId === actionId,
    );
    if (!stored) return { accepted: false as const, reason: "not-found" };
    const assigned = stored.envelope.actions[stored.actionIndex]!;
    const { actionId: assignedActionId, ...intent } = assigned;
    void assignedActionId;
    return this.propose(sessionId, { actions: [intent] }, context);
  }

  pin(sessionId: string, actionId: string, pinned: boolean): void {
    const pins = this.#actions.filter(
      (record) => record.sessionId === sessionId && record.pinned,
    ).length;
    const index = this.#actions.findIndex(
      (record) =>
        record.sessionId === sessionId && record.outcome.actionId === actionId,
    );
    if (index < 0) throw new Error("World Action is missing");
    if (
      pinned &&
      !this.#actions[index]!.pinned &&
      pins >= WORLD_ACTION_LIMITS.maximumPins
    ) {
      throw new Error("World Action timeline supports at most 32 pins");
    }
    this.#actions[index] = { ...this.#actions[index]!, pinned };
    this.#write();
  }

  clear(sessionId: string): void {
    for (const record of this.#actions)
      if (record.sessionId === sessionId && !record.pinned)
        this.#paths.delete(record.outcome.actionId);
    this.#actions = this.#actions.filter(
      (record) => record.sessionId !== sessionId || record.pinned,
    );
    this.#write();
  }

  #initialOutcome(
    action: WorldActionEnvelope["actions"][number],
    resolved: readonly {
      readonly objectRef: string;
      readonly requestedPath?: string;
      readonly currentPath?: string;
    }[],
    context: WorldActionContext,
  ): WorldActionOutcome {
    if (action.kind === "move-agent")
      return {
        actionId: action.actionId,
        requestedTarget: null,
        kind: action.kind,
        state: "path-planned",
        attention: false,
        arrived: false,
        continuity: "current",
        reason: action.source,
      } as WorldActionOutcome;
    const target = "target" in action ? action.target : null;
    if (!target) {
      return {
        actionId: action.actionId,
        requestedTarget: null,
        kind: action.kind,
        state: "attention",
        attention: true,
        arrived: false,
        continuity: "current",
      } as WorldActionOutcome;
    }
    const machine = new WorldActionStateMachine(action.actionId, target);
    machine.attend();
    if (action.kind === "navigate" || action.kind === "follow") {
      const destination = context.positions.get(target.objectRef);
      const start = context.actorPosition ??
        [...context.positions.values()][0] ?? { x: 0, z: 0 };
      if (!destination) machine.block("target-interaction-zone-unavailable");
      else {
        const planned = planNavigationPath(
          context.navigationMesh,
          start,
          destination,
          destination.interactionRadius,
        );
        if (planned.status === "blocked") machine.block("static-collision");
        else {
          machine.pathPlanned(planned.meshId);
          this.#paths.set(
            action.actionId,
            replayCanonicalPath(planned, 0.25).slice(0, 1_024),
          );
        }
      }
    }
    const truth = resolved.find(
      (candidate) =>
        candidate.objectRef === target.objectRef &&
        candidate.requestedPath === target.requestedPath,
    );
    const trace = this.#traceFor(action, context);
    return {
      ...machine.snapshot,
      requestedTarget: target.objectRef,
      kind: action.kind,
      ...(truth?.requestedPath ? { requestedPath: truth.requestedPath } : {}),
      ...(truth?.currentPath ? { currentPath: truth.currentPath } : {}),
      ...(trace ? { trace } : {}),
    };
  }

  #traceFor(
    action: WorldActionEnvelope["actions"][number],
    context: WorldActionContext,
  ): ReturnType<typeof validateTraceEvidence> | undefined {
    if (
      context.binding.graphGeneration === null ||
      !context.relationships ||
      !(
        action.kind === "trace" ||
        action.kind === "compare" ||
        action.kind === "present-evidence"
      )
    )
      return undefined;
    const requestedRefs =
      action.kind === "present-evidence"
        ? new Set(action.relationshipRefs)
        : null;
    const destinationRef =
      "destination" in action ? action.destination.objectRef : null;
    const selected = context.relationships.filter((relationship) => {
      if (requestedRefs) return requestedRefs.has(relationship.ref);
      if (!destinationRef || !("target" in action)) return false;
      return (
        (relationship.sourceRef === action.target.objectRef &&
          relationship.targetRef === destinationRef) ||
        (relationship.targetRef === action.target.objectRef &&
          relationship.sourceRef === destinationRef)
      );
    });
    const objectRefs = [
      ...new Set(
        selected.flatMap(({ sourceRef, targetRef }) => [sourceRef, targetRef]),
      ),
    ];
    return validateTraceEvidence({
      graphGeneration: context.binding.graphGeneration,
      objects: objectRefs,
      edges: selected,
      confirmedPath: selected.map(({ ref }) => ref),
      totalObjects: objectRefs.length,
      totalEdges: selected.length,
    });
  }

  #nextSequence(sessionId: string): number {
    return (
      Math.max(
        0,
        ...this.#actions
          .filter((record) => record.sessionId === sessionId)
          .map((record) => record.envelope.sequence),
      ) + 1
    );
  }

  #gate(sessionId: string, binding: WorldActionBinding): WorldActionGate {
    const bindingKey = JSON.stringify(binding);
    let cached = this.#gates.get(sessionId);
    if (!cached || cached.bindingKey !== bindingKey) {
      const gate = new WorldActionGate(binding, {
        now: this.#now,
        initialSequence: this.#nextSequence(sessionId),
      });
      cached = { bindingKey, gate };
      this.#gates.set(sessionId, cached);
    }
    return cached.gate;
  }

  #bindingMatches(
    envelope: WorldActionEnvelope,
    binding: WorldActionBinding,
  ): boolean {
    return (
      envelope.sessionId === binding.sessionId &&
      envelope.adapterSessionRef === binding.adapterSessionRef &&
      envelope.repositoryRef === binding.repositoryRef &&
      envelope.worldGeneration === binding.worldGeneration &&
      envelope.layoutGeneration === binding.layoutGeneration &&
      envelope.graphGeneration === binding.graphGeneration &&
      envelope.capabilitySnapshotHash === binding.capabilitySnapshotHash
    );
  }

  #invalidateBatch(batchId: string, reason: string): void {
    const now = new Date(this.#now()).toISOString();
    for (const record of this.#actions)
      if (record.envelope.batchId === batchId)
        this.#paths.delete(record.outcome.actionId);
    this.#actions = this.#actions.map((record) =>
      record.envelope.batchId === batchId &&
      activeStates.has(record.outcome.state)
        ? {
            ...record,
            outcome: {
              ...record.outcome,
              state: "interrupted",
              arrived: false,
              reason,
            },
            updatedAt: now,
          }
        : record,
    );
    this.#write();
  }

  #expireMovementLeases(): void {
    const now = this.#now();
    let changed = false;
    this.#actions = this.#actions.map((record) => {
      if (
        record.outcome.state !== "moving" ||
        !record.leaseExpiresAt ||
        Date.parse(record.leaseExpiresAt) >= now
      )
        return record;
      changed = true;
      this.#paths.delete(record.outcome.actionId);
      return {
        ...record,
        outcome: {
          ...record.outcome,
          state: "interrupted",
          arrived: false,
          reason: "movement-lease-expired",
        },
        updatedAt: new Date(now).toISOString(),
      };
    });
    if (changed) this.#write();
  }

  #prune(): void {
    const cutoff = this.#now() - WORLD_ACTION_LIMITS.timelineRetentionMs;
    const sourceCutoff = this.#now() - WORLD_ACTION_LIMITS.dedupeMs;
    this.#sources = this.#sources
      .filter((record) => Date.parse(record.acceptedAt) >= sourceCutoff)
      .sort(
        (left, right) =>
          Date.parse(right.acceptedAt) - Date.parse(left.acceptedAt),
      )
      .slice(0, WORLD_ACTION_LIMITS.dedupeIds);
    this.#sourceCursors = this.#sourceCursors
      .sort(
        (left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      )
      .slice(0, MAXIMUM_SOURCE_CURSORS);
    this.#actions = this.#actions
      .filter(
        (record) => record.pinned || Date.parse(record.createdAt) >= cutoff,
      )
      .sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
          right.actionIndex - left.actionIndex,
      );
    if (this.#actions.length > WORLD_ACTION_LIMITS.maximumTimelineActions) {
      const pinned = this.#actions.filter((record) => record.pinned);
      const rest = this.#actions.filter((record) => !record.pinned);
      this.#actions = [
        ...pinned,
        ...rest.slice(
          0,
          WORLD_ACTION_LIMITS.maximumTimelineActions - pinned.length,
        ),
      ];
    }
    const retainedPaths = new Set(
      this.#actions
        .filter((record) => activeStates.has(record.outcome.state))
        .map((record) => record.outcome.actionId),
    );
    for (const actionId of this.#paths.keys())
      if (!retainedPaths.has(actionId)) this.#paths.delete(actionId);
  }

  #write(): void {
    const payload: StorePayload = {
      schema: "aiw.world-action-store/0.13",
      actions: this.#actions,
      sources: this.#sources,
      sourceCursors: this.#sourceCursors,
    };
    const envelope: StoreEnvelope = {
      schema: "aiw.world-action-store-envelope/0.13",
      checksum: checksum(payload),
      payload,
    };
    const temporary = `${this.#file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(envelope)}\n`, {
      mode: 0o600,
    });
    fs.renameSync(temporary, this.#file);
    fs.chmodSync(this.#file, 0o600);
  }
}

export async function importWorldActionProposal(
  service: Pick<WorldActionService, "propose">,
  sessionId: string,
  imported: {
    readonly proposalId: string;
    readonly sourceStreamId: string;
    readonly sequence: number;
    readonly createdAt: string;
    readonly proposal: unknown;
  },
  context: WorldActionContext,
): Promise<{
  readonly consume: boolean;
  readonly result: Awaited<ReturnType<WorldActionService["propose"]>>;
}> {
  const result = await service.propose(sessionId, imported.proposal, context, {
    requestId: imported.proposalId,
    sourceStreamId: imported.sourceStreamId,
    sequence: imported.sequence,
    createdAt: imported.createdAt,
  });
  return {
    consume:
      result.accepted ||
      result.reason === "expired" ||
      result.reason === "duplicate",
    result,
  };
}

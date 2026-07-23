import { z } from "zod";

export const COORDINATION_SCHEMA = "aiw.coordination/0.16" as const;
export const COORDINATION_ACTION_SCHEMA =
  "aiw.coordination-action/0.16" as const;

export const COORDINATION_LIMITS = Object.freeze({
  agents: 2,
  worktrees: 2,
  tasks: 32,
  dependencies: 64,
  ownership: 64,
  interests: 64,
  messages: 64,
  handoffs: 16,
  mergeCandidates: 8,
  conflicts: 64,
  tests: 64,
  lifecycleEvents: 256,
  correlations: 256,
  messageBytes: 4 * 1024,
  evidenceBytes: 8 * 1024,
  candidateDiffBytes: 128 * 1024,
  retainedDiffBytes: 512 * 1024,
  snapshotBytes: 2 * 1024 * 1024,
  gitPaths: 256,
  gitProcesses: 1,
  gitTimeoutMs: 10_000,
});

const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
const timestamp = z.iso.datetime({ offset: true });
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const boundedText = (length: number) => z.string().max(length);
const nullableIdentifier = identifier.nullable();
const agentId = z.enum(["mr-fluff", "beans"]);
const relativePath = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !/^[A-Za-z]:[\\/]/.test(value) &&
      !value.split(/[\\/]/).includes("..") &&
      !value.includes("\\"),
    "Expected a repository-relative slash-separated path",
  );

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
  }
  return bytes;
}

const boundedUtf8Text = (bytes: number) =>
  z
    .string()
    .refine(
      (value) => utf8ByteLength(value) <= bytes,
      `Expected at most ${bytes} UTF-8 bytes`,
    );

export const AgentIdSchema = agentId;
export type AgentId = z.infer<typeof AgentIdSchema>;

export const AgentBindingSchema = z.strictObject({
  agentId,
  adapter: z.enum(["hermes", "openclaw"]),
  displayName: z.enum(["Mr Fluff", "Beans"]),
  avatarId: z.enum(["mr-fluff", "beans"]),
  nativeSessionId: identifier,
  model: z.literal("gpt-5.6-sol"),
  toolStreamId: identifier,
  evidenceStreamId: identifier,
  status: z.enum(["ready", "active", "blocked", "cancelled", "unavailable"]),
  assignedTaskId: nullableIdentifier.default(null),
  worktreeId: nullableIdentifier.default(null),
});
export type AgentBinding = z.infer<typeof AgentBindingSchema>;

export const TaskSchema = z.strictObject({
  taskId: identifier,
  title: boundedText(240),
  status: z.enum([
    "ready",
    "assigned",
    "active",
    "blocked",
    "handed-off",
    "complete",
    "cancelled",
  ]),
  dependencyTaskIds: z.array(identifier).max(COORDINATION_LIMITS.dependencies),
  ownerAgentId: agentId.nullable(),
});
export type CoordinationTask = z.infer<typeof TaskSchema>;

export const OwnershipSchema = z.strictObject({
  ownershipId: identifier,
  agentId,
  nativeSessionId: identifier,
  taskId: identifier,
  targetKind: z.enum(["file", "object", "task", "worktree"]),
  target: boundedText(512),
  state: z.enum(["active", "released", "cancelled"]),
});
export type CoordinationOwnership = z.infer<typeof OwnershipSchema>;

export const InterestSchema = z.strictObject({
  interestId: identifier,
  agentId,
  nativeSessionId: identifier,
  taskId: identifier,
  targetKind: z.enum(["file", "object"]),
  target: boundedText(512),
  state: z.enum(["active", "released"]),
});
export type CoordinationInterest = z.infer<typeof InterestSchema>;

export const ContentionSchema = z.strictObject({
  contentionId: identifier,
  targetKind: z.enum(["file", "object"]),
  target: boundedText(512),
  agentIds: z.array(agentId).length(2),
  classification: z.literal("interest-only"),
});
export type CoordinationContention = z.infer<typeof ContentionSchema>;

export const AgentMessageSchema = z.strictObject({
  messageId: identifier,
  senderAgentId: agentId,
  recipientAgentId: agentId,
  nativeSessionId: identifier,
  taskId: identifier,
  text: boundedUtf8Text(COORDINATION_LIMITS.messageBytes),
  authority: z.literal("none"),
  contentKind: z.literal("inert-visible-record"),
  createdAt: timestamp,
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const HandoffSchema = z.strictObject({
  handoffId: identifier,
  senderAgentId: agentId,
  recipientAgentId: agentId,
  nativeSessionId: identifier,
  taskId: identifier,
  repositoryId: identifier,
  worktreeId: identifier,
  sourceBranch: boundedText(256),
  sourceHead: boundedText(64),
  summary: boundedUtf8Text(COORDINATION_LIMITS.evidenceBytes),
  evidenceIds: z.array(identifier).max(32),
  createdAt: timestamp,
});
export type CoordinationHandoff = z.infer<typeof HandoffSchema>;

export const WorktreeSchema = z.strictObject({
  worktreeId: identifier,
  agentId,
  nativeSessionId: identifier,
  taskId: identifier,
  repositoryId: identifier,
  displayPath: relativePath,
  branch: boundedText(256),
  head: boundedText(64),
  commonRepositoryId: identifier,
  state: z.enum([
    "current",
    "dirty",
    "stale",
    "missing",
    "deleted",
    "wrong-repository",
    "wrong-branch",
    "unavailable",
  ]),
  statusSummary: boundedText(2_048),
  validatedAt: timestamp,
});
export type CoordinationWorktree = z.infer<typeof WorktreeSchema>;

export const TestEvidenceSchema = z.strictObject({
  testId: identifier,
  agentId,
  nativeSessionId: identifier,
  taskId: identifier,
  worktreeId: identifier,
  branch: boundedText(256),
  head: boundedText(64),
  command: boundedText(1_024),
  exitCode: z.number().int().min(0).max(255),
  summary: boundedUtf8Text(COORDINATION_LIMITS.evidenceBytes),
  digest,
  recordedAt: timestamp,
});
export type CoordinationTestEvidence = z.infer<typeof TestEvidenceSchema>;

export const ConflictSchema = z.strictObject({
  conflictId: identifier,
  candidateId: identifier,
  relativePath,
  classification: z.literal("git-conflict"),
  source: z.enum(["git-merge-tree", "git-status"]),
});
export type CoordinationConflict = z.infer<typeof ConflictSchema>;

export const MergeCandidateSchema = z.strictObject({
  candidateId: identifier,
  sourceAgentId: agentId,
  targetAgentId: agentId,
  sourceTaskId: identifier,
  targetTaskId: identifier,
  repositoryId: identifier,
  sourceWorktreeId: identifier,
  targetWorktreeId: identifier,
  sourceBranch: boundedText(256),
  targetBranch: boundedText(256),
  sourceHead: boundedText(64),
  targetHead: boundedText(64),
  diff: boundedUtf8Text(COORDINATION_LIMITS.candidateDiffBytes),
  diffDigest: digest,
  changedPaths: z.array(relativePath).max(COORDINATION_LIMITS.gitPaths),
  testEvidenceIds: z.array(identifier).max(COORDINATION_LIMITS.tests),
  conflictIds: z.array(identifier).max(COORDINATION_LIMITS.conflicts),
  uncertainties: z.array(boundedText(512)).max(16),
  cleanupState: z.enum(["not-planned", "previewed", "blocked-dirty"]),
  state: z.enum([
    "candidate",
    "operator-approved",
    "conflicting",
    "cancelled",
    "integrated",
  ]),
  mergeRun: z.literal(false),
  preparedAt: timestamp,
  approvedAt: timestamp.nullable(),
});
export type CoordinationMergeCandidate = z.infer<typeof MergeCandidateSchema>;

export const CleanupPlanSchema = z.strictObject({
  cleanupPlanId: identifier,
  agentId,
  worktreeId: identifier,
  displayPath: relativePath,
  branch: boundedText(256),
  recommendation: z.enum(["allowed", "refused-dirty", "refused-stale"]),
  reasons: z.array(boundedText(512)).max(16),
  previewOnly: z.literal(true),
  createdAt: timestamp,
});
export type CoordinationCleanupPlan = z.infer<typeof CleanupPlanSchema>;

export const LifecycleEventSchema = z.strictObject({
  eventId: identifier,
  kind: z.enum([
    "session-initialized",
    "agent-bound",
    "task-upserted",
    "task-assigned",
    "interest-declared",
    "contention-detected",
    "message-recorded",
    "handoff-recorded",
    "worktree-created",
    "worktree-attached",
    "worktree-validated",
    "candidate-prepared",
    "candidate-approved",
    "cleanup-previewed",
    "coordination-cancelled",
    "merge-run",
  ]),
  actor: z.enum(["operator", "mr-fluff", "beans", "system"]),
  summary: boundedText(1_024),
  correlationId: identifier,
  createdAt: timestamp,
});
export type CoordinationLifecycleEvent = z.infer<typeof LifecycleEventSchema>;

export const CorrelationRecordSchema = z.strictObject({
  correlationId: identifier,
  requestCanonical: boundedText(16_384),
  resultingRevision: z.number().int().nonnegative(),
});
export type CoordinationCorrelationRecord = z.infer<
  typeof CorrelationRecordSchema
>;

export const CoordinationSnapshotSchema = z
  .strictObject({
    schema: z.literal(COORDINATION_SCHEMA),
    revision: z.number().int().nonnegative(),
    coordinationSessionId: identifier.nullable(),
    repositoryId: identifier.nullable(),
    repositoryDisplayName: boundedText(240).nullable(),
    operatorId: identifier.nullable(),
    agents: z.array(AgentBindingSchema).max(COORDINATION_LIMITS.agents),
    tasks: z.array(TaskSchema).max(COORDINATION_LIMITS.tasks),
    ownership: z.array(OwnershipSchema).max(COORDINATION_LIMITS.ownership),
    interests: z.array(InterestSchema).max(COORDINATION_LIMITS.interests),
    contentions: z.array(ContentionSchema).max(COORDINATION_LIMITS.interests),
    messages: z.array(AgentMessageSchema).max(COORDINATION_LIMITS.messages),
    handoffs: z.array(HandoffSchema).max(COORDINATION_LIMITS.handoffs),
    worktrees: z.array(WorktreeSchema).max(COORDINATION_LIMITS.worktrees),
    mergeCandidates: z
      .array(MergeCandidateSchema)
      .max(COORDINATION_LIMITS.mergeCandidates),
    conflicts: z.array(ConflictSchema).max(COORDINATION_LIMITS.conflicts),
    testEvidence: z.array(TestEvidenceSchema).max(COORDINATION_LIMITS.tests),
    cleanupPlans: z.array(CleanupPlanSchema).max(COORDINATION_LIMITS.worktrees),
    lifecycleEvents: z
      .array(LifecycleEventSchema)
      .max(COORDINATION_LIMITS.lifecycleEvents),
    correlations: z
      .array(CorrelationRecordSchema)
      .max(COORDINATION_LIMITS.correlations),
    cancelled: z.boolean(),
    updatedAt: timestamp,
  })
  .superRefine((snapshot, context) => {
    for (const [field, values] of [
      ["agents", snapshot.agents.map((value) => value.agentId)],
      [
        "agent native sessions",
        snapshot.agents.map((value) => value.nativeSessionId),
      ],
      ["tool streams", snapshot.agents.map((value) => value.toolStreamId)],
      [
        "evidence streams",
        snapshot.agents.map((value) => value.evidenceStreamId),
      ],
      ["tasks", snapshot.tasks.map((value) => value.taskId)],
      ["interests", snapshot.interests.map((value) => value.interestId)],
      ["messages", snapshot.messages.map((value) => value.messageId)],
      ["handoffs", snapshot.handoffs.map((value) => value.handoffId)],
      ["worktrees", snapshot.worktrees.map((value) => value.worktreeId)],
      ["worktree agents", snapshot.worktrees.map((value) => value.agentId)],
      ["test evidence", snapshot.testEvidence.map((value) => value.testId)],
      [
        "mergeCandidates",
        snapshot.mergeCandidates.map((value) => value.candidateId),
      ],
      [
        "correlations",
        snapshot.correlations.map((value) => value.correlationId),
      ],
    ] as const) {
      if (new Set(values).size !== values.length)
        context.addIssue({
          code: "custom",
          message: `Duplicate ${field} identity`,
          path: [field],
        });
    }
    const dependencyCount = snapshot.tasks.reduce(
      (total, task) => total + task.dependencyTaskIds.length,
      0,
    );
    if (dependencyCount > COORDINATION_LIMITS.dependencies)
      context.addIssue({
        code: "custom",
        message: "Dependency edge ceiling exceeded",
        path: ["tasks"],
      });
    const retainedDiffBytes = snapshot.mergeCandidates.reduce(
      (total, candidate) => total + utf8ByteLength(candidate.diff),
      0,
    );
    if (retainedDiffBytes > COORDINATION_LIMITS.retainedDiffBytes)
      context.addIssue({
        code: "custom",
        message: "Retained diff byte ceiling exceeded",
        path: ["mergeCandidates"],
      });
  });
export type CoordinationSnapshot = z.infer<typeof CoordinationSnapshotSchema>;

const SessionInitializeActionSchema = z.strictObject({
  kind: z.literal("session.initialize"),
  repositoryId: identifier,
  repositoryDisplayName: boundedText(240),
  operatorId: identifier,
});
const AgentBindActionSchema = z.strictObject({
  kind: z.literal("agent.bind"),
  binding: AgentBindingSchema.omit({
    assignedTaskId: true,
    worktreeId: true,
  }),
});
const TaskUpsertActionSchema = z.strictObject({
  kind: z.literal("task.upsert"),
  task: TaskSchema,
});
const TaskAssignActionSchema = z.strictObject({
  kind: z.literal("task.assign"),
  taskId: identifier,
  agentId,
  nativeSessionId: identifier,
});
const InterestDeclareActionSchema = z.strictObject({
  kind: z.literal("interest.declare"),
  interest: InterestSchema,
});
const MessageRecordActionSchema = z.strictObject({
  kind: z.literal("message.record"),
  message: AgentMessageSchema.omit({
    authority: true,
    contentKind: true,
    createdAt: true,
  }),
});
const HandoffRecordActionSchema = z.strictObject({
  kind: z.literal("handoff.record"),
  handoff: HandoffSchema.omit({ createdAt: true }),
});
const WorktreeRequestBaseSchema = z.strictObject({
  worktreeId: identifier,
  agentId,
  nativeSessionId: identifier,
  taskId: identifier,
  repositoryRoot: z.string().min(1).max(1_024),
  worktreePath: z.string().min(1).max(1_024),
  branch: boundedText(256),
  displayPath: relativePath,
});
const WorktreeCreateActionSchema = WorktreeRequestBaseSchema.extend({
  kind: z.literal("worktree.create"),
  startPoint: boundedText(256),
});
const WorktreeAttachActionSchema = WorktreeRequestBaseSchema.extend({
  kind: z.literal("worktree.attach"),
});
const WorktreeValidateActionSchema = z.strictObject({
  kind: z.literal("worktree.validate"),
  worktreeId: identifier,
  agentId,
  nativeSessionId: identifier,
  repositoryRoot: z.string().min(1).max(1_024),
  worktreePath: z.string().min(1).max(1_024),
});
const MergeCandidatePrepareActionSchema = z.strictObject({
  kind: z.literal("merge-candidate.prepare"),
  candidateId: identifier,
  sourceAgentId: agentId,
  targetAgentId: agentId,
  sourceTaskId: identifier,
  targetTaskId: identifier,
  sourceWorktreeId: identifier,
  targetWorktreeId: identifier,
  testEvidence: z.array(TestEvidenceSchema).max(COORDINATION_LIMITS.tests),
  uncertainties: z.array(boundedText(512)).max(16),
});
const MergeCandidateApproveActionSchema = z.strictObject({
  kind: z.literal("merge-candidate.approve"),
  candidateId: identifier,
});
const CleanupPreviewActionSchema = z.strictObject({
  kind: z.literal("cleanup.preview"),
  agentId,
  worktreeId: identifier,
});
const CoordinationCancelActionSchema = z.strictObject({
  kind: z.literal("coordination.cancel"),
  reason: boundedText(1_024),
});

export const CoordinationDomainActionSchema = z.discriminatedUnion("kind", [
  SessionInitializeActionSchema,
  AgentBindActionSchema,
  TaskUpsertActionSchema,
  TaskAssignActionSchema,
  InterestDeclareActionSchema,
  MessageRecordActionSchema,
  HandoffRecordActionSchema,
  WorktreeCreateActionSchema,
  WorktreeAttachActionSchema,
  WorktreeValidateActionSchema,
  MergeCandidatePrepareActionSchema,
  MergeCandidateApproveActionSchema,
  CleanupPreviewActionSchema,
  CoordinationCancelActionSchema,
]);
export type CoordinationDomainAction = z.infer<
  typeof CoordinationDomainActionSchema
>;

export const CoordinationActionSchema = z.strictObject({
  schema: z.literal(COORDINATION_ACTION_SCHEMA),
  coordinationSessionId: identifier,
  actor: z.literal("operator"),
  operatorApproval: z.literal("approved"),
  expectedRevision: z.number().int().nonnegative(),
  correlationId: identifier,
  action: CoordinationDomainActionSchema,
});
export type CoordinationAction = z.infer<typeof CoordinationActionSchema>;

export const CoordinationTruthSchema = z.enum([
  "current",
  "previous-recovered",
  "unavailable",
]);
export const CoordinationProjectionSchema = z.strictObject({
  schema: z.literal("aiw.coordination-projection/0.16"),
  truth: CoordinationTruthSchema,
  snapshot: CoordinationSnapshotSchema.nullable(),
  unavailableReason: boundedText(512).nullable(),
});
export type CoordinationProjection = z.infer<
  typeof CoordinationProjectionSchema
>;

const PresentationAgentSchema = z.strictObject({
  agentId,
  displayName: z.enum(["Mr Fluff", "Beans"]),
  avatarId: z.enum(["mr-fluff", "beans"]),
  adapter: AgentBindingSchema.shape.adapter,
  model: boundedText(128),
  status: AgentBindingSchema.shape.status,
  nativeSessionId: identifier,
  toolStreamId: identifier,
  evidenceStreamId: identifier,
  taskId: identifier.nullable(),
  worktreeId: identifier.nullable(),
});
export const CoordinationPresentationSchema = z.strictObject({
  schema: z.literal("aiw.coordination-presentation/0.16"),
  truth: CoordinationTruthSchema,
  revision: z.number().int().nonnegative().nullable(),
  coordinationSessionId: identifier.nullable(),
  cancelled: z.boolean().nullable(),
  unavailableReason: boundedText(512).nullable(),
  agents: z.array(PresentationAgentSchema).max(2),
  tasks: z.array(
    z.strictObject({
      taskId: identifier,
      title: boundedText(240),
      status: TaskSchema.shape.status,
      ownerAgentId: agentId.nullable(),
    }),
  ),
  worktrees: z.array(
    z.strictObject({
      worktreeId: identifier,
      agentId,
      displayPath: relativePath,
      branch: boundedText(256),
      head: boundedText(64),
      commonRepositoryId: identifier,
      state: WorktreeSchema.shape.state,
    }),
  ),
  interests: z.array(
    z.strictObject({
      interestId: identifier,
      agentId,
      taskId: identifier,
      targetKind: z.enum(["file", "object"]),
      target: boundedText(256),
      state: InterestSchema.shape.state,
    }),
  ),
  contention: z.array(
    z.strictObject({
      contentionId: identifier,
      targetKind: z.enum(["file", "object"]),
      target: boundedText(256),
      agentIds: z.array(agentId).length(2),
      classification: z.literal("interest-only"),
    }),
  ),
  messages: z.array(
    z.strictObject({
      messageId: identifier,
      senderAgentId: agentId,
      recipientAgentId: agentId,
      summary: z.literal("Attributed inert message recorded"),
    }),
  ),
  handoffs: z.array(
    z.strictObject({
      handoffId: identifier,
      senderAgentId: agentId,
      recipientAgentId: agentId,
      evidenceCount: z.number().int().nonnegative(),
    }),
  ),
  mergeCandidates: z.array(
    z.strictObject({
      candidateId: identifier,
      sourceAgentId: agentId,
      targetAgentId: agentId,
      sourceBranch: boundedText(256),
      targetBranch: boundedText(256),
      state: MergeCandidateSchema.shape.state,
      conflictCount: z.number().int().nonnegative(),
      testCount: z.number().int().nonnegative(),
      diffDigest: digest,
      changedPathCount: z.number().int().nonnegative(),
      mergeRun: z.literal(false),
    }),
  ),
  testEvidence: z.array(
    z.strictObject({
      testId: identifier,
      agentId,
      exitCode: z.number().int().min(0).max(255),
      statusSummary: z.enum(["Test passed", "Test failed"]),
      digest,
    }),
  ),
  cleanupPlans: z.array(
    z.strictObject({
      cleanupPlanId: identifier,
      agentId,
      worktreeId: identifier,
      displayPath: relativePath,
      branch: boundedText(256),
      recommendation: CleanupPlanSchema.shape.recommendation,
      reasons: z.array(boundedText(256)).max(8),
      previewOnly: z.literal(true),
    }),
  ),
});
export type CoordinationPresentation = z.infer<
  typeof CoordinationPresentationSchema
>;

function safePresentationLabel(value: string): string {
  if (
    /(?:^|\s)\/\S+/.test(value) ||
    /(?:^|\s)[A-Za-z]:[\\/]\S+/.test(value) ||
    /(?:api[_-]?key|password|secret|token)\s*[:=]/i.test(value) ||
    /\bsk-[A-Za-z0-9_-]{8,}\b/.test(value)
  )
    return "[redacted]";
  return value.slice(0, 256);
}

export function projectCoordinationForPresentation(
  projection: CoordinationProjection,
): CoordinationPresentation {
  const parsed = CoordinationProjectionSchema.parse(projection);
  const snapshot = parsed.snapshot;
  return CoordinationPresentationSchema.parse({
    schema: "aiw.coordination-presentation/0.16",
    truth: parsed.truth,
    revision: snapshot?.revision ?? null,
    coordinationSessionId: snapshot?.coordinationSessionId ?? null,
    cancelled: snapshot?.cancelled ?? null,
    unavailableReason: parsed.unavailableReason
      ? safePresentationLabel(parsed.unavailableReason)
      : null,
    agents:
      snapshot?.agents.map((agent) => ({
        agentId: agent.agentId,
        displayName: agent.displayName,
        avatarId: agent.avatarId,
        adapter: agent.adapter,
        model: safePresentationLabel(agent.model),
        status: agent.status,
        nativeSessionId: agent.nativeSessionId,
        toolStreamId: agent.toolStreamId,
        evidenceStreamId: agent.evidenceStreamId,
        taskId: agent.assignedTaskId,
        worktreeId: agent.worktreeId,
      })) ?? [],
    tasks:
      snapshot?.tasks.map((task) => ({
        taskId: task.taskId,
        title: safePresentationLabel(task.title),
        status: task.status,
        ownerAgentId: task.ownerAgentId,
      })) ?? [],
    worktrees:
      snapshot?.worktrees.map((worktree) => ({
        worktreeId: worktree.worktreeId,
        agentId: worktree.agentId,
        displayPath: worktree.displayPath,
        branch: safePresentationLabel(worktree.branch),
        head: worktree.head,
        commonRepositoryId: worktree.commonRepositoryId,
        state: worktree.state,
      })) ?? [],
    interests:
      snapshot?.interests.map((interest) => ({
        interestId: interest.interestId,
        agentId: interest.agentId,
        taskId: interest.taskId,
        targetKind: interest.targetKind,
        target: safePresentationLabel(interest.target),
        state: interest.state,
      })) ?? [],
    contention:
      snapshot?.contentions.map((contention) => ({
        contentionId: contention.contentionId,
        targetKind: contention.targetKind,
        target: safePresentationLabel(contention.target),
        agentIds: contention.agentIds,
        classification: contention.classification,
      })) ?? [],
    messages:
      snapshot?.messages.map((message) => ({
        messageId: message.messageId,
        senderAgentId: message.senderAgentId,
        recipientAgentId: message.recipientAgentId,
        summary: "Attributed inert message recorded",
      })) ?? [],
    handoffs:
      snapshot?.handoffs.map((handoff) => ({
        handoffId: handoff.handoffId,
        senderAgentId: handoff.senderAgentId,
        recipientAgentId: handoff.recipientAgentId,
        evidenceCount: handoff.evidenceIds.length,
      })) ?? [],
    mergeCandidates:
      snapshot?.mergeCandidates.map((candidate) => ({
        candidateId: candidate.candidateId,
        sourceAgentId: candidate.sourceAgentId,
        targetAgentId: candidate.targetAgentId,
        sourceBranch: safePresentationLabel(candidate.sourceBranch),
        targetBranch: safePresentationLabel(candidate.targetBranch),
        state: candidate.state,
        conflictCount: candidate.conflictIds.length,
        testCount: candidate.testEvidenceIds.length,
        diffDigest: candidate.diffDigest,
        changedPathCount: candidate.changedPaths.length,
        mergeRun: false,
      })) ?? [],
    testEvidence:
      snapshot?.testEvidence.map((test) => ({
        testId: test.testId,
        agentId: test.agentId,
        exitCode: test.exitCode,
        statusSummary: test.exitCode === 0 ? "Test passed" : "Test failed",
        digest: test.digest,
      })) ?? [],
    cleanupPlans:
      snapshot?.cleanupPlans.map((plan) => ({
        cleanupPlanId: plan.cleanupPlanId,
        agentId: plan.agentId,
        worktreeId: plan.worktreeId,
        displayPath: plan.displayPath,
        branch: safePresentationLabel(plan.branch),
        recommendation: plan.recommendation,
        reasons: plan.reasons.map(safePresentationLabel),
        previewOnly: true,
      })) ?? [],
  });
}

const INITIAL_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export function createEmptyCoordinationSnapshot(
  initial: {
    readonly coordinationSessionId?: string;
    readonly repositoryId?: string;
  } = {},
): CoordinationSnapshot {
  return CoordinationSnapshotSchema.parse({
    schema: COORDINATION_SCHEMA,
    revision: 0,
    coordinationSessionId: initial.coordinationSessionId ?? null,
    repositoryId: initial.repositoryId ?? null,
    repositoryDisplayName: initial.repositoryId ?? null,
    operatorId: initial.coordinationSessionId ? "operator-local" : null,
    agents: [],
    tasks: [],
    ownership: [],
    interests: [],
    contentions: [],
    messages: [],
    handoffs: [],
    worktrees: [],
    mergeCandidates: [],
    conflicts: [],
    testEvidence: [],
    cleanupPlans: [],
    lifecycleEvents: [],
    correlations: [],
    cancelled: false,
    updatedAt: INITIAL_TIMESTAMP,
  });
}

export class CoordinationProtocolError extends Error {
  constructor(
    readonly code:
      | "revision_conflict"
      | "correlation_conflict"
      | "resource_limit"
      | "binding_mismatch"
      | "not_found"
      | "cancelled"
      | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "CoordinationProtocolError";
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function upsertBy<T>(
  values: readonly T[],
  value: T,
  identity: (item: T) => string,
  ceiling: number,
): T[] {
  const id = identity(value);
  const index = values.findIndex((item) => identity(item) === id);
  if (index >= 0)
    return values.map((item, at) => (at === index ? value : item));
  if (values.length >= ceiling)
    throw new CoordinationProtocolError(
      "resource_limit",
      `Resource ceiling ${ceiling} reached`,
    );
  return [...values, value];
}

function event(
  snapshot: CoordinationSnapshot,
  request: CoordinationAction,
  kind: CoordinationLifecycleEvent["kind"],
  summary: string,
  now: string,
): CoordinationLifecycleEvent[] {
  const next = [
    ...snapshot.lifecycleEvents,
    {
      eventId: `event-${request.correlationId}`,
      kind,
      actor: "operator" as const,
      summary,
      correlationId: request.correlationId,
      createdAt: now,
    },
  ];
  return next.slice(-COORDINATION_LIMITS.lifecycleEvents);
}

function deriveContentions(
  interests: readonly CoordinationInterest[],
): CoordinationContention[] {
  const grouped = new Map<
    string,
    { kind: "file" | "object"; target: string; agents: Set<AgentId> }
  >();
  for (const interest of interests) {
    if (interest.state !== "active") continue;
    const key = `${interest.targetKind}:${interest.target}`;
    const current = grouped.get(key) ?? {
      kind: interest.targetKind,
      target: interest.target,
      agents: new Set<AgentId>(),
    };
    current.agents.add(interest.agentId);
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .filter((value) => value.agents.size === 2)
    .map((value) => ({
      contentionId: `contention-${value.kind}-${value.target.replace(
        /[^A-Za-z0-9._-]/g,
        "-",
      )}`.slice(0, 128),
      targetKind: value.kind,
      target: value.target,
      agentIds: [...value.agents].sort() as [AgentId, AgentId],
      classification: "interest-only" as const,
    }))
    .sort((left, right) => left.target.localeCompare(right.target));
}

function assertAgentTaskBinding(
  snapshot: CoordinationSnapshot,
  input: {
    readonly agentId: AgentId;
    readonly nativeSessionId: string;
    readonly taskId: string;
  },
): void {
  const binding = snapshot.agents.find(
    (value) => value.agentId === input.agentId,
  );
  const task = snapshot.tasks.find((value) => value.taskId === input.taskId);
  if (
    !binding ||
    !task ||
    binding.nativeSessionId !== input.nativeSessionId ||
    binding.assignedTaskId !== input.taskId ||
    task.ownerAgentId !== input.agentId
  )
    throw new CoordinationProtocolError(
      "binding_mismatch",
      "Agent, native-session, and task binding mismatch",
    );
}

export function applyCoordinationAction(
  inputSnapshot: CoordinationSnapshot,
  inputRequest: CoordinationAction,
  options: { readonly now?: string } = {},
): CoordinationSnapshot {
  const snapshot = CoordinationSnapshotSchema.parse(inputSnapshot);
  const request = CoordinationActionSchema.parse(inputRequest);
  const now = timestamp.parse(options.now ?? new Date().toISOString());
  const requestCanonical = canonical(request);
  const replay = snapshot.correlations.find(
    (item) => item.correlationId === request.correlationId,
  );
  if (replay) {
    if (replay.requestCanonical !== requestCanonical)
      throw new CoordinationProtocolError(
        "correlation_conflict",
        "Correlation ID was already used for different input",
      );
    return snapshot;
  }
  if (request.expectedRevision !== snapshot.revision)
    throw new CoordinationProtocolError(
      "revision_conflict",
      `Expected revision ${request.expectedRevision}; current is ${snapshot.revision}`,
    );
  if (
    snapshot.coordinationSessionId &&
    request.coordinationSessionId !== snapshot.coordinationSessionId
  )
    throw new CoordinationProtocolError(
      "binding_mismatch",
      "Coordination session mismatch",
    );
  if (snapshot.cancelled && request.action.kind !== "cleanup.preview")
    throw new CoordinationProtocolError(
      "cancelled",
      "Coordination is cancelled",
    );

  let next: CoordinationSnapshot = { ...snapshot, updatedAt: now };
  const action = request.action;
  switch (action.kind) {
    case "session.initialize": {
      if (snapshot.coordinationSessionId)
        throw new CoordinationProtocolError(
          "invalid",
          "Coordination session is already initialized",
        );
      next = {
        ...next,
        coordinationSessionId: request.coordinationSessionId,
        repositoryId: action.repositoryId,
        repositoryDisplayName: action.repositoryDisplayName,
        operatorId: action.operatorId,
        lifecycleEvents: event(
          snapshot,
          request,
          "session-initialized",
          `Session ${request.coordinationSessionId} initialized`,
          now,
        ),
      };
      break;
    }
    case "agent.bind": {
      const existing = snapshot.agents.find(
        (value) => value.agentId === action.binding.agentId,
      );
      const expected =
        action.binding.agentId === "mr-fluff"
          ? {
              adapter: "hermes",
              displayName: "Mr Fluff",
              avatarId: "mr-fluff",
            }
          : {
              adapter: "openclaw",
              displayName: "Beans",
              avatarId: "beans",
            };
      if (
        action.binding.adapter !== expected.adapter ||
        action.binding.displayName !== expected.displayName ||
        action.binding.avatarId !== expected.avatarId
      )
        throw new CoordinationProtocolError(
          "binding_mismatch",
          "Agent identity and adapter binding is invalid",
        );
      if (
        snapshot.agents.some(
          (value) =>
            value.agentId !== action.binding.agentId &&
            (value.nativeSessionId === action.binding.nativeSessionId ||
              value.toolStreamId === action.binding.toolStreamId ||
              value.evidenceStreamId === action.binding.evidenceStreamId),
        )
      )
        throw new CoordinationProtocolError(
          "binding_mismatch",
          "Native session and stream bindings must be distinct",
        );
      const sameIdentity =
        !existing ||
        (existing.adapter === action.binding.adapter &&
          existing.displayName === action.binding.displayName &&
          existing.avatarId === action.binding.avatarId &&
          existing.nativeSessionId === action.binding.nativeSessionId &&
          existing.toolStreamId === action.binding.toolStreamId &&
          existing.evidenceStreamId === action.binding.evidenceStreamId);
      const hasActiveReferences =
        existing !== undefined &&
        (existing.assignedTaskId !== null ||
          existing.worktreeId !== null ||
          snapshot.ownership.some(
            (ownership) =>
              ownership.agentId === existing.agentId &&
              ownership.state === "active",
          ) ||
          snapshot.interests.some(
            (interest) =>
              interest.agentId === existing.agentId &&
              interest.state === "active",
          ) ||
          snapshot.worktrees.some(
            (worktree) => worktree.agentId === existing.agentId,
          ));
      if (hasActiveReferences && !sameIdentity)
        throw new CoordinationProtocolError(
          "binding_mismatch",
          "An active agent identity or native-session binding cannot be rebound",
        );
      next = {
        ...next,
        agents: upsertBy(
          snapshot.agents,
          {
            ...action.binding,
            assignedTaskId: existing?.assignedTaskId ?? null,
            worktreeId: existing?.worktreeId ?? null,
          },
          (value) => value.agentId,
          COORDINATION_LIMITS.agents,
        ),
        lifecycleEvents: event(
          snapshot,
          request,
          "agent-bound",
          `${action.binding.agentId} bound`,
          now,
        ),
      };
      break;
    }
    case "task.upsert":
      next = {
        ...next,
        tasks: upsertBy(
          snapshot.tasks,
          action.task,
          (value) => value.taskId,
          COORDINATION_LIMITS.tasks,
        ),
        lifecycleEvents: event(
          snapshot,
          request,
          "task-upserted",
          `${action.task.taskId} stored`,
          now,
        ),
      };
      break;
    case "task.assign": {
      const binding = snapshot.agents.find(
        (value) => value.agentId === action.agentId,
      );
      const task = snapshot.tasks.find(
        (value) => value.taskId === action.taskId,
      );
      if (!binding || !task)
        throw new CoordinationProtocolError(
          "not_found",
          "Task or agent binding is unavailable",
        );
      if (binding.nativeSessionId !== action.nativeSessionId)
        throw new CoordinationProtocolError(
          "binding_mismatch",
          "Native session mismatch",
        );
      next = {
        ...next,
        agents: snapshot.agents.map((value) =>
          value.agentId === action.agentId
            ? { ...value, assignedTaskId: action.taskId }
            : value,
        ),
        tasks: snapshot.tasks.map((value) =>
          value.taskId === action.taskId
            ? { ...value, ownerAgentId: action.agentId, status: "assigned" }
            : value,
        ),
        ownership: upsertBy(
          snapshot.ownership,
          {
            ownershipId: `ownership-task-${action.taskId}`,
            agentId: action.agentId,
            nativeSessionId: action.nativeSessionId,
            taskId: action.taskId,
            targetKind: "task",
            target: action.taskId,
            state: "active",
          },
          (value) => value.ownershipId,
          COORDINATION_LIMITS.ownership,
        ),
        lifecycleEvents: event(
          snapshot,
          request,
          "task-assigned",
          `${action.taskId} assigned to ${action.agentId}`,
          now,
        ),
      };
      break;
    }
    case "interest.declare": {
      assertAgentTaskBinding(snapshot, action.interest);
      const interests = upsertBy(
        snapshot.interests,
        action.interest,
        (value) => value.interestId,
        COORDINATION_LIMITS.interests,
      );
      const contentions = deriveContentions(interests);
      next = {
        ...next,
        interests,
        contentions,
        lifecycleEvents: event(
          snapshot,
          request,
          contentions.length > snapshot.contentions.length
            ? "contention-detected"
            : "interest-declared",
          `${action.interest.agentId} declared ${action.interest.target}`,
          now,
        ),
      };
      break;
    }
    case "message.record":
      assertAgentTaskBinding(snapshot, {
        agentId: action.message.senderAgentId,
        nativeSessionId: action.message.nativeSessionId,
        taskId: action.message.taskId,
      });
      if (
        !snapshot.agents.some(
          (value) => value.agentId === action.message.recipientAgentId,
        )
      )
        throw new CoordinationProtocolError(
          "binding_mismatch",
          "Message recipient is not bound",
        );
      if (action.message.senderAgentId === action.message.recipientAgentId)
        throw new CoordinationProtocolError(
          "invalid",
          "Message sender and recipient must differ",
        );
      next = {
        ...next,
        messages: upsertBy(
          snapshot.messages,
          {
            ...action.message,
            authority: "none",
            contentKind: "inert-visible-record",
            createdAt: now,
          },
          (value) => value.messageId,
          COORDINATION_LIMITS.messages,
        ),
        lifecycleEvents: event(
          snapshot,
          request,
          "message-recorded",
          `${action.message.senderAgentId} message recorded as inert`,
          now,
        ),
      };
      break;
    case "handoff.record":
      assertAgentTaskBinding(snapshot, {
        agentId: action.handoff.senderAgentId,
        nativeSessionId: action.handoff.nativeSessionId,
        taskId: action.handoff.taskId,
      });
      if (
        !snapshot.agents.some(
          (value) => value.agentId === action.handoff.recipientAgentId,
        ) ||
        snapshot.repositoryId !== action.handoff.repositoryId
      )
        throw new CoordinationProtocolError(
          "binding_mismatch",
          "Handoff recipient or repository binding mismatch",
        );
      {
        const worktree = snapshot.worktrees.find(
          (value) => value.worktreeId === action.handoff.worktreeId,
        );
        if (
          !worktree ||
          worktree.agentId !== action.handoff.senderAgentId ||
          worktree.nativeSessionId !== action.handoff.nativeSessionId ||
          worktree.taskId !== action.handoff.taskId ||
          worktree.branch !== action.handoff.sourceBranch ||
          worktree.head !== action.handoff.sourceHead
        )
          throw new CoordinationProtocolError(
            "binding_mismatch",
            "Handoff worktree, branch, or HEAD binding mismatch",
          );
      }
      next = {
        ...next,
        handoffs: upsertBy(
          snapshot.handoffs,
          { ...action.handoff, createdAt: now },
          (value) => value.handoffId,
          COORDINATION_LIMITS.handoffs,
        ),
        lifecycleEvents: event(
          snapshot,
          request,
          "handoff-recorded",
          `${action.handoff.senderAgentId} handed off to ${action.handoff.recipientAgentId}`,
          now,
        ),
      };
      break;
    case "worktree.create":
    case "worktree.attach":
    case "worktree.validate":
    case "merge-candidate.prepare":
    case "cleanup.preview":
      throw new CoordinationProtocolError(
        "invalid",
        `${action.kind} requires the Git-aware coordination service`,
      );
    case "merge-candidate.approve": {
      const candidate = snapshot.mergeCandidates.find(
        (value) => value.candidateId === action.candidateId,
      );
      if (!candidate)
        throw new CoordinationProtocolError(
          "not_found",
          "Merge candidate is unavailable",
        );
      next = {
        ...next,
        mergeCandidates: snapshot.mergeCandidates.map((value) =>
          value.candidateId === action.candidateId
            ? { ...value, state: "operator-approved", approvedAt: now }
            : value,
        ),
        lifecycleEvents: event(
          snapshot,
          request,
          "candidate-approved",
          `${action.candidateId} approved; merge not run`,
          now,
        ),
      };
      break;
    }
    case "coordination.cancel":
      next = {
        ...next,
        cancelled: true,
        agents: snapshot.agents.map((value) => ({
          ...value,
          status: "cancelled",
        })),
        lifecycleEvents: event(
          snapshot,
          request,
          "coordination-cancelled",
          action.reason,
          now,
        ),
      };
      break;
  }
  next = {
    ...next,
    revision: snapshot.revision + 1,
    correlations: [
      ...snapshot.correlations,
      {
        correlationId: request.correlationId,
        requestCanonical,
        resultingRevision: snapshot.revision + 1,
      },
    ].slice(-COORDINATION_LIMITS.correlations),
  };
  const parsed = CoordinationSnapshotSchema.parse(next);
  const bytes = utf8ByteLength(JSON.stringify(parsed));
  if (bytes > COORDINATION_LIMITS.snapshotBytes)
    throw new CoordinationProtocolError(
      "resource_limit",
      "Serialized snapshot ceiling exceeded",
    );
  return parsed;
}

export function withServiceResult(
  snapshot: CoordinationSnapshot,
  request: CoordinationAction,
  update: Partial<
    Pick<
      CoordinationSnapshot,
      | "worktrees"
      | "mergeCandidates"
      | "conflicts"
      | "testEvidence"
      | "cleanupPlans"
    >
  >,
  kind: CoordinationLifecycleEvent["kind"],
  summary: string,
  now = new Date().toISOString(),
): CoordinationSnapshot {
  if (request.expectedRevision !== snapshot.revision)
    throw new CoordinationProtocolError(
      "revision_conflict",
      "Snapshot revision changed during Git operation",
    );
  const parsedNow = timestamp.parse(now);
  const requestCanonical = canonical(request);
  const next = CoordinationSnapshotSchema.parse({
    ...snapshot,
    ...update,
    revision: snapshot.revision + 1,
    updatedAt: parsedNow,
    lifecycleEvents: event(snapshot, request, kind, summary, parsedNow),
    correlations: [
      ...snapshot.correlations,
      {
        correlationId: request.correlationId,
        requestCanonical,
        resultingRevision: snapshot.revision + 1,
      },
    ].slice(-COORDINATION_LIMITS.correlations),
  });
  if (utf8ByteLength(JSON.stringify(next)) > COORDINATION_LIMITS.snapshotBytes)
    throw new CoordinationProtocolError(
      "resource_limit",
      "Serialized snapshot ceiling exceeded",
    );
  return next;
}

export function canonicalCoordinationValue(value: unknown): string {
  return canonical(value);
}

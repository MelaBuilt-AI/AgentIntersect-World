import type { Phase14Journey } from "./phase14-service.js";

export type WorkstreamPhase14Owner = {
  readonly workstreamId: string;
  readonly correlationId: string;
  readonly repositoryId: string;
  readonly nativeSessionId: string;
  readonly evidenceOperationRefs: readonly string[];
};

export type WorkstreamPhase14Evidence = {
  readonly schema: "aiw.workstream-phase14-evidence/1";
  readonly workstreamId: string;
  readonly operationId: string;
  readonly lifecycle: {
    readonly status: Phase14Journey["status"];
    readonly step: number;
  };
  readonly operationIds: Phase14Journey["operationIds"];
  readonly edit?: {
    readonly operationId: string;
    readonly outcome: NonNullable<Phase14Journey["edit"]>["outcome"];
    readonly patchDigest: string;
    readonly previousEvidenceRef: string;
    readonly currentEvidenceRef?: string;
  };
  readonly test?: {
    readonly state: NonNullable<Phase14Journey["test"]>["state"];
    readonly exitCode: number | null;
    readonly timedOut: boolean;
    readonly startedAt: string;
    readonly finishedAt: string | null;
    readonly evidenceRef?: string;
  };
  readonly preview?: {
    readonly state: NonNullable<Phase14Journey["preview"]>["state"];
    readonly startedAt: string;
    readonly readyAt: string | null;
    readonly stoppedAt: string | null;
    readonly portClosed: boolean | null;
    readonly evidenceRef?: string;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
};

export class WorkstreamPhase14AdapterError extends Error {
  constructor(readonly code: "reference-mismatch") {
    super("Phase 14 evidence does not belong to this Workstream");
    this.name = "WorkstreamPhase14AdapterError";
  }
}

export function projectWorkstreamPhase14Evidence(
  journey: Phase14Journey,
  owner: WorkstreamPhase14Owner,
): WorkstreamPhase14Evidence {
  if (
    !owner.evidenceOperationRefs.includes(journey.operationId) ||
    journey.disposable.repositoryId !== owner.repositoryId ||
    journey.session.adapterSessionRef !== owner.nativeSessionId ||
    journey.correlationId !== owner.correlationId
  )
    throw new WorkstreamPhase14AdapterError("reference-mismatch");

  return {
    schema: "aiw.workstream-phase14-evidence/1",
    workstreamId: owner.workstreamId,
    operationId: journey.operationId,
    lifecycle: { status: journey.status, step: journey.step },
    operationIds: { ...journey.operationIds },
    ...(journey.edit
      ? {
          edit: {
            operationId: journey.edit.operationId,
            outcome: journey.edit.outcome,
            patchDigest: journey.edit.patchDigest,
            previousEvidenceRef: journey.edit.previousEvidenceRef,
            ...(journey.edit.currentEvidenceRef
              ? { currentEvidenceRef: journey.edit.currentEvidenceRef }
              : {}),
          },
        }
      : {}),
    ...(journey.test
      ? {
          test: {
            state: journey.test.state,
            exitCode: journey.test.exitCode,
            timedOut: journey.test.timedOut,
            startedAt: journey.test.startedAt,
            finishedAt: journey.test.finishedAt,
            ...(journey.test.evidenceRef
              ? { evidenceRef: journey.test.evidenceRef }
              : {}),
          },
        }
      : {}),
    ...(journey.preview
      ? {
          preview: {
            state: journey.preview.state,
            startedAt: journey.preview.startedAt,
            readyAt: journey.preview.readyAt,
            stoppedAt: journey.preview.stoppedAt,
            portClosed: journey.preview.portClosed,
            ...(journey.preview.evidenceRef
              ? { evidenceRef: journey.preview.evidenceRef }
              : {}),
          },
        }
      : {}),
    createdAt: journey.createdAt,
    updatedAt: journey.updatedAt,
  };
}

export type Capability =
  | "session"
  | "tool"
  | "world-action"
  | "preview"
  | "voice"
  | "worktree"
  | "yjs"
  | "sqlite";
export type ReadinessStatus =
  "ready" | "degraded" | "unavailable" | "recovery-needed";
export type ReadinessRow = {
  readonly capability: Capability;
  readonly status: ReadinessStatus;
  readonly lastVerifiedAt: string;
  readonly lastVerifiedRevision: number;
  readonly evidence: string;
  readonly permittedAction: "inspect" | "recover" | "retry" | "none";
};
export type DiagnosticOperation = {
  readonly operationId: string;
  readonly state: "started" | "interrupted" | "orphaned" | "reconciled";
  readonly completionRecorded: false;
  readonly reconciliation: "pending" | "required" | "applied";
  readonly correlation: {
    readonly repositoryId: string;
    readonly sessionId: string;
    readonly agentId: "mr-fluff" | "beans";
    readonly taskId: string;
    readonly worktreeId: string;
    readonly operationId: string;
    readonly capability: Capability;
    readonly revision: number;
  };
};
export type DiagnosticIncident = {
  readonly incidentId: string;
  readonly kind: string;
  readonly status: "open" | "recovered" | "preserved";
  readonly summary: string;
  readonly occurredAt: string;
  readonly revision: number;
  readonly completionEvidence: false;
  readonly correlation: DiagnosticOperation["correlation"];
};
export type DiagnosticSnapshot = {
  readonly schema: "aiw.observability/0.17";
  readonly revision: number;
  readonly truth:
    "current" | "previous-recovered" | "rebuilt-derived" | "unavailable";
  readonly repositoryId: string;
  readonly sessionId: string;
  readonly generatedAt: string;
  readonly currentState: string;
  readonly previousVerifiedState: string;
  readonly lossWindow: string;
  readonly readiness: readonly ReadinessRow[];
  readonly operations: readonly DiagnosticOperation[];
  readonly incidents: readonly DiagnosticIncident[];
};
export type DiagnosticProjection = {
  readonly schema: "aiw.observability-projection/0.17";
  readonly truth: DiagnosticSnapshot["truth"];
  readonly current: DiagnosticSnapshot | null;
  readonly previous: DiagnosticSnapshot | null;
  readonly recoverySource: "current" | "previous-recovered" | "empty";
  readonly preservedCorruptCurrent: string | null;
};

type ApiEnvelope<T> = {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: { readonly message?: string };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !body.ok || body.data === undefined)
    throw new Error(
      body.error?.message ?? `Diagnostics request failed (${response.status}).`,
    );
  return body.data;
}

export function getDiagnosticsSnapshot(
  signal?: AbortSignal,
): Promise<DiagnosticProjection> {
  return request("/diagnostics/snapshot", signal ? { signal } : undefined);
}

export function previewRecovery(snapshot: DiagnosticSnapshot) {
  const operation = snapshot.operations.find(
    (item) =>
      item.state === "orphaned" ||
      item.state === "interrupted" ||
      item.reconciliation === "required",
  );
  if (!operation) throw new Error("No interrupted operation needs recovery.");
  return request<{
    readonly operationId: string;
    readonly mutation: "none";
    readonly lossWindow: string;
  }>("/diagnostics/recovery/preview", {
    method: "POST",
    body: JSON.stringify({
      repositoryId: snapshot.repositoryId,
      sessionId: snapshot.sessionId,
      expectedRevision: snapshot.revision,
      operationId: operation.operationId,
    }),
  });
}

export function applyRecovery(snapshot: DiagnosticSnapshot) {
  const operation = snapshot.operations.find(
    (item) =>
      item.state === "orphaned" ||
      item.state === "interrupted" ||
      item.reconciliation === "required",
  );
  if (!operation) throw new Error("No interrupted operation needs recovery.");
  return request("/diagnostics/recovery/apply", {
    method: "POST",
    body: JSON.stringify({
      repositoryId: snapshot.repositoryId,
      sessionId: snapshot.sessionId,
      expectedRevision: snapshot.revision,
      operationId: operation.operationId,
      operatorApproval: "approved",
    }),
  });
}

export function previewDiagnostics(snapshot: DiagnosticSnapshot) {
  return request<{ readonly previewId: string }>("/diagnostics/preview", {
    method: "POST",
    body: JSON.stringify({
      repositoryId: snapshot.repositoryId,
      sessionId: snapshot.sessionId,
      expectedRevision: snapshot.revision,
    }),
  });
}

export function exportDiagnostics(
  snapshot: DiagnosticSnapshot,
  previewId: string,
) {
  return request<{
    readonly record: {
      readonly exportId: string;
      readonly relativePath: string;
      readonly bytes: number;
    };
  }>("/diagnostics/exports", {
    method: "POST",
    body: JSON.stringify({
      repositoryId: snapshot.repositoryId,
      sessionId: snapshot.sessionId,
      expectedRevision: snapshot.revision,
      previewId,
      operatorApproval: "approved",
    }),
  });
}

export function deleteDiagnosticExport(
  snapshot: DiagnosticSnapshot,
  exportId: string,
) {
  return request<{
    readonly deleted: boolean;
    readonly absentAfterDelete: boolean;
    readonly replayed: boolean;
  }>(`/diagnostics/exports/${encodeURIComponent(exportId)}`, {
    method: "DELETE",
    body: JSON.stringify({
      repositoryId: snapshot.repositoryId,
      sessionId: snapshot.sessionId,
      expectedRevision: snapshot.revision,
      exportId,
      operatorApproval: "approved",
    }),
  });
}

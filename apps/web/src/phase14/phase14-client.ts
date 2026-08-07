export type Phase14Action =
  | "create"
  | "inspect"
  | "prepare-edit"
  | "approve"
  | "revoke"
  | "apply"
  | "test"
  | "start-preview"
  | "stop-preview"
  | "cancel";

type Phase14Claim = {
  readonly label:
    "source-fact" | "runtime-observation" | "test-result" | "interpretation";
  readonly text: string;
};

export type Phase14JourneyState = {
  readonly operationId: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly status: "idle" | "active" | "cancelled" | "completed" | "failed";
  readonly step: number;
  readonly session: {
    readonly adapterSessionRef: string;
    readonly continuity: string;
  } | null;
  readonly disposable: {
    readonly repositoryId: string;
    readonly fixtureRevision: string;
    readonly target: "src/greeting.mjs";
    readonly symbol: "greeting";
  } | null;
  readonly events: readonly {
    readonly eventId: string;
    readonly operation: "read" | "search" | "edit" | "test" | "preview";
    readonly state:
      | "requested"
      | "accepted"
      | "running"
      | "succeeded"
      | "failed"
      | "cancelled"
      | "superseded";
    readonly sequence: number;
    readonly occurredAt: string;
  }[];
  readonly explanation: {
    readonly continuity: {
      readonly state: string;
      readonly reason: string | null;
    };
    readonly claims: {
      readonly sourceFacts: readonly Phase14Claim[];
      readonly runtimeObservations: readonly Phase14Claim[];
      readonly testResults: readonly Phase14Claim[];
      readonly interpretations: readonly Phase14Claim[];
    };
  } | null;
  readonly edit: {
    readonly outcome: string;
    readonly diff: string;
    readonly patchDigest: string;
    readonly previousHash: string;
    readonly currentHash: string | null;
    readonly previousEvidenceRef: string;
    readonly currentEvidenceRef: string | null;
    readonly error: string | null;
  } | null;
  readonly approval: {
    readonly approvalId: string;
    readonly expiresAt: string;
    readonly used: boolean;
    readonly revoked: boolean;
  } | null;
  readonly test: {
    readonly state:
      "requested" | "running" | "succeeded" | "failed" | "cancelled";
    readonly argv: readonly string[];
    readonly stdout: string;
    readonly stderr: string;
    readonly stdoutTruncated: boolean;
    readonly stderrTruncated: boolean;
    readonly exitCode: number | null;
    readonly signal: string | null;
    readonly timedOut: boolean;
    readonly startedAt: string;
    readonly finishedAt: string | null;
    readonly evidenceRef: string | null;
  } | null;
  readonly preview: {
    readonly state: string;
    readonly url: string | null;
    readonly health: { readonly ok: true; readonly schema: string } | null;
    readonly logs: string;
    readonly logsTruncated: boolean;
    readonly portClosed: boolean | null;
    readonly evidenceRef: string | null;
  } | null;
  readonly evidenceRefs: readonly string[];
};

async function jsonRequest<T>(
  fetcher: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : ((body as { error: { message?: string } }).error.message ??
            "Phase 14 request failed")
        : "Phase 14 request failed";
    throw new Error(message);
  }
  return body as T;
}

export class Phase14Client {
  constructor(readonly fetcher: typeof fetch = fetch) {}

  create<T>(): Promise<T> {
    return jsonRequest<T>(this.fetcher, "/api/phase14/journeys", {
      method: "POST",
      body: "{}",
    });
  }

  current<T>(): Promise<T> {
    return jsonRequest<T>(this.fetcher, "/api/phase14/journeys/current");
  }

  get<T>(operationId: string): Promise<T> {
    return jsonRequest<T>(
      this.fetcher,
      `/api/phase14/journeys/${encodeURIComponent(operationId)}`,
    );
  }

  async action<T>(
    action: Exclude<Phase14Action, "create">,
    operationId: string,
    binding: { patchDigest?: string; approvalId?: string } = {},
  ): Promise<T> {
    const route: Record<Exclude<Phase14Action, "create">, string> = {
      inspect: "inspect",
      "prepare-edit": "edit/preview",
      approve: "approval",
      revoke: "approval/revoke",
      apply: "edit/apply",
      test: "test",
      "start-preview": "preview/start",
      "stop-preview": "preview/stop",
      cancel: "cancel",
    };
    const body =
      action === "approve"
        ? { patchDigest: binding.patchDigest }
        : action === "revoke" || action === "apply"
          ? { approvalId: binding.approvalId }
          : {};
    return jsonRequest<T>(
      this.fetcher,
      `/api/phase14/journeys/${encodeURIComponent(operationId)}/${route[action]}`,
      { method: "POST", body: JSON.stringify(body) },
    );
  }
}

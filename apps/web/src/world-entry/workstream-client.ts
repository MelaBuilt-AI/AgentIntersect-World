export type WorkstreamReference = {
  readonly repositoryId: string;
  readonly revision: string;
};

export type WorkstreamAgentReference = {
  readonly agentId: string;
  readonly nativeSessionId: string;
  readonly revision: string;
};

export type WorkstreamAuthorityDescriptor = {
  readonly repository: WorkstreamReference;
  readonly agent: WorkstreamAgentReference;
};

export type WorkstreamApiRecord = {
  readonly schema: "aiw.workstream/1";
  readonly workstreamId: string;
  readonly revision: number;
  readonly title: string;
  readonly repository: WorkstreamReference;
  readonly agent: WorkstreamAgentReference;
  readonly authority: {
    readonly schema: "aiw.worktree-authority-receipt/1";
    readonly ownerId: string;
    readonly requestId: string;
    readonly worktreeId: string;
    readonly repositoryId: string;
    readonly relativePath: string;
    readonly branch: string;
    readonly head: string;
    readonly state: "current" | "dirty" | "wrong-branch";
    readonly statusSummary: string;
    readonly validatedAt: string;
    readonly attestation: string;
  };
  readonly worktreeState:
    "current" | "dirty" | "wrong-branch" | "missing" | "removed";
  readonly evidenceOperationRefs: readonly string[];
  readonly status:
    | "planning"
    | "working"
    | "completed"
    | "blocked"
    | "cancelled"
    | "cleanup-required";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly events: readonly {
    readonly eventId: string;
    readonly status: WorkstreamApiRecord["status"];
    readonly summary: string;
    readonly occurredAt: string;
  }[];
};

export type WorkstreamCreateInput = {
  readonly requestId: string;
  readonly correlationId: string;
  readonly title: string;
  readonly repository: WorkstreamReference;
  readonly agent: WorkstreamAgentReference;
};

type ApiResult<T> = {
  readonly ok: true;
  readonly data: T;
};

function errorMessage(body: unknown): string {
  if (!body || typeof body !== "object" || !("error" in body))
    return "Workstream request failed";
  const error = (body as { error: unknown }).error;
  return error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Workstream request failed";
}

function isNotFound(body: unknown): boolean {
  return Boolean(
    body &&
    typeof body === "object" &&
    "error" in body &&
    (body as { error?: { code?: unknown } }).error?.code === "not_found",
  );
}

function recordFrom(body: unknown): WorkstreamApiRecord {
  if (!body || typeof body !== "object")
    throw new Error("Invalid Workstream response");
  const record = body as Partial<WorkstreamApiRecord>;
  if (
    record.schema !== "aiw.workstream/1" ||
    typeof record.workstreamId !== "string" ||
    typeof record.revision !== "number" ||
    typeof record.title !== "string" ||
    !record.repository ||
    !record.agent ||
    !record.authority ||
    !Array.isArray(record.events) ||
    !Array.isArray(record.evidenceOperationRefs) ||
    typeof record.status !== "string"
  )
    throw new Error("Invalid Workstream response");
  return record as WorkstreamApiRecord;
}

export class WorkstreamClient {
  constructor(readonly fetcher: typeof fetch = fetch) {}

  async current(): Promise<WorkstreamApiRecord | null> {
    const response = await this.fetcher("/api/workstreams/current", {
      headers: { accept: "application/json" },
    });
    const body: unknown = await response.json();
    if (response.status === 404 && isNotFound(body)) return null;
    if (!response.ok) throw new Error(errorMessage(body));
    const envelope = body as ApiResult<unknown>;
    if (envelope.ok !== true) throw new Error("Invalid Workstream response");
    return recordFrom(envelope.data);
  }

  async create(input: WorkstreamCreateInput): Promise<{
    readonly workstream: WorkstreamApiRecord;
    readonly replayed: boolean;
  }> {
    return this.#mutation("/api/workstreams", input);
  }

  async cancel(
    workstream: WorkstreamApiRecord,
    command: { readonly requestId: string; readonly correlationId: string },
  ): Promise<{
    readonly workstream: WorkstreamApiRecord;
    readonly replayed: boolean;
  }> {
    return this.#mutation(
      `/api/workstreams/${encodeURIComponent(workstream.workstreamId)}/cancel`,
      {
        ...command,
        expectedRevision: workstream.revision,
        repository: workstream.repository,
        agent: workstream.agent,
      },
    );
  }

  async #mutation(
    url: string,
    body: unknown,
  ): Promise<{
    readonly workstream: WorkstreamApiRecord;
    readonly replayed: boolean;
  }> {
    const response = await this.fetcher(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const responseBody: unknown = await response.json();
    if (!response.ok) throw new Error(errorMessage(responseBody));
    const envelope = responseBody as ApiResult<{
      workstream?: unknown;
      replayed?: unknown;
    }>;
    if (envelope.ok !== true || typeof envelope.data?.replayed !== "boolean")
      throw new Error("Invalid Workstream response");
    return {
      workstream: recordFrom(envelope.data.workstream),
      replayed: envelope.data.replayed,
    };
  }
}

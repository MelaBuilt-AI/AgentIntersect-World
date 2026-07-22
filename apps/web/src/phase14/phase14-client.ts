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

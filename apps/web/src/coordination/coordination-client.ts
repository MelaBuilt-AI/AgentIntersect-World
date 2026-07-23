import {
  CoordinationPresentationSchema,
  type CoordinationAction,
  type CoordinationPresentation,
} from "@agentintersect-world/multi-agent-coordination";

type ApiEnvelope<T> = {
  readonly ok: true;
  readonly data: T;
};

async function responseJson(response: Response): Promise<unknown> {
  const value: unknown = await response.json();
  if (!response.ok) {
    const message =
      value &&
      typeof value === "object" &&
      "error" in value &&
      (value as { error?: { message?: unknown } }).error?.message;
    throw new Error(
      typeof message === "string"
        ? message
        : `Coordination request failed (${response.status})`,
    );
  }
  return value;
}

export async function getCoordinationSnapshot(
  signal?: AbortSignal,
): Promise<CoordinationPresentation> {
  const response = await fetch("/api/coordination/snapshot", {
    headers: { accept: "application/json" },
    ...(signal ? { signal } : {}),
  });
  const envelope = (await responseJson(response)) as ApiEnvelope<unknown>;
  return CoordinationPresentationSchema.parse(envelope.data);
}

export async function postCoordinationAction(
  action: CoordinationAction,
): Promise<CoordinationPresentation> {
  const response = await fetch("/api/coordination/actions", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(action),
  });
  const envelope = (await responseJson(response)) as ApiEnvelope<unknown>;
  return CoordinationPresentationSchema.parse(envelope.data);
}

export async function reconcileCoordination(
  coordinationSessionId: string,
): Promise<CoordinationPresentation> {
  const response = await fetch("/api/coordination/reconcile", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      coordinationSessionId,
      actor: "operator",
      operatorApproval: "approved",
    }),
  });
  const envelope = (await responseJson(response)) as ApiEnvelope<unknown>;
  return CoordinationPresentationSchema.parse(envelope.data);
}

import type { Workstream } from "./workstream-tracer.js";

export type IterationStatus = {
  readonly state: "updating" | "refreshing" | "ready" | "failed";
  readonly message: string;
};

export function previewIterationKey(
  workstream: Workstream,
  preview: { readonly startedAt: string; readonly workstreamRevision: number },
): string | null {
  const authority = workstream.authority;
  const turn = authority?.events.findLast(
    (event) => event.status === "working",
  );
  return turn &&
    authority!.revision > preview.workstreamRevision &&
    Date.parse(turn.occurredAt) > Date.parse(preview.startedAt)
    ? `${workstream.workstreamId}:${turn.eventId}`
    : null;
}

export function resolveIterationRefresh(workstream: Workstream): {
  readonly ready: boolean;
  readonly message: string;
} {
  if (workstream.validation.length === 0)
    return {
      ready: false,
      message:
        "Iteration finished without validation evidence. Verified preview retained.",
    };
  if (workstream.validation.some((check) => check.state !== "passed"))
    return {
      ready: false,
      message:
        "Iteration blocked · validation failed. Verified preview retained.",
    };
  return {
    ready: true,
    message: "Validation passed · refreshing World View.",
  };
}

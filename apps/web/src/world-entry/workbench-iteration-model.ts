import type { Workstream } from "./workstream-tracer.js";

export type IterationStatus = {
  readonly state: "updating" | "refreshing" | "ready" | "failed";
  readonly message: string;
};

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

import type { PreviewProjection } from "./preview-manager-client.js";
import type { Workstream } from "./workstream-tracer.js";

export type WorldInputOwner = "world" | "preview";

export type WorldViewLauncher = {
  readonly enabled: boolean;
  readonly label: string;
};

export function resolveWorldViewLauncher({
  workstream,
  recipeCount,
  projection,
  loading,
  pending,
  unavailableReason,
}: {
  readonly workstream: Workstream;
  readonly recipeCount: number;
  readonly projection: PreviewProjection | null;
  readonly loading: boolean;
  readonly pending: boolean;
  readonly unavailableReason: string | null;
}): WorldViewLauncher {
  const authority = workstream.authority;
  if (
    !authority ||
    workstream.status === "cancelled" ||
    !["current", "dirty"].includes(authority.worktreeState)
  )
    return {
      enabled: false,
      label:
        "World View unavailable — current owned Workstream authority required.",
    };
  if (pending)
    return {
      enabled: false,
      label: "World View unavailable — preview action pending.",
    };
  if (unavailableReason)
    return {
      enabled: false,
      label: `World View unavailable — ${unavailableReason}`,
    };
  if (projection?.display?.truth === "current")
    return {
      enabled: false,
      label: "World View attached — current verified preview.",
    };
  if (loading)
    return {
      enabled: false,
      label: "World View unavailable — loading approved preview recipes.",
    };
  if (recipeCount === 0)
    return {
      enabled: false,
      label: "World View unavailable — no approved preview recipe.",
    };
  if (recipeCount > 1)
    return {
      enabled: false,
      label: "World View unavailable — multiple approved preview recipes.",
    };
  return {
    enabled: true,
    label:
      projection?.display?.truth === "previous-verified"
        ? "Refresh World View"
        : "Start World View",
  };
}

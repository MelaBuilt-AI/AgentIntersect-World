export type BrowserAgentWorkFocus = {
  readonly activityId: string;
  readonly rosterId: string;
  readonly worldSessionId: string;
  readonly objectRef: string;
  readonly repositoryPath: string;
  readonly layoutGeneration: string;
  readonly movementRequestId: string | null;
  readonly source: "structured-tool-event" | "workstream-binding";
  readonly state:
    | "targeted"
    | "navigating"
    | "coding"
    | "completed"
    | "failed"
    | "cancelled"
    | "stale";
};

export type AgentWorkArrival = {
  readonly activityId: string;
  readonly requestId: string;
  readonly actorId: string;
  readonly objectRef: string;
  readonly layoutGeneration: string;
  readonly atSafeApproachPoint: boolean;
};

export type AgentRepositoryWorkState = {
  readonly state: "idle" | "navigating" | "coding" | "stale";
  readonly action: "Idle" | "Walk" | "Work";
  readonly codingSemantic: "Work" | null;
  readonly mixerPaused: boolean;
  readonly objectRef: string | null;
  readonly repositoryPath: string | null;
};

const terminal = new Set(["completed", "failed", "cancelled"]);

export function deriveAgentRepositoryWorkState(
  focus: BrowserAgentWorkFocus | null,
  arrival: AgentWorkArrival | null,
  currentLayoutGeneration: string,
  reducedMotion = false,
): AgentRepositoryWorkState {
  if (!focus || terminal.has(focus.state))
    return {
      state: "idle",
      action: "Idle",
      codingSemantic: null,
      mixerPaused: reducedMotion,
      objectRef: null,
      repositoryPath: null,
    };
  if (
    focus.state === "stale" ||
    focus.layoutGeneration !== currentLayoutGeneration
  )
    return {
      state: "stale",
      action: "Idle",
      codingSemantic: null,
      mixerPaused: reducedMotion,
      objectRef: focus.objectRef,
      repositoryPath: focus.repositoryPath,
    };
  const coding =
    focus.source === "structured-tool-event" &&
    arrival !== null &&
    focus.movementRequestId !== null &&
    arrival.activityId === focus.activityId &&
    arrival.requestId === focus.movementRequestId &&
    arrival.actorId === focus.worldSessionId &&
    arrival.objectRef === focus.objectRef &&
    arrival.layoutGeneration === focus.layoutGeneration &&
    arrival.atSafeApproachPoint;
  const recoveredArrival =
    focus.source === "workstream-binding" &&
    arrival !== null &&
    focus.movementRequestId !== null &&
    arrival.activityId === focus.activityId &&
    arrival.requestId === focus.movementRequestId &&
    arrival.actorId === focus.worldSessionId &&
    arrival.objectRef === focus.objectRef &&
    arrival.layoutGeneration === focus.layoutGeneration &&
    arrival.atSafeApproachPoint;
  return {
    state: coding ? "coding" : recoveredArrival ? "idle" : "navigating",
    action: coding
      ? reducedMotion
        ? "Idle"
        : "Work"
      : recoveredArrival
        ? "Idle"
        : "Walk",
    codingSemantic: coding ? "Work" : null,
    mixerPaused: reducedMotion,
    objectRef: focus.objectRef,
    repositoryPath: focus.repositoryPath,
  };
}

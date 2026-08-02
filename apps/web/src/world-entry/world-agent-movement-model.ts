export const AGENT_MOVEMENT_SCHEMA = "aiw.agent-movement/1" as const;
export const AGENT_MOVEMENT_EVENT_SCHEMA =
  "aiw.agent-movement-event/1" as const;

export type WorldPoint = { readonly x: number; readonly z: number };
export type WorldBounds = {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
};
export type AgentMovementSource = "user-directed" | "agent-autonomous";
export type AgentMovementTarget =
  | {
      readonly kind: "coordinate";
      readonly x: number;
      readonly z: number;
      readonly stoppingRadius?: number;
    }
  | {
      readonly kind: "relative";
      readonly direction: "forward" | "backward" | "left" | "right";
      readonly distance: number;
      readonly stoppingRadius?: number;
    }
  | { readonly kind: "follow-user"; readonly stoppingRadius: number }
  | {
      readonly kind: "repository-object";
      readonly objectId: string;
      readonly layoutGeneration: string;
      readonly stoppingRadius?: number;
    };
export type AgentMovementRequest = {
  readonly schema: typeof AGENT_MOVEMENT_SCHEMA;
  readonly requestId: string;
  readonly actorId: string;
  readonly source: AgentMovementSource;
  readonly speed: number;
  readonly target: AgentMovementTarget;
};
export type AgentMovementEventState =
  | "requested"
  | "accepted"
  | "moving"
  | "arrived"
  | "cancelled"
  | "refused"
  | "target-stale";
export type AgentMovementEvent = {
  readonly schema: typeof AGENT_MOVEMENT_EVENT_SCHEMA;
  readonly actorId: string;
  readonly requestId: string;
  readonly source: AgentMovementSource;
  readonly state: AgentMovementEventState;
  readonly targetKind: AgentMovementTarget["kind"];
  readonly reason?: string;
};
type ActiveMovement = AgentMovementRequest & {
  readonly stoppingRadius: number;
};
export type AgentMovementState = {
  readonly actorId: string;
  readonly position: WorldPoint;
  readonly heading: number;
  readonly velocity: WorldPoint;
  readonly destination: WorldPoint | null;
  readonly source: AgentMovementSource | null;
  readonly movementState: "idle" | "moving";
  readonly animationSemantic: "Idle" | "Walk" | "Run";
  readonly generation: number;
  readonly activeRequest: ActiveMovement | null;
  readonly suspendedAutonomy: AgentMovementRequest | null;
};
export type RepositoryApproachPoint = {
  readonly objectId: string;
  readonly layoutGeneration: string;
  readonly position: WorldPoint;
  readonly hidden: boolean;
  readonly reachable: boolean;
};
export type AgentMovementContext = {
  readonly bounds: WorldBounds;
  readonly userPosition: WorldPoint;
  readonly layoutGeneration: string;
  readonly resolveRepositoryObject: (
    objectId: string,
  ) => RepositoryApproachPoint | null;
};
export type AgentMovementResult = {
  readonly state: AgentMovementState;
  readonly events: readonly AgentMovementEvent[];
};

const MAX_DISTANCE = 30;
const MAX_SPEED = 12;
const MIN_STOPPING_RADIUS = 0.25;
const MAX_STOPPING_RADIUS = 5;
const MAX_ELAPSED_SECONDS = 0.1;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const objectPattern = /^aiw:\/\/object\/[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const finitePoint = (point: WorldPoint) =>
  Number.isFinite(point.x) && Number.isFinite(point.z);
const inside = (point: WorldPoint, bounds: WorldBounds) =>
  finitePoint(point) &&
  point.x >= bounds.minX &&
  point.x <= bounds.maxX &&
  point.z >= bounds.minZ &&
  point.z <= bounds.maxZ;
const quantized = (value: number) => {
  const result = Math.round(value * 1_000) / 1_000;
  return Object.is(result, -0) ? 0 : result;
};
const event = (
  request: AgentMovementRequest,
  state: AgentMovementEventState,
  reason?: string,
): AgentMovementEvent => ({
  schema: AGENT_MOVEMENT_EVENT_SCHEMA,
  actorId: request.actorId,
  requestId: request.requestId,
  source: request.source,
  state,
  targetKind: request.target.kind,
  ...(reason ? { reason } : {}),
});

export function createAgentMovementState(
  actorId: string,
  position: WorldPoint,
): AgentMovementState {
  if (!idPattern.test(actorId) || !finitePoint(position))
    throw new TypeError("Agent movement state identity or position is invalid");
  return {
    actorId,
    position,
    heading: 0,
    velocity: { x: 0, z: 0 },
    destination: null,
    source: null,
    movementState: "idle",
    animationSemantic: "Idle",
    generation: 0,
    activeRequest: null,
    suspendedAutonomy: null,
  };
}

function requestError(request: AgentMovementRequest): string | null {
  if (
    request.schema !== AGENT_MOVEMENT_SCHEMA ||
    !idPattern.test(request.requestId) ||
    !idPattern.test(request.actorId) ||
    (request.source !== "user-directed" &&
      request.source !== "agent-autonomous") ||
    !Number.isFinite(request.speed) ||
    request.speed <= 0 ||
    request.speed > MAX_SPEED
  )
    return "invalid-request";
  const radius = request.target.stoppingRadius;
  if (
    radius !== undefined &&
    (!Number.isFinite(radius) ||
      radius < MIN_STOPPING_RADIUS ||
      radius > MAX_STOPPING_RADIUS)
  )
    return "invalid-stopping-radius";
  if (
    request.target.kind === "relative" &&
    (!Number.isFinite(request.target.distance) ||
      request.target.distance <= 0 ||
      request.target.distance > MAX_DISTANCE)
  )
    return "invalid-distance";
  if (
    request.target.kind === "coordinate" &&
    (!Number.isFinite(request.target.x) || !Number.isFinite(request.target.z))
  )
    return "invalid-coordinate";
  if (
    request.target.kind === "repository-object" &&
    (!objectPattern.test(request.target.objectId) ||
      !idPattern.test(request.target.layoutGeneration))
  )
    return "invalid-object-reference";
  return null;
}

function resolveDestination(
  state: AgentMovementState,
  request: AgentMovementRequest,
  context: AgentMovementContext,
):
  | { readonly destination: WorldPoint; readonly stoppingRadius: number }
  | {
      readonly stale: string;
    }
  | { readonly refused: string } {
  const stoppingRadius = request.target.stoppingRadius ?? MIN_STOPPING_RADIUS;
  let destination: WorldPoint;
  if (request.target.kind === "coordinate")
    destination = { x: request.target.x, z: request.target.z };
  else if (request.target.kind === "relative") {
    const direction = {
      forward: { x: 0, z: -1 },
      backward: { x: 0, z: 1 },
      left: { x: -1, z: 0 },
      right: { x: 1, z: 0 },
    }[request.target.direction];
    destination = {
      x: state.position.x + direction.x * request.target.distance,
      z: state.position.z + direction.z * request.target.distance,
    };
  } else if (request.target.kind === "follow-user")
    destination = context.userPosition;
  else {
    if (request.target.layoutGeneration !== context.layoutGeneration)
      return { stale: "layout-generation-mismatch" };
    const resolved = context.resolveRepositoryObject(request.target.objectId);
    if (
      !resolved ||
      resolved.objectId !== request.target.objectId ||
      resolved.layoutGeneration !== context.layoutGeneration
    )
      return { stale: "repository-object-missing-or-stale" };
    if (resolved.hidden || !resolved.reachable)
      return { refused: "repository-object-unreachable" };
    destination = resolved.position;
  }
  return inside(destination, context.bounds)
    ? { destination, stoppingRadius }
    : { refused: "destination-outside-world-bounds" };
}

export function requestAgentMovement(
  state: AgentMovementState,
  request: AgentMovementRequest,
  context: AgentMovementContext,
): AgentMovementResult {
  const requested = event(request, "requested");
  const error = requestError(request);
  if (error || request.actorId !== state.actorId)
    return {
      state,
      events: [requested, event(request, "refused", error ?? "actor-mismatch")],
    };
  if (
    state.activeRequest?.source === "user-directed" &&
    request.source === "agent-autonomous"
  )
    return {
      state: { ...state, suspendedAutonomy: request },
      events: [requested, event(request, "accepted", "held-by-user-priority")],
    };
  const resolved = resolveDestination(state, request, context);
  if ("stale" in resolved)
    return {
      state,
      events: [requested, event(request, "target-stale", resolved.stale)],
    };
  if ("refused" in resolved)
    return {
      state,
      events: [requested, event(request, "refused", resolved.refused)],
    };
  const cancelled = state.activeRequest
    ? [event(state.activeRequest, "cancelled", "superseded")]
    : [];
  const suspendedAutonomy =
    request.source === "user-directed" &&
    state.activeRequest?.source === "agent-autonomous"
      ? state.activeRequest
      : state.suspendedAutonomy;
  const activeRequest: ActiveMovement = {
    ...request,
    stoppingRadius: resolved.stoppingRadius,
  };
  const next: AgentMovementState = {
    ...state,
    destination: resolved.destination,
    source: request.source,
    movementState: "moving",
    animationSemantic: request.speed > 6 ? "Run" : "Walk",
    generation: state.generation + 1,
    activeRequest,
    suspendedAutonomy,
    velocity: { x: 0, z: 0 },
  };
  return {
    state: next,
    events: [
      ...cancelled,
      requested,
      event(request, "accepted"),
      event(request, "moving"),
    ],
  };
}

function idleState(state: AgentMovementState): AgentMovementState {
  return {
    ...state,
    velocity: { x: 0, z: 0 },
    destination: null,
    source: null,
    movementState: "idle",
    animationSemantic: "Idle",
    activeRequest: null,
  };
}

function resumeAutonomy(
  state: AgentMovementState,
  context: AgentMovementContext,
): AgentMovementResult {
  const pending = state.suspendedAutonomy;
  if (!pending) return { state, events: [] };
  return requestAgentMovement(
    { ...state, suspendedAutonomy: null },
    pending,
    context,
  );
}

export function advanceAgentMovement(
  state: AgentMovementState,
  elapsedSeconds: number,
  context: AgentMovementContext,
): AgentMovementResult {
  const request = state.activeRequest;
  if (!request || !state.destination) return { state, events: [] };
  const destination =
    request.target.kind === "follow-user"
      ? context.userPosition
      : state.destination;
  if (!inside(destination, context.bounds))
    return cancelAgentMovement(state, "destination-invalidated", context);
  const dx = destination.x - state.position.x;
  const dz = destination.z - state.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= request.stoppingRadius) {
    const arrived = idleState({ ...state, destination });
    const resumed =
      request.source === "user-directed"
        ? resumeAutonomy(arrived, context)
        : { state: arrived, events: [] };
    return {
      state: resumed.state,
      events: [event(request, "arrived"), ...resumed.events],
    };
  }
  const elapsed = Math.max(
    0,
    Math.min(
      Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0,
      MAX_ELAPSED_SECONDS,
    ),
  );
  const step = Math.min(
    request.speed * elapsed,
    distance - request.stoppingRadius,
  );
  const ux = dx / distance;
  const uz = dz / distance;
  const position = {
    x: quantized(state.position.x + ux * step),
    z: quantized(state.position.z + uz * step),
  };
  if (!inside(position, context.bounds))
    return cancelAgentMovement(state, "world-bounds", context);
  return {
    state: {
      ...state,
      position,
      destination,
      heading: Math.atan2(ux, -uz),
      velocity:
        elapsed > 0
          ? { x: ux * request.speed, z: uz * request.speed }
          : { x: 0, z: 0 },
    },
    events: [],
  };
}

export function cancelAgentMovement(
  state: AgentMovementState,
  reason: string,
  context: AgentMovementContext,
): AgentMovementResult {
  const request = state.activeRequest;
  if (!request) return { state: idleState(state), events: [] };
  const cancelled = idleState(state);
  const resumed =
    request.source === "user-directed" && reason === "policy-release"
      ? resumeAutonomy(cancelled, context)
      : { state: cancelled, events: [] };
  return {
    state: resumed.state,
    events: [event(request, "cancelled", reason), ...resumed.events],
  };
}

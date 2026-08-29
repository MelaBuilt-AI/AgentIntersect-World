import {
  createRepositoryCityState,
  projectRepositoryObjects,
  REPOSITORY_ASSET_BY_ID,
  reduceRepositoryCity,
  repositoryVisualFamily,
  resolveWebGLCapability,
  type RepositoryAssetId,
  type RepositoryCityInstance,
  type RepositoryRenderObject,
} from "@agentintersect-world/renderer-r3f";
import {
  projectAvatarLayerState,
  projectWorldAvatarAction,
  type AvatarDraft,
  type AvatarMovementPhase,
} from "@agentintersect-world/avatar-system";
import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { isOperatorMovementKey } from "../world-actions/operator-navigation.js";
import {
  Phase14Client,
  type Phase14JourneyState,
} from "../phase14/phase14-client.js";
import {
  completeAvatarOneShot,
  createAvatarAnimationState,
  setAvatarLocomotion,
  triggerAvatarOneShot,
  type AvatarAnimationState,
  type AvatarOneShotSemantic,
  type WorldActivity,
} from "./world-chat-model.js";
import {
  applyWorldCameraLook,
  isEditableWorldTarget,
  moveWorldPosition,
  projectAvatarMovementPhaseFromKeys,
  shouldConsumeWorldJump,
  type WorldCameraLook,
} from "./world-navigation-model.js";
import { worldImportedAvatarSelection } from "./world-imported-avatar.js";
import { RepositoryAssetPalette } from "./RepositoryAssetPalette.js";
import { buildRepositoryExplainPrompt } from "./repository-explain-prompt.js";
import {
  demoWorkstreamFromSearch,
  findWorkstreamForRepositorySelection,
  loadCurrentPhase14Workstream,
  projectAuthoritativeWorkstream,
  workstreamTracerModeFromSearch,
  type Workstream,
} from "./workstream-tracer.js";
import {
  WorkstreamClient,
  type WorkstreamAuthorityDescriptor,
} from "./workstream-client.js";
import { createLiveWorkstream } from "./workstream-create.js";
import {
  advanceAgentMovement,
  createAgentMovementState,
  interruptAgentMovement,
  requestAgentMovement,
  type AgentMovementEvent,
  type AgentMovementContext,
  type AgentMovementRequest,
  type AgentMovementResult,
  type AgentMovementState,
  type RepositoryApproachPoint,
} from "./world-agent-movement-model.js";
import type { AgentRepositoryWorkFocus } from "../sessions/session-client.js";
import {
  deriveAgentRepositoryWorkState,
  type AgentWorkArrival,
} from "./agent-work-focus-model.js";

const WorldRoomCanvas = lazy(async () => {
  const module = await import("@agentintersect-world/renderer-r3f/world-room");
  return { default: module.WorldRoomCanvas };
});
const ImportedWorldRoomCanvas = lazy(async () => {
  const module =
    await import("@agentintersect-world/renderer-r3f/world-room-imported");
  return { default: module.WorldRoomCanvas };
});

const WORLD_AGENT_SPAWN_POSITIONS = [
  { x: -4.2, z: 0.8 },
  { x: 4.2, z: 0.8 },
  { x: -3.2, z: -4 },
  { x: 3.2, z: -4 },
] as const;

function settleReducedAgentMovement(
  result: AgentMovementResult,
  context: AgentMovementContext,
  reducedMotion: boolean,
): AgentMovementResult {
  if (!reducedMotion) return result;
  let state = result.state;
  const events = [...result.events];
  for (
    let step = 0;
    step < 400 && state.movementState === "moving";
    step += 1
  ) {
    const advanced = advanceAgentMovement(state, 0.1, context);
    state = advanced.state;
    events.push(...advanced.events);
  }
  return { state, events };
}

function reconcileAgentWorkArrival(
  focus: AgentRepositoryWorkFocus | null | undefined,
  arrival: Omit<AgentWorkArrival, "activityId"> | null,
): AgentWorkArrival | null {
  if (
    !focus ||
    !arrival ||
    !arrival.atSafeApproachPoint ||
    focus.movementRequestId !== arrival.requestId ||
    focus.worldSessionId !== arrival.actorId ||
    focus.objectRef !== arrival.objectRef ||
    focus.layoutGeneration !== arrival.layoutGeneration
  )
    return null;
  return { ...arrival, activityId: focus.activityId };
}

class WorldCanvasErrorBoundary extends Component<
  { readonly children: ReactNode; readonly onError: () => void },
  { readonly failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const isInteractiveMouseTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  Boolean(
    target.closest(
      'input, textarea, select, button, a, form, [contenteditable="true"], [role="button"], [role="link"], .world-transcript, .repository-asset-palette, .repository-asset-inspector',
    ),
  );

export function WorldRoom({
  floor,
  objects,
  reducedMotion,
  forceNoWebGL,
  userName,
  agentName,
  userAvatar,
  agentAvatar,
  agentAvatars,
  selectedRecipientId = null,
  onSelectRecipient,
  onClearRecipient,
  activity,
  activeAgentRosterIds = [],
  userCue,
  agentCue,
  agentActorId,
  agentMovementRequest,
  agentMovementControl,
  agentWorkFocus,
  agentMovementBindings,
  layoutGeneration = "blank-world",
  onAgentMovementEvent,
  showControlHints = true,
  repositoryReadiness = "idle",
  workstreamAuthority,
  workstreamTask,
  workstreamCreateUnavailableReason,
  onWorkstreamSessionChanged,
  onAskAgent,
  onRepositoryReady,
  onRepositoryError,
}: {
  readonly floor: "blank" | "repository";
  readonly objects: readonly RepositoryRenderObject[];
  readonly reducedMotion: boolean;
  readonly forceNoWebGL: boolean;
  readonly userName: string;
  readonly agentName: string;
  readonly userAvatar: AvatarDraft;
  readonly agentAvatar: AvatarDraft;
  readonly agentAvatars?: readonly {
    readonly rosterId: string;
    readonly worldSessionId?: string;
    readonly name: string;
    readonly avatar: AvatarDraft;
  }[];
  readonly selectedRecipientId?: string | null;
  readonly onSelectRecipient?: ((rosterId: string) => void) | undefined;
  readonly onClearRecipient?: (() => void) | undefined;
  readonly activity: WorldActivity;
  readonly activeAgentRosterIds?: readonly string[];
  readonly userCue?:
    | {
        readonly sequence: number;
        readonly semantic: AvatarOneShotSemantic;
        readonly source: "local-command";
      }
    | null
    | undefined;
  readonly agentCue?:
    | {
        readonly sequence: number;
        readonly semantic: AvatarOneShotSemantic;
        readonly source: "visible-text" | "application-event";
      }
    | null
    | undefined;
  readonly agentActorId?: string | undefined;
  readonly agentMovementRequest?: AgentMovementRequest | null | undefined;
  readonly agentMovementControl?:
    | {
        readonly sequence: number;
        readonly requestId: string;
        readonly state: "cancelled" | "interrupted";
        readonly reason: string;
      }
    | null
    | undefined;
  readonly agentWorkFocus?: AgentRepositoryWorkFocus | null | undefined;
  readonly agentMovementBindings?: readonly {
    readonly rosterId: string;
    readonly actorId: string;
    readonly request: AgentMovementRequest | null;
    readonly control: {
      readonly sequence: number;
      readonly requestId: string;
      readonly state: "cancelled" | "interrupted";
      readonly reason: string;
    } | null;
    readonly workFocus: AgentRepositoryWorkFocus | null;
  }[];
  readonly layoutGeneration?: string | undefined;
  readonly onAgentMovementEvent?:
    | ((event: AgentMovementEvent, position: { x: number; z: number }) => void)
    | undefined;
  readonly showControlHints?: boolean;
  readonly repositoryReadiness?: "idle" | "loading" | "ready" | "error";
  readonly workstreamAuthority?:
    WorkstreamAuthorityDescriptor | null | undefined;
  readonly workstreamTask?: string | null | undefined;
  readonly workstreamCreateUnavailableReason?: string | null | undefined;
  readonly onWorkstreamSessionChanged?:
    (() => Promise<void> | void) | undefined;
  readonly onAskAgent?: ((prompt: string) => void) | undefined;
  readonly onRepositoryReady?: (() => void) | undefined;
  readonly onRepositoryError?: (() => void) | undefined;
}) {
  const roomRef = useRef<HTMLElement>(null);
  const pressedKeys = useRef(new Set<string>());
  const lastFrame = useRef<number | null>(null);
  const [contextLost, setContextLost] = useState(
    () => forceNoWebGL || !resolveWebGLCapability().available,
  );
  const [rendererFailure, setRendererFailure] = useState<
    "context-lost" | "load-or-render-error" | null
  >(null);
  const [userPosition, setUserPosition] = useState({ x: 0, z: 0 });
  const renderedAgents = (
    agentAvatars?.length
      ? agentAvatars
      : [
          {
            rosterId: agentActorId ?? "agent-local",
            name: agentName,
            avatar: agentAvatar,
          },
        ]
  ).slice(0, 4);
  const activeRoster = new Set(activeAgentRosterIds);
  const renderedAgentActivities = renderedAgents.map((agent) =>
    activeRoster.has(agent.rosterId)
      ? {
          ...activity,
          label:
            activity.state === "thinking"
              ? `${agent.name} is thinking`
              : activity.state === "completed"
                ? `${agent.name} completed the request`
                : activity.state === "failed"
                  ? `${agent.name} failed`
                  : `${agent.name} is ${activity.detail || activity.state}`,
        }
      : {
          state: "idle" as const,
          icon: "",
          label: `${agent.name} is idle`,
          detail: "" as const,
        },
  );
  const resolvedAgentActorId = agentActorId ?? "agent-local";
  const [agentMovement, setAgentMovement] = useState<AgentMovementState>(() =>
    createAgentMovementState(
      resolvedAgentActorId,
      renderedAgents.length > 1
        ? WORLD_AGENT_SPAWN_POSITIONS[0]
        : { x: 2.5, z: 1 },
    ),
  );
  const [agentWorkArrival, setAgentWorkArrival] =
    useState<AgentWorkArrival | null>(null);
  const [secondaryMovements, setSecondaryMovements] = useState<
    Readonly<Record<string, AgentMovementState>>
  >({});
  const secondaryMovementsRef = useRef(secondaryMovements);
  const agentMovementBindingsRef = useRef(agentMovementBindings);
  const secondaryHandledRequests = useRef<Record<string, string>>({});
  const secondaryHandledControls = useRef<Record<string, number>>({});
  const [secondaryArrivals, setSecondaryArrivals] = useState<
    Readonly<Record<string, AgentWorkArrival | null>>
  >({});
  const agentMovementRef = useRef(agentMovement);
  const pendingAgentWorkArrivalRef = useRef<Omit<
    AgentWorkArrival,
    "activityId"
  > | null>(null);
  const latestAgentWorkFocusRef = useRef(agentWorkFocus);
  const handledAgentMovementRequest = useRef<string | null>(null);
  const handledAgentMovementControl = useRef(0);
  const onAgentMovementEventRef = useRef(onAgentMovementEvent);
  const [movementPhase, setMovementPhase] =
    useState<AvatarMovementPhase>("idle");
  const [userAnimation, setUserAnimation] = useState<AvatarAnimationState>(() =>
    createAvatarAnimationState(),
  );
  const [agentAnimation, setAgentAnimation] = useState<AvatarAnimationState>(
    () => createAvatarAnimationState(),
  );
  const userAnimationRef = useRef(userAnimation);
  const [expiredTerminalActivity, setExpiredTerminalActivity] =
    useState<WorldActivity | null>(null);
  const [camera, setCamera] = useState<WorldCameraLook>({
    yaw: 0,
    pitch: 0.35,
  });
  const cameraRef = useRef(camera);
  const activeLookPointer = useRef<number | null>(null);
  const lookSurface = useRef<HTMLCanvasElement | null>(null);
  const lookRequestPending = useRef(false);
  const lookOwnsPointerLock = useRef(false);
  const lookRequestSequence = useRef(0);
  const [mouseLookActive, setMouseLookActive] = useState(false);
  const [city, dispatchCity] = useReducer(
    reduceRepositoryCity,
    undefined,
    createRepositoryCityState,
  );
  const [cityMode, setCityMode] = useState<"live" | "director">("live");
  const [selectedCityInstanceId, setSelectedCityInstanceId] = useState<
    string | null
  >(null);
  const tracerMode = useMemo(
    () =>
      workstreamTracerModeFromSearch(
        typeof window === "undefined" ? "" : window.location.search,
      ),
    [],
  );
  const demoWorkstream = useMemo(
    () =>
      tracerMode === "demo"
        ? demoWorkstreamFromSearch(window.location.search)
        : null,
    [tracerMode],
  );
  const [liveWorkstream, setLiveWorkstream] = useState<Workstream | null>(null);
  const [liveTracerMessage, setLiveTracerMessage] = useState<string | null>(
    tracerMode === "live"
      ? "Loading current Workstream…"
      : tracerMode === "phase14"
        ? "Loading diagnostic Phase 14 current journey…"
        : null,
  );
  const [workstreamActionPending, setWorkstreamActionPending] = useState(false);
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState<
    string | null
  >(null);
  const [cityFocusPosition, setCityFocusPosition] = useState<{
    readonly x: number;
    readonly z: number;
  } | null>(null);
  const nextManualCityInstance = useRef(1);
  const modularUnsupported =
    (userAvatar.avatarSource?.kind === "imported" &&
      userAvatar.avatarSource.mode === "modular") ||
    renderedAgents.some(
      ({ avatar }) =>
        avatar.avatarSource?.kind === "imported" &&
        avatar.avatarSource.mode === "modular",
    );
  const noWebGL = forceNoWebGL || contextLost || modularUnsupported;
  const selectedCityInstance =
    city.instances.find(
      ({ instanceId }) => instanceId === selectedCityInstanceId,
    ) ?? null;
  const availableWorkstream = demoWorkstream ?? liveWorkstream;
  const selectedWorkstream = selectedCityInstance
    ? findWorkstreamForRepositorySelection(
        availableWorkstream ? [availableWorkstream] : [],
        selectedCityInstance,
      )
    : selectedWorkstreamId === availableWorkstream?.workstreamId
      ? availableWorkstream
      : null;
  useEffect(() => {
    if (tracerMode !== "live" && tracerMode !== "phase14") return;
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const workstream =
          tracerMode === "live"
            ? await new WorkstreamClient()
                .current()
                .then((record) =>
                  record ? projectAuthoritativeWorkstream(record) : null,
                )
            : await loadCurrentPhase14Workstream(() =>
                new Phase14Client().current<Phase14JourneyState>(),
              );
        if (!active) return;
        setLiveWorkstream((current) => {
          if (!workstream) return current;
          if (
            current?.authority &&
            workstream.authority &&
            current.authority.revision > workstream.authority.revision
          )
            return current;
          return workstream;
        });
        setLiveTracerMessage(
          tracerMode === "live"
            ? workstream
              ? `Current Workstream is ${workstream.status}.`
              : "No current Workstream."
            : workstream
              ? "Diagnostic Phase 14 current journey available."
              : "Phase 14 current journey unavailable · current response had no journey identity.",
        );
      } catch (error) {
        if (!active) return;
        const detail =
          error instanceof Error ? error.message : "Workstream request failed";
        setLiveTracerMessage(
          tracerMode === "live"
            ? `Workbench error · ${detail}.`
            : detail === "No Phase 14 journey"
              ? "Phase 14 current journey unavailable · No current journey."
              : `Phase 14 diagnostic error · ${detail}.`,
        );
      } finally {
        pending = false;
      }
    };
    void load();
    const timer =
      tracerMode === "live"
        ? window.setInterval(() => void load(), 1_000)
        : null;
    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
    };
  }, [tracerMode]);

  const cancelWorkstream = useCallback(async () => {
    const authority = selectedWorkstream?.authority;
    if (tracerMode !== "live" || !authority || workstreamActionPending) return;
    setWorkstreamActionPending(true);
    try {
      const commandId = crypto.randomUUID();
      const result = await new WorkstreamClient().cancel(authority, {
        requestId: `cancel-${commandId}`,
        correlationId: commandId,
      });
      const projected = projectAuthoritativeWorkstream(result.workstream);
      setLiveWorkstream(projected);
      setLiveTracerMessage(`Current Workstream is ${projected.status}.`);
      await onWorkstreamSessionChanged?.();
    } catch (error) {
      setLiveTracerMessage(
        `Workbench error · ${error instanceof Error ? error.message : "Cancel failed"}.`,
      );
    } finally {
      setWorkstreamActionPending(false);
    }
  }, [
    onWorkstreamSessionChanged,
    selectedWorkstream,
    tracerMode,
    workstreamActionPending,
  ]);
  const createWorkstream = useCallback(async () => {
    if (
      tracerMode !== "live" ||
      !workstreamAuthority ||
      !workstreamTask ||
      workstreamCreateUnavailableReason ||
      liveWorkstream ||
      liveTracerMessage !== "No current Workstream." ||
      workstreamActionPending
    )
      return;
    setWorkstreamActionPending(true);
    const outcome = await createLiveWorkstream(
      workstreamAuthority,
      workstreamTask,
    );
    if (outcome.workstream) {
      setLiveWorkstream(outcome.workstream);
      setSelectedWorkstreamId(outcome.workstream.workstreamId);
      await onWorkstreamSessionChanged?.();
    }
    setLiveTracerMessage(outcome.message);
    setWorkstreamActionPending(false);
  }, [
    liveTracerMessage,
    liveWorkstream,
    tracerMode,
    workstreamActionPending,
    workstreamAuthority,
    workstreamCreateUnavailableReason,
    workstreamTask,
    onWorkstreamSessionChanged,
  ]);
  useEffect(() => {
    if (floor === "blank") {
      dispatchCity({ type: "initial", instances: [] });
      return;
    }
    dispatchCity({
      type: "initial",
      instances: projectRepositoryObjects(objects),
    });
    if (noWebGL) onRepositoryReady?.();
  }, [floor, layoutGeneration, noWebGL, objects, onRepositoryReady]);
  useEffect(() => {
    if (floor !== "repository" || activity.state === "idle") return;
    dispatchCity({
      type: "event",
      event: {
        id: "world-chat",
        type: "conversation.activity",
        status:
          activity.state === "failed"
            ? "failure"
            : activity.state === "completed"
              ? "active"
              : "pending",
        linkedRepoData: {
          label: activity.label,
          detail: activity.detail || null,
        },
      },
    });
  }, [activity.detail, activity.label, activity.state, floor]);
  const addManualCityInstance = useCallback(
    (assetId: RepositoryAssetId, position?: { x: number; z: number }) => {
      const sequence = nextManualCityInstance.current++;
      const angle = (sequence % 12) * (Math.PI / 6);
      dispatchCity({
        type: "manual.add",
        instanceId: `manual:${sequence}`,
        assetId,
        position: position ?? {
          x: Math.round(Math.cos(angle) * 10),
          z: Math.round(Math.sin(angle) * 10),
        },
      });
      setSelectedCityInstanceId(`manual:${sequence}`);
      setCityFocusPosition(null);
    },
    [dispatchCity],
  );
  const selectCityInstance = useCallback((instanceId: string) => {
    setSelectedCityInstanceId(instanceId);
    setSelectedWorkstreamId(null);
    setCityFocusPosition(null);
  }, []);
  useEffect(() => {
    userAnimationRef.current = userAnimation;
  }, [userAnimation]);
  useEffect(() => {
    agentMovementRef.current = agentMovement;
  }, [agentMovement]);

  useEffect(() => {
    secondaryMovementsRef.current = secondaryMovements;
  }, [secondaryMovements]);
  useEffect(() => {
    agentMovementBindingsRef.current = agentMovementBindings;
  }, [agentMovementBindings]);
  useEffect(() => {
    latestAgentWorkFocusRef.current = agentWorkFocus;
    const arrival = reconcileAgentWorkArrival(
      agentWorkFocus,
      pendingAgentWorkArrivalRef.current,
    );
    const timer = window.setTimeout(() => setAgentWorkArrival(arrival), 0);
    return () => window.clearTimeout(timer);
  }, [agentWorkFocus]);
  useEffect(() => {
    const next = { ...secondaryMovementsRef.current };
    let changed = false;
    for (const [index, binding] of (agentMovementBindings ?? []).entries()) {
      if (index === 0 || next[binding.rosterId]) continue;
      const spawn = WORLD_AGENT_SPAWN_POSITIONS[index]!;
      next[binding.rosterId] = createAgentMovementState(binding.actorId, {
        x: spawn.x,
        z: spawn.z,
      });
      changed = true;
    }
    const currentIds = new Set(
      (agentMovementBindings ?? []).slice(1).map(({ rosterId }) => rosterId),
    );
    for (const rosterId of Object.keys(next))
      if (!currentIds.has(rosterId)) {
        delete next[rosterId];
        changed = true;
      }
    if (changed) {
      secondaryMovementsRef.current = next;
      setSecondaryMovements(next);
    }
  }, [agentMovementBindings]);
  useEffect(() => {
    onAgentMovementEventRef.current = onAgentMovementEvent;
  }, [onAgentMovementEvent]);
  useEffect(() => {
    if (!userCue) return;
    const timer = window.setTimeout(
      () =>
        setUserAnimation((current) =>
          triggerAvatarOneShot(
            current,
            userCue.semantic,
            userCue.source,
            reducedMotion,
          ),
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, userCue]);
  useEffect(() => {
    if (!agentCue) return;
    const timer = window.setTimeout(
      () =>
        setAgentAnimation((current) =>
          agentMovementRef.current.movementState === "moving"
            ? current
            : triggerAvatarOneShot(
                current,
                agentCue.semantic,
                agentCue.source,
                reducedMotion,
              ),
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [agentCue, reducedMotion]);
  const agentMovementContext = useMemo(
    () => ({
      bounds: { minX: -15, maxX: 15, minZ: -15, maxZ: 15 },
      userPosition,
      layoutGeneration,
      resolveRepositoryObject: (
        objectId: string,
      ): RepositoryApproachPoint | null => {
        const instance = city.instances.find(
          ({ linkedRepoData }) => linkedRepoData?.ref === objectId,
        );
        const from = agentMovementRef.current.position;
        const footprint = instance
          ? REPOSITORY_ASSET_BY_ID.get(instance.assetId)!.footprint
          : null;
        const clearance = 0.6;
        const occupied = [
          userPosition,
          ...Object.values(secondaryMovementsRef.current).map(
            ({ position }) => position,
          ),
        ];
        const candidates =
          instance && footprint
            ? [
                {
                  x: instance.position.x - footprint[0] / 2 - clearance,
                  z: instance.position.z,
                },
                {
                  x: instance.position.x + footprint[0] / 2 + clearance,
                  z: instance.position.z,
                },
                {
                  x: instance.position.x,
                  z: instance.position.z - footprint[1] / 2 - clearance,
                },
                {
                  x: instance.position.x,
                  z: instance.position.z + footprint[1] / 2 + clearance,
                },
              ]
                .filter((candidate) =>
                  occupied.every(
                    (position) =>
                      Math.hypot(
                        candidate.x - position.x,
                        candidate.z - position.z,
                      ) >= clearance,
                  ),
                )
                .sort(
                  (left, right) =>
                    Math.hypot(left.x - from.x, left.z - from.z) -
                      Math.hypot(right.x - from.x, right.z - from.z) ||
                    left.x - right.x ||
                    left.z - right.z,
                )
            : [];
        return instance && candidates[0]
          ? {
              objectId,
              layoutGeneration,
              position: candidates[0],
              hidden: false,
              reachable: true,
            }
          : null;
      },
    }),
    [city.instances, layoutGeneration, userPosition],
  );
  const agentMovementContextRef = useRef(agentMovementContext);
  useEffect(() => {
    agentMovementContextRef.current = agentMovementContext;
  }, [agentMovementContext]);
  const secondaryMovementContext = useCallback(
    (rosterId: string, movement: AgentMovementState) => ({
      bounds: { minX: -15, maxX: 15, minZ: -15, maxZ: 15 },
      userPosition,
      layoutGeneration,
      resolveRepositoryObject: (
        objectId: string,
      ): RepositoryApproachPoint | null => {
        const instance = city.instances.find(
          ({ linkedRepoData }) => linkedRepoData?.ref === objectId,
        );
        const footprint = instance
          ? REPOSITORY_ASSET_BY_ID.get(instance.assetId)!.footprint
          : null;
        if (!instance || !footprint) return null;
        const occupied = [
          userPosition,
          agentMovementRef.current.position,
          ...Object.entries(secondaryMovementsRef.current).flatMap(
            ([otherRosterId, state]) =>
              otherRosterId === rosterId ? [] : [state.position],
          ),
        ];
        const clearance = 0.8;
        const candidates = [
          {
            x: instance.position.x - footprint[0] / 2 - clearance,
            z: instance.position.z,
          },
          {
            x: instance.position.x + footprint[0] / 2 + clearance,
            z: instance.position.z,
          },
          {
            x: instance.position.x,
            z: instance.position.z - footprint[1] / 2 - clearance,
          },
          {
            x: instance.position.x,
            z: instance.position.z + footprint[1] / 2 + clearance,
          },
        ]
          .filter((candidate) =>
            occupied.every(
              (position) =>
                Math.hypot(
                  candidate.x - position.x,
                  candidate.z - position.z,
                ) >= clearance,
            ),
          )
          .sort(
            (left, right) =>
              Math.hypot(
                left.x - movement.position.x,
                left.z - movement.position.z,
              ) -
                Math.hypot(
                  right.x - movement.position.x,
                  right.z - movement.position.z,
                ) ||
              left.x - right.x ||
              left.z - right.z,
          );
        return candidates[0]
          ? {
              objectId,
              layoutGeneration,
              position: candidates[0],
              hidden: false,
              reachable: true,
            }
          : null;
      },
    }),
    [city.instances, layoutGeneration, userPosition],
  );
  useEffect(() => {
    if (
      !agentMovementRequest ||
      handledAgentMovementRequest.current === agentMovementRequest.requestId
    )
      return;
    handledAgentMovementRequest.current = agentMovementRequest.requestId;
    pendingAgentWorkArrivalRef.current = null;
    const result = settleReducedAgentMovement(
      requestAgentMovement(
        agentMovementRef.current,
        agentMovementRequest,
        agentMovementContextRef.current,
      ),
      agentMovementContextRef.current,
      reducedMotion,
    );
    if (
      agentMovementRequest.target.kind === "repository-object" &&
      result.events.some((event) => event.state === "arrived")
    ) {
      const arrival = {
        requestId: agentMovementRequest.requestId,
        actorId: agentMovementRequest.actorId,
        objectRef: agentMovementRequest.target.objectId,
        layoutGeneration: agentMovementRequest.target.layoutGeneration,
        atSafeApproachPoint: true as const,
      };
      pendingAgentWorkArrivalRef.current = arrival;
    }
    const arrival = reconcileAgentWorkArrival(
      latestAgentWorkFocusRef.current,
      pendingAgentWorkArrivalRef.current,
    );
    const arrivalTimer = window.setTimeout(
      () => setAgentWorkArrival(arrival),
      0,
    );
    agentMovementRef.current = result.state;
    setAgentMovement(result.state);
    setAgentAnimation((current) =>
      setAvatarLocomotion(current, result.state.animationSemantic),
    );
    for (const movementEvent of result.events)
      onAgentMovementEventRef.current?.(movementEvent, result.state.position);
    return () => window.clearTimeout(arrivalTimer);
  }, [agentMovementRequest, reducedMotion]);
  useEffect(() => {
    if (
      !agentMovementControl ||
      agentMovementControl.sequence <= handledAgentMovementControl.current
    )
      return;
    handledAgentMovementControl.current = agentMovementControl.sequence;
    pendingAgentWorkArrivalRef.current = null;
    const arrivalTimer = window.setTimeout(() => setAgentWorkArrival(null), 0);
    const result = interruptAgentMovement(
      agentMovementRef.current,
      agentMovementControl.requestId,
      agentMovementControl.reason,
      agentMovementControl.state,
    );
    agentMovementRef.current = result.state;
    setAgentMovement(result.state);
    setAgentAnimation((current) => setAvatarLocomotion(current, "Idle"));
    for (const movementEvent of result.events)
      onAgentMovementEventRef.current?.(movementEvent, result.state.position);
    return () => window.clearTimeout(arrivalTimer);
  }, [agentMovementControl]);
  useEffect(() => {
    if (agentMovement.movementState !== "moving") return;
    let frame = 0;
    let previousFrame: number | null = null;
    const tick = (timestamp: number) => {
      const elapsedSeconds =
        previousFrame === null ? 0 : (timestamp - previousFrame) / 1_000;
      previousFrame = timestamp;
      const result = advanceAgentMovement(
        agentMovementRef.current,
        elapsedSeconds,
        agentMovementContextRef.current,
      );
      const activeRequest = agentMovementRef.current.activeRequest;
      if (
        activeRequest?.target.kind === "repository-object" &&
        result.events.some((event) => event.state === "arrived")
      ) {
        const arrival = {
          requestId: activeRequest.requestId,
          actorId: activeRequest.actorId,
          objectRef: activeRequest.target.objectId,
          layoutGeneration: activeRequest.target.layoutGeneration,
          atSafeApproachPoint: true as const,
        };
        pendingAgentWorkArrivalRef.current = arrival;
        setAgentWorkArrival(
          reconcileAgentWorkArrival(latestAgentWorkFocusRef.current, arrival),
        );
      }
      agentMovementRef.current = result.state;
      setAgentMovement(result.state);
      setAgentAnimation((current) =>
        setAvatarLocomotion(current, result.state.animationSemantic),
      );
      for (const movementEvent of result.events)
        onAgentMovementEventRef.current?.(movementEvent, result.state.position);
      if (result.state.movementState === "moving")
        frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [agentMovement.generation, agentMovement.movementState]);
  useEffect(() => {
    if (!agentMovementBindings) return;
    const next = { ...secondaryMovementsRef.current };
    let changed = false;
    for (const [index, binding] of agentMovementBindings.entries()) {
      if (index === 0) continue;
      const current = next[binding.rosterId];
      if (!current) continue;
      if (
        binding.request &&
        secondaryHandledRequests.current[binding.rosterId] !==
          binding.request.requestId
      ) {
        secondaryHandledRequests.current[binding.rosterId] =
          binding.request.requestId;
        const context = secondaryMovementContext(binding.rosterId, current);
        const result = settleReducedAgentMovement(
          requestAgentMovement(current, binding.request, context),
          context,
          reducedMotion,
        );
        next[binding.rosterId] = result.state;
        changed = true;
        setSecondaryArrivals((arrivals) => ({
          ...arrivals,
          [binding.rosterId]: null,
        }));
        const repositoryTarget =
          binding.request.target.kind === "repository-object"
            ? binding.request.target
            : null;
        if (
          repositoryTarget &&
          result.events.some((event) => event.state === "arrived") &&
          binding.workFocus
        ) {
          const focus = binding.workFocus;
          const request = binding.request;
          setSecondaryArrivals((arrivals) => ({
            ...arrivals,
            [binding.rosterId]: {
              activityId: focus.activityId,
              requestId: request.requestId,
              actorId: request.actorId,
              objectRef: repositoryTarget.objectId,
              layoutGeneration: repositoryTarget.layoutGeneration,
              atSafeApproachPoint: true,
            },
          }));
        }
        for (const event of result.events)
          onAgentMovementEventRef.current?.(event, result.state.position);
      }
      const updated = next[binding.rosterId];
      if (
        updated &&
        binding.control &&
        (secondaryHandledControls.current[binding.rosterId] ?? 0) <
          binding.control.sequence
      ) {
        secondaryHandledControls.current[binding.rosterId] =
          binding.control.sequence;
        const result = interruptAgentMovement(
          updated,
          binding.control.requestId,
          binding.control.reason,
          binding.control.state,
        );
        next[binding.rosterId] = result.state;
        changed = true;
        setSecondaryArrivals((arrivals) => ({
          ...arrivals,
          [binding.rosterId]: null,
        }));
        for (const event of result.events)
          onAgentMovementEventRef.current?.(event, result.state.position);
      }
    }
    if (changed) {
      secondaryMovementsRef.current = next;
      setSecondaryMovements(next);
    }
  }, [agentMovementBindings, reducedMotion, secondaryMovementContext]);
  const hasMovingSecondaryAgent = Object.values(secondaryMovements).some(
    ({ movementState }) => movementState === "moving",
  );
  useEffect(() => {
    if (!agentMovementBindingsRef.current || !hasMovingSecondaryAgent) return;
    let frame = 0;
    let previousFrame: number | null = null;
    const tick = (timestamp: number) => {
      const elapsedSeconds =
        previousFrame === null ? 0 : (timestamp - previousFrame) / 1_000;
      previousFrame = timestamp;
      const next = { ...secondaryMovementsRef.current };
      let moving = false;
      for (const binding of (agentMovementBindingsRef.current ?? []).slice(1)) {
        const current = next[binding.rosterId];
        if (!current || current.movementState !== "moving") continue;
        const activeRequest = current.activeRequest;
        const result = advanceAgentMovement(
          current,
          elapsedSeconds,
          secondaryMovementContext(binding.rosterId, current),
        );
        next[binding.rosterId] = result.state;
        moving ||= result.state.movementState === "moving";
        if (
          activeRequest?.target.kind === "repository-object" &&
          result.events.some((event) => event.state === "arrived") &&
          binding.workFocus
        ) {
          const focus = binding.workFocus;
          const target = activeRequest.target;
          setSecondaryArrivals((arrivals) => ({
            ...arrivals,
            [binding.rosterId]: {
              activityId: focus.activityId,
              requestId: activeRequest.requestId,
              actorId: activeRequest.actorId,
              objectRef: target.objectId,
              layoutGeneration: target.layoutGeneration,
              atSafeApproachPoint: true,
            },
          }));
        }
        for (const event of result.events)
          onAgentMovementEventRef.current?.(event, result.state.position);
      }
      secondaryMovementsRef.current = next;
      setSecondaryMovements(next);
      if (moving) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [hasMovingSecondaryAgent, secondaryMovementContext]);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);
  useEffect(() => {
    if (movementPhase !== "starting" && movementPhase !== "stopping") return;
    const next = movementPhase === "starting" ? "moving" : "idle";
    const timer = window.setTimeout(() => setMovementPhase(next), 220);
    return () => window.clearTimeout(timer);
  }, [movementPhase]);
  useEffect(() => {
    if (activity.state !== "completed" && activity.state !== "failed") return;
    const timer = window.setTimeout(
      () => setExpiredTerminalActivity(activity),
      2201,
    );
    return () => window.clearTimeout(timer);
  }, [activity]);

  useEffect(() => {
    if (
      movementPhase !== "starting" &&
      movementPhase !== "moving" &&
      movementPhase !== "sprinting"
    )
      return;
    let frame = 0;
    const tick = (timestamp: number) => {
      const previous = lastFrame.current ?? timestamp;
      lastFrame.current = timestamp;
      const elapsedSeconds = Math.min(0.1, (timestamp - previous) / 1_000);
      if (
        pressedKeys.current.size > 0 &&
        !isEditableWorldTarget(document.activeElement)
      )
        setUserPosition((position) =>
          moveWorldPosition({
            position,
            keys: [...pressedKeys.current],
            yaw: cameraRef.current.yaw,
            elapsedSeconds,
            sprint: pressedKeys.current.has("shift"),
          }),
        );
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      lastFrame.current = null;
    };
  }, [movementPhase]);

  const stopMouseLook = useCallback((updateState = true) => {
    activeLookPointer.current = null;
    const surface = lookSurface.current;
    const ownedLock = lookOwnsPointerLock.current;
    lookOwnsPointerLock.current = false;
    if (
      surface &&
      document.pointerLockElement === surface &&
      (ownedLock || lookRequestPending.current)
    ) {
      lookRequestPending.current = false;
      document.exitPointerLock();
    }
    if (updateState) setMouseLookActive(false);
  }, []);

  useEffect(() => {
    const activeKeys = pressedKeys.current;
    const down = (event: KeyboardEvent) => {
      if (isEditableWorldTarget(event.target)) return;
      const key = event.key.toLocaleLowerCase();
      const dialogOpen = Boolean(
        document.querySelector('[role="dialog"], dialog[open]'),
      );
      if (
        shouldConsumeWorldJump({
          key: event.key,
          repeat: event.repeat,
          target: event.target,
          worldActive:
            document.visibilityState === "visible" &&
            roomRef.current?.isConnected === true,
          dialogOpen,
          escapeMenuOpen: dialogOpen,
          oneShotActive: userAnimationRef.current.oneShot !== null,
        })
      ) {
        event.preventDefault();
        setUserAnimation((current) =>
          triggerAvatarOneShot(current, "Jump", "space", reducedMotion),
        );
        return;
      }
      if (key === "escape" && activeLookPointer.current !== null) {
        stopMouseLook();
        return;
      }
      if (key === "shift" || isOperatorMovementKey(key)) {
        setCityFocusPosition(null);
        const previousKeys = [...activeKeys];
        activeKeys.add(key);
        setMovementPhase((current) =>
          projectAvatarMovementPhaseFromKeys({
            current,
            previousKeys,
            nextKeys: [...activeKeys],
          }),
        );
        if (isOperatorMovementKey(key)) {
          event.preventDefault();
        }
      }
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLocaleLowerCase();
      const previousKeys = [...activeKeys];
      activeKeys.delete(key);
      if (key === "shift" || isOperatorMovementKey(key))
        setMovementPhase((current) =>
          projectAvatarMovementPhaseFromKeys({
            current,
            previousKeys,
            nextKeys: [...activeKeys],
          }),
        );
    };
    const clear = () => {
      const previousKeys = [...activeKeys];
      activeKeys.clear();
      setMovementPhase((current) =>
        projectAvatarMovementPhaseFromKeys({
          current,
          previousKeys,
          nextKeys: [],
        }),
      );
      stopMouseLook();
    };
    const focus = (event: FocusEvent) => {
      if (!isEditableWorldTarget(event.target)) return;
      const previousKeys = [...activeKeys];
      activeKeys.clear();
      setMovementPhase((current) =>
        projectAvatarMovementPhaseFromKeys({
          current,
          previousKeys,
          nextKeys: [],
        }),
      );
    };
    const release = (event: PointerEvent) => {
      if (event.pointerId === activeLookPointer.current) stopMouseLook();
    };
    const visibility = () => {
      if (document.visibilityState !== "visible") clear();
    };
    const pointerLockChanged = () => {
      const surface = lookSurface.current;
      if (surface && document.pointerLockElement === surface) {
        if (lookRequestPending.current) {
          lookRequestPending.current = false;
          if (activeLookPointer.current !== null) {
            lookOwnsPointerLock.current = true;
            setMouseLookActive(true);
            return;
          }
          document.exitPointerLock();
          setMouseLookActive(false);
        }
        return;
      }
      if (lookOwnsPointerLock.current) {
        lookOwnsPointerLock.current = false;
        activeLookPointer.current = null;
        setMouseLookActive(false);
      }
    };
    const pointerLockError = () => {
      if (!lookRequestPending.current) return;
      lookRequestPending.current = false;
      lookOwnsPointerLock.current = false;
      activeLookPointer.current = null;
      setMouseLookActive(false);
    };
    const look = (event: MouseEvent) => {
      if (
        !lookOwnsPointerLock.current ||
        document.pointerLockElement !== lookSurface.current ||
        activeLookPointer.current === null
      )
        return;
      if ((event.buttons & 2) === 0) {
        stopMouseLook();
        return;
      }
      setCamera((current) =>
        applyWorldCameraLook(current, {
          movementX: event.movementX,
          movementY: event.movementY,
        }),
      );
    };
    const startLook = (event: PointerEvent) => {
      if (
        event.button !== 2 ||
        activeLookPointer.current !== null ||
        isInteractiveMouseTarget(event.target)
      )
        return;
      const room = roomRef.current;
      const surface = document.querySelector<HTMLCanvasElement>(
        'canvas[data-scene-id="world-room"]',
      );
      if (!room || !surface) return;
      setCityFocusPosition(null);
      const pointerId = event.pointerId;
      const requestSequence = lookRequestSequence.current + 1;
      lookRequestSequence.current = requestSequence;
      activeLookPointer.current = pointerId;
      lookSurface.current = surface;
      lookRequestPending.current = true;
      lookOwnsPointerLock.current = false;
      setMouseLookActive(false);
      event.preventDefault();
      room.focus({ preventScroll: true });
      try {
        void Promise.resolve(surface.requestPointerLock())
          .then(() => {
            if (
              lookRequestSequence.current === requestSequence &&
              activeLookPointer.current !== pointerId &&
              document.pointerLockElement === surface
            ) {
              lookRequestPending.current = false;
              document.exitPointerLock();
            }
          })
          .catch(() => {
            if (
              lookRequestSequence.current === requestSequence &&
              lookRequestPending.current
            ) {
              lookRequestPending.current = false;
              lookOwnsPointerLock.current = false;
              if (activeLookPointer.current === pointerId) {
                activeLookPointer.current = null;
                setMouseLookActive(false);
              }
            }
          });
      } catch {
        lookRequestPending.current = false;
        lookOwnsPointerLock.current = false;
        activeLookPointer.current = null;
        setMouseLookActive(false);
      }
    };
    const contextMenu = (event: MouseEvent) => {
      if (
        !roomRef.current?.isConnected ||
        isInteractiveMouseTarget(event.target)
      )
        return;
      event.preventDefault();
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", clear);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("pointerdown", startLook, true);
    window.addEventListener("contextmenu", contextMenu, true);
    document.addEventListener("focusin", focus, true);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerlockchange", pointerLockChanged);
    document.addEventListener("pointerlockerror", pointerLockError);
    document.addEventListener("mousemove", look);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", clear);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("pointerdown", startLook, true);
      window.removeEventListener("contextmenu", contextMenu, true);
      document.removeEventListener("focusin", focus, true);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerlockchange", pointerLockChanged);
      document.removeEventListener("pointerlockerror", pointerLockError);
      document.removeEventListener("mousemove", look);
      activeKeys.clear();
      stopMouseLook(false);
    };
  }, [reducedMotion, stopMouseLook]);

  const projectedUserAction = projectWorldAvatarAction({
    role: "user",
    activity: activity.state,
    movement: movementPhase,
    terminalElapsedMs: 0,
  });
  const projectedAgentAction = projectWorldAvatarAction({
    role: "agent",
    activity: activity.state,
    movement:
      agentMovement.animationSemantic === "Run"
        ? "sprinting"
        : agentMovement.movementState === "moving"
          ? "moving"
          : "idle",
    terminalElapsedMs: expiredTerminalActivity === activity ? 2201 : 0,
  });
  const userLocomotion =
    projectedUserAction === "StartWalk" || projectedUserAction === "Walk"
      ? "Walk"
      : projectedUserAction === "Run"
        ? "Run"
        : "Idle";
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setUserAnimation((current) =>
          setAvatarLocomotion(current, userLocomotion),
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [userLocomotion]);
  const userUsesImported =
    userAvatar.avatarSource?.kind === "imported" &&
    userAvatar.avatarSource.mode === "original";
  const agentUsesImported =
    agentAvatar.avatarSource?.kind === "imported" &&
    agentAvatar.avatarSource.mode === "original";
  const userAction = userUsesImported
    ? userAnimation.semantic
    : projectedUserAction;
  const agentWorkState = deriveAgentRepositoryWorkState(
    agentWorkFocus ?? null,
    agentWorkArrival,
    layoutGeneration,
    reducedMotion,
  );
  const agentAction =
    agentWorkState.state === "coding"
      ? agentUsesImported
        ? "Idle"
        : agentWorkState.action
      : agentUsesImported
        ? agentAnimation.semantic
        : projectedAgentAction;
  const renderedAgentStates = renderedAgents.map((agent, index) => {
    const spawn = WORLD_AGENT_SPAWN_POSITIONS[index]!;
    const binding = agentMovementBindings?.find(
      ({ rosterId }) => rosterId === agent.rosterId,
    );
    const movement =
      index === 0
        ? agentMovement
        : (secondaryMovements[agent.rosterId] ??
          createAgentMovementState(binding?.actorId ?? agent.rosterId, {
            x: spawn.x,
            z: spawn.z,
          }));
    const work =
      index === 0
        ? agentWorkState
        : deriveAgentRepositoryWorkState(
            binding?.workFocus ?? null,
            secondaryArrivals[agent.rosterId] ?? null,
            layoutGeneration,
            reducedMotion,
          );
    const movementAction =
      movement.animationSemantic === "Run"
        ? "Run"
        : movement.movementState === "moving"
          ? "Walk"
          : "Idle";
    return {
      rosterId: agent.rosterId,
      name: agent.name,
      position: movement.position,
      heading: movement.heading,
      action:
        work.state === "coding"
          ? "Work"
          : index === 0 && movement.movementState !== "moving"
            ? agentAction
            : movementAction,
      workState: work.state,
      objectRef: work.objectRef,
    };
  });
  const userImportedAvatar = worldImportedAvatarSelection(
    userAvatar,
    userAction,
    "user",
  );
  const agentImportedAvatar = worldImportedAvatarSelection(
    agentAvatar,
    agentAction,
    "agent",
  );
  const renderedAgentImports = renderedAgents.map(({ avatar }, index) =>
    worldImportedAvatarSelection(
      avatar,
      renderedAgentStates[index]?.action ??
        (index === 0 ? agentAction : "Idle"),
      "agent",
    ),
  );
  const useImportedRenderer =
    Boolean(userImportedAvatar) || renderedAgentImports.some(Boolean);
  const userImportedClip = userImportedAvatar?.resolvedClip;
  const agentImportedClip = agentImportedAvatar?.resolvedClip;
  const staticPoseRefused =
    userImportedClip?.clipName === "unverified-static-pose" ||
    agentImportedClip?.clipName === "unverified-static-pose";
  const userOneShot = userAnimation.oneShot;
  const agentOneShot = agentAnimation.oneShot;
  const userOneShotDuration = userImportedClip?.durationSeconds ?? 0;
  const agentOneShotDuration = agentImportedClip?.durationSeconds ?? 0;
  const userOneShotVerified =
    userImportedClip?.verification === "semantic-review-pass";
  const agentOneShotVerified =
    agentImportedClip?.verification === "semantic-review-pass";
  useEffect(() => {
    const active = [
      [
        "user",
        userOneShot,
        userOneShotDuration,
        userOneShotVerified,
        userAnimation.generation,
      ] as const,
      [
        "agent",
        agentOneShot,
        agentOneShotDuration,
        agentOneShotVerified,
        agentAnimation.generation,
      ] as const,
    ];
    const timers = active.flatMap(
      ([role, oneShot, duration, verified, generation]) => {
        if (!oneShot) return [];
        const delay =
          reducedMotion || noWebGL || !verified
            ? 0
            : Math.ceil((duration + 0.44) * 1_000);
        return [
          window.setTimeout(() => {
            if (role === "user")
              setUserAnimation((current) =>
                completeAvatarOneShot(current, generation),
              );
            else
              setAgentAnimation((current) =>
                completeAvatarOneShot(current, generation),
              );
          }, delay),
        ];
      },
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [
    agentOneShot,
    agentOneShotDuration,
    agentOneShotVerified,
    noWebGL,
    reducedMotion,
    userOneShot,
    userOneShotDuration,
    userOneShotVerified,
    userAnimation.generation,
    agentAnimation.generation,
  ]);
  const completeImportedOneShot = useCallback(
    (role: "user" | "agent", generation: number) => {
      if (role === "user")
        setUserAnimation((current) =>
          completeAvatarOneShot(current, generation),
        );
      else
        setAgentAnimation((current) =>
          completeAvatarOneShot(current, generation),
        );
    },
    [],
  );
  const userLayerState = useMemo(
    () =>
      projectAvatarLayerState({
        action: projectedUserAction,
        reducedMotion,
        speechShape: null,
        gaze: "camera",
      }),
    [projectedUserAction, reducedMotion],
  );
  const agentLayerState = useMemo(
    () =>
      projectAvatarLayerState({
        action: projectedAgentAction,
        reducedMotion,
        speechShape: null,
        gaze:
          activity.state === "tool" || activity.state === "coding"
            ? "work"
            : activity.state === "thinking"
              ? "operator"
              : "camera",
      }),
    [activity.state, projectedAgentAction, reducedMotion],
  );

  return (
    <main
      ref={roomRef}
      className="world-room"
      data-scene-id="world-room"
      data-floor-state={floor}
      data-renderer={noWebGL ? "semantic" : "webgl"}
      data-user-avatar-species={userAvatar.species}
      data-user-avatar-shirt={userAvatar.shirt}
      data-user-avatar-source={
        userAvatar.avatarSource?.kind === "imported" &&
        userAvatar.avatarSource.mode === "modular"
          ? "imported-modular-unavailable"
          : userImportedAvatar
            ? "imported"
            : "custom"
      }
      data-user-avatar-imported-id={userImportedAvatar?.assetId}
      data-user-avatar-rendered-clip-index={userImportedClip?.clipIndex}
      data-user-avatar-rendered-clip={userImportedClip?.clipName}
      data-user-avatar-locomotion={userImportedClip?.locomotion}
      data-user-avatar-semantic={userAnimation.semantic}
      data-user-avatar-cue-source={userAnimation.cueSource}
      data-user-avatar-animation-progression={userAnimation.progression}
      data-user-avatar-animation-verification={userImportedClip?.verification}
      data-user-avatar-animation-error={userImportedClip?.error}
      data-agent-avatar-species={agentAvatar.species}
      data-agent-avatar-shirt={agentAvatar.shirt}
      data-agent-avatar-source={
        agentAvatar.avatarSource?.kind === "imported" &&
        agentAvatar.avatarSource.mode === "modular"
          ? "imported-modular-unavailable"
          : agentImportedAvatar
            ? "imported"
            : "custom"
      }
      data-agent-avatar-imported-id={agentImportedAvatar?.assetId}
      data-agent-avatar-rendered-clip-index={agentImportedClip?.clipIndex}
      data-agent-avatar-rendered-clip={agentImportedClip?.clipName}
      data-agent-avatar-locomotion={agentImportedClip?.locomotion}
      data-agent-avatar-semantic={agentAnimation.semantic}
      data-agent-avatar-cue-source={agentAnimation.cueSource}
      data-agent-avatar-animation-progression={agentAnimation.progression}
      data-agent-avatar-animation-verification={agentImportedClip?.verification}
      data-agent-avatar-animation-error={agentImportedClip?.error}
      data-agent-movement-state={agentMovement.movementState}
      data-agent-movement-source={agentMovement.source ?? "none"}
      data-agent-movement-request={agentMovement.activeRequest?.requestId ?? ""}
      data-agent-position-x={agentMovement.position.x}
      data-agent-position-z={agentMovement.position.z}
      data-agent-heading={agentMovement.heading}
      data-agent-velocity={`${agentMovement.velocity.x},${agentMovement.velocity.z}`}
      data-mouse-look={mouseLookActive ? "active" : "idle"}
      data-camera-yaw={camera.yaw.toFixed(3)}
      data-camera-pitch={camera.pitch.toFixed(3)}
      data-repository-readiness={repositoryReadiness}
      data-repository-city-count={city.instances.length}
      data-repository-city-mode={cityMode}
      data-user-avatar-action={userAction}
      data-agent-avatar-action={agentAction}
      data-agent-work-state={agentWorkState.state}
      data-agent-object-ref={agentWorkState.objectRef ?? ""}
      tabIndex={0}
      aria-label={
        agentWorkState.state === "coding"
          ? `${agentName} coding at ${agentWorkState.repositoryPath}`
          : "AgentIntersect World room. Hold right mouse over the 3D canvas to look. Use W A S D or arrow keys to move, Shift to sprint, and Space to jump."
      }
      onDragOver={(event) => {
        if (cityMode === "director" && floor === "repository")
          event.preventDefault();
      }}
      onDrop={(event) => {
        const assetId = event.dataTransfer.getData(
          "application/x-aiw-repository-asset",
        ) as RepositoryAssetId;
        if (!assetId || cityMode !== "director" || floor !== "repository")
          return;
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        let x = Math.round(
          ((event.clientX - bounds.left) / bounds.width - 0.5) * 30,
        );
        const z = Math.round(
          ((event.clientY - bounds.top) / bounds.height - 0.5) * 30,
        );
        if (Math.hypot(x, z) < 6) x = x < 0 ? -6 : 6;
        addManualCityInstance(assetId, { x, z });
      }}
      onPointerUp={(event) => {
        if (event.pointerId === activeLookPointer.current) stopMouseLook();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === activeLookPointer.current) stopMouseLook();
      }}
    >
      {showControlHints ? (
        <section
          className="world-room__controls"
          aria-label="World controls"
          role="status"
        >
          <span>Hold right mouse on canvas: look · release: stop</span>
          <span>WASD / arrows: move · Shift: sprint · Space: jump</span>
          <strong>
            {mouseLookActive ? "Mouse look active" : "Mouse look idle"}
          </strong>
        </section>
      ) : null}
      {floor === "repository" ? (
        <>
          <RepositoryAssetPalette
            mode={cityMode}
            selected={selectedCityInstance}
            availableWorkstream={availableWorkstream}
            workstream={selectedWorkstream}
            workstreamSource={tracerMode ?? undefined}
            tracerMessage={availableWorkstream ? null : liveTracerMessage}
            onCreateWorkstream={
              tracerMode === "live" &&
              workstreamAuthority &&
              !availableWorkstream &&
              liveTracerMessage === "No current Workstream." &&
              !workstreamActionPending
                ? () => void createWorkstream()
                : undefined
            }
            workstreamTask={workstreamTask}
            workstreamCreateUnavailableReason={
              workstreamCreateUnavailableReason
            }
            onCancelWorkstream={
              tracerMode === "live" && selectedWorkstream?.authority
                ? () => void cancelWorkstream()
                : undefined
            }
            workstreamActionPending={workstreamActionPending}
            onSelectWorkstream={(workstreamId) => {
              setSelectedCityInstanceId(null);
              setSelectedWorkstreamId(workstreamId);
              setCityFocusPosition(null);
            }}
            onMode={setCityMode}
            onPlace={addManualCityInstance}
            onFocus={(instanceId) => {
              const instance = city.instances.find(
                (candidate) => candidate.instanceId === instanceId,
              );
              if (!instance) return;
              setSelectedCityInstanceId(instanceId);
              setSelectedWorkstreamId(null);
              setCityFocusPosition(instance.position);
            }}
            onPin={(instanceId, pinned) =>
              dispatchCity({ type: "pin", instanceId, pinned })
            }
            onRemove={(instanceId) => {
              dispatchCity({ type: "remove", instanceId });
              setSelectedCityInstanceId(null);
              setSelectedWorkstreamId(null);
              setCityFocusPosition(null);
            }}
            onAskAgent={(instance: RepositoryCityInstance) => {
              onAskAgent?.(buildRepositoryExplainPrompt(instance));
            }}
          />
          {cityMode === "director" ? (
            <p className="repository-city-drop-hint" role="status">
              Director grid active · drop an asset outside the center zone
            </p>
          ) : null}
        </>
      ) : null}
      {staticPoseRefused ? (
        <p className="world-room__static-pose-truth" role="status">
          Static source pose · animation semantics unverified
        </p>
      ) : null}
      <div
        className="world-room__activity-semantic"
        data-activity-state={activity.state}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span aria-hidden="true">{activity.icon || "○"}</span>
        <span>{activity.label}</span>
        {activity.detail ? <span>· {activity.detail}</span> : null}
      </div>
      <nav
        className="world-room__agent-targets"
        aria-label="Choose the next message recipient"
      >
        {renderedAgents.map((agent, index) => {
          const position = WORLD_AGENT_SPAWN_POSITIONS[index]!;
          const selected = selectedRecipientId === agent.rosterId;
          return (
            <span
              key={agent.rosterId}
              className="world-room__agent-target-shell"
            >
              <button
                type="button"
                className="world-room__agent-target world-action--enabled"
                aria-label={`Send next message to ${agent.name}`}
                aria-pressed={selected}
                data-spawn={`${position.x},${position.z}`}
                onClick={() => onSelectRecipient?.(agent.rosterId)}
              >
                {agent.name}
              </button>
              {selected ? (
                <button
                  type="button"
                  className="world-room__agent-target-clear"
                  aria-label={`Clear ${agent.name} and send to all agents`}
                  title="Send next message to all agents"
                  onClick={onClearRecipient}
                >
                  ×
                </button>
              ) : null}
            </span>
          );
        })}
      </nav>
      <section className="world-room__semantic" aria-label="World scene status">
        <h1>{floor === "blank" ? "Blank World room" : "Repository floor"}</h1>
        <p>Third-person camera behind {userName}.</p>
        <ul className="world-room__avatars">
          <li>
            {userName} · user avatar · position {userPosition.x},{" "}
            {userPosition.z} ·{" "}
            {userImportedAvatar
              ? `imported ${userImportedAvatar.assetId} · ${userAction} · clip ${(userImportedClip?.clipIndex ?? -1) + 1} ${userImportedClip?.clipName ?? "missing"}`
              : `${userAvatar.species} · ${userAvatar.shirt}`}
          </li>
          {renderedAgents.map((agent, index) => {
            const state = renderedAgentStates[index]!;
            const position = state.position;
            const imported = renderedAgentImports[index];
            const agentActivity = renderedAgentActivities[index]!;
            return (
              <li
                key={agent.rosterId}
                data-roster-id={agent.rosterId}
                data-work-state={state.workState}
                data-object-ref={state.objectRef ?? ""}
                data-activity-state={agentActivity.state}
              >
                <span>
                  {agent.name}
                  {state.workState === "coding"
                    ? ` · coding at ${state.objectRef}`
                    : ""}{" "}
                  · connected agent avatar · position {position.x},{position.z}{" "}
                  ·{" "}
                  {imported
                    ? `imported ${imported.assetId} · ${state.action}`
                    : `${agent.avatar.species} · ${agent.avatar.shirt}`}{" "}
                  · {agentActivity.label}
                </span>
              </li>
            );
          })}
        </ul>
        {floor === "repository" ? (
          <>
            <p>The existing floor is now the current repository landscape.</p>
            <p role="status">
              Repository city {repositoryReadiness} · {city.instances.length}{" "}
              semantic objects.
            </p>
            <ol
              className="world-room__repository-objects"
              aria-label="Repository floor objects"
              tabIndex={0}
            >
              {objects.slice(0, 160).map((object) => (
                <li key={object.ref}>
                  {repositoryVisualFamily(object)}: {object.name}
                </li>
              ))}
            </ol>
            {objects.length > 160 ? (
              <p>{objects.length - 160} additional objects remain in 3D.</p>
            ) : null}
          </>
        ) : (
          <p>The open floor is ready for a repository request.</p>
        )}
        {noWebGL ? (
          <p role="status">
            {modularUnsupported
              ? "Modular 3D avatar refused: layered donor-region rendering is pending verification. No complete donor or custom avatar was substituted."
              : rendererFailure === "load-or-render-error"
                ? "3D avatar loading or rendering failed. Semantic scene active; movement, chat, and repository state remain available."
                : rendererFailure === "context-lost"
                  ? "3D renderer context became unavailable. Semantic scene active; movement, chat, and repository state remain available."
                  : "Semantic scene active. Movement, avatars, chat, and repository state remain available."}
          </p>
        ) : null}
      </section>
      {!noWebGL ? (
        <div className="world-room__canvas-host" aria-hidden="true">
          <WorldCanvasErrorBoundary
            onError={() => {
              setRendererFailure("load-or-render-error");
              setContextLost(true);
              onRepositoryError?.();
            }}
          >
            <Suspense fallback={null}>
              {useImportedRenderer ? (
                <ImportedWorldRoomCanvas
                  floor={floor}
                  objects={objects}
                  cityInstances={city.instances}
                  selectedCityInstanceId={selectedCityInstanceId}
                  cityFocusPosition={cityFocusPosition}
                  userPosition={userPosition}
                  camera={camera}
                  activity={activity}
                  agentActivities={renderedAgentActivities}
                  userAvatar={userAvatar}
                  agentAvatar={agentAvatar}
                  {...(agentAvatars
                    ? { agentAvatars: agentAvatars.map(({ avatar }) => avatar) }
                    : {})}
                  agentStates={renderedAgentStates}
                  userImportedAvatar={userImportedAvatar}
                  agentImportedAvatar={agentImportedAvatar}
                  {...(agentAvatars
                    ? { agentImportedAvatars: renderedAgentImports }
                    : {})}
                  userAction={userAction}
                  agentAction={agentAction}
                  userAnimationGeneration={userAnimation.generation}
                  agentAnimationGeneration={agentAnimation.generation}
                  agentPosition={agentMovement.position}
                  agentHeading={agentMovement.heading}
                  userLayerState={userLayerState}
                  agentLayerState={agentLayerState}
                  reducedMotion={reducedMotion}
                  onImportedOneShotComplete={completeImportedOneShot}
                  onContextLost={() => {
                    setRendererFailure("context-lost");
                    setContextLost(true);
                    onRepositoryError?.();
                  }}
                  onCitySelect={selectCityInstance}
                  onCitySettled={(instanceId) =>
                    dispatchCity({ type: "settled", instanceId })
                  }
                  onCityReady={onRepositoryReady ?? (() => undefined)}
                />
              ) : (
                <WorldRoomCanvas
                  floor={floor}
                  objects={objects}
                  cityInstances={city.instances}
                  selectedCityInstanceId={selectedCityInstanceId}
                  cityFocusPosition={cityFocusPosition}
                  userPosition={userPosition}
                  camera={camera}
                  activity={activity}
                  agentActivities={renderedAgentActivities}
                  userAvatar={userAvatar}
                  agentAvatar={agentAvatar}
                  {...(agentAvatars
                    ? { agentAvatars: agentAvatars.map(({ avatar }) => avatar) }
                    : {})}
                  agentStates={renderedAgentStates}
                  userAction={userAction}
                  agentAction={agentAction}
                  userLayerState={userLayerState}
                  agentLayerState={agentLayerState}
                  reducedMotion={reducedMotion}
                  onContextLost={() => {
                    setRendererFailure("context-lost");
                    setContextLost(true);
                    onRepositoryError?.();
                  }}
                  onCitySelect={selectCityInstance}
                  onCitySettled={(instanceId) =>
                    dispatchCity({ type: "settled", instanceId })
                  }
                  onCityReady={onRepositoryReady ?? (() => undefined)}
                />
              )}
            </Suspense>
          </WorldCanvasErrorBoundary>
        </div>
      ) : null}
    </main>
  );
}

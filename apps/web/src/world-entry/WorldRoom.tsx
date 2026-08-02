import {
  repositoryVisualFamily,
  resolveWebGLCapability,
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
  useRef,
  useState,
  type ReactNode,
} from "react";

import { isOperatorMovementKey } from "../world-actions/operator-navigation.js";
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
import {
  advanceAgentMovement,
  cancelAgentMovement,
  createAgentMovementState,
  requestAgentMovement,
  type AgentMovementEvent,
  type AgentMovementRequest,
  type AgentMovementState,
  type RepositoryApproachPoint,
} from "./world-agent-movement-model.js";

const WorldRoomCanvas = lazy(async () => {
  const module = await import("@agentintersect-world/renderer-r3f/world-room");
  return { default: module.WorldRoomCanvas };
});
const ImportedWorldRoomCanvas = lazy(async () => {
  const module =
    await import("@agentintersect-world/renderer-r3f/world-room-imported");
  return { default: module.WorldRoomCanvas };
});

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

export function WorldRoom({
  floor,
  objects,
  reducedMotion,
  forceNoWebGL,
  userName,
  agentName,
  userAvatar,
  agentAvatar,
  activity,
  userCue,
  agentCue,
  agentActorId,
  agentMovementRequest,
  agentMovementCancellationGeneration = 0,
  layoutGeneration = "blank-world",
  onAgentMovementEvent,
  showControlHints = true,
}: {
  readonly floor: "blank" | "repository";
  readonly objects: readonly RepositoryRenderObject[];
  readonly reducedMotion: boolean;
  readonly forceNoWebGL: boolean;
  readonly userName: string;
  readonly agentName: string;
  readonly userAvatar: AvatarDraft;
  readonly agentAvatar: AvatarDraft;
  readonly activity: WorldActivity;
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
  readonly agentMovementCancellationGeneration?: number | undefined;
  readonly layoutGeneration?: string | undefined;
  readonly onAgentMovementEvent?:
    | ((event: AgentMovementEvent, position: { x: number; z: number }) => void)
    | undefined;
  readonly showControlHints?: boolean;
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
  const resolvedAgentActorId = agentActorId ?? "agent-local";
  const [agentMovement, setAgentMovement] = useState<AgentMovementState>(() =>
    createAgentMovementState(resolvedAgentActorId, { x: 2.5, z: 1 }),
  );
  const agentMovementRef = useRef(agentMovement);
  const handledAgentMovementRequest = useRef<string | null>(null);
  const handledAgentMovementCancellation = useRef(0);
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
  const modularUnsupported =
    (userAvatar.avatarSource?.kind === "imported" &&
      userAvatar.avatarSource.mode === "modular") ||
    (agentAvatar.avatarSource?.kind === "imported" &&
      agentAvatar.avatarSource.mode === "modular");
  const noWebGL = forceNoWebGL || contextLost || modularUnsupported;
  useEffect(() => {
    userAnimationRef.current = userAnimation;
  }, [userAnimation]);
  useEffect(() => {
    agentMovementRef.current = agentMovement;
  }, [agentMovement]);
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
        const object = objects.find(({ ref }) => ref === objectId);
        return object
          ? {
              objectId,
              layoutGeneration,
              position: { x: object.position.x, z: object.position.z },
              hidden: false,
              reachable: true,
            }
          : null;
      },
    }),
    [layoutGeneration, objects, userPosition],
  );
  const agentMovementContextRef = useRef(agentMovementContext);
  useEffect(() => {
    agentMovementContextRef.current = agentMovementContext;
  }, [agentMovementContext]);
  useEffect(() => {
    if (
      !agentMovementRequest ||
      handledAgentMovementRequest.current === agentMovementRequest.requestId
    )
      return;
    handledAgentMovementRequest.current = agentMovementRequest.requestId;
    const result = requestAgentMovement(
      agentMovementRef.current,
      agentMovementRequest,
      agentMovementContextRef.current,
    );
    agentMovementRef.current = result.state;
    setAgentMovement(result.state);
    setAgentAnimation((current) =>
      setAvatarLocomotion(current, result.state.animationSemantic),
    );
    for (const movementEvent of result.events)
      onAgentMovementEventRef.current?.(movementEvent, result.state.position);
  }, [agentMovementRequest]);
  useEffect(() => {
    if (
      agentMovementCancellationGeneration <=
      handledAgentMovementCancellation.current
    )
      return;
    handledAgentMovementCancellation.current =
      agentMovementCancellationGeneration;
    const result = cancelAgentMovement(
      agentMovementRef.current,
      "user-directed-stop",
      agentMovementContextRef.current,
    );
    agentMovementRef.current = result.state;
    setAgentMovement(result.state);
    setAgentAnimation((current) => setAvatarLocomotion(current, "Idle"));
    for (const movementEvent of result.events)
      onAgentMovementEventRef.current?.(movementEvent, result.state.position);
  }, [agentMovementCancellationGeneration]);
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
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", clear);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
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
  const agentAction = agentUsesImported
    ? agentAnimation.semantic
    : projectedAgentAction;
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
      data-user-avatar-action={userAction}
      data-agent-avatar-action={agentAction}
      tabIndex={0}
      aria-label="AgentIntersect World room. Hold right mouse over the 3D canvas to look. Use W A S D or arrow keys to move, Shift to sprint, and Space to jump."
      onPointerDown={(event) => {
        if (event.button !== 2 || !(event.target instanceof HTMLCanvasElement))
          return;
        const surface = event.target;
        const pointerId = event.pointerId;
        const requestSequence = lookRequestSequence.current + 1;
        lookRequestSequence.current = requestSequence;
        activeLookPointer.current = pointerId;
        lookSurface.current = surface;
        lookRequestPending.current = true;
        lookOwnsPointerLock.current = false;
        setMouseLookActive(false);
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
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
      }}
      onPointerUp={(event) => {
        if (event.pointerId === activeLookPointer.current) stopMouseLook();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === activeLookPointer.current) stopMouseLook();
      }}
      onContextMenu={(event) => {
        if (event.target === lookSurface.current) event.preventDefault();
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
          <li>
            {agentName} · connected agent avatar ·{" "}
            {agentImportedAvatar
              ? `imported ${agentImportedAvatar.assetId} · ${agentAction} · clip ${(agentImportedClip?.clipIndex ?? -1) + 1} ${agentImportedClip?.clipName ?? "missing"}`
              : `${agentAvatar.species} · ${agentAvatar.shirt}`}
          </li>
        </ul>
        {floor === "repository" ? (
          <>
            <p>The existing floor is now the current repository landscape.</p>
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
            }}
          >
            <Suspense fallback={null}>
              {userImportedAvatar || agentImportedAvatar ? (
                <ImportedWorldRoomCanvas
                  floor={floor}
                  objects={objects}
                  userPosition={userPosition}
                  camera={camera}
                  activity={activity}
                  userAvatar={userAvatar}
                  agentAvatar={agentAvatar}
                  userImportedAvatar={userImportedAvatar}
                  agentImportedAvatar={agentImportedAvatar}
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
                  }}
                />
              ) : (
                <WorldRoomCanvas
                  floor={floor}
                  objects={objects}
                  userPosition={userPosition}
                  camera={camera}
                  activity={activity}
                  userAvatar={userAvatar}
                  agentAvatar={agentAvatar}
                  userAction={userAction}
                  agentAction={agentAction}
                  userLayerState={userLayerState}
                  agentLayerState={agentLayerState}
                  reducedMotion={reducedMotion}
                  onContextLost={() => {
                    setRendererFailure("context-lost");
                    setContextLost(true);
                  }}
                />
              )}
            </Suspense>
          </WorldCanvasErrorBoundary>
        </div>
      ) : null}
    </main>
  );
}

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
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { isOperatorMovementKey } from "../world-actions/operator-navigation.js";
import type { WorldActivity } from "./world-chat-model.js";
import {
  applyWorldCameraLook,
  isEditableWorldTarget,
  moveWorldPosition,
  type WorldCameraLook,
} from "./world-navigation-model.js";

const WorldRoomCanvas = lazy(async () => {
  const module = await import("@agentintersect-world/renderer-r3f/world-room");
  return { default: module.WorldRoomCanvas };
});

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
}) {
  const roomRef = useRef<HTMLElement>(null);
  const pressedKeys = useRef(new Set<string>());
  const lastFrame = useRef<number | null>(null);
  const [contextLost, setContextLost] = useState(
    () => forceNoWebGL || !resolveWebGLCapability().available,
  );
  const [userPosition, setUserPosition] = useState({ x: 0, z: 0 });
  const [movementPhase, setMovementPhase] =
    useState<AvatarMovementPhase>("idle");
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
  const noWebGL = forceNoWebGL || contextLost;
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
    if (movementPhase !== "starting" && movementPhase !== "moving") return;
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
      if (key === "escape" && activeLookPointer.current !== null) {
        stopMouseLook();
        return;
      }
      if (key === "shift" || isOperatorMovementKey(key)) {
        const alreadyMoving = [...activeKeys].some(isOperatorMovementKey);
        activeKeys.add(key);
        if (isOperatorMovementKey(key)) {
          if (!alreadyMoving) setMovementPhase("starting");
          event.preventDefault();
        }
      }
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLocaleLowerCase();
      activeKeys.delete(key);
      if (
        isOperatorMovementKey(key) &&
        ![...activeKeys].some(isOperatorMovementKey)
      )
        setMovementPhase("stopping");
    };
    const clear = () => {
      if ([...activeKeys].some(isOperatorMovementKey))
        setMovementPhase("stopping");
      activeKeys.clear();
      stopMouseLook();
    };
    const focus = (event: FocusEvent) => {
      if (!isEditableWorldTarget(event.target)) return;
      if ([...activeKeys].some(isOperatorMovementKey))
        setMovementPhase("stopping");
      activeKeys.clear();
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
  }, [stopMouseLook]);

  const userAction = projectWorldAvatarAction({
    role: "user",
    activity: activity.state,
    movement: movementPhase,
    terminalElapsedMs: 0,
  });
  const agentAction = projectWorldAvatarAction({
    role: "agent",
    activity: activity.state,
    movement: "idle",
    terminalElapsedMs: expiredTerminalActivity === activity ? 2201 : 0,
  });
  const userLayerState = useMemo(
    () =>
      projectAvatarLayerState({
        action: userAction,
        reducedMotion,
        speechShape: null,
        gaze: "camera",
      }),
    [reducedMotion, userAction],
  );
  const agentLayerState = useMemo(
    () =>
      projectAvatarLayerState({
        action: agentAction,
        reducedMotion,
        speechShape: null,
        gaze:
          activity.state === "tool" || activity.state === "coding"
            ? "work"
            : activity.state === "thinking"
              ? "operator"
              : "camera",
      }),
    [activity.state, agentAction, reducedMotion],
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
      data-agent-avatar-species={agentAvatar.species}
      data-agent-avatar-shirt={agentAvatar.shirt}
      data-mouse-look={mouseLookActive ? "active" : "idle"}
      data-camera-yaw={camera.yaw.toFixed(3)}
      data-camera-pitch={camera.pitch.toFixed(3)}
      data-user-avatar-action={userAction}
      data-agent-avatar-action={agentAction}
      tabIndex={0}
      aria-label="AgentIntersect World room. Hold right mouse over the 3D canvas to look. Use W A S D or arrow keys to move and Shift to sprint."
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
      <section
        className="world-room__controls"
        aria-label="World controls"
        role="status"
      >
        <span>Hold right mouse on canvas: look · release: stop</span>
        <span>WASD / arrows: move · Shift: sprint</span>
        <strong>
          {mouseLookActive ? "Mouse look active" : "Mouse look idle"}
        </strong>
      </section>
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
            {userPosition.z} · {userAvatar.species} · {userAvatar.shirt}
          </li>
          <li>
            {agentName} · connected agent avatar · {agentAvatar.species} ·{" "}
            {agentAvatar.shirt}
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
            Semantic scene active. Movement, avatars, chat, and repository state
            remain available.
          </p>
        ) : null}
      </section>
      {!noWebGL ? (
        <div className="world-room__canvas-host" aria-hidden="true">
          <Suspense fallback={null}>
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
              onContextLost={() => setContextLost(true)}
            />
          </Suspense>
        </div>
      ) : null}
    </main>
  );
}

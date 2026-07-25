import {
  resolveWebGLCapability,
  type RepositoryRenderObject,
} from "@agentintersect-world/renderer-r3f";
import type { AvatarDraft } from "@agentintersect-world/avatar-system";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
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
  const [camera, setCamera] = useState<WorldCameraLook>({
    yaw: 0,
    pitch: 0.35,
  });
  const cameraRef = useRef(camera);
  const [pointerState, setPointerState] = useState<
    "unlocked" | "requesting" | "locked" | "denied" | "unavailable"
  >("unlocked");
  const noWebGL = forceNoWebGL || contextLost;
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    let frame = 0;
    const tick = (timestamp: number) => {
      const previous = lastFrame.current ?? timestamp;
      lastFrame.current = timestamp;
      const elapsedSeconds = Math.min(0.1, (timestamp - previous) / 1_000);
      if (pressedKeys.current.size > 0)
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
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (isEditableWorldTarget(event.target)) return;
      const key = event.key.toLocaleLowerCase();
      if (key === "escape" && document.pointerLockElement === roomRef.current) {
        document.exitPointerLock?.();
        return;
      }
      if (key === "shift" || isOperatorMovementKey(key)) {
        pressedKeys.current.add(key);
        if (isOperatorMovementKey(key)) event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      pressedKeys.current.delete(event.key.toLocaleLowerCase());
    };
    const clear = () => pressedKeys.current.clear();
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", clear);
    };
  }, []);

  useEffect(() => {
    const changed = () =>
      setPointerState(
        document.pointerLockElement === roomRef.current ? "locked" : "unlocked",
      );
    const denied = () => setPointerState("denied");
    const mouseLook = (event: MouseEvent) => {
      if (document.pointerLockElement !== roomRef.current) return;
      setCamera((current) =>
        applyWorldCameraLook(current, {
          movementX: event.movementX,
          movementY: event.movementY,
        }),
      );
    };
    document.addEventListener("pointerlockchange", changed);
    document.addEventListener("pointerlockerror", denied);
    document.addEventListener("mousemove", mouseLook);
    return () => {
      document.removeEventListener("pointerlockchange", changed);
      document.removeEventListener("pointerlockerror", denied);
      document.removeEventListener("mousemove", mouseLook);
    };
  }, []);

  const requestMouseLook = useCallback(() => {
    const room = roomRef.current;
    if (!room || document.pointerLockElement === room) return;
    if (typeof room.requestPointerLock !== "function") {
      setPointerState("unavailable");
      room.focus();
      return;
    }
    setPointerState("requesting");
    try {
      const request = room.requestPointerLock();
      if (request && typeof request.catch === "function")
        void request.catch(() => setPointerState("denied"));
    } catch {
      setPointerState("denied");
    }
  }, []);

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
      data-pointer-lock={pointerState}
      data-camera-yaw={camera.yaw.toFixed(3)}
      data-camera-pitch={camera.pitch.toFixed(3)}
      tabIndex={0}
      aria-label="AgentIntersect World room. Click the World for mouse look. Use W A S D or arrow keys to move and Shift to sprint."
      onPointerDown={(event) => {
        if (event.button === 0) requestMouseLook();
      }}
    >
      <section
        className="world-room__controls"
        aria-label="World controls"
        role="status"
      >
        <span>Click World: mouse look · Esc: release</span>
        <span>WASD / arrows: move · Shift: sprint</span>
        <strong>
          {pointerState === "locked"
            ? "Mouse look locked"
            : pointerState === "requesting"
              ? "Requesting mouse look"
              : pointerState === "denied"
                ? "Mouse look denied · keyboard ready"
                : pointerState === "unavailable"
                  ? "Mouse look unavailable · keyboard ready"
                  : "Mouse look unlocked"}
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
                  {object.kind}: {object.name}
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
              reducedMotion={reducedMotion}
              onContextLost={() => setContextLost(true)}
            />
          </Suspense>
        </div>
      ) : null}
    </main>
  );
}

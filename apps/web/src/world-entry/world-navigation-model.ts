import type { AvatarMovementPhase } from "@agentintersect-world/avatar-system";

import { isOperatorMovementKey } from "../world-actions/operator-navigation.js";

const bounded = (value: number) => Math.max(-15, Math.min(15, value));
const quantized = (value: number) => {
  const result = Math.round(value * 1_000) / 1_000;
  return Object.is(result, -0) ? 0 : result;
};

export type WorldCameraLook = {
  readonly yaw: number;
  readonly pitch: number;
};

export function projectAvatarMovementPhaseFromKeys({
  current,
  previousKeys,
  nextKeys,
}: {
  readonly current: AvatarMovementPhase;
  readonly previousKeys: readonly string[];
  readonly nextKeys: readonly string[];
}): AvatarMovementPhase {
  const previousMoving = previousKeys.some(isOperatorMovementKey);
  const nextMoving = nextKeys.some(isOperatorMovementKey);
  if (!nextMoving) return previousMoving ? "stopping" : current;
  if (nextKeys.includes("shift")) return "sprinting";
  if (!previousMoving || current === "idle" || current === "stopping")
    return "starting";
  return current === "starting" ? "starting" : "moving";
}

export function isEditableWorldTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const candidate = target as {
    readonly tagName?: unknown;
    readonly isContentEditable?: unknown;
  };
  const tagName =
    typeof candidate.tagName === "string"
      ? candidate.tagName.toLocaleLowerCase()
      : "";
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "button" ||
    tagName === "a" ||
    candidate.isContentEditable === true
  );
}

export function shouldConsumeWorldJump({
  key,
  repeat,
  target,
  worldActive,
  dialogOpen,
  escapeMenuOpen,
  oneShotActive,
}: {
  readonly key: string;
  readonly repeat: boolean;
  readonly target: unknown;
  readonly worldActive: boolean;
  readonly dialogOpen: boolean;
  readonly escapeMenuOpen: boolean;
  readonly oneShotActive: boolean;
}): boolean {
  return (
    (key === " " || key === "Spacebar") &&
    !repeat &&
    worldActive &&
    !dialogOpen &&
    !escapeMenuOpen &&
    !oneShotActive &&
    !isEditableWorldTarget(target)
  );
}

export function applyWorldCameraLook(
  camera: WorldCameraLook,
  input: { readonly movementX: number; readonly movementY: number },
): WorldCameraLook {
  const pitchLimit = Math.PI / 2 - 0.1;
  return {
    yaw: camera.yaw + input.movementX * 0.0025,
    pitch: Math.max(
      -pitchLimit,
      Math.min(pitchLimit, camera.pitch + input.movementY * 0.0025),
    ),
  };
}

export function moveWorldPosition({
  position,
  keys,
  yaw,
  elapsedSeconds,
  sprint,
}: {
  readonly position: Readonly<{ x: number; z: number }>;
  readonly keys: readonly string[];
  readonly yaw: number;
  readonly elapsedSeconds: number;
  readonly sprint: boolean;
}): { readonly x: number; readonly z: number } {
  const normalized = new Set(keys.map((key) => key.toLocaleLowerCase()));
  const forwardInput =
    Number(normalized.has("w") || normalized.has("arrowup")) -
    Number(normalized.has("s") || normalized.has("arrowdown"));
  const rightInput =
    Number(normalized.has("d") || normalized.has("arrowright")) -
    Number(normalized.has("a") || normalized.has("arrowleft"));
  if (forwardInput === 0 && rightInput === 0) return position;
  const length = Math.hypot(forwardInput, rightInput);
  const forward = { x: Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), z: Math.sin(yaw) };
  const distance = Math.max(0, elapsedSeconds) * (sprint ? 12 : 6);
  return {
    x: quantized(
      bounded(
        position.x +
          ((forward.x * forwardInput + right.x * rightInput) / length) *
            distance,
      ),
    ),
    z: quantized(
      bounded(
        position.z +
          ((forward.z * forwardInput + right.z * rightInput) / length) *
            distance,
      ),
    ),
  };
}

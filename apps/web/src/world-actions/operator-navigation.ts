import type { WorldSnapshot } from "@agentintersect-world/world-schema";

import type { NavigationState } from "./world-action-model.js";

const OPERATOR_MOVEMENT_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
]);

export function isOperatorMovementKey(key: string): boolean {
  return OPERATOR_MOVEMENT_KEYS.has(key.toLowerCase());
}

export function shouldInterruptOperatorMovement(
  navigation: NavigationState,
): boolean {
  return (
    navigation.pointerLocked ||
    navigation.follow ||
    navigation.agentMotion === "path-planned" ||
    navigation.agentMotion === "moving"
  );
}

const quantizePosition = (value: number) => Math.round(value * 1_000) / 1_000;

export function moveOperatorPosition({
  snapshot,
  selectedRef,
  currentPosition,
  direction,
  noWebGL,
  yawRadians = 0,
}: {
  readonly snapshot: WorldSnapshot;
  readonly selectedRef: string | null;
  readonly currentPosition: { readonly x: number; readonly z: number } | null;
  readonly direction: "forward" | "left" | "back" | "right";
  readonly noWebGL: boolean;
  readonly yawRadians?: number;
}): {
  readonly position: { readonly x: number; readonly z: number } | null;
  readonly moved: boolean;
  readonly status: string;
} {
  if (noWebGL)
    return {
      position: null,
      moved: false,
      status:
        "Semantic movement selected; physical movement is not claimed without WebGL.",
    };
  const selected = snapshot.objects.find(
    (object) => object.ref === selectedRef && object.kind !== "tombstone",
  );
  const fallback =
    selected ?? snapshot.objects.find(({ kind }) => kind !== "tombstone");
  if (!currentPosition && !fallback)
    return {
      position: null,
      moved: false,
      status: "Manual movement is unavailable in the empty World snapshot.",
    };
  const start =
    currentPosition ??
    ({
      x: fallback!.bounds.x + fallback!.bounds.width / 2,
      z: fallback!.bounds.z + fallback!.bounds.depth / 2,
    } as const);
  const bounds = snapshot.objects.reduce(
    (value, object) => ({
      minimumX: Math.min(value.minimumX, object.bounds.x),
      maximumX: Math.max(value.maximumX, object.bounds.x + object.bounds.width),
      minimumZ: Math.min(value.minimumZ, object.bounds.z),
      maximumZ: Math.max(value.maximumZ, object.bounds.z + object.bounds.depth),
    }),
    {
      minimumX: start.x - 1,
      maximumX: start.x + 1,
      minimumZ: start.z - 1,
      maximumZ: start.z + 1,
    },
  );
  const forward = { x: Math.sin(yawRadians), z: -Math.cos(yawRadians) };
  const right = { x: Math.cos(yawRadians), z: Math.sin(yawRadians) };
  const vector = {
    forward,
    left: { x: -right.x, z: -right.z },
    back: { x: -forward.x, z: -forward.z },
    right,
  }[direction];
  const delta = { x: vector.x * 0.75, z: vector.z * 0.75 };
  const position = {
    x: quantizePosition(
      Math.min(bounds.maximumX, Math.max(bounds.minimumX, start.x + delta.x)),
    ),
    z: quantizePosition(
      Math.min(bounds.maximumZ, Math.max(bounds.minimumZ, start.z + delta.z)),
    ),
  };
  return {
    position,
    moved: position.x !== start.x || position.z !== start.z,
    status: `Operator moved ${direction} to (${position.x}, ${position.z}); no agent arrival is implied.`,
  };
}

export function performOperatorTeleport({
  snapshot,
  selectedRef,
  noWebGL,
  onAgentPosition,
  onSelect,
  onFocus,
}: {
  readonly snapshot: WorldSnapshot;
  readonly selectedRef: string | null;
  readonly noWebGL: boolean;
  readonly onAgentPosition: (
    position: { readonly x: number; readonly z: number } | null,
  ) => void;
  readonly onSelect: (ref: string) => void;
  readonly onFocus: (ref: string) => void;
}): string {
  const target = snapshot.objects.find(
    (object) => object.ref === selectedRef && object.kind !== "tombstone",
  );
  if (!target)
    return "Teleport target is unavailable in the exact current World snapshot.";
  if (noWebGL) {
    onSelect(target.ref);
    onFocus(target.ref);
    return "Semantic focus moved to the selected target; physical arrival is not claimed without WebGL.";
  }
  const interactionPosition = {
    x: quantizePosition(target.bounds.x + target.bounds.width / 2),
    z: quantizePosition(target.bounds.z - 0.75),
  };
  onAgentPosition(interactionPosition);
  onSelect(target.ref);
  onFocus(target.ref);
  return "Operator-invoked Teleport moved the visible actor to the exact selected interaction zone.";
}

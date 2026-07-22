import type { NavigationState } from "./world-action-model.js";
import type { WorldActionInterruptReason } from "./world-action-executor.js";

export function stopWorldActionLifecycle({
  navigation,
  reason,
  animationFrame,
  cancelFrame,
  exitPointerLock,
  postInterrupt,
}: {
  readonly navigation: NavigationState;
  readonly reason: WorldActionInterruptReason;
  readonly animationFrame: number | null;
  readonly cancelFrame: (handle: number) => void;
  readonly exitPointerLock: () => void;
  readonly postInterrupt: (reason: WorldActionInterruptReason) => void;
}): NavigationState {
  if (animationFrame !== null) cancelFrame(animationFrame);
  if (navigation.pointerLocked) exitPointerLock();
  const ownsActiveWork =
    animationFrame !== null ||
    navigation.pointerLocked ||
    navigation.follow ||
    navigation.agentMotion === "path-planned" ||
    navigation.agentMotion === "moving";
  if (ownsActiveWork) postInterrupt(reason);
  return {
    ...navigation,
    cameraMode: navigation.pointerLocked
      ? "third-person"
      : navigation.cameraMode,
    pointerLocked: false,
    follow: false,
    photo: false,
    agentMotion:
      navigation.agentMotion === "path-planned" ||
      navigation.agentMotion === "moving"
        ? "interrupted"
        : navigation.agentMotion,
    interruptionReason: reason,
  };
}

export type CameraMode = "third-person" | "first-person" | "photo";
export type AgentMotion =
  | "idle"
  | "requested"
  | "attention"
  | "path-planned"
  | "moving"
  | "arrived"
  | "blocked"
  | "interrupted"
  | "superseded";

export type NavigationState = {
  readonly cameraMode: CameraMode;
  readonly pointerLocked: boolean;
  readonly follow: boolean;
  readonly photo: boolean;
  readonly agentMotion: AgentMotion;
  readonly interruptionReason: string | null;
  readonly shellFocusRequested: boolean;
};

export const DEFAULT_NAVIGATION_STATE: NavigationState = Object.freeze({
  cameraMode: "third-person",
  pointerLocked: false,
  follow: false,
  photo: false,
  agentMotion: "idle",
  interruptionReason: null,
  shellFocusRequested: false,
});

export type ComfortPreferences = {
  readonly sensitivity: number;
  readonly fieldOfView: number;
  readonly invertedY: boolean;
  readonly easing: number;
  readonly cosmeticMotion: boolean;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(value) ? value : minimum),
  );

export function clampComfortPreferences(
  value: ComfortPreferences,
): ComfortPreferences {
  return {
    sensitivity: clamp(value.sensitivity, 0.1, 2),
    fieldOfView: clamp(value.fieldOfView, 60, 100),
    invertedY: value.invertedY,
    easing: clamp(value.easing, 0, 1),
    cosmeticMotion: value.cosmeticMotion,
  };
}

export type NavigationEvent =
  | { readonly type: "operator-move" }
  | { readonly type: "escape" }
  | { readonly type: "enter-first-person" }
  | { readonly type: "third-person" }
  | { readonly type: "photo" }
  | { readonly type: "follow"; readonly enabled: boolean }
  | { readonly type: "agent-motion"; readonly state: AgentMotion };

export function applyNavigationEvent(
  state: NavigationState,
  event: NavigationEvent,
): NavigationState {
  if (event.type === "escape" || event.type === "operator-move") {
    return {
      ...state,
      cameraMode: event.type === "escape" ? "third-person" : state.cameraMode,
      pointerLocked: false,
      follow: false,
      photo: false,
      agentMotion:
        state.agentMotion === "moving" || state.agentMotion === "path-planned"
          ? "interrupted"
          : state.agentMotion,
      interruptionReason:
        event.type === "escape" ? "escape" : "operator-movement",
      shellFocusRequested: event.type === "escape",
    };
  }
  if (event.type === "enter-first-person") {
    return {
      ...state,
      cameraMode: "first-person",
      pointerLocked: true,
      photo: false,
      shellFocusRequested: false,
    };
  }
  if (event.type === "third-person") {
    return {
      ...state,
      cameraMode: "third-person",
      pointerLocked: false,
      photo: false,
    };
  }
  if (event.type === "photo") {
    return {
      ...state,
      cameraMode: "photo",
      pointerLocked: false,
      photo: true,
      follow: false,
    };
  }
  if (event.type === "follow")
    return { ...state, follow: event.enabled, photo: false };
  return { ...state, agentMotion: event.state, interruptionReason: null };
}

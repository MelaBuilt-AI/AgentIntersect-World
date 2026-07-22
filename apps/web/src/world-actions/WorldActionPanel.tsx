import type { WorldSnapshot } from "@agentintersect-world/world-schema";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import {
  DEFAULT_NAVIGATION_STATE,
  applyNavigationEvent,
  clampComfortPreferences,
  type AgentMotion,
  type ComfortPreferences,
  type NavigationState,
} from "./world-action-model.js";
import {
  isOperatorMovementKey,
  moveOperatorPosition,
  performOperatorTeleport,
  shouldInterruptOperatorMovement,
} from "./operator-navigation.js";
import { resolveCanonicalTourTargets } from "./tour-targets.js";
import {
  createWorldActionExecutor,
  type WorldActionExecution,
  type WorldActionExecutor,
  type WorldActionInterruptReason,
} from "./world-action-executor.js";
import { stopWorldActionLifecycle } from "./world-action-lifecycle.js";

export type WorldActionTimelineItem = {
  readonly actionId: string;
  readonly batchId: string;
  readonly kind: string;
  readonly requestedTarget: string | null;
  readonly state: AgentMotion | "cancelled";
  readonly attention: boolean;
  readonly arrived: boolean;
  readonly continuity: "current" | "previous-recovered";
  readonly reason?: string;
  readonly requestedPath?: string;
  readonly currentPath?: string;
  readonly pinned: boolean;
  readonly trace?: {
    readonly graphGeneration: string;
    readonly objects: readonly string[];
    readonly edges: readonly {
      readonly ref: string;
      readonly sourceRef: string;
      readonly targetRef: string;
      readonly confidence: string;
      readonly evidenceRef: string;
      readonly status: "confirmed" | "candidate" | "unavailable";
    }[];
    readonly confirmedPath: readonly string[];
    readonly truncation: {
      readonly shownObjects: number;
      readonly totalObjects: number;
      readonly shownEdges: number;
      readonly totalEdges: number;
      readonly reason: string;
    } | null;
  };
};

export type WorldActionViewState = {
  readonly capability:
    | { readonly enabled: true }
    | { readonly enabled: false; readonly reason: string };
  readonly navigation: NavigationState;
  readonly preferences: ComfortPreferences;
  readonly reducedMotion: boolean;
  readonly noWebGL: boolean;
  readonly mobile: boolean;
  readonly currentStatus: string;
  readonly previousStatus: string | null;
  readonly timeline: readonly WorldActionTimelineItem[];
  readonly trace: {
    readonly graphGeneration: string;
    readonly relationships: readonly {
      readonly confidence: string;
      readonly status: "confirmed" | "candidate" | "unavailable";
      readonly evidenceRef: string;
      readonly sourceRef: string;
      readonly targetRef: string;
    }[];
    readonly shownObjects: number;
    readonly totalObjects: number;
    readonly shownEdges: number;
    readonly totalEdges: number;
    readonly confirmedHops: number;
    readonly truncated: boolean;
  };
};

const noop = () => undefined;

// Test/Storybook helpers are intentionally colocated with the bounded view model.
// eslint-disable-next-line react-refresh/only-export-components
export function deriveCurrentActionTruth(
  timeline: readonly WorldActionTimelineItem[],
) {
  const newest = timeline.find(({ continuity }) => continuity === "current");
  const current = newest
    ? timeline.filter(
        ({ continuity, batchId }) =>
          continuity === "current" && batchId === newest.batchId,
      )
    : [];
  return {
    requested: current.some(({ state }) => state === "requested"),
    attention: current.some(({ attention }) => attention),
    pathPlanned: current.some(({ state }) => state === "path-planned"),
    moving: current.some(({ state }) => state === "moving"),
    arrived: current.some(({ arrived }) => arrived),
    blocked: current.some(({ state }) => state === "blocked"),
    interrupted: current.some(({ state }) => state === "interrupted"),
    superseded: current.some(({ state }) => state === "superseded"),
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function describeTimelineOutcome(
  action: WorldActionTimelineItem,
): string {
  const continuity =
    action.continuity === "previous-recovered"
      ? "Previous / recovered"
      : "Current";
  return `${continuity}: ${action.kind} · ${action.state} · ${
    action.arrived ? "physically arrived" : "not arrived"
  }${action.reason ? ` · ${action.reason}` : ""}`;
}

export function WorldActionExperience({
  state,
  onCamera = noop,
  onFollow = noop,
  onTour = noop,
  onMove = noop,
  onFocus = noop,
  onTeleport = noop,
  onCancel = noop,
  onReplay = noop,
  onPin = noop,
  onClear = noop,
  onPreferences = noop,
}: {
  readonly state: WorldActionViewState;
  readonly onCamera?: (mode: "third-person" | "first-person" | "photo") => void;
  readonly onFollow?: () => void;
  readonly onTour?: () => void;
  readonly onMove?: (direction: "forward" | "left" | "back" | "right") => void;
  readonly onFocus?: () => void;
  readonly onTeleport?: () => void;
  readonly onCancel?: (actionId?: string) => void;
  readonly onReplay?: (actionId: string) => void;
  readonly onPin?: (actionId: string, pinned: boolean) => void;
  readonly onClear?: () => void;
  readonly onPreferences?: (preferences: ComfortPreferences) => void;
}) {
  const truth = deriveCurrentActionTruth(state.timeline);
  const labels = [
    ["Requested target", truth.requested],
    ["Semantic attention", truth.attention],
    ["Path planned", truth.pathPlanned],
    ["Moving", truth.moving],
    ["Arrived", truth.arrived],
    ["Blocked", truth.blocked],
    ["Interrupted", truth.interrupted],
    ["Superseded", truth.superseded],
  ] as const;
  return (
    <section className="world-actions" aria-labelledby="world-actions-title">
      <header>
        <span className="terminal-kicker">
          Phase 13 · aiw.world-action/0.13
        </span>
        <h3 id="world-actions-title">Embodied navigation and World Actions</h3>
        <p>
          Presentation only. Actions cannot edit files, run commands, approve
          work, launch processes, or advance phases. Phase 12 chat remains
          available.
        </p>
        <p className="world-actions__capability" role="status">
          {state.capability.enabled
            ? "Structured Hermes World Actions available."
            : state.capability.reason}
        </p>
      </header>

      <div
        className="world-actions__controls"
        aria-label="Camera and navigation controls"
      >
        <strong>Camera · {state.navigation.cameraMode}</strong>
        <button
          type="button"
          aria-pressed={state.navigation.cameraMode === "third-person"}
          onClick={() => onCamera("third-person")}
        >
          Third-person
        </button>
        <button
          type="button"
          aria-pressed={state.navigation.cameraMode === "first-person"}
          onClick={() => onCamera("first-person")}
        >
          Enter first-person
        </button>
        <button
          type="button"
          aria-pressed={state.navigation.photo}
          onClick={() => onCamera("photo")}
        >
          Photo
        </button>
        <button
          type="button"
          disabled={!state.capability.enabled}
          onClick={onTour}
        >
          Start agent tour{state.capability.enabled ? "" : " · disabled"}
        </button>
        <button
          type="button"
          aria-pressed={state.navigation.follow}
          onClick={onFollow}
        >
          Follow
        </button>
        <button type="button" onClick={onFocus}>
          Focus fallback
        </button>
        <button type="button" onClick={onTeleport}>
          Teleport fallback
        </button>
        <button type="button" onClick={() => onCancel()}>
          Cancel
        </button>
      </div>

      <fieldset className="world-actions__wasd">
        <legend>Configurable WASD · keyboard-only directional movement</legend>
        <button
          type="button"
          aria-label="Move forward (W)"
          onClick={() => onMove("forward")}
        >
          W
        </button>
        <button
          type="button"
          aria-label="Move left (A)"
          onClick={() => onMove("left")}
        >
          A
        </button>
        <button
          type="button"
          aria-label="Move back (S)"
          onClick={() => onMove("back")}
        >
          S
        </button>
        <button
          type="button"
          aria-label="Move right (D)"
          onClick={() => onMove("right")}
        >
          D
        </button>
      </fieldset>
      <fieldset className="world-actions__touch">
        <legend>Touch movement controls</legend>
        <button type="button" onClick={() => onMove("forward")}>
          Tap forward
        </button>
        <button type="button" onClick={() => onMove("left")}>
          Tap left
        </button>
        <button type="button" onClick={() => onMove("right")}>
          Tap right
        </button>
        <span>
          Drag repository view to look · tap minimap destinations to travel
        </span>
      </fieldset>

      <details>
        <summary>Camera comfort settings</summary>
        <label>
          Mouse sensitivity
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={state.preferences.sensitivity}
            onChange={(event) =>
              onPreferences(
                clampComfortPreferences({
                  ...state.preferences,
                  sensitivity: Number(event.target.value),
                }),
              )
            }
          />
        </label>
        <label>
          Field of view
          <input
            type="range"
            min="60"
            max="100"
            value={state.preferences.fieldOfView}
            onChange={(event) =>
              onPreferences(
                clampComfortPreferences({
                  ...state.preferences,
                  fieldOfView: Number(event.target.value),
                }),
              )
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.preferences.invertedY}
            onChange={(event) =>
              onPreferences({
                ...state.preferences,
                invertedY: event.target.checked,
              })
            }
          />
          Invert mouse Y
        </label>
        <label>
          Camera easing
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={state.preferences.easing}
            onChange={(event) =>
              onPreferences(
                clampComfortPreferences({
                  ...state.preferences,
                  easing: Number(event.target.value),
                }),
              )
            }
          />
        </label>
        <p>
          {state.reducedMotion
            ? "Reduced motion: bob, sway, sweeping travel, and long easing are removed; semantic steps remain complete."
            : "Cosmetic motion enabled within comfort bounds; camera roll is always disabled."}
        </p>
      </details>

      {state.noWebGL && (
        <p className="world-actions__semantic-fallback" role="status">
          Semantic mode: focus only; physical arrival is not claimed. Search,
          focus, evidence, cancel, timeline, and replay remain equivalent.
        </p>
      )}

      <section aria-label="World Action truth" className="world-actions__truth">
        <h4>Current action truth</h4>
        <ul>
          {labels.map(([label, active]) => (
            <li key={label} data-active={active}>
              {label}: {active ? "yes" : "no"}
            </li>
          ))}
        </ul>
        <p aria-live="polite" role="status">
          Current: {state.currentStatus}
        </p>
        <p>Previous / recovered: {state.previousStatus ?? "none"}</p>
      </section>

      <section
        aria-label="Trace and compare evidence"
        className="world-actions__trace"
      >
        <h4>Trace / compare evidence</h4>
        <p>
          Graph {state.trace.graphGeneration} · {state.trace.shownObjects} of{" "}
          {state.trace.totalObjects} objects · {state.trace.shownEdges} of{" "}
          {state.trace.totalEdges} edges · {state.trace.confirmedHops} confirmed
          hops ·{" "}
          {state.trace.truncated
            ? "truncated: phase13-rich-graph-limit"
            : "complete"}
        </p>
        <ul>
          {state.trace.relationships.map((relationship) => (
            <li key={relationship.evidenceRef}>
              {relationship.sourceRef} → {relationship.targetRef} ·{" "}
              {relationship.confidence} · {relationship.status} ·{" "}
              <a
                id={`world-action-evidence-${relationship.evidenceRef}`}
                href={`#world-action-evidence-${relationship.evidenceRef}`}
              >
                evidence {relationship.evidenceRef}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Bounded World Action timeline"
        className="world-actions__timeline"
      >
        <h4>Action timeline · showing at most 50 of 200 retained / 7 days</h4>
        <button type="button" onClick={onClear}>
          Clear unpinned
        </button>
        <ol>
          {state.timeline.slice(0, 50).map((action) => (
            <li key={action.actionId} data-continuity={action.continuity}>
              <strong>{action.kind}</strong> · {action.state} ·{" "}
              {action.arrived ? "physically arrived" : "not arrived"}
              {action.requestedPath &&
              action.currentPath &&
              action.requestedPath !== action.currentPath
                ? ` · requested ${action.requestedPath} · current ${action.currentPath}`
                : ""}
              {action.reason ? ` · ${action.reason}` : ""}
              <button type="button" onClick={() => onCancel(action.actionId)}>
                Cancel
              </button>
              <button type="button" onClick={() => onReplay(action.actionId)}>
                Replay (revalidate)
              </button>
              <button
                type="button"
                aria-pressed={action.pinned}
                onClick={() => onPin(action.actionId, !action.pinned)}
              >
                {action.pinned ? "Unpin" : "Pin"}
              </button>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

const fixtureTimeline: WorldActionTimelineItem[] = [
  "requested",
  "attention",
  "path-planned",
  "moving",
  "arrived",
  "blocked",
  "interrupted",
  "superseded",
].map((state, index) => ({
  actionId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  batchId: "00000000-0000-4000-8000-000000000999",
  kind: index === 2 ? "navigate" : "focus",
  requestedTarget: `aiw://object/${index}`,
  state: state as WorldActionTimelineItem["state"],
  attention: state !== "requested",
  arrived: state === "arrived",
  continuity: index === 6 ? "previous-recovered" : "current",
  pinned: index === 4,
}));

// Test/Storybook fixture is intentionally colocated with the bounded view model.
// eslint-disable-next-line react-refresh/only-export-components
export const PHASE13_WORLD_ACTION_FIXTURE: WorldActionViewState = {
  capability: { enabled: true },
  navigation: DEFAULT_NAVIGATION_STATE,
  preferences: {
    sensitivity: 0.8,
    fieldOfView: 75,
    invertedY: false,
    easing: 0.35,
    cosmeticMotion: true,
  },
  reducedMotion: false,
  noWebGL: true,
  mobile: false,
  currentStatus: "Tour ready at packages/spatial-code-graph.",
  previousStatus:
    "Recovered movement interrupted; replay requires revalidation.",
  timeline: fixtureTimeline,
  trace: {
    graphGeneration: "00000000-0000-4000-8000-000000000099",
    relationships: [
      {
        confidence: "exact_workspace_package",
        status: "confirmed",
        evidenceRef: "edge-confirmed",
        sourceRef: "aiw://object/source",
        targetRef: "aiw://object/destination",
      },
      {
        confidence: "ambiguous",
        status: "candidate",
        evidenceRef: "edge-candidate",
        sourceRef: "aiw://object/source",
        targetRef: "aiw://object/candidate",
      },
    ],
    shownObjects: 256,
    totalObjects: 400,
    shownEdges: 512,
    totalEdges: 900,
    confirmedHops: 24,
    truncated: true,
  },
};

const EMPTY_TRACE: WorldActionViewState["trace"] = {
  graphGeneration: "unavailable",
  relationships: [],
  shownObjects: 0,
  totalObjects: 0,
  shownEdges: 0,
  totalEdges: 0,
  confirmedHops: 0,
  truncated: false,
};

function traceFromTimeline(
  timeline: readonly WorldActionTimelineItem[],
): WorldActionViewState["trace"] {
  const trace = timeline.find((action) => action.trace)?.trace;
  if (!trace) return EMPTY_TRACE;
  return {
    graphGeneration: trace.graphGeneration,
    relationships: trace.edges,
    shownObjects: trace.truncation?.shownObjects ?? trace.objects.length,
    totalObjects: trace.truncation?.totalObjects ?? trace.objects.length,
    shownEdges: trace.truncation?.shownEdges ?? trace.edges.length,
    totalEdges: trace.truncation?.totalEdges ?? trace.edges.length,
    confirmedHops: trace.confirmedPath.length,
    truncated: trace.truncation !== null,
  };
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : `World Action request failed (${response.status})`,
    );
  return body;
}

export function WorldActionPanel({
  snapshot,
  selectedRef,
  onSelect,
  onFocus,
  onAgentPosition,
  noWebGL,
  reducedMotion,
  cameraYaw = 0,
  onCameraMode = noop,
  onCameraLook = noop,
  onCameraPreferences = noop,
}: {
  readonly snapshot: WorldSnapshot;
  readonly selectedRef: string | null;
  readonly onSelect: (ref: string) => void;
  readonly onFocus: (ref: string) => void;
  readonly onAgentPosition: (
    position: { readonly x: number; readonly z: number } | null,
  ) => void;
  readonly noWebGL: boolean;
  readonly reducedMotion: boolean;
  readonly cameraYaw?: number;
  readonly onCameraMode?: (
    mode: "third-person" | "first-person" | "photo",
  ) => void;
  readonly onCameraLook?: (input: {
    readonly movementX: number;
    readonly movementY: number;
    readonly sensitivity: number;
    readonly invertedY: boolean;
  }) => void;
  readonly onCameraPreferences?: (preferences: ComfortPreferences) => void;
}) {
  const shellRef = useRef<HTMLElement | null>(null);
  const executorRef = useRef<WorldActionExecutor | null>(null);
  const operatorPositionRef = useRef<{
    readonly x: number;
    readonly z: number;
  } | null>(null);
  const onSelectRef = useRef(onSelect);
  const onFocusRef = useRef(onFocus);
  const onAgentPositionRef = useRef(onAgentPosition);
  const firstPersonEscapeArmedRef = useRef(false);
  const updateAgentPosition = useCallback(
    (position: { readonly x: number; readonly z: number } | null) => {
      operatorPositionRef.current = position;
      onAgentPositionRef.current(position);
    },
    [],
  );
  const sessionId =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem("aiw.agent-session.pointer.0.12");
  const [state, setState] = useState<WorldActionViewState>({
    ...PHASE13_WORLD_ACTION_FIXTURE,
    capability: {
      enabled: false,
      reason: sessionId
        ? "Checking structured World Action capability; manual navigation remains available."
        : "Connect a Phase 12 Hermes session for agent-led World Actions; manual navigation remains available.",
    },
    timeline: [],
    trace: EMPTY_TRACE,
    reducedMotion,
    noWebGL,
    currentStatus: "Third-person manual navigation ready.",
    previousStatus: null,
  });
  const navigationRef = useRef(state.navigation);
  const capabilityWasEnabledRef = useRef(false);
  const worldGenerationRef = useRef(snapshot.generationFingerprint);
  const noWebGLRef = useRef(noWebGL);
  const previousNoWebGLRef = useRef(noWebGL);
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => {
    navigationRef.current = state.navigation;
  }, [state.navigation]);
  useEffect(() => {
    onCameraMode(state.navigation.cameraMode);
  }, [onCameraMode, state.navigation.cameraMode]);
  useEffect(() => {
    noWebGLRef.current = noWebGL;
    reducedMotionRef.current = reducedMotion;
  }, [noWebGL, reducedMotion]);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onFocusRef.current = onFocus;
    onAgentPositionRef.current = onAgentPosition;
  }, [onSelect, onFocus, onAgentPosition]);
  const requestBrowserFrame = useCallback(
    (callback: FrameRequestCallback) =>
      window.requestAnimationFrame?.(callback) ??
      window.setTimeout(() => callback(Date.now()), 16),
    [],
  );
  const cancelBrowserFrame = useCallback(
    (handle: number) =>
      (window.cancelAnimationFrame ?? window.clearTimeout).call(window, handle),
    [],
  );
  const postInterrupt = useCallback(
    (reason: WorldActionInterruptReason) => {
      if (!sessionId) return;
      void jsonRequest(`/world-actions/${sessionId}/interrupt`, {
        method: "POST",
        keepalive: true,
        body: JSON.stringify({ reason }),
      }).catch(() => undefined);
    },
    [sessionId],
  );
  const stopOwnedLifecycle = useCallback(
    (reason: WorldActionInterruptReason) => {
      const next = stopWorldActionLifecycle({
        navigation: navigationRef.current,
        reason,
        animationFrame: null,
        cancelFrame: cancelBrowserFrame,
        exitPointerLock: () => document.exitPointerLock?.(),
        postInterrupt: (interruptReason) => {
          executorRef.current?.interrupt(interruptReason);
          if (!executorRef.current) postInterrupt(interruptReason);
        },
      });
      navigationRef.current = next;
      setState((current) => ({ ...current, navigation: next }));
    },
    [cancelBrowserFrame, postInterrupt],
  );
  useEffect(() => {
    const executor = createWorldActionExecutor({
      noWebGL: () => noWebGLRef.current,
      reducedMotion: () => reducedMotionRef.current,
      requestFrame: requestBrowserFrame,
      cancelFrame: cancelBrowserFrame,
      onSelect: (objectRef) => onSelectRef.current(objectRef),
      onFocus: (objectRef) => onFocusRef.current(objectRef),
      onPresent: (kind, objectRef) =>
        setState((current) => ({
          ...current,
          currentStatus:
            noWebGLRef.current && (kind === "navigate" || kind === "follow")
              ? `Semantic Focus reached ${objectRef ?? "the requested target"}; physical arrival is not claimed without WebGL.`
              : `${kind} presentation applied${objectRef ? ` to ${objectRef}` : ""}.`,
        })),
      onPosition: updateAgentPosition,
      onTransition: async (actionId, event, actorPosition) => {
        if (!sessionId) return;
        await jsonRequest(
          `/world-actions/${sessionId}/actions/${actionId}/transition`,
          {
            method: "POST",
            body: JSON.stringify({
              event,
              ...(actorPosition ? { actorPosition } : {}),
            }),
          },
        );
        setState((current) => {
          const navigation = applyNavigationEvent(current.navigation, {
            type: "agent-motion",
            state:
              event === "semantic-focus"
                ? "attention"
                : event === "moving"
                  ? "moving"
                  : event,
          });
          navigationRef.current = navigation;
          return {
            ...current,
            navigation,
            currentStatus:
              event === "semantic-focus"
                ? "Semantic Focus reached the requested target; physical arrival is not claimed without WebGL."
                : event === "moving"
                  ? "Moving on the deterministic canonical path."
                  : event === "arrived"
                    ? "Arrived inside the authoritative interaction zone."
                    : "Canonical navigation is blocked.",
          };
        });
      },
      onInterrupt: postInterrupt,
    });
    executorRef.current = executor;
    const pagehide = () => stopOwnedLifecycle("cancel");
    window.addEventListener("pagehide", pagehide);
    return () => {
      window.removeEventListener("pagehide", pagehide);
      stopOwnedLifecycle("cancel");
      executor.dispose();
      if (executorRef.current === executor) executorRef.current = null;
    };
  }, [
    cancelBrowserFrame,
    postInterrupt,
    requestBrowserFrame,
    sessionId,
    stopOwnedLifecycle,
    updateAgentPosition,
  ]);
  useEffect(() => {
    if (worldGenerationRef.current !== snapshot.generationFingerprint) {
      worldGenerationRef.current = snapshot.generationFingerprint;
      stopOwnedLifecycle("invalid-target");
    }
    if (!previousNoWebGLRef.current && noWebGL)
      stopOwnedLifecycle("capability-loss");
    previousNoWebGLRef.current = noWebGL;
  }, [snapshot.generationFingerprint, noWebGL, stopOwnedLifecycle]);
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    const load = () =>
      jsonRequest(`/world-actions/${sessionId}`)
        .then((body) => {
          if (!active) return;
          const capability =
            body.capability as WorldActionViewState["capability"];
          if (capabilityWasEnabledRef.current && !capability.enabled)
            stopOwnedLifecycle("capability-loss");
          capabilityWasEnabledRef.current = capability.enabled;
          const timeline = Array.isArray(body.actions)
            ? (body.actions as WorldActionTimelineItem[])
            : [];
          const latestCurrent = timeline.find(
            ({ continuity }) => continuity === "current",
          );
          const latestRecovered = timeline.find(
            ({ continuity }) => continuity === "previous-recovered",
          );
          setState((current) => ({
            ...current,
            capability,
            timeline,
            trace: traceFromTimeline(timeline),
            currentStatus: latestCurrent
              ? describeTimelineOutcome(latestCurrent)
              : capability.enabled
                ? "Structured World Actions ready."
                : capability.reason,
            previousStatus: latestRecovered
              ? describeTimelineOutcome(latestRecovered)
              : null,
          }));
          const executions = Array.isArray(body.executions)
            ? (body.executions as WorldActionExecution[])
            : [];
          if (!navigationRef.current.photo)
            for (const execution of executions)
              void executorRef.current?.execute(execution);
        })
        .catch((error: unknown) => {
          if (active)
            setState((current) => ({
              ...current,
              capability: {
                enabled: false,
                reason:
                  "World Actions unavailable; Phase 12 chat and manual navigation remain available.",
              },
              currentStatus:
                error instanceof Error
                  ? error.message
                  : "World Action status unavailable.",
            }));
        });
    void load();
    const timer = window.setInterval(() => void load(), 2_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId, stopOwnedLifecycle]);

  const interrupt = (
    reason: "operator-movement" | "escape" | "cancel",
    status?: string,
  ) => {
    executorRef.current?.interrupt(reason);
    setState((current) => ({
      ...current,
      navigation: applyNavigationEvent(current.navigation, {
        type: reason === "escape" ? "escape" : "operator-move",
      }),
      currentStatus:
        status ??
        (reason === "escape"
          ? "Escape returned control to the unchanged shell."
          : "Direct operator movement interrupted agent-led motion."),
    }));
    if (!executorRef.current) postInterrupt(reason);
  };
  const moveOperator = (direction: "forward" | "left" | "back" | "right") => {
    const result = moveOperatorPosition({
      snapshot,
      selectedRef,
      currentPosition: operatorPositionRef.current,
      direction,
      noWebGL,
      yawRadians:
        state.navigation.cameraMode === "first-person" ? cameraYaw : 0,
    });
    if (result.moved && result.position) {
      updateAgentPosition(result.position);
    }
    interrupt("operator-movement", result.status);
  };
  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as Element | null;
    const editableTarget = Boolean(
      target?.closest?.(
        "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
      ),
    );
    if (editableTarget) return;
    const shell = shellRef.current;
    const shellOwnsKey =
      shell !== null &&
      (event.target === shell ||
        (event.target !== null && shell.contains(event.target as Node)) ||
        document.activeElement === shell ||
        (document.activeElement !== null &&
          shell.contains(document.activeElement)));
    if (event.key === "Escape") {
      const firstPersonEscapeArmed = firstPersonEscapeArmedRef.current;
      if (
        !firstPersonEscapeArmed &&
        !state.navigation.pointerLocked &&
        !state.navigation.follow &&
        state.navigation.agentMotion !== "moving" &&
        state.navigation.agentMotion !== "path-planned"
      )
        return;
      event.stopPropagation();
      event.stopImmediatePropagation();
      firstPersonEscapeArmedRef.current = false;
      document.exitPointerLock?.();
      interrupt("escape");
      shellRef.current?.focus();
    } else if (
      isOperatorMovementKey(event.key) &&
      (shouldInterruptOperatorMovement(state.navigation) || shellOwnsKey)
    ) {
      event.preventDefault();
      event.stopPropagation();
      const normalized = event.key.toLowerCase();
      moveOperator(
        normalized === "w" || normalized === "arrowup"
          ? "forward"
          : normalized === "a" || normalized === "arrowleft"
            ? "left"
            : normalized === "s" || normalized === "arrowdown"
              ? "back"
              : "right",
      );
    }
  });
  const handleMouseLook = useEffectEvent((event: MouseEvent) => {
    if (
      document.pointerLockElement !== shellRef.current ||
      navigationRef.current.cameraMode !== "first-person"
    )
      return;
    onCameraLook({
      movementX: event.movementX,
      movementY: event.movementY,
      sensitivity: state.preferences.sensitivity,
      invertedY: state.preferences.invertedY,
    });
  });
  useEffect(() => {
    const key = (event: KeyboardEvent) => handleKey(event);
    const mouse = (event: MouseEvent) => handleMouseLook(event);
    window.addEventListener("keydown", key, true);
    document.addEventListener("mousemove", mouse);
    return () => {
      window.removeEventListener("keydown", key, true);
      document.removeEventListener("mousemove", mouse);
    };
  }, []);
  useEffect(() => {
    const pointerLockChanged = () => {
      const granted = document.pointerLockElement === shellRef.current;
      if (granted) firstPersonEscapeArmedRef.current = true;
      else
        window.setTimeout(() => {
          firstPersonEscapeArmedRef.current = false;
        }, 250);
      setState((current) => ({
        ...current,
        navigation: granted
          ? applyNavigationEvent(current.navigation, {
              type: "enter-first-person",
            })
          : current.navigation.pointerLocked
            ? applyNavigationEvent(current.navigation, { type: "third-person" })
            : current.navigation,
        currentStatus: granted
          ? "First-person pointer lock active; Escape exits immediately."
          : current.navigation.pointerLocked
            ? "Pointer lock ended; third-person shell control restored."
            : current.currentStatus,
      }));
    };
    const pointerLockDenied = () => {
      firstPersonEscapeArmedRef.current = false;
      setState((current) => ({
        ...current,
        navigation: applyNavigationEvent(current.navigation, {
          type: "third-person",
        }),
        currentStatus:
          "First-person pointer lock was not granted; third-person control remains active.",
      }));
    };
    document.addEventListener("pointerlockchange", pointerLockChanged);
    document.addEventListener("pointerlockerror", pointerLockDenied);
    return () => {
      document.removeEventListener("pointerlockchange", pointerLockChanged);
      document.removeEventListener("pointerlockerror", pointerLockDenied);
    };
  }, []);

  const refresh = async () => {
    if (!sessionId) return;
    const body = await jsonRequest(`/world-actions/${sessionId}`);
    const timeline = body.actions as WorldActionTimelineItem[];
    const latestCurrent = timeline.find(
      ({ continuity }) => continuity === "current",
    );
    const latestRecovered = timeline.find(
      ({ continuity }) => continuity === "previous-recovered",
    );
    setState((current) => ({
      ...current,
      timeline,
      trace: traceFromTimeline(timeline),
      currentStatus: latestCurrent
        ? describeTimelineOutcome(latestCurrent)
        : current.currentStatus,
      previousStatus: latestRecovered
        ? describeTimelineOutcome(latestRecovered)
        : null,
    }));
  };
  const tour = () => {
    if (!sessionId) return;
    const targets = resolveCanonicalTourTargets(snapshot.objects);
    if (!targets) {
      setState((current) => ({
        ...current,
        currentStatus:
          "Tour targets are unavailable in the exact current World generation.",
      }));
      return;
    }
    const { source, destination } = targets;
    const target = (objectRef: string) => ({
      repositoryRef: snapshot.repositoryRef,
      objectRef,
    });
    void jsonRequest(`/world-actions/${sessionId}/proposals`, {
      method: "POST",
      body: JSON.stringify({
        actions: [
          { kind: "focus", target: target(source.ref) },
          {
            kind: "trace",
            target: target(source.ref),
            destination: target(destination.ref),
          },
          { kind: "navigate", target: target(destination.ref) },
          { kind: "inspect", target: target(destination.ref) },
        ],
      }),
    })
      .then(async (body) => {
        setState((current) => ({
          ...current,
          currentStatus:
            "Tour accepted: semantic attention at packages/spatial-code-graph; path to packages/renderer-r3f planned.",
        }));
        await executorRef.current?.execute(body as WorldActionExecution);
        await refresh();
      })
      .catch((error: unknown) =>
        setState((current) => ({
          ...current,
          currentStatus:
            error instanceof Error ? error.message : "Tour proposal rejected.",
        })),
      );
  };

  return (
    <section
      ref={shellRef}
      tabIndex={0}
      aria-label="World Action keyboard navigation"
      data-camera-mode={state.navigation.cameraMode}
    >
      <WorldActionExperience
        state={state}
        onCamera={(mode) => {
          if (mode === "first-person") {
            const shell = shellRef.current;
            if (!shell?.requestPointerLock) {
              firstPersonEscapeArmedRef.current = false;
              setState((current) => ({
                ...current,
                navigation: applyNavigationEvent(current.navigation, {
                  type: "third-person",
                }),
                currentStatus:
                  "First-person pointer lock was not granted; third-person control remains active.",
              }));
              return;
            }
            firstPersonEscapeArmedRef.current = true;
            try {
              void Promise.resolve(shell.requestPointerLock()).catch(() => {
                firstPersonEscapeArmedRef.current = false;
                setState((current) => ({
                  ...current,
                  navigation: applyNavigationEvent(current.navigation, {
                    type: "third-person",
                  }),
                  currentStatus:
                    "First-person pointer lock was not granted; third-person control remains active.",
                }));
              });
            } catch {
              firstPersonEscapeArmedRef.current = false;
              setState((current) => ({
                ...current,
                navigation: applyNavigationEvent(current.navigation, {
                  type: "third-person",
                }),
                currentStatus:
                  "First-person pointer lock was not granted; third-person control remains active.",
              }));
              return;
            }
            setState((current) => ({
              ...current,
              currentStatus:
                "First-person pointer lock requested; awaiting browser permission.",
            }));
          } else {
            firstPersonEscapeArmedRef.current = false;
            document.exitPointerLock?.();
            if (mode === "photo")
              executorRef.current?.interrupt("operator-movement");
            setState((current) => ({
              ...current,
              navigation: (() => {
                const navigation = applyNavigationEvent(current.navigation, {
                  type: mode === "photo" ? "photo" : "third-person",
                });
                navigationRef.current = navigation;
                return navigation;
              })(),
              currentStatus:
                mode === "photo"
                  ? "Photo mode paused action playback and hid selection overlays; camera-only orbit remains available."
                  : "Comfort-first third-person camera active; selection overlays restored.",
            }));
          }
        }}
        onFollow={() =>
          setState((current) => ({
            ...current,
            navigation: applyNavigationEvent(current.navigation, {
              type: "follow",
              enabled: !current.navigation.follow,
            }),
            currentStatus: current.navigation.follow
              ? "Follow exited; operator control restored."
              : "Follow enabled; direct movement or Escape exits immediately.",
          }))
        }
        onTour={tour}
        onMove={moveOperator}
        onFocus={() => {
          if (selectedRef) onFocus(selectedRef);
          setState((current) => ({
            ...current,
            currentStatus: noWebGL
              ? "Semantic Focus fallback selected; physical arrival is not claimed."
              : "Camera-only Focus fallback selected; physical arrival is unchanged.",
          }));
        }}
        onTeleport={() => {
          const currentStatus = performOperatorTeleport({
            snapshot,
            selectedRef,
            noWebGL,
            onAgentPosition: updateAgentPosition,
            onSelect,
            onFocus,
          });
          setState((current) => ({ ...current, currentStatus }));
        }}
        onCancel={(actionId) => {
          if (!actionId) {
            interrupt("cancel");
            return;
          }
          if (sessionId)
            void jsonRequest(
              `/world-actions/${sessionId}/actions/${actionId}/cancel`,
              { method: "POST", body: "{}" },
            )
              .then(refresh)
              .catch(() => undefined);
        }}
        onReplay={(actionId) => {
          if (sessionId)
            void jsonRequest(
              `/world-actions/${sessionId}/actions/${actionId}/replay`,
              { method: "POST", body: "{}" },
            )
              .then(refresh)
              .catch(() => undefined);
        }}
        onPin={(actionId, pinned) => {
          if (sessionId)
            void jsonRequest(
              `/world-actions/${sessionId}/actions/${actionId}/pin`,
              { method: "POST", body: JSON.stringify({ pinned }) },
            )
              .then(refresh)
              .catch(() => undefined);
        }}
        onClear={() => {
          if (sessionId)
            void jsonRequest(`/world-actions/${sessionId}/clear`, {
              method: "DELETE",
            })
              .then(refresh)
              .catch(() => undefined);
        }}
        onPreferences={(preferences) => {
          const nextPreferences = reducedMotion
            ? { ...preferences, easing: 0, cosmeticMotion: false }
            : preferences;
          onCameraPreferences(nextPreferences);
          setState((current) => ({
            ...current,
            preferences: nextPreferences,
          }));
        }}
      />
    </section>
  );
}

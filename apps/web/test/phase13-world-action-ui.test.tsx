import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const panelHooks = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  updates: [] as unknown[],
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useCallback: <T extends (...args: never[]) => unknown>(callback: T) =>
      callback,
    useEffect: (effect: () => void | (() => void)) => {
      panelHooks.effects.push(effect);
    },
    useEffectEvent: <T extends (...args: never[]) => unknown>(callback: T) =>
      callback,
    useRef: <T,>(initialValue: T) => ({ current: initialValue }),
    useState: <T,>(initialValue: T) => [
      initialValue,
      (update: unknown) => panelHooks.updates.push(update),
    ],
  };
});

import { PHASE5_WORLD_FIXTURE } from "../src/fixtures/phase5-world.js";

import {
  DEFAULT_NAVIGATION_STATE,
  applyNavigationEvent,
  clampComfortPreferences,
} from "../src/world-actions/world-action-model.js";
import {
  PHASE13_WORLD_ACTION_FIXTURE,
  WorldActionExperience,
  WorldActionPanel,
  deriveCurrentActionTruth,
  describeTimelineOutcome,
} from "../src/world-actions/WorldActionPanel.js";
import {
  isOperatorMovementKey,
  moveOperatorPosition,
  performOperatorTeleport,
  shouldInterruptOperatorMovement,
} from "../src/world-actions/operator-navigation.js";
import { resolveCanonicalTourTargets } from "../src/world-actions/tour-targets.js";

describe("Phase 13 operator navigation model", () => {
  it("normalizes WASD and every Arrow key as immediate operator movement", () => {
    for (const key of [
      "w",
      "A",
      "s",
      "D",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ])
      expect(isOperatorMovementKey(key)).toBe(true);
    expect(isOperatorMovementKey("Enter")).toBe(false);
  });

  it("leaves idle repository keys alone but interrupts active World movement", () => {
    expect(shouldInterruptOperatorMovement(DEFAULT_NAVIGATION_STATE)).toBe(
      false,
    );
    for (const navigation of [
      { ...DEFAULT_NAVIGATION_STATE, pointerLocked: true },
      { ...DEFAULT_NAVIGATION_STATE, follow: true },
      { ...DEFAULT_NAVIGATION_STATE, agentMotion: "path-planned" as const },
      { ...DEFAULT_NAVIGATION_STATE, agentMotion: "moving" as const },
    ])
      expect(shouldInterruptOperatorMovement(navigation)).toBe(true);
  });

  it("defaults to comfort-first third person and bounded preferences", () => {
    expect(DEFAULT_NAVIGATION_STATE).toMatchObject({
      cameraMode: "third-person",
      pointerLocked: false,
      follow: false,
      photo: false,
    });
    expect(
      clampComfortPreferences({
        sensitivity: 99,
        fieldOfView: 10,
        invertedY: true,
        easing: 99,
        cosmeticMotion: true,
      }),
    ).toEqual({
      sensitivity: 2,
      fieldOfView: 60,
      invertedY: true,
      easing: 1,
      cosmeticMotion: true,
    });
  });

  it("moves the visible operator actor within the current snapshot and degrades semantically without WebGL", () => {
    const moved = moveOperatorPosition({
      snapshot: PHASE5_WORLD_FIXTURE,
      selectedRef: PHASE5_WORLD_FIXTURE.repositoryRef,
      currentPosition: { x: 4, z: 4 },
      direction: "forward",
      noWebGL: false,
    });
    expect(moved).toMatchObject({
      position: { x: 4, z: 3.25 },
      moved: true,
    });
    expect(
      moveOperatorPosition({
        snapshot: PHASE5_WORLD_FIXTURE,
        selectedRef: null,
        currentPosition: { x: 4, z: 4 },
        direction: "right",
        noWebGL: true,
      }),
    ).toMatchObject({
      position: null,
      moved: false,
      status: expect.stringContaining("physical movement is not claimed"),
    });
  });

  it("lets direct movement and Escape immediately interrupt agent motion/follow/pointer lock", () => {
    const immersive = {
      ...DEFAULT_NAVIGATION_STATE,
      cameraMode: "first-person" as const,
      pointerLocked: true,
      follow: true,
      agentMotion: "moving" as const,
    };
    expect(
      applyNavigationEvent(immersive, { type: "operator-move" }),
    ).toMatchObject({
      pointerLocked: false,
      follow: false,
      agentMotion: "interrupted",
      interruptionReason: "operator-movement",
    });
    expect(applyNavigationEvent(immersive, { type: "escape" })).toMatchObject({
      cameraMode: "third-person",
      pointerLocked: false,
      follow: false,
      agentMotion: "interrupted",
      shellFocusRequested: true,
    });
  });
});

describe("Phase 13 accessible World Action surface", () => {
  it("moves on idle third-person keys owned by the World Action shell without claiming outside keys", () => {
    panelHooks.effects.length = 0;
    panelHooks.updates.length = 0;
    const keyListeners = new Map<string, (event: KeyboardEvent) => void>();
    const documentStub = {
      activeElement: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const windowStub = {
      localStorage: { getItem: vi.fn(() => null) },
      addEventListener: vi.fn(
        (type: string, listener: (event: KeyboardEvent) => void) => {
          keyListeners.set(type, listener);
        },
      ),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("document", documentStub);
    vi.stubGlobal("window", windowStub);
    const onAgentPosition = vi.fn();
    const panel = WorldActionPanel({
      snapshot: PHASE5_WORLD_FIXTURE,
      selectedRef: PHASE5_WORLD_FIXTURE.repositoryRef,
      onSelect: vi.fn(),
      onFocus: vi.fn(),
      onAgentPosition,
      noWebGL: false,
      reducedMotion: false,
    });
    const insideTarget = { closest: vi.fn(() => null) };
    const outsideTarget = { closest: vi.fn(() => null) };
    const shell = {
      contains: vi.fn((target: unknown) => target === insideTarget),
      focus: vi.fn(),
    };
    const shellRef = panel!.props.ref as {
      current: typeof shell | null;
    };
    shellRef.current = shell;
    for (const effect of panelHooks.effects) effect();
    const onKeyDown = keyListeners.get("keydown");
    expect(onKeyDown).toBeTypeOf("function");
    expect(windowStub.addEventListener).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
      true,
    );

    const insideEvent = {
      key: "ArrowUp",
      target: insideTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    onKeyDown!(insideEvent);

    expect(onAgentPosition).toHaveBeenCalledOnce();
    expect(onAgentPosition).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number), z: expect.any(Number) }),
    );
    expect(insideEvent.preventDefault).toHaveBeenCalledOnce();
    expect(insideEvent.stopPropagation).toHaveBeenCalledOnce();

    const outsideEvent = {
      key: "ArrowUp",
      target: outsideTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    onKeyDown!(outsideEvent);

    expect(onAgentPosition).toHaveBeenCalledOnce();
    expect(outsideEvent.preventDefault).not.toHaveBeenCalled();
    expect(outsideEvent.stopPropagation).not.toHaveBeenCalled();

    const editableEvent = {
      key: "ArrowUp",
      target: {
        closest: vi.fn(() => ({ tagName: "INPUT" })),
      },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    onKeyDown!(editableEvent);

    expect(onAgentPosition).toHaveBeenCalledOnce();
    expect(editableEvent.preventDefault).not.toHaveBeenCalled();
    expect(editableEvent.stopPropagation).not.toHaveBeenCalled();
    expect(panel!.props).toMatchObject({
      tabIndex: 0,
      "aria-label": "World Action keyboard navigation",
    });
    vi.unstubAllGlobals();
  });

  it("moves the visible actor and reports the resulting position through the panel control boundary", () => {
    panelHooks.effects.length = 0;
    panelHooks.updates.length = 0;
    const onAgentPosition = vi.fn();
    const panel = WorldActionPanel({
      snapshot: PHASE5_WORLD_FIXTURE,
      selectedRef: PHASE5_WORLD_FIXTURE.repositoryRef,
      onSelect: vi.fn(),
      onFocus: vi.fn(),
      onAgentPosition,
      noWebGL: false,
      reducedMotion: false,
    });
    expect(panel).toBeTruthy();
    const experience = panel!.props.children as {
      readonly props: {
        readonly onMove: (
          direction: "forward" | "left" | "back" | "right",
        ) => void;
      };
    };

    experience.props.onMove("forward");

    expect(onAgentPosition).toHaveBeenCalledOnce();
    expect(onAgentPosition).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number), z: expect.any(Number) }),
    );
    const update = panelHooks.updates.at(-1);
    expect(update).toBeTypeOf("function");
    const nextState = (
      update as (state: typeof PHASE13_WORLD_ACTION_FIXTURE) => {
        currentStatus: string;
      }
    )(PHASE13_WORLD_ACTION_FIXTURE);
    expect(nextState.currentStatus).toContain("Operator moved forward");
  });

  it("does not claim first-person or pointer lock when the browser cannot grant it", () => {
    panelHooks.effects.length = 0;
    panelHooks.updates.length = 0;
    const panel = WorldActionPanel({
      snapshot: PHASE5_WORLD_FIXTURE,
      selectedRef: PHASE5_WORLD_FIXTURE.repositoryRef,
      onSelect: vi.fn(),
      onFocus: vi.fn(),
      onAgentPosition: vi.fn(),
      noWebGL: false,
      reducedMotion: false,
    });
    const experience = panel!.props.children as {
      readonly props: { readonly onCamera: (mode: "first-person") => void };
    };

    experience.props.onCamera("first-person");

    const update = panelHooks.updates.at(-1);
    expect(update).toBeTypeOf("function");
    const nextState = (
      update as (state: typeof PHASE13_WORLD_ACTION_FIXTURE) => {
        navigation: typeof PHASE13_WORLD_ACTION_FIXTURE.navigation;
        currentStatus: string;
      }
    )(PHASE13_WORLD_ACTION_FIXTURE);
    expect(nextState.navigation).toMatchObject({
      cameraMode: "third-person",
      pointerLocked: false,
    });
    expect(nextState.currentStatus).toContain("not granted");
  });

  it("projects current truth from only the newest current batch and labels recovered history", () => {
    const previous = {
      ...PHASE13_WORLD_ACTION_FIXTURE.timeline[4]!,
      batchId: "00000000-0000-4000-8000-000000000001",
      state: "arrived" as const,
      arrived: true,
      continuity: "previous-recovered" as const,
    };
    const current = {
      ...PHASE13_WORLD_ACTION_FIXTURE.timeline[3]!,
      batchId: "00000000-0000-4000-8000-000000000002",
      state: "moving" as const,
      arrived: false,
      continuity: "current" as const,
    };
    expect(deriveCurrentActionTruth([current, previous])).toMatchObject({
      moving: true,
      arrived: false,
      blocked: false,
    });
    expect(describeTimelineOutcome(previous)).toContain("Previous / recovered");
    const html = renderToStaticMarkup(
      <WorldActionExperience
        state={{
          ...PHASE13_WORLD_ACTION_FIXTURE,
          timeline: [current, previous],
          previousStatus: describeTimelineOutcome(previous),
        }}
      />,
    );
    expect(html).toContain("Moving: yes");
    expect(html).toContain("Arrived: no");
    expect(html).toContain("Previous / recovered: Previous / recovered");
  });

  it("resolves real manifest-backed canonical package refs and ignores directory/fixture lookalikes", () => {
    const sourceRef = "aiw://object/real-spatial-package";
    const destinationRef = "aiw://object/real-renderer-package";
    const objects = [
      {
        kind: "directory",
        ref: "aiw://object/spatial-directory",
        path: "packages/spatial-code-graph",
      },
      {
        kind: "package",
        ref: sourceRef,
        path: "packages/spatial-code-graph/package.json",
        packageName: "@agentintersect-world/spatial-code-graph",
      },
      {
        kind: "package",
        ref: "aiw://object/nested-fixture-spatial-package",
        path: "tooling/fixtures/example/packages/spatial-code-graph/package.json",
        packageName: "@fixture/spatial-code-graph",
      },
      {
        kind: "directory",
        ref: "aiw://object/renderer-directory",
        path: "packages/renderer-r3f",
      },
      {
        kind: "package",
        ref: destinationRef,
        path: "packages/renderer-r3f/package.json",
        packageName: "@agentintersect-world/renderer-r3f",
      },
    ];

    expect(resolveCanonicalTourTargets(objects)).toEqual({
      source: expect.objectContaining({ ref: sourceRef }),
      destination: expect.objectContaining({ ref: destinationRef }),
    });
    expect(
      resolveCanonicalTourTargets([
        ...objects,
        {
          kind: "package",
          ref: "aiw://object/ambiguous-spatial-package",
          path: "packages/spatial-code-graph",
          packageName: "@ambiguous/spatial-code-graph",
        },
      ]),
    ).toBeNull();
  });

  it("moves, selects, and focuses the exact snapshot target before reporting operator Teleport", () => {
    const target = PHASE5_WORLD_FIXTURE.objects.find(
      ({ kind }) => kind === "package",
    )!;
    const onAgentPosition = vi.fn();
    const onSelect = vi.fn();
    const onFocus = vi.fn();

    expect(
      performOperatorTeleport({
        snapshot: PHASE5_WORLD_FIXTURE,
        selectedRef: target.ref,
        noWebGL: false,
        onAgentPosition,
        onSelect,
        onFocus,
      }),
    ).toBe(
      "Operator-invoked Teleport moved the visible actor to the exact selected interaction zone.",
    );
    expect(onAgentPosition).toHaveBeenCalledOnce();
    expect(onAgentPosition).toHaveBeenCalledWith({ x: 4.5, z: 1.25 });
    expect(onSelect).toHaveBeenCalledWith(target.ref);
    expect(onFocus).toHaveBeenCalledWith(target.ref);

    onAgentPosition.mockClear();
    expect(
      performOperatorTeleport({
        snapshot: PHASE5_WORLD_FIXTURE,
        selectedRef: target.ref,
        noWebGL: true,
        onAgentPosition,
        onSelect,
        onFocus,
      }),
    ).toContain("physical arrival is not claimed");
    expect(onAgentPosition).not.toHaveBeenCalled();
  });

  it("renders every truthful state, camera mode, fallback, timeline control, and rich evidence label", () => {
    const html = renderToStaticMarkup(
      <WorldActionExperience state={PHASE13_WORLD_ACTION_FIXTURE} />,
    );
    for (const label of [
      "Requested target",
      "Semantic attention",
      "Path planned",
      "Moving",
      "Arrived",
      "Blocked",
      "Interrupted",
      "Superseded",
    ])
      expect(html).toContain(label);
    for (const label of [
      "Third-person",
      "Enter first-person",
      "Tour",
      "Follow",
      "Photo",
      "Focus fallback",
      "Teleport fallback",
      "Cancel",
      "Replay (revalidate)",
      "Pin",
      "Clear unpinned",
    ])
      expect(html).toContain(label);
    expect(html).toContain("WASD");
    expect(html).toContain("Touch movement controls");
    expect(html).toContain(
      "Semantic mode: focus only; physical arrival is not claimed",
    );
    expect(html).toContain("exact_workspace_package · confirmed");
    expect(html).toContain("ambiguous · candidate");
    expect(html).toContain("aiw://object/source → aiw://object/destination");
    expect(html).toContain('href="#world-action-evidence-edge-confirmed"');
    expect(html).toContain("256 of 400 objects");
    expect(html).toContain("512 of 900 edges");
    expect(html).toContain("24 confirmed hops");
    expect(html).toContain('aria-live="polite"');
  });

  it("renders truthful capability degradation while chat/manual navigation remain available", () => {
    const html = renderToStaticMarkup(
      <WorldActionExperience
        state={{
          ...PHASE13_WORLD_ACTION_FIXTURE,
          capability: {
            enabled: false,
            reason:
              "Structured helper unavailable; persistent chat and manual navigation remain available.",
          },
        }}
      />,
    );
    expect(html).toContain("Structured helper unavailable");
    expect(html).toContain(
      "persistent chat and manual navigation remain available",
    );
    expect(html).toMatch(/Start agent tour[\s\S]*disabled/);
  });
});

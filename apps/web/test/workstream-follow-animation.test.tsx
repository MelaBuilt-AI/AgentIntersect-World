import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMPORTED_AVATAR_DRAFT,
  createOriginalImportedAvatarSource,
} from "@agentintersect-world/avatar-system/imported-avatar";
import { worldImportedAvatarSelection } from "../src/world-entry/world-imported-avatar.js";
type ImportedAvatarWorldSelection = NonNullable<
  ReturnType<typeof worldImportedAvatarSelection>
>;
import { WorldRoom } from "../src/world-entry/WorldRoom.js";
import {
  advanceAgentMovement,
  createAgentMovementState,
  interruptAgentMovement,
  requestAgentMovement,
  type AgentMovementState,
} from "../src/world-entry/world-agent-movement-model.js";
import {
  createAvatarAnimationState,
  setAvatarLocomotion,
  type AvatarAnimationState,
} from "../src/world-entry/world-chat-model.js";
import { projectAuthoritativeWorkstream } from "../src/world-entry/workstream-tracer.js";
import type { WorkstreamApiRecord } from "../src/world-entry/workstream-client.js";

// Seed a real controller snapshot at the React render boundary. No browser,
// native agent, or mocked animation selector is involved.
const snapshot = vi.hoisted(() => ({
  movement: null as AgentMovementState | null,
  animation: null as AvatarAnimationState | null,
}));
vi.mock("../src/world-entry/world-agent-movement-model.js", async (load) => {
  const actual =
    await load<
      typeof import("../src/world-entry/world-agent-movement-model.js")
    >();
  return {
    ...actual,
    createAgentMovementState: (
      ...args: Parameters<typeof actual.createAgentMovementState>
    ) => snapshot.movement ?? actual.createAgentMovementState(...args),
  };
});
vi.mock("../src/world-entry/world-chat-model.js", async (load) => {
  const actual =
    await load<typeof import("../src/world-entry/world-chat-model.js")>();
  return {
    ...actual,
    createAvatarAnimationState: () =>
      snapshot.animation ?? actual.createAvatarAnimationState(),
  };
});
vi.mock("@agentintersect-world/renderer-r3f", async (load) => ({
  ...(await load<typeof import("@agentintersect-world/renderer-r3f")>()),
  resolveWebGLCapability: () => ({ available: true }),
}));

afterEach(() => {
  snapshot.movement = null;
  snapshot.animation = null;
});

const completed = projectAuthoritativeWorkstream({
  workstreamId: "work-one",
  title: "Claude diff test",
  status: "ready-for-review",
  repository: { repositoryId: "repo-one", revision: "one" },
  agent: { agentId: "claude-one", nativeSessionId: "native-one" },
  authority: { worktreeId: "tree-one" },
  worktreeState: "current",
  projection: {
    currentActivity: "Completed heading edit",
    changedFiles: [],
    diff: { summary: "", patch: "", truncated: false },
    validation: [],
    evidenceRefs: [],
  },
  events: [
    {
      eventId: "turn-one",
      status: "working",
      summary: "Started",
      occurredAt: "2026-09-22T12:00:00Z",
    },
  ],
  createdAt: "2026-09-22T12:00:00Z",
  updatedAt: "2026-09-22T12:01:00Z",
} as unknown as WorkstreamApiRecord);

function rendererProps(node: ReactNode):
  | {
      agentAction: string;
      agentImportedAvatar: ImportedAvatarWorldSelection;
      agentStates: readonly {
        action: string;
        position: { x: number; z: number };
      }[];
    }
  | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Record<string, unknown>>(child)) continue;
    if (child.props.agentImportedAvatar)
      return child.props as ReturnType<typeof rendererProps>;
    const nested = rendererProps(child.props.children as ReactNode);
    if (nested) return nested;
  }
  return undefined;
}

function renderSnapshot(
  movement: AgentMovementState,
  animation: AvatarAnimationState,
) {
  snapshot.movement = movement;
  snapshot.animation = animation;
  let room!: ReactElement<Record<string, unknown>>;
  function Probe() {
    room = WorldRoom({
      floor: "repository",
      objects: [],
      reducedMotion: false,
      forceNoWebGL: false,
      userName: "Aaron",
      agentName: "Claude",
      agentActorId: "claude-one",
      userAvatar: {
        ...DEFAULT_IMPORTED_AVATAR_DRAFT,
        avatarSource: createOriginalImportedAvatarSource("user-male-03"),
      },
      agentAvatar: {
        ...DEFAULT_IMPORTED_AVATAR_DRAFT,
        avatarSource: createOriginalImportedAvatarSource("dog-agent-02"),
      },
      activity: { state: "idle", icon: "", label: "idle", detail: "" },
      liveWorkstream: completed,
    });
    return null;
  }
  renderToStaticMarkup(<Probe />);
  const renderer = rendererProps(room);
  expect(renderer).toBeDefined();
  expect(renderer!.agentStates[0]!.position).toEqual(movement.position);
  expect(renderer!.agentStates[0]!.action).toBe(movement.animationSemantic);
  expect(renderer!.agentImportedAvatar.resolvedClip).toMatchObject({
    semantic: movement.animationSemantic,
    locomotion: movement.animationSemantic,
    verification: "semantic-review-pass",
  });
  expect(room.props["data-agent-avatar-action"]).toBe(
    movement.animationSemantic,
  );
  expect(renderer!.agentAction).toBe(movement.animationSemantic);
}

describe("follow animation after Workstream completion", () => {
  it.each([2, 8])(
    "renders actual locomotion at speed %s, rests, resumes and stops",
    (speed) => {
      const context = {
        bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 },
        userPosition: { x: 4, z: 0 },
        layoutGeneration: "blank-world",
        resolveRepositoryObject: () => null,
      };
      const request = {
        schema: "aiw.agent-movement/1",
        requestId: "follow-one",
        actorId: "claude-one",
        source: "user-directed",
        speed,
        target: { kind: "follow-user", stoppingRadius: 1.5 },
      } as const;
      let movement = requestAgentMovement(
        createAgentMovementState("claude-one", { x: 0, z: 0 }),
        request,
        context,
      ).state;
      let animation = createAvatarAnimationState();
      const check = () => {
        animation = setAvatarLocomotion(animation, movement.animationSemantic);
        renderSnapshot(movement, animation);
      };
      movement = advanceAgentMovement(movement, 0.1, context).state;
      expect(movement.position.x).toBeGreaterThan(0);
      expect(movement.animationSemantic).toBe(speed === 2 ? "Walk" : "Run");
      check();
      for (let i = 0; i < 40; i++)
        movement = advanceAgentMovement(movement, 0.1, context).state;
      expect(movement.activeRequest?.requestId).toBe("follow-one");
      expect(movement.animationSemantic).toBe("Idle");
      check();
      context.userPosition = { x: 7, z: 0 };
      movement = advanceAgentMovement(movement, 0.1, context).state;
      expect(movement.animationSemantic).toBe(speed === 2 ? "Walk" : "Run");
      check();
      movement = interruptAgentMovement(
        movement,
        request.requestId,
        "Operator stopped following",
      ).state;
      expect(movement.animationSemantic).toBe("Idle");
      check();
    },
  );
});

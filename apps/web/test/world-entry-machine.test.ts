import * as machineModule from "../src/world-entry/world-entry-machine.js";
import { describe, expect, it } from "vitest";

type MachineApi = {
  readonly createReturningWorldEntryState: (identity: {
    readonly profileId: string;
    readonly name: string;
  }) => {
    readonly step: string;
    readonly user: { readonly profileId: string; readonly name: string };
    readonly connection: {
      readonly status: string;
      readonly sessionId: string | null;
      readonly continuity: string;
    };
    readonly agentAvatar: {
      readonly status: string;
      readonly sessionId: string | null;
    };
    readonly world: {
      readonly sceneId: string;
      readonly cameraId: string;
      readonly floor: string;
    };
  };
  readonly reduceWorldEntry: (
    state: ReturnType<MachineApi["createReturningWorldEntryState"]>,
    event: Readonly<Record<string, unknown>>,
  ) => ReturnType<MachineApi["createReturningWorldEntryState"]>;
  readonly canEnterWorld: (
    state: ReturnType<MachineApi["createReturningWorldEntryState"]>,
  ) => boolean;
};

const api = machineModule as unknown as Partial<MachineApi>;

it("admits agents without restarting or replacing the active World", () => {
  const initial = machineModule.createReturningWorldEntryState({
    profileId: "user",
    name: "Aaron",
  });
  const state = {
    ...initial,
    step: "world_repository" as const,
    world: {
      ...initial.world,
      floor: "repository" as const,
      generationId: "repo",
    },
  };
  const roster = ["a", "b"].map((rosterId) => ({
    rosterId,
    adapterId: "codex" as const,
    agentName: rosterId,
    connection: {
      status: "connected" as const,
      sessionId: rosterId,
      continuity: "current" as const,
    },
    agentAvatar: {
      status: "accepted" as const,
      sessionId: rosterId,
      profileId: rosterId,
    },
  }));
  const next = machineModule.reduceWorldEntry(state, {
    type: "WORLD_ROSTER_ADDED",
    roster,
  });
  expect(next).toMatchObject({
    step: "world_repository",
    sessionMode: "multi",
    world: state.world,
    roster,
  });
  expect(next.world).toBe(state.world);
  expect(next.connection).toBe(state.connection);
  expect(
    machineModule.reduceWorldEntry(state, {
      type: "WORLD_ROSTER_ADDED",
      roster: [...roster, ...roster, ...roster],
    }),
  ).toBe(state);
});

it("cancels a pending harness without dropping completed agents and ignores late attachment", () => {
  const { createReturningWorldEntryState: initial, reduceWorldEntry: reduce } =
    machineModule;
  let state = initial({ profileId: "user", name: "Aaron" });
  for (const event of [
    { type: "PRESENT_IDENTITY" },
    { type: "SELECT_MULTI_AGENT" },
    { type: "SELECT_HARNESS", harness: "claude-code" },
    { type: "SUBMIT_AGENT_NAME", name: "Claude" },
  ] as const)
    state = reduce(state, event);
  const cancelled = reduce(state, { type: "CANCEL_AGENT_SELECTION" });
  expect(cancelled.step).toBe("constellation_multi");
  expect(cancelled.pendingAgent).toBeNull();
  expect(cancelled.roster).toBe(state.roster);
  expect(
    reduce(cancelled, {
      type: "AGENT_ATTACHED",
      rosterId: "late",
      sessionId: "late",
      continuity: "current",
    }),
  ).toBe(cancelled);
  expect(
    reduce(cancelled, { type: "SELECT_HARNESS", harness: "hermes" })
      .selectedHarness,
  ).toBe("hermes");
});

describe("Phase 18 World entry state machine", () => {
  it("provides the pure returning-user machine API", () => {
    expect(typeof api.createReturningWorldEntryState).toBe("function");
    expect(typeof api.reduceWorldEntry).toBe("function");
    expect(typeof api.canEnterWorld).toBe("function");
  });

  it("starts from restored identity and preserves it across a nontechnical miss and retry", () => {
    if (!api.createReturningWorldEntryState || !api.reduceWorldEntry) return;
    const initial = api.createReturningWorldEntryState({
      profileId: "avatar_user",
      name: "Mela",
    });
    expect(initial).toMatchObject({
      step: "returning_identity",
      sessionMode: "single",
      roster: [],
      pendingAgent: null,
      user: { profileId: "avatar_user", name: "Mela" },
      connection: {
        status: "none",
        sessionId: null,
        continuity: "none",
      },
    });

    const prompted = api.reduceWorldEntry(
      api.reduceWorldEntry(
        api.reduceWorldEntry(initial, { type: "PRESENT_IDENTITY" }),
        { type: "SELECT_SINGLE_AGENT" },
      ),
      { type: "SELECT_HERMES" },
    );
    const resolving = api.reduceWorldEntry(prompted, {
      type: "SUBMIT_AGENT_NAME",
      name: "Mr Fluff",
    });
    const missed = api.reduceWorldEntry(resolving, {
      type: "CONNECTION_NOT_FOUND",
    });
    expect(missed).toMatchObject({
      step: "agent_not_found",
      user: initial.user,
      connection: { status: "not_found", sessionId: null },
    });
    const retry = api.reduceWorldEntry(missed, { type: "RETRY_CONNECTION" });
    expect(retry).toMatchObject({
      step: "agent_prompt",
      user: initial.user,
      connection: { status: "none", sessionId: null },
    });
  });

  it("never unlocks entry before exact-session connection and deliberate avatar acceptance", () => {
    if (
      !api.createReturningWorldEntryState ||
      !api.reduceWorldEntry ||
      !api.canEnterWorld
    )
      return;
    let state = api.createReturningWorldEntryState({
      profileId: "avatar_user",
      name: "Mela",
    });
    for (const event of [
      { type: "PRESENT_IDENTITY" },
      { type: "SELECT_SINGLE_AGENT" },
      { type: "SELECT_HERMES" },
      { type: "SUBMIT_AGENT_NAME", name: "Mr Fluff" },
      {
        type: "CONNECTION_ATTACHED",
        sessionId: "world_session_a",
        continuity: "current",
      },
      { type: "OPEN_AGENT_AVATAR" },
    ])
      state = api.reduceWorldEntry(state, event);
    expect(state.step).toBe("agent_avatar");
    expect(api.canEnterWorld(state)).toBe(false);

    const mismatch = api.reduceWorldEntry(state, {
      type: "ACCEPT_AGENT_AVATAR",
      sessionId: "world_session_b",
      avatarProfileId: "avatar_mr_fluff",
    });
    expect(mismatch.step).toBe("agent_avatar");
    expect(api.canEnterWorld(mismatch)).toBe(false);

    state = api.reduceWorldEntry(state, {
      type: "ACCEPT_AGENT_AVATAR",
      sessionId: "world_session_a",
      avatarProfileId: "avatar_mr_fluff",
    });
    expect(state).toMatchObject({
      step: "enter_ready",
      connection: {
        status: "connected",
        sessionId: "world_session_a",
        continuity: "current",
      },
      agentAvatar: {
        status: "accepted",
        sessionId: "world_session_a",
      },
    });
    expect(api.canEnterWorld(state)).toBe(true);
  });

  it("keeps unavailable, stale, current, and previous/recovered connection truth distinct", () => {
    if (!api.createReturningWorldEntryState || !api.reduceWorldEntry) return;
    const resolving = [
      { type: "PRESENT_IDENTITY" },
      { type: "SELECT_SINGLE_AGENT" },
      { type: "SELECT_HERMES" },
      { type: "SUBMIT_AGENT_NAME", name: "Mr Fluff" },
    ].reduce(
      (state, event) => api.reduceWorldEntry!(state, event),
      api.createReturningWorldEntryState({
        profileId: "avatar_user",
        name: "Mela",
      }),
    );
    expect(
      api.reduceWorldEntry(resolving, {
        type: "CONNECTION_UNAVAILABLE",
        stale: false,
      }).connection,
    ).toMatchObject({ status: "unavailable", continuity: "none" });
    expect(
      api.reduceWorldEntry(resolving, {
        type: "CONNECTION_UNAVAILABLE",
        stale: true,
      }).connection,
    ).toMatchObject({ status: "stale", continuity: "none" });
    expect(
      api.reduceWorldEntry(resolving, {
        type: "CONNECTION_ATTACHED",
        sessionId: "world_current",
        continuity: "current",
      }).connection,
    ).toMatchObject({ status: "connected", continuity: "current" });
    expect(
      api.reduceWorldEntry(resolving, {
        type: "CONNECTION_ATTACHED",
        sessionId: "world_previous",
        continuity: "previous-recovered",
      }).connection,
    ).toMatchObject({
      status: "connected",
      continuity: "previous-recovered",
    });
  });

  it("restores a proven accepted exact session directly into the blank World room", () => {
    if (!api.createReturningWorldEntryState || !api.reduceWorldEntry) return;
    const restored = api.reduceWorldEntry(
      api.createReturningWorldEntryState({
        profileId: "avatar_user",
        name: "Mela",
      }),
      {
        type: "RESTORE_WORLD",
        sessionId: "world_current",
        continuity: "current",
        agentName: "Mr Fluff",
        avatarProfileId: "avatar_mr_fluff",
      },
    );
    expect(restored).toMatchObject({
      step: "world_blank",
      sessionMode: "single",
      pendingAgent: null,
      roster: [
        {
          rosterId: "world_current",
          adapterId: "hermes",
          agentName: "Mr Fluff",
        },
      ],
      selectedHarness: "hermes",
      agentName: "Mr Fluff",
      connection: {
        status: "connected",
        sessionId: "world_current",
        continuity: "current",
      },
      agentAvatar: {
        status: "accepted",
        sessionId: "world_current",
        profileId: "avatar_mr_fluff",
      },
      world: {
        sceneId: "world-room",
        cameraId: "third-person-user",
        floor: "blank",
      },
    });
  });

  it("restores an accepted legacy exact session into explicit avatar migration without changing its attachment", () => {
    if (!api.createReturningWorldEntryState || !api.reduceWorldEntry) return;
    const restored = api.reduceWorldEntry(
      api.createReturningWorldEntryState({
        profileId: "avatar_user",
        name: "Mela",
      }),
      {
        type: "RESTORE_AGENT_AVATAR",
        sessionId: "world_current",
        continuity: "current",
        agentName: "Mr Fluff",
      },
    );
    expect(restored).toMatchObject({
      step: "agent_avatar",
      sessionMode: "single",
      roster: [],
      pendingAgent: {
        rosterId: "world_current",
        adapterId: "hermes",
        agentName: "Mr Fluff",
      },
      selectedHarness: "hermes",
      agentName: "Mr Fluff",
      connection: {
        status: "connected",
        sessionId: "world_current",
        continuity: "current",
      },
      agentAvatar: {
        status: "editing",
        sessionId: "world_current",
        profileId: null,
      },
    });
    expect(api.canEnterWorld?.(restored)).toBe(false);
  });

  it("detaches only World presentation for logout/reset and returns Change Agent to an empty prompt", () => {
    if (!api.createReturningWorldEntryState || !api.reduceWorldEntry) return;
    const initial = api.createReturningWorldEntryState({
      profileId: "avatar_user",
      name: "Mela",
    });
    const world = api.reduceWorldEntry(initial, {
      type: "RESTORE_WORLD",
      sessionId: "world_current",
      continuity: "current",
      agentName: "Mr Fluff",
      avatarProfileId: "avatar_mr_fluff",
    });
    const sessionEntry = api.reduceWorldEntry(world, {
      type: "LEAVE_WORLD",
      destination: "session_select",
    });
    expect(sessionEntry).toMatchObject({
      step: "session_select",
      user: initial.user,
      selectedHarness: null,
      agentName: "",
      connection: {
        status: "none",
        sessionId: null,
        continuity: "none",
      },
      world: { floor: "blank", generationId: null },
      repository: { status: "idle", request: "", error: "" },
    });
    const agentPrompt = api.reduceWorldEntry(world, {
      type: "LEAVE_WORLD",
      destination: "agent_prompt",
    });
    expect(agentPrompt).toMatchObject({
      step: "agent_prompt",
      user: initial.user,
      roster: [],
      pendingAgent: { adapterId: "hermes", agentName: "" },
      selectedHarness: "hermes",
      agentName: "",
      connection: {
        status: "none",
        sessionId: null,
        continuity: "none",
      },
    });
  });

  it("honors Claude and Codex selection from the Change Agent prompt", () => {
    if (!api.createReturningWorldEntryState || !api.reduceWorldEntry) return;
    const world = api.reduceWorldEntry(
      api.createReturningWorldEntryState({
        profileId: "avatar_user",
        name: "Mela",
      }),
      {
        type: "RESTORE_WORLD",
        sessionId: "world_current",
        continuity: "current",
        agentName: "Claude",
        avatarProfileId: "avatar_claude",
      },
    );
    let state = api.reduceWorldEntry(world, {
      type: "LEAVE_WORLD",
      destination: "agent_prompt",
    });
    for (const harness of ["claude-code", "codex", "claude-code"]) {
      state = api.reduceWorldEntry(state, { type: "SELECT_HARNESS", harness });
      expect(state).toMatchObject({
        selectedHarness: harness,
        pendingAgent: { adapterId: harness, connection: { status: "none" } },
      });
    }
    state = api.reduceWorldEntry(state, {
      type: "SUBMIT_AGENT_NAME",
      name: "Claude",
    });
    const connecting = state;
    expect(
      api.reduceWorldEntry(state, { type: "SELECT_HARNESS", harness: "codex" }),
    ).toBe(connecting);
    state = api.reduceWorldEntry(state, {
      type: "CONNECTION_UNAVAILABLE",
      stale: false,
    });
    state = api.reduceWorldEntry(state, {
      type: "SELECT_HARNESS",
      harness: "codex",
    });
    expect(state).toMatchObject({
      selectedHarness: "codex",
      connection: { status: "none" },
    });
  });

  it("ignores animation as authority and activates only a successful current or disclosed recovered floor", () => {
    if (!api.createReturningWorldEntryState || !api.reduceWorldEntry) return;
    const initial = api.createReturningWorldEntryState({
      profileId: "avatar_user",
      name: "Mela",
    });
    expect(
      api.reduceWorldEntry(initial, { type: "ANIMATION_FINISHED" }),
    ).toEqual(initial);

    let state = initial;
    for (const event of [
      { type: "PRESENT_IDENTITY" },
      { type: "SELECT_SINGLE_AGENT" },
      { type: "SELECT_HERMES" },
      { type: "SUBMIT_AGENT_NAME", name: "Mr Fluff" },
      {
        type: "CONNECTION_ATTACHED",
        sessionId: "world_session_a",
        continuity: "current",
      },
      { type: "OPEN_AGENT_AVATAR" },
      {
        type: "ACCEPT_AGENT_AVATAR",
        sessionId: "world_session_a",
        avatarProfileId: "avatar_mr_fluff",
      },
      { type: "ENTER_WORLD" },
      { type: "WORLD_READY" },
      { type: "REQUEST_REPOSITORY", request: "Load AgentIntersect World" },
    ])
      state = api.reduceWorldEntry(state, event);
    expect(state).toMatchObject({
      step: "repository_loading",
      world: {
        sceneId: "world-room",
        cameraId: "third-person-user",
        floor: "blank",
      },
    });

    const unproven = api.reduceWorldEntry(state, {
      type: "ACTIVATE_REPOSITORY",
      generationId: "generation_a",
      projectionTruth: "unavailable",
    });
    expect(unproven.world.floor).toBe("blank");
    const failed = api.reduceWorldEntry(state, {
      type: "REPOSITORY_FAILED",
      reason: "Repository unavailable",
    });
    expect(failed).toMatchObject({
      step: "world_blank",
      world: { sceneId: "world-room", floor: "blank" },
    });

    const active = api.reduceWorldEntry(state, {
      type: "ACTIVATE_REPOSITORY",
      generationId: "generation_a",
      projectionTruth: "previous-recovered",
    });
    expect(active).toMatchObject({
      step: "world_repository",
      world: {
        sceneId: "world-room",
        cameraId: "third-person-user",
        floor: "repository",
      },
    });

    const switching = api.reduceWorldEntry(active, {
      type: "REQUEST_REPOSITORY",
      request: "Load Notes App",
    });
    const preserved = api.reduceWorldEntry(switching, {
      type: "REPOSITORY_FAILED",
      reason: "Replacement unavailable",
    });
    expect(preserved).toMatchObject({
      step: "world_repository",
      world: {
        floor: "repository",
        generationId: "generation_a",
        projectionTruth: "previous-recovered",
      },
    });
  });
});

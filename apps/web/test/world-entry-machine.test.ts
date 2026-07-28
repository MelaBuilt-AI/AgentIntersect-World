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
  });
});

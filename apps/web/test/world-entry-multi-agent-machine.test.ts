import * as machineModule from "../src/world-entry/world-entry-machine.js";
import { describe, expect, it } from "vitest";

type State = Readonly<Record<string, unknown>>;
type MachineApi = {
  readonly createReturningWorldEntryState: (identity: {
    readonly profileId: string;
    readonly name: string;
  }) => State;
  readonly reduceWorldEntry: (
    state: State,
    event: Readonly<Record<string, unknown>>,
  ) => State;
  readonly canEnterWorld: (state: State) => boolean;
};

const api = machineModule as unknown as MachineApi;

const enterMulti = () => {
  const initial = api.createReturningWorldEntryState({
    profileId: "avatar_user",
    name: "Mela",
  });
  return [{ type: "PRESENT_IDENTITY" }, { type: "SELECT_MULTI_AGENT" }].reduce(
    api.reduceWorldEntry,
    initial,
  );
};

const addAgent = (
  state: State,
  input: {
    readonly harness: string;
    readonly rosterId: string;
    readonly name: string;
    readonly sessionId: string;
    readonly avatarProfileId: string;
  },
) => {
  let next = state;
  for (const event of [
    { type: "SELECT_HARNESS", harness: input.harness },
    { type: "SUBMIT_AGENT_NAME", name: input.name },
    {
      type: "AGENT_ATTACHED",
      rosterId: input.rosterId,
      sessionId: input.sessionId,
      continuity: "current",
    },
    { type: "OPEN_AGENT_AVATAR" },
    {
      type: "AGENT_AVATAR_ACCEPTED",
      rosterId: input.rosterId,
      sessionId: input.sessionId,
      avatarProfileId: input.avatarProfileId,
    },
    { type: "RETURN_TO_CONSTELLATION" },
  ]) {
    const reduced = api.reduceWorldEntry(next, event);
    expect(reduced, `event ${event.type} must return state`).toBeDefined();
    next = reduced;
  }
  return next;
};

describe("Phase 19 multi-agent World entry state machine", () => {
  it("selects explicit multi-agent mode with an empty ordered roster", () => {
    const initial = api.createReturningWorldEntryState({
      profileId: "avatar_user",
      name: "Mela",
    });
    const sessionSelect = api.reduceWorldEntry(initial, {
      type: "PRESENT_IDENTITY",
    });
    const multi = api.reduceWorldEntry(sessionSelect, {
      type: "SELECT_MULTI_AGENT",
    });

    expect(multi).toMatchObject({
      step: "constellation_multi",
      sessionMode: "multi",
      roster: [],
      pendingAgent: null,
    });
  });

  it("moves one pending setup at a time into stable roster order", () => {
    const first = addAgent(enterMulti(), {
      harness: "hermes",
      rosterId: "roster-hermes",
      name: "Mr Fluff",
      sessionId: "session-hermes",
      avatarProfileId: "avatar-hermes",
    });
    const second = addAgent(first, {
      harness: "codex",
      rosterId: "roster-codex",
      name: "Codex",
      sessionId: "session-codex",
      avatarProfileId: "avatar-codex",
    });

    expect(second).toMatchObject({
      step: "enter_ready",
      pendingAgent: null,
      roster: [
        {
          rosterId: "roster-hermes",
          adapterId: "hermes",
          agentName: "Mr Fluff",
          connection: { sessionId: "session-hermes" },
          agentAvatar: { profileId: "avatar-hermes" },
        },
        {
          rosterId: "roster-codex",
          adapterId: "codex",
          agentName: "Codex",
          connection: { sessionId: "session-codex" },
          agentAvatar: { profileId: "avatar-codex" },
        },
      ],
    });
  });

  it("requires two complete agents and no pending setup before multi-agent entry", () => {
    const first = addAgent(enterMulti(), {
      harness: "hermes",
      rosterId: "roster-hermes",
      name: "Mr Fluff",
      sessionId: "session-hermes",
      avatarProfileId: "avatar-hermes",
    });
    expect(api.canEnterWorld(first)).toBe(false);

    const second = addAgent(first, {
      harness: "openclaw",
      rosterId: "roster-openclaw",
      name: "Claw",
      sessionId: "session-openclaw",
      avatarProfileId: "avatar-openclaw",
    });
    expect(second).toMatchObject({ step: "enter_ready" });
    expect(api.canEnterWorld(second)).toBe(true);

    expect(api.reduceWorldEntry(second, { type: "ENTER_WORLD" })).toMatchObject(
      { step: "world_entering" },
    );

    const pending = api.reduceWorldEntry(second, {
      type: "SELECT_HARNESS",
      harness: "claude-code",
    });
    expect(api.canEnterWorld(pending)).toBe(false);
    expect(
      api.reduceWorldEntry(pending, { type: "ANIMATION_FINISHED" }),
    ).toEqual(pending);
  });

  it("rejects a duplicate exact roster identity without changing accepted entries", () => {
    const first = addAgent(enterMulti(), {
      harness: "hermes",
      rosterId: "roster-exact",
      name: "Mr Fluff",
      sessionId: "session-hermes",
      avatarProfileId: "avatar-hermes",
    });
    const duplicate = addAgent(first, {
      harness: "codex",
      rosterId: "roster-exact",
      name: "Codex",
      sessionId: "session-codex",
      avatarProfileId: "avatar-codex",
    });

    expect(duplicate).toMatchObject({
      step: "agent_avatar",
      roster: [{ rosterId: "roster-exact", agentName: "Mr Fluff" }],
      pendingAgent: { rosterId: "roster-exact", agentName: "Codex" },
    });
  });

  it("keeps stale entries visible until exact reconnect or explicit removal", () => {
    const first = addAgent(enterMulti(), {
      harness: "hermes",
      rosterId: "roster-hermes",
      name: "Mr Fluff",
      sessionId: "session-hermes",
      avatarProfileId: "avatar-hermes",
    });
    const ready = addAgent(first, {
      harness: "claude-code",
      rosterId: "roster-claude",
      name: "Claude",
      sessionId: "session-claude",
      avatarProfileId: "avatar-claude",
    });
    const unavailable = api.reduceWorldEntry(ready, {
      type: "RECONNECT_AGENT",
      rosterId: "roster-hermes",
      status: "unavailable",
    });
    expect(unavailable).toMatchObject({
      roster: [
        {
          rosterId: "roster-hermes",
          connection: { status: "unavailable", sessionId: "session-hermes" },
        },
        { rosterId: "roster-claude" },
      ],
    });
    expect(api.canEnterWorld(unavailable)).toBe(false);

    const stale = api.reduceWorldEntry(ready, {
      type: "RECONNECT_AGENT",
      rosterId: "roster-claude",
      status: "stale",
      sessionId: "wrong-session",
    });
    expect(stale).toMatchObject({
      roster: [
        { rosterId: "roster-hermes" },
        {
          rosterId: "roster-claude",
          connection: {
            status: "stale",
            sessionId: "session-claude",
            continuity: "none",
          },
        },
      ],
    });
    expect(api.canEnterWorld(stale)).toBe(false);

    const wrongReconnect = api.reduceWorldEntry(stale, {
      type: "RECONNECT_AGENT",
      rosterId: "roster-claude",
      sessionId: "wrong-session",
      continuity: "current",
    });
    expect(wrongReconnect).toEqual(stale);

    const reconnected = api.reduceWorldEntry(stale, {
      type: "RECONNECT_AGENT",
      rosterId: "roster-claude",
      sessionId: "session-claude",
      continuity: "previous-recovered",
    });
    expect(api.canEnterWorld(reconnected)).toBe(true);

    const removed = api.reduceWorldEntry(reconnected, {
      type: "REMOVE_AGENT",
      rosterId: "roster-hermes",
    });
    expect(removed).toMatchObject({
      roster: [{ rosterId: "roster-claude" }],
    });
    expect(api.canEnterWorld(removed)).toBe(false);
  });

  it("restores one accepted four-agent constellation directly into the same active World", () => {
    const initial = api.createReturningWorldEntryState({
      profileId: "avatar_user",
      name: "Mela",
    });
    const agents = [
      ["roster-hermes", "hermes", "Mr Fluff", "session-hermes"],
      ["roster-openclaw", "openclaw", "Claw", "session-openclaw"],
      ["roster-codex", "codex", "Codex", "session-codex"],
      ["roster-claude", "claude-code", "Claude", "session-claude"],
    ].map(([rosterId, adapterId, agentName, sessionId]) => ({
      rosterId,
      adapterId,
      agentName,
      sessionId,
      continuity: "current",
      avatarProfileId: `avatar-${adapterId}`,
    }));

    const restored = api.reduceWorldEntry(initial, {
      type: "RESTORE_CONSTELLATION",
      agents,
    });

    expect(restored).toMatchObject({
      step: "world_blank",
      sessionMode: "multi",
      pendingAgent: null,
      roster: agents.map((agent) => ({
        rosterId: agent.rosterId,
        adapterId: agent.adapterId,
        agentName: agent.agentName,
        connection: {
          status: "connected",
          sessionId: agent.sessionId,
          continuity: "current",
        },
        agentAvatar: {
          status: "accepted",
          sessionId: agent.sessionId,
          profileId: agent.avatarProfileId,
        },
      })),
    });
    expect(restored.roster as readonly unknown[]).toHaveLength(4);
    expect(api.canEnterWorld(restored)).toBe(true);
  });

  it("restores a stale retained member visibly and blocks entry until exact reconnect or remove", () => {
    const initial = api.createReturningWorldEntryState({
      profileId: "avatar_user",
      name: "Mela",
    });
    const restored = api.reduceWorldEntry(initial, {
      type: "RESTORE_CONSTELLATION",
      enterWorld: false,
      agents: [
        {
          rosterId: "roster-hermes",
          adapterId: "hermes",
          agentName: "Mr Fluff",
          sessionId: "session-hermes",
          connectionStatus: "connected",
          continuity: "current",
          avatarProfileId: "avatar-hermes",
        },
        {
          rosterId: "roster-codex",
          adapterId: "codex",
          agentName: "Codex",
          sessionId: "session-codex",
          connectionStatus: "connected",
          continuity: "current",
          avatarProfileId: "avatar-codex",
        },
        {
          rosterId: "roster-claude",
          adapterId: "claude-code",
          agentName: "Claude",
          sessionId: "session-claude",
          connectionStatus: "stale",
          continuity: "none",
          avatarProfileId: "avatar-claude",
        },
      ],
    });

    expect(restored).toMatchObject({
      step: "constellation_multi",
      sessionMode: "multi",
      roster: [
        { rosterId: "roster-hermes", connection: { status: "connected" } },
        { rosterId: "roster-codex", connection: { status: "connected" } },
        {
          rosterId: "roster-claude",
          connection: { status: "stale", continuity: "none" },
          agentAvatar: { status: "accepted", profileId: "avatar-claude" },
        },
      ],
    });
    expect(api.canEnterWorld(restored)).toBe(false);

    const reconnected = api.reduceWorldEntry(restored, {
      type: "RECONNECT_AGENT",
      rosterId: "roster-claude",
      sessionId: "session-claude",
      continuity: "previous-recovered",
    });
    expect(api.canEnterWorld(reconnected)).toBe(true);
  });

  it("caps the stable roster at four accepted entries", () => {
    let state = enterMulti();
    for (const [index, harness] of [
      "hermes",
      "openclaw",
      "codex",
      "claude-code",
    ].entries()) {
      state = addAgent(state, {
        harness,
        rosterId: `roster-${index}`,
        name: `Agent ${index}`,
        sessionId: `session-${index}`,
        avatarProfileId: `avatar-${index}`,
      });
    }
    const fifth = api.reduceWorldEntry(state, {
      type: "SELECT_HARNESS",
      harness: "codex",
    });

    expect(fifth).toEqual(state);
    expect(fifth).toMatchObject({ pendingAgent: null });
    expect(fifth.roster as readonly unknown[]).toHaveLength(4);
  });
});

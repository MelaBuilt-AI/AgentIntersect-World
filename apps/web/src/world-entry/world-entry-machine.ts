export const WORLD_ENTRY_MACHINE_VERSION = "phase19-task9";

export type WorldEntryStep =
  | "returning_identity"
  | "session_select"
  | "constellation_single"
  | "constellation_multi"
  | "agent_prompt"
  | "agent_resolving"
  | "agent_not_found"
  | "agent_connected"
  | "agent_avatar"
  | "enter_ready"
  | "world_entering"
  | "world_blank"
  | "repository_loading"
  | "world_repository";

export type WorldEntryConnection = {
  readonly status:
    "none" | "connecting" | "not_found" | "unavailable" | "stale" | "connected";
  readonly sessionId: string | null;
  readonly continuity: "none" | "current" | "previous-recovered";
};

export type WorldEntryAdapterId =
  "hermes" | "openclaw" | "codex" | "claude-code";

export type WorldEntryRosterEntry = {
  readonly rosterId: string;
  readonly adapterId: WorldEntryAdapterId;
  readonly agentName: string;
  readonly connection: WorldEntryConnection;
  readonly agentAvatar: {
    readonly status: "missing" | "editing" | "accepted";
    readonly sessionId: string | null;
    readonly profileId: string | null;
  };
};

export type WorldEntryPendingAgent = WorldEntryRosterEntry;

export type WorldEntryState = {
  readonly step: WorldEntryStep;
  readonly user: {
    readonly profileId: string;
    readonly name: string;
  };
  readonly sessionMode: "single" | "multi";
  readonly roster: readonly WorldEntryRosterEntry[];
  readonly pendingAgent: WorldEntryPendingAgent | null;
  /** Derived compatibility projection for the Task 10-unmodified UI. */
  readonly selectedHarness: WorldEntryAdapterId | null;
  /** Derived compatibility projection for the Task 10-unmodified UI. */
  readonly agentName: string;
  /** Derived compatibility projection for the Task 10-unmodified UI. */
  readonly connection: WorldEntryConnection;
  /** Derived compatibility projection for the Task 10-unmodified UI. */
  readonly agentAvatar: {
    readonly status: "missing" | "editing" | "accepted";
    readonly sessionId: string | null;
    readonly profileId: string | null;
  };
  readonly world: {
    readonly sceneId: "world-room";
    readonly cameraId: "third-person-user";
    readonly floor: "blank" | "repository";
    readonly generationId: string | null;
    readonly projectionTruth: "none" | "current" | "previous-recovered";
  };
  readonly repository: {
    readonly status: "idle" | "loading" | "failed" | "active";
    readonly request: string;
    readonly error: string;
  };
};

export type WorldEntryEvent =
  | { readonly type: "PRESENT_IDENTITY" }
  | { readonly type: "SELECT_SINGLE_AGENT" }
  | { readonly type: "SELECT_MULTI_AGENT" }
  | {
      readonly type: "SELECT_HARNESS";
      readonly harness: WorldEntryAdapterId;
    }
  | { readonly type: "SELECT_HERMES" }
  | { readonly type: "SUBMIT_AGENT_NAME"; readonly name: string }
  | { readonly type: "CONNECTION_NOT_FOUND" }
  | { readonly type: "RETRY_CONNECTION" }
  | {
      readonly type: "CONNECTION_UNAVAILABLE";
      readonly stale: boolean;
    }
  | {
      readonly type: "CONNECTION_ATTACHED";
      readonly sessionId: string;
      readonly continuity: "current" | "previous-recovered";
    }
  | {
      readonly type: "AGENT_ATTACHED";
      readonly rosterId: string;
      readonly sessionId: string;
      readonly continuity: "current" | "previous-recovered";
    }
  | {
      readonly type: "RESTORE_WORLD";
      readonly sessionId: string;
      readonly continuity: "current" | "previous-recovered";
      readonly agentName: string;
      readonly avatarProfileId: string;
    }
  | {
      readonly type: "RESTORE_CONSTELLATION";
      readonly enterWorld?: boolean;
      readonly repository?: {
        readonly generationId: string;
        readonly projectionTruth: "current" | "previous-recovered";
      };
      readonly agents: readonly {
        readonly rosterId: string;
        readonly adapterId: WorldEntryAdapterId;
        readonly agentName: string;
        readonly sessionId: string;
        readonly connectionStatus?: "connected" | "stale" | "unavailable";
        readonly continuity: "none" | "current" | "previous-recovered";
        readonly avatarProfileId: string;
      }[];
    }
  | {
      readonly type: "RESTORE_AGENT_AVATAR";
      readonly sessionId: string;
      readonly continuity: "current" | "previous-recovered";
      readonly agentName: string;
    }
  | { readonly type: "OPEN_AGENT_AVATAR" }
  | {
      readonly type: "ACCEPT_AGENT_AVATAR";
      readonly sessionId: string;
      readonly avatarProfileId: string;
    }
  | {
      readonly type: "AGENT_AVATAR_ACCEPTED";
      readonly rosterId?: string;
      readonly sessionId: string;
      readonly avatarProfileId: string;
    }
  | { readonly type: "RETURN_TO_CONSTELLATION" }
  | {
      readonly type: "RECONNECT_AGENT";
      readonly rosterId: string;
      readonly status?: "connected" | "stale" | "unavailable";
      readonly sessionId?: string;
      readonly continuity?: "current" | "previous-recovered";
    }
  | { readonly type: "REMOVE_AGENT"; readonly rosterId: string }
  | { readonly type: "ENTER_WORLD" }
  | { readonly type: "WORLD_READY" }
  | { readonly type: "REQUEST_REPOSITORY"; readonly request: string }
  | { readonly type: "REPOSITORY_FAILED"; readonly reason: string }
  | {
      readonly type: "ACTIVATE_REPOSITORY";
      readonly generationId: string;
      readonly projectionTruth:
        "current" | "previous-recovered" | "unavailable";
    }
  | {
      readonly type: "LEAVE_WORLD";
      readonly destination: "session_select" | "agent_prompt";
    }
  | { readonly type: "ANIMATION_FINISHED" };

const emptyConnection = (): WorldEntryConnection => ({
  status: "none",
  sessionId: null,
  continuity: "none",
});

const emptyAvatar = (): WorldEntryRosterEntry["agentAvatar"] => ({
  status: "missing",
  sessionId: null,
  profileId: null,
});

function projectSetupAuthority(state: WorldEntryState): WorldEntryState {
  const entry =
    state.pendingAgent ?? state.roster[state.roster.length - 1] ?? null;
  return {
    ...state,
    selectedHarness: entry?.adapterId ?? null,
    agentName: entry?.agentName ?? "",
    connection: entry?.connection ?? emptyConnection(),
    agentAvatar: entry?.agentAvatar ?? emptyAvatar(),
  };
}

function pendingForHarness(
  harness: WorldEntryAdapterId,
): WorldEntryPendingAgent {
  return {
    rosterId: "",
    adapterId: harness,
    agentName: "",
    connection: emptyConnection(),
    agentAvatar: emptyAvatar(),
  };
}

export function createReturningWorldEntryState(identity: {
  readonly profileId: string;
  readonly name: string;
}): WorldEntryState {
  return {
    step: "returning_identity",
    user: identity,
    sessionMode: "single",
    roster: [],
    pendingAgent: null,
    selectedHarness: null,
    agentName: "",
    connection: emptyConnection(),
    agentAvatar: {
      status: "missing",
      sessionId: null,
      profileId: null,
    },
    world: {
      sceneId: "world-room",
      cameraId: "third-person-user",
      floor: "blank",
      generationId: null,
      projectionTruth: "none",
    },
    repository: {
      status: "idle",
      request: "",
      error: "",
    },
  };
}

export function canEnterWorld(state: WorldEntryState): boolean {
  if (state.pendingAgent !== null) return false;
  const ready = state.roster.every(
    (entry) =>
      entry.connection.status === "connected" &&
      entry.connection.sessionId !== null &&
      (entry.connection.continuity === "current" ||
        entry.connection.continuity === "previous-recovered") &&
      entry.agentAvatar.status === "accepted" &&
      entry.agentAvatar.sessionId === entry.connection.sessionId &&
      entry.agentAvatar.profileId !== null,
  );
  return state.sessionMode === "single"
    ? state.roster.length === 1 && ready
    : state.roster.length >= 2 && state.roster.length <= 4 && ready;
}

function safeName(value: string): string {
  return value.trim().slice(0, 80);
}

export function reduceWorldEntry(
  state: WorldEntryState,
  event: WorldEntryEvent,
): WorldEntryState {
  switch (event.type) {
    case "PRESENT_IDENTITY":
      return state.step === "returning_identity"
        ? { ...state, step: "session_select" }
        : state;
    case "SELECT_SINGLE_AGENT":
      return state.step === "session_select"
        ? { ...state, step: "constellation_single", sessionMode: "single" }
        : state;
    case "SELECT_MULTI_AGENT":
      return state.step === "session_select"
        ? { ...state, step: "constellation_multi", sessionMode: "multi" }
        : state;
    case "SELECT_HARNESS":
      return (state.step === "constellation_single" ||
        state.step === "constellation_multi" ||
        (state.step === "enter_ready" && state.sessionMode === "multi")) &&
        state.pendingAgent === null &&
        state.roster.length < 4
        ? projectSetupAuthority({
            ...state,
            step: "agent_prompt",
            pendingAgent: pendingForHarness(event.harness),
          })
        : state;
    case "SELECT_HERMES":
      return state.step === "constellation_single"
        ? projectSetupAuthority({
            ...state,
            step: "agent_prompt",
            pendingAgent: pendingForHarness("hermes"),
          })
        : state;
    case "SUBMIT_AGENT_NAME": {
      const name = safeName(event.name);
      return state.step === "agent_prompt" && name && state.pendingAgent
        ? projectSetupAuthority({
            ...state,
            step: "agent_resolving",
            pendingAgent: {
              ...state.pendingAgent,
              agentName: name,
              connection: {
                status: "connecting",
                sessionId: null,
                continuity: "none",
              },
            },
          })
        : state;
    }
    case "CONNECTION_NOT_FOUND":
      return state.step === "agent_resolving" && state.pendingAgent
        ? projectSetupAuthority({
            ...state,
            step: "agent_not_found",
            pendingAgent: {
              ...state.pendingAgent,
              connection: {
                status: "not_found",
                sessionId: null,
                continuity: "none",
              },
            },
          })
        : state;
    case "RETRY_CONNECTION":
      return state.step === "agent_not_found" ||
        state.connection.status === "unavailable" ||
        state.connection.status === "stale"
        ? projectSetupAuthority({
            ...state,
            step: "agent_prompt",
            pendingAgent: state.pendingAgent
              ? { ...state.pendingAgent, connection: emptyConnection() }
              : null,
          })
        : state;
    case "CONNECTION_UNAVAILABLE":
      return state.step === "agent_resolving" && state.pendingAgent
        ? projectSetupAuthority({
            ...state,
            step: "agent_prompt",
            pendingAgent: {
              ...state.pendingAgent,
              connection: {
                status: event.stale ? "stale" : "unavailable",
                sessionId: null,
                continuity: "none",
              },
            },
          })
        : state;
    case "CONNECTION_ATTACHED":
    case "AGENT_ATTACHED":
      return state.step === "agent_resolving" &&
        state.pendingAgent &&
        event.sessionId &&
        (event.type === "CONNECTION_ATTACHED" || event.rosterId)
        ? projectSetupAuthority({
            ...state,
            step: "agent_connected",
            pendingAgent: {
              ...state.pendingAgent,
              rosterId:
                event.type === "AGENT_ATTACHED"
                  ? event.rosterId
                  : event.sessionId,
              connection: {
                status: "connected",
                sessionId: event.sessionId,
                continuity: event.continuity,
              },
              agentAvatar: emptyAvatar(),
            },
          })
        : state;
    case "RESTORE_WORLD": {
      const agentName = safeName(event.agentName);
      return state.step === "returning_identity" &&
        event.sessionId &&
        agentName &&
        event.avatarProfileId
        ? projectSetupAuthority({
            ...state,
            step: "world_blank",
            sessionMode: "single",
            roster: [
              {
                rosterId: event.sessionId,
                adapterId: "hermes",
                agentName,
                connection: {
                  status: "connected",
                  sessionId: event.sessionId,
                  continuity: event.continuity,
                },
                agentAvatar: {
                  status: "accepted",
                  sessionId: event.sessionId,
                  profileId: event.avatarProfileId,
                },
              },
            ],
            pendingAgent: null,
          })
        : state;
    }
    case "RESTORE_CONSTELLATION": {
      if (
        state.step !== "returning_identity" ||
        event.agents.length < 2 ||
        event.agents.length > 4
      )
        return state;
      const rosterIds = new Set(event.agents.map((agent) => agent.rosterId));
      const sessionIds = new Set(event.agents.map((agent) => agent.sessionId));
      if (
        rosterIds.size !== event.agents.length ||
        sessionIds.size !== event.agents.length ||
        event.agents.some(
          (agent) =>
            !agent.rosterId ||
            !agent.sessionId ||
            !agent.avatarProfileId ||
            !safeName(agent.agentName),
        )
      )
        return state;
      const restoredRepository =
        event.enterWorld !== false && event.repository
          ? event.repository
          : null;
      return projectSetupAuthority({
        ...state,
        step:
          event.enterWorld === false
            ? "constellation_multi"
            : restoredRepository
              ? "world_repository"
              : "world_blank",
        ...(restoredRepository
          ? {
              repository: {
                ...state.repository,
                status: "active" as const,
                request: "restored repository",
                error: "",
              },
              world: {
                ...state.world,
                floor: "repository" as const,
                generationId: restoredRepository.generationId,
                projectionTruth: restoredRepository.projectionTruth,
              },
            }
          : {}),
        sessionMode: "multi",
        roster: event.agents.map((agent) => ({
          rosterId: agent.rosterId,
          adapterId: agent.adapterId,
          agentName: safeName(agent.agentName),
          connection: {
            status: agent.connectionStatus ?? "connected",
            sessionId: agent.sessionId,
            continuity: agent.continuity,
          },
          agentAvatar: {
            status: "accepted",
            sessionId: agent.sessionId,
            profileId: agent.avatarProfileId,
          },
        })),
        pendingAgent: null,
      });
    }
    case "RESTORE_AGENT_AVATAR": {
      const agentName = safeName(event.agentName);
      return state.step === "returning_identity" && event.sessionId && agentName
        ? projectSetupAuthority({
            ...state,
            step: "agent_avatar",
            sessionMode: "single",
            roster: [],
            pendingAgent: {
              rosterId: event.sessionId,
              adapterId: "hermes",
              agentName,
              connection: {
                status: "connected",
                sessionId: event.sessionId,
                continuity: event.continuity,
              },
              agentAvatar: {
                status: "editing",
                sessionId: event.sessionId,
                profileId: null,
              },
            },
          })
        : state;
    }
    case "OPEN_AGENT_AVATAR":
      return state.step === "agent_connected" &&
        state.pendingAgent?.connection.sessionId !== null &&
        state.pendingAgent !== null
        ? projectSetupAuthority({
            ...state,
            step: "agent_avatar",
            pendingAgent: {
              ...state.pendingAgent,
              agentAvatar: {
                status: "editing",
                sessionId: state.pendingAgent.connection.sessionId,
                profileId: null,
              },
            },
          })
        : state;
    case "ACCEPT_AGENT_AVATAR":
    case "AGENT_AVATAR_ACCEPTED": {
      const pending = state.pendingAgent;
      if (
        state.step !== "agent_avatar" ||
        pending === null ||
        pending.connection.status !== "connected" ||
        !event.avatarProfileId ||
        event.sessionId !== pending.connection.sessionId ||
        event.sessionId !== pending.agentAvatar.sessionId ||
        (event.type === "AGENT_AVATAR_ACCEPTED" &&
          event.rosterId !== undefined &&
          event.rosterId !== pending.rosterId) ||
        !pending.rosterId ||
        state.roster.length >= 4 ||
        state.roster.some(
          (entry) =>
            entry.rosterId === pending.rosterId ||
            entry.connection.sessionId === pending.connection.sessionId,
        )
      )
        return state;
      const accepted: WorldEntryRosterEntry = {
        ...pending,
        agentAvatar: {
          status: "accepted",
          sessionId: event.sessionId,
          profileId: event.avatarProfileId,
        },
      };
      return projectSetupAuthority({
        ...state,
        step:
          state.sessionMode === "single" ? "enter_ready" : "agent_connected",
        roster: [...state.roster, accepted],
        pendingAgent: null,
      });
    }
    case "RETURN_TO_CONSTELLATION":
      return state.sessionMode === "multi" &&
        state.step === "agent_connected" &&
        state.pendingAgent === null
        ? (() => {
            const next = projectSetupAuthority({
              ...state,
              step: "constellation_multi",
            });
            return canEnterWorld(next)
              ? { ...next, step: "enter_ready" }
              : next;
          })()
        : state;
    case "RECONNECT_AGENT": {
      const index = state.roster.findIndex(
        (entry) => entry.rosterId === event.rosterId,
      );
      if (index === -1) return state;
      const entry = state.roster[index]!;
      const status = event.status ?? "connected";
      const sessionId =
        status === "connected"
          ? (event.sessionId ?? entry.connection.sessionId)
          : entry.connection.sessionId;
      if (
        status === "connected" &&
        (sessionId !== entry.connection.sessionId ||
          (event.continuity !== "current" &&
            event.continuity !== "previous-recovered"))
      )
        return state;
      const roster = [...state.roster];
      roster[index] = {
        ...entry,
        connection: {
          status,
          sessionId,
          continuity: status === "connected" ? event.continuity! : "none",
        },
      };
      const next = projectSetupAuthority({ ...state, roster });
      return state.sessionMode === "multi" &&
        (state.step === "constellation_multi" || state.step === "enter_ready")
        ? {
            ...next,
            step: canEnterWorld(next) ? "enter_ready" : "constellation_multi",
          }
        : next;
    }
    case "REMOVE_AGENT": {
      if (!state.roster.some((entry) => entry.rosterId === event.rosterId))
        return state;
      const next = projectSetupAuthority({
        ...state,
        roster: state.roster.filter(
          (entry) => entry.rosterId !== event.rosterId,
        ),
      });
      return state.sessionMode === "multi" &&
        (state.step === "constellation_multi" || state.step === "enter_ready")
        ? {
            ...next,
            step: canEnterWorld(next) ? "enter_ready" : "constellation_multi",
          }
        : next;
    }
    case "ENTER_WORLD":
      return state.step === "enter_ready" && canEnterWorld(state)
        ? { ...state, step: "world_entering" }
        : state;
    case "WORLD_READY":
      return state.step === "world_entering"
        ? { ...state, step: "world_blank" }
        : state;
    case "REQUEST_REPOSITORY": {
      const request = event.request.trim().slice(0, 240);
      return (state.step === "world_blank" ||
        state.step === "world_repository") &&
        request
        ? {
            ...state,
            step: "repository_loading",
            repository: {
              status: "loading",
              request,
              error: "",
            },
          }
        : state;
    }
    case "REPOSITORY_FAILED":
      return state.step === "repository_loading"
        ? {
            ...state,
            step: "world_blank",
            repository: {
              ...state.repository,
              status: "failed",
              error: event.reason.trim().slice(0, 160),
            },
            world: {
              ...state.world,
              floor: "blank",
              generationId: null,
              projectionTruth: "none",
            },
          }
        : state;
    case "ACTIVATE_REPOSITORY":
      return state.step === "repository_loading" &&
        event.generationId &&
        (event.projectionTruth === "current" ||
          event.projectionTruth === "previous-recovered")
        ? {
            ...state,
            step: "world_repository",
            repository: {
              ...state.repository,
              status: "active",
              error: "",
            },
            world: {
              ...state.world,
              floor: "repository",
              generationId: event.generationId,
              projectionTruth: event.projectionTruth,
            },
          }
        : state;
    case "LEAVE_WORLD": {
      if (
        state.step !== "world_entering" &&
        state.step !== "world_blank" &&
        state.step !== "repository_loading" &&
        state.step !== "world_repository"
      )
        return state;
      const detached = createReturningWorldEntryState(state.user);
      return event.destination === "agent_prompt"
        ? projectSetupAuthority({
            ...detached,
            step: "agent_prompt",
            pendingAgent: pendingForHarness("hermes"),
          })
        : { ...detached, step: "session_select" };
    }
    case "ANIMATION_FINISHED":
      return state;
  }
}

export const WORLD_ENTRY_MACHINE_VERSION = "phase18";

export type WorldEntryStep =
  | "returning_identity"
  | "session_select"
  | "constellation_single"
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

export type WorldEntryState = {
  readonly step: WorldEntryStep;
  readonly user: {
    readonly profileId: string;
    readonly name: string;
  };
  readonly selectedHarness: null | "hermes";
  readonly agentName: string;
  readonly connection: WorldEntryConnection;
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
      readonly type: "RESTORE_WORLD";
      readonly sessionId: string;
      readonly continuity: "current" | "previous-recovered";
      readonly agentName: string;
      readonly avatarProfileId: string;
    }
  | { readonly type: "OPEN_AGENT_AVATAR" }
  | {
      readonly type: "ACCEPT_AGENT_AVATAR";
      readonly sessionId: string;
      readonly avatarProfileId: string;
    }
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
  | { readonly type: "ANIMATION_FINISHED" };

const emptyConnection = (): WorldEntryConnection => ({
  status: "none",
  sessionId: null,
  continuity: "none",
});

export function createReturningWorldEntryState(identity: {
  readonly profileId: string;
  readonly name: string;
}): WorldEntryState {
  return {
    step: "returning_identity",
    user: identity,
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
  return (
    state.connection.status === "connected" &&
    state.connection.sessionId !== null &&
    (state.connection.continuity === "current" ||
      state.connection.continuity === "previous-recovered") &&
    state.agentAvatar.status === "accepted" &&
    state.agentAvatar.sessionId === state.connection.sessionId &&
    state.agentAvatar.profileId !== null
  );
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
        ? { ...state, step: "constellation_single" }
        : state;
    case "SELECT_HERMES":
      return state.step === "constellation_single"
        ? { ...state, step: "agent_prompt", selectedHarness: "hermes" }
        : state;
    case "SUBMIT_AGENT_NAME": {
      const name = safeName(event.name);
      return state.step === "agent_prompt" && name
        ? {
            ...state,
            step: "agent_resolving",
            agentName: name,
            connection: {
              status: "connecting",
              sessionId: null,
              continuity: "none",
            },
          }
        : state;
    }
    case "CONNECTION_NOT_FOUND":
      return state.step === "agent_resolving"
        ? {
            ...state,
            step: "agent_not_found",
            connection: {
              status: "not_found",
              sessionId: null,
              continuity: "none",
            },
          }
        : state;
    case "RETRY_CONNECTION":
      return state.step === "agent_not_found" ||
        state.connection.status === "unavailable" ||
        state.connection.status === "stale"
        ? {
            ...state,
            step: "agent_prompt",
            connection: emptyConnection(),
          }
        : state;
    case "CONNECTION_UNAVAILABLE":
      return state.step === "agent_resolving"
        ? {
            ...state,
            step: "agent_prompt",
            connection: {
              status: event.stale ? "stale" : "unavailable",
              sessionId: null,
              continuity: "none",
            },
          }
        : state;
    case "CONNECTION_ATTACHED":
      return state.step === "agent_resolving" && event.sessionId
        ? {
            ...state,
            step: "agent_connected",
            connection: {
              status: "connected",
              sessionId: event.sessionId,
              continuity: event.continuity,
            },
            agentAvatar: {
              status: "missing",
              sessionId: null,
              profileId: null,
            },
          }
        : state;
    case "RESTORE_WORLD": {
      const agentName = safeName(event.agentName);
      return state.step === "returning_identity" &&
        event.sessionId &&
        agentName &&
        event.avatarProfileId
        ? {
            ...state,
            step: "world_blank",
            selectedHarness: "hermes",
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
          }
        : state;
    }
    case "OPEN_AGENT_AVATAR":
      return state.step === "agent_connected" &&
        state.connection.sessionId !== null
        ? {
            ...state,
            step: "agent_avatar",
            agentAvatar: {
              status: "editing",
              sessionId: state.connection.sessionId,
              profileId: null,
            },
          }
        : state;
    case "ACCEPT_AGENT_AVATAR":
      if (
        state.step !== "agent_avatar" ||
        state.connection.status !== "connected" ||
        !event.avatarProfileId ||
        event.sessionId !== state.connection.sessionId ||
        event.sessionId !== state.agentAvatar.sessionId
      )
        return state;
      return {
        ...state,
        step: "enter_ready",
        agentAvatar: {
          status: "accepted",
          sessionId: event.sessionId,
          profileId: event.avatarProfileId,
        },
      };
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
    case "ANIMATION_FINISHED":
      return state;
  }
}

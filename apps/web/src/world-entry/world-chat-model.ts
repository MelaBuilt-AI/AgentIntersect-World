import type {
  SessionHistory,
  WorldAgentEvent,
} from "../sessions/session-client.js";
import type { ImportedAvatarSemantic } from "@agentintersect-world/avatar-system/imported-avatar";
import {
  AgentMovementTargetSchema,
  type AgentMovementTarget,
} from "@agentintersect-world/world-action-protocol";

export type AvatarOneShotSemantic = Exclude<
  ImportedAvatarSemantic,
  "Idle" | "Walk" | "Run"
>;
export type AvatarLocomotionSemantic = "Idle" | "Walk" | "Run";
export type AvatarAnimationState = {
  readonly locomotion: AvatarLocomotionSemantic;
  readonly semantic: ImportedAvatarSemantic;
  readonly oneShot: AvatarOneShotSemantic | null;
  readonly cueSource: string;
  readonly progression:
    "locomotion" | "playing-once" | "returned" | "reduced-motion-completed";
  readonly generation: number;
};

const LOCAL_AVATAR_COMMANDS = Object.freeze({
  "/dance": "Dance",
  "/clap": "Clap",
  "/cheer": "Cheer",
  "/wave": "Wave",
  "/bow": "Bow",
  "/agree": "Agree",
  "/angry": "Angry",
  "/laugh": "Laugh",
} satisfies Readonly<Record<string, AvatarOneShotSemantic>>);

export type WorldChatInputHistory = {
  readonly entries: readonly string[];
  readonly index: number | null;
  readonly draft: string;
};

export function createWorldChatInputHistory(): WorldChatInputHistory {
  return { entries: [], index: null, draft: "" };
}

export function recordWorldChatSubmission(
  history: WorldChatInputHistory,
  message: string,
): WorldChatInputHistory {
  if (!message.trim()) return history;
  return {
    entries: [message, ...history.entries].slice(0, 5),
    index: null,
    draft: "",
  };
}

export function recallWorldChatHistory(
  history: WorldChatInputHistory,
  direction: "up" | "down",
  currentMessage: string,
): { readonly history: WorldChatInputHistory; readonly message: string } {
  if (history.entries.length === 0) return { history, message: currentMessage };
  if (direction === "up") {
    const index =
      history.index === null
        ? 0
        : Math.min(history.index + 1, history.entries.length - 1);
    const draft = history.index === null ? currentMessage : history.draft;
    return {
      history: { ...history, index, draft },
      message: history.entries[index]!,
    };
  }
  if (history.index === null) return { history, message: currentMessage };
  if (history.index > 0) {
    const index = history.index - 1;
    return {
      history: { ...history, index },
      message: history.entries[index]!,
    };
  }
  return {
    history: { ...history, index: null },
    message: history.draft,
  };
}

export function shouldConsumeWorldChatShortcut({
  key,
  target,
  worldActive,
  dialogOpen,
}: {
  readonly key: string;
  readonly target: unknown;
  readonly worldActive: boolean;
  readonly dialogOpen: boolean;
}): boolean {
  if (key !== "/" || !worldActive || dialogOpen) return false;
  if (!target || typeof target !== "object") return true;
  const candidate = target as {
    readonly tagName?: unknown;
    readonly isContentEditable?: unknown;
  };
  const tagName =
    typeof candidate.tagName === "string"
      ? candidate.tagName.toLocaleLowerCase()
      : "";
  return (
    tagName !== "input" &&
    tagName !== "textarea" &&
    tagName !== "select" &&
    candidate.isContentEditable !== true
  );
}

export function resolveLocalAvatarCommand(
  text: string,
): AvatarOneShotSemantic | null {
  const command = text.trim().toLocaleLowerCase();
  return (
    LOCAL_AVATAR_COMMANDS[command as keyof typeof LOCAL_AVATAR_COMMANDS] ?? null
  );
}

export type AgentDirectionCommand =
  | { readonly kind: "not-agent-command" }
  | { readonly kind: "movement"; readonly target: AgentMovementTarget }
  | { readonly kind: "stop" }
  | { readonly kind: "refused"; readonly message: string };

const AGENT_DIRECTION_REFUSAL =
  "agent movement refused · use /agent move <x> <z>, /agent move <direction> <distance>, /agent follow [radius], or /agent stop";
const STRICT_FINITE_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u;

const parseFiniteNumber = (value: string): number | null => {
  if (!STRICT_FINITE_NUMBER.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseAgentDirectionCommand(
  text: string,
): AgentDirectionCommand {
  const tokens = text.trim().split(/\s+/u);
  if (tokens[0]?.toLocaleLowerCase() !== "/agent")
    return { kind: "not-agent-command" };
  const command = tokens[1]?.toLocaleLowerCase();
  if (command === "stop" && tokens.length === 2) return { kind: "stop" };
  if (command === "follow" && (tokens.length === 2 || tokens.length === 3)) {
    const stoppingRadius =
      tokens.length === 2 ? 1.5 : parseFiniteNumber(tokens[2]!);
    if (stoppingRadius !== null) {
      const target = AgentMovementTargetSchema.safeParse({
        kind: "follow-user",
        stoppingRadius,
      });
      if (target.success) return { kind: "movement", target: target.data };
    }
    return { kind: "refused", message: AGENT_DIRECTION_REFUSAL };
  }
  if (command === "move" && tokens.length === 4) {
    const direction = tokens[2]!.toLocaleLowerCase();
    const distance = parseFiniteNumber(tokens[3]!);
    if (
      distance !== null &&
      ["forward", "backward", "left", "right"].includes(direction)
    ) {
      const target = AgentMovementTargetSchema.safeParse({
        kind: "relative",
        direction,
        distance,
      });
      if (target.success) return { kind: "movement", target: target.data };
    }
    const x = parseFiniteNumber(tokens[2]!);
    const z = parseFiniteNumber(tokens[3]!);
    if (x !== null && z !== null) {
      const target = AgentMovementTargetSchema.safeParse({
        kind: "coordinate",
        x,
        z,
      });
      if (target.success) return { kind: "movement", target: target.data };
    }
  }
  return { kind: "refused", message: AGENT_DIRECTION_REFUSAL };
}

export function isRepositoryLoadRequest(text: string): boolean {
  return (
    /\b(load|open|index|map|show)\b/iu.test(text) &&
    /\b(repo|repository|project|codebase)\b/iu.test(text)
  );
}

export function classifyWorldMessage(text: string):
  | {
      readonly kind: "local-animation";
      readonly semantic: AvatarOneShotSemantic;
    }
  | {
      readonly kind: "local-agent-movement";
      readonly target: AgentMovementTarget;
    }
  | { readonly kind: "local-agent-stop" }
  | { readonly kind: "local-repository-load"; readonly text: string }
  | { readonly kind: "local-refusal"; readonly message: string }
  | { readonly kind: "remote-chat"; readonly text: string } {
  const semantic = resolveLocalAvatarCommand(text);
  if (semantic) return { kind: "local-animation", semantic };
  const direction = parseAgentDirectionCommand(text);
  if (direction.kind === "movement")
    return { kind: "local-agent-movement", target: direction.target };
  if (direction.kind === "stop") return { kind: "local-agent-stop" };
  if (direction.kind === "refused")
    return { kind: "local-refusal", message: direction.message };
  const trimmed = text.trim();
  if (isRepositoryLoadRequest(trimmed))
    return { kind: "local-repository-load", text: trimmed };
  return { kind: "remote-chat", text: trimmed };
}

export function projectAgentAnimationCue(
  input:
    | { readonly type: "visible-text"; readonly text: string }
    | {
        readonly type: "application-event";
        readonly event: "completed" | "failed";
      },
): {
  readonly semantic: AvatarOneShotSemantic;
  readonly source: "visible-text" | "application-event";
} | null {
  if (input.type === "application-event")
    return {
      semantic: input.event === "completed" ? "Cheer" : "Angry",
      source: "application-event",
    };
  return null;
}

export function createAvatarAnimationState(
  locomotion: AvatarLocomotionSemantic = "Idle",
): AvatarAnimationState {
  return {
    locomotion,
    semantic: locomotion,
    oneShot: null,
    cueSource: "locomotion",
    progression: "locomotion",
    generation: 0,
  };
}

export function triggerAvatarOneShot(
  state: AvatarAnimationState,
  semantic: AvatarOneShotSemantic,
  source: string,
  reducedMotion: boolean,
): AvatarAnimationState {
  const generation = state.generation + 1;
  if (reducedMotion)
    return {
      ...state,
      semantic: state.locomotion,
      oneShot: null,
      cueSource: source,
      progression: "reduced-motion-completed",
      generation,
    };
  return {
    ...state,
    semantic,
    oneShot: semantic,
    cueSource: source,
    progression: "playing-once",
    generation,
  };
}

export function completeAvatarOneShot(
  state: AvatarAnimationState,
  generation: number,
): AvatarAnimationState {
  if (!state.oneShot || generation !== state.generation) return state;
  return {
    ...state,
    semantic: state.locomotion,
    oneShot: null,
    progression: "returned",
  };
}

export function setAvatarLocomotion(
  state: AvatarAnimationState,
  locomotion: AvatarLocomotionSemantic,
): AvatarAnimationState {
  if (
    state.locomotion === locomotion &&
    state.oneShot === null &&
    state.semantic === locomotion &&
    state.progression === "locomotion"
  )
    return state;
  const cancelled = state.oneShot !== null;
  return {
    locomotion,
    semantic: locomotion,
    oneShot: null,
    cueSource: "locomotion",
    progression: "locomotion",
    generation: state.generation + (cancelled ? 1 : 0),
  };
}

export type WorldActivityState =
  "idle" | "thinking" | "tool" | "coding" | "completed" | "failed";

export type WorldActivity = {
  readonly state: WorldActivityState;
  readonly icon: "" | "…" | "◇" | "</>" | "✓" | "!";
  readonly label: string;
  readonly detail: "" | "terminal" | "reading" | "tool";
};

export type WorldTranscriptItem = {
  readonly id: string;
  readonly kind: "user" | "assistant" | "tool" | "error";
  readonly text: string;
};

export type WorldChatState = {
  readonly activity: WorldActivity;
  readonly transcript: readonly WorldTranscriptItem[];
  readonly activeAssistantId: string | null;
  readonly animationCue: {
    readonly sequence: number;
    readonly semantic: AvatarOneShotSemantic;
    readonly source: "visible-text" | "application-event";
  } | null;
  readonly nextAnimationCueSequence: number;
};

export type WorldChatAction =
  | {
      readonly type: "RESTORE_HISTORY";
      readonly messages: SessionHistory["messages"];
    }
  | {
      readonly type: "QUEUE_MESSAGE";
      readonly id: string;
      readonly text: string;
    }
  | {
      readonly type: "SEND_STARTED";
      readonly id: string;
    }
  | { readonly type: "AGENT_EVENT"; readonly event: WorldAgentEvent }
  | { readonly type: "SEND_COMPLETED"; readonly text: string }
  | { readonly type: "SEND_FAILED"; readonly message: string }
  | {
      readonly type: "LOCAL_REPOSITORY_RESULT";
      readonly id: string;
      readonly request: string;
      readonly success: boolean;
      readonly message: string;
    }
  | { readonly type: "RESET_PRESENTATION" };

const IDLE: WorldActivity = {
  state: "idle",
  icon: "",
  label: "Mr Fluff is idle",
  detail: "",
};

const toolDetail = (toolName: string): Exclude<WorldActivity["detail"], ""> => {
  const normalized = toolName.toLocaleLowerCase();
  if (
    /(?:^|[^a-z0-9])(?:terminal|shell|bash|exec|command|code|write|edit|patch|git|test|build|lint|python|typescript)(?:[^a-z0-9]|$)/u.test(
      normalized,
    )
  )
    return "terminal";
  if (
    /(?:^|[^a-z0-9])(?:read|get|search|find|list|snapshot|history|file-content|symbol|context|vision)(?:[^a-z0-9]|$)/u.test(
      normalized,
    )
  )
    return "reading";
  return "tool";
};

const toolActivity = (toolName: string): WorldActivity => {
  const detail = toolDetail(toolName);
  return {
    state: detail === "terminal" ? "coding" : "tool",
    icon: detail === "terminal" ? "</>" : "◇",
    label: "Mr Fluff is working",
    detail,
  };
};

const thinkingActivity = (): WorldActivity => ({
  state: "thinking",
  icon: "…",
  label: "Mr Fluff is thinking",
  detail: "",
});

const preserveOuterActivity = (state: WorldChatState): WorldActivity =>
  state.activity.state === "tool" || state.activity.state === "coding"
    ? state.activity
    : thinkingActivity();

const append = (
  state: WorldChatState,
  item: WorldTranscriptItem,
  activity = state.activity,
): WorldChatState => ({
  ...state,
  activity,
  transcript: [...state.transcript, item].slice(-200),
});

const withAnimationCue = (
  state: WorldChatState,
  cue: ReturnType<typeof projectAgentAnimationCue>,
): WorldChatState =>
  cue
    ? {
        ...state,
        animationCue: {
          sequence: state.nextAnimationCueSequence,
          ...cue,
        },
        nextAnimationCueSequence: state.nextAnimationCueSequence + 1,
      }
    : state;

const replaceAssistant = (
  state: WorldChatState,
  text: string,
): WorldChatState => {
  if (!state.activeAssistantId)
    return append(
      { ...state, activeAssistantId: `assistant-${state.transcript.length}` },
      {
        id: `assistant-${state.transcript.length}`,
        kind: "assistant",
        text,
      },
    );
  const index = state.transcript.findIndex(
    ({ id }) => id === state.activeAssistantId,
  );
  if (index < 0)
    return append(state, {
      id: state.activeAssistantId,
      kind: "assistant",
      text,
    });
  return {
    ...state,
    transcript: state.transcript.map((item, itemIndex) =>
      itemIndex === index ? { ...item, text } : item,
    ),
  };
};

export function createWorldChatState(): WorldChatState {
  return {
    activity: IDLE,
    transcript: [],
    activeAssistantId: null,
    animationCue: null,
    nextAnimationCueSequence: 1,
  };
}

export function reduceWorldChat(
  state: WorldChatState,
  action: WorldChatAction,
): WorldChatState {
  if (action.type === "RESET_PRESENTATION") return createWorldChatState();
  if (action.type === "RESTORE_HISTORY")
    return {
      activity: IDLE,
      transcript: action.messages.slice(-200).map((message, index) => ({
        id: `history-${index}`,
        kind: message.role,
        text: message.text,
      })),
      activeAssistantId: null,
      animationCue: null,
      nextAnimationCueSequence: 1,
    };
  if (action.type === "QUEUE_MESSAGE")
    return append(state, {
      id: `user-${action.id}`,
      kind: "user",
      text: action.text,
    });
  if (action.type === "SEND_STARTED")
    return {
      ...state,
      activeAssistantId: `assistant-${action.id}`,
      activity: thinkingActivity(),
    };
  if (action.type === "SEND_FAILED")
    return withAnimationCue(
      append(
        { ...state, activeAssistantId: null },
        {
          id: `error-${state.transcript.length}`,
          kind: "error",
          text: action.message,
        },
        { state: "failed", icon: "!", label: "Mr Fluff failed", detail: "" },
      ),
      projectAgentAnimationCue({
        type: "application-event",
        event: "failed",
      }),
    );
  if (action.type === "SEND_COMPLETED") {
    const completed = replaceAssistant(state, action.text);
    return withAnimationCue(
      {
        ...completed,
        activeAssistantId: null,
        activity: {
          state: "completed",
          icon: "✓",
          label: "Mr Fluff completed the request",
          detail: "",
        },
      },
      projectAgentAnimationCue({ type: "visible-text", text: action.text }) ??
        projectAgentAnimationCue({
          type: "application-event",
          event: "completed",
        }),
    );
  }
  if (action.type === "LOCAL_REPOSITORY_RESULT") {
    const withRequest = append(state, {
      id: `user-${action.id}`,
      kind: "user",
      text: action.request,
    });
    return append(withRequest, {
      id: `local-repository-${action.id}`,
      kind: action.success ? "assistant" : "error",
      text: action.message,
    });
  }

  const { event } = action;
  if (event.type === "message.user-accepted") return state;
  if (event.type === "message.assistant-delta") {
    const text = String(event.payload.text);
    const current = state.transcript.find(
      ({ id }) => id === state.activeAssistantId,
    );
    const next = replaceAssistant(state, `${current?.text ?? ""}${text}`);
    return {
      ...next,
      activity: preserveOuterActivity(state),
    };
  }
  if (event.type === "message.assistant-final") {
    const next = replaceAssistant(state, String(event.payload.text));
    return {
      ...next,
      activity: preserveOuterActivity(state),
    };
  }
  const toolName = String(event.payload.toolName);
  const detail = toolDetail(toolName);
  const prefix =
    detail === "terminal"
      ? "Coding"
      : detail === "reading"
        ? "Reading"
        : "Tool";
  if (event.type === "tool.started")
    return append(
      state,
      {
        id: `tool-${event.eventId}`,
        kind: "tool",
        text: `${prefix} started · ${toolName}`,
      },
      toolActivity(toolName),
    );
  if (event.type === "tool.completed")
    return withAnimationCue(
      append(
        state,
        {
          id: `tool-${event.eventId}`,
          kind: "tool",
          text: `${prefix} completed · ${toolName}`,
        },
        toolActivity(toolName),
      ),
      projectAgentAnimationCue({
        type: "application-event",
        event: "completed",
      }),
    );
  return withAnimationCue(
    append(
      state,
      {
        id: `tool-${event.eventId}`,
        kind: "tool",
        text: `${prefix} failed · ${toolName}`,
      },
      toolActivity(toolName),
    ),
    projectAgentAnimationCue({
      type: "application-event",
      event: "failed",
    }),
  );
}

import type {
  SessionHistory,
  WorldAgentEvent,
} from "../sessions/session-client.js";

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
    return append(
      { ...state, activeAssistantId: null },
      {
        id: `error-${state.transcript.length}`,
        kind: "error",
        text: action.message,
      },
      { state: "failed", icon: "!", label: "Mr Fluff failed", detail: "" },
    );
  if (action.type === "SEND_COMPLETED") {
    const completed = replaceAssistant(state, action.text);
    return {
      ...completed,
      activeAssistantId: null,
      activity: {
        state: "completed",
        icon: "✓",
        label: "Mr Fluff completed the request",
        detail: "",
      },
    };
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
    return append(
      state,
      {
        id: `tool-${event.eventId}`,
        kind: "tool",
        text: `${prefix} completed · ${toolName}`,
      },
      toolActivity(toolName),
    );
  return append(
    state,
    {
      id: `tool-${event.eventId}`,
      kind: "tool",
      text: `${prefix} failed · ${toolName}`,
    },
    toolActivity(toolName),
  );
}

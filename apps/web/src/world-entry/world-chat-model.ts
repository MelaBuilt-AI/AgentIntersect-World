import type { WorldAgentEvent } from "../sessions/session-client.js";

export type WorldActivityState =
  "idle" | "thinking" | "tool" | "coding" | "completed" | "failed";

export type WorldActivity = {
  readonly state: WorldActivityState;
  readonly icon: "" | "…" | "◇" | "</>" | "✓" | "!";
  readonly label: string;
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
      readonly type: "SEND_STARTED";
      readonly id: string;
      readonly text: string;
    }
  | { readonly type: "AGENT_EVENT"; readonly event: WorldAgentEvent }
  | { readonly type: "SEND_COMPLETED"; readonly text: string }
  | { readonly type: "SEND_FAILED"; readonly message: string };

const IDLE: WorldActivity = {
  state: "idle",
  icon: "",
  label: "Mr Fluff is idle",
};

const codingTool = (toolName: string) =>
  /(?:terminal|shell|bash|exec|command|code|write|edit|patch|git|test|build|lint|typescript|python)/iu.test(
    toolName,
  );

const toolActivity = (toolName: string): WorldActivity =>
  codingTool(toolName)
    ? { state: "coding", icon: "</>", label: "Mr Fluff is coding" }
    : { state: "tool", icon: "◇", label: "Mr Fluff is using a tool" };

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
  if (action.type === "SEND_STARTED")
    return append(
      {
        ...state,
        activeAssistantId: `assistant-${action.id}`,
      },
      { id: `user-${action.id}`, kind: "user", text: action.text },
      { state: "thinking", icon: "…", label: "Mr Fluff is thinking" },
    );
  if (action.type === "SEND_FAILED")
    return append(
      { ...state, activeAssistantId: null },
      {
        id: `error-${state.transcript.length}`,
        kind: "error",
        text: action.message,
      },
      { state: "failed", icon: "!", label: "Mr Fluff failed" },
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
      activity: {
        state: "thinking",
        icon: "…",
        label: "Mr Fluff is typing",
      },
    };
  }
  if (event.type === "message.assistant-final") {
    const next = replaceAssistant(state, String(event.payload.text));
    return {
      ...next,
      activity: {
        state: "completed",
        icon: "✓",
        label: "Mr Fluff completed the response",
      },
    };
  }
  const toolName = String(event.payload.toolName);
  const coding = codingTool(toolName);
  const prefix = coding ? "Coding" : "Tool";
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
      {
        state: "completed",
        icon: "✓",
        label: `${toolName} completed`,
      },
    );
  return append(
    state,
    {
      id: `tool-${event.eventId}`,
      kind: "tool",
      text: `${prefix} failed · ${toolName}`,
    },
    { state: "failed", icon: "!", label: `${toolName} failed` },
  );
}

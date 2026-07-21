import type { WorldAgentEvent } from "./session-client.js";

export type ChatMessage = {
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly streaming?: boolean;
};

export type AgentStreamUiState = {
  readonly messages: readonly ChatMessage[];
  readonly toolStatuses: readonly string[];
};

type AgentStreamUiEvent = Pick<
  WorldAgentEvent,
  "type" | "payload" | "redaction"
>;

export function beginAgentStreamTurn(
  messages: readonly ChatMessage[],
  text: string,
): AgentStreamUiState {
  return {
    messages: [
      ...messages,
      { role: "user", text },
      { role: "assistant", text: "", streaming: true },
    ],
    toolStatuses: [],
  };
}

function updateStreamingMessage(
  messages: readonly ChatMessage[],
  update: (message: ChatMessage) => ChatMessage,
): readonly ChatMessage[] {
  const index = messages.findLastIndex(
    (message) => message.role === "assistant" && message.streaming === true,
  );
  if (index === -1)
    return [
      ...messages,
      update({ role: "assistant", text: "", streaming: true }),
    ];
  return messages.map((message, candidate) =>
    candidate === index ? update(message) : message,
  );
}

export function applyAgentStreamEvent(
  state: AgentStreamUiState,
  event: AgentStreamUiEvent,
): AgentStreamUiState {
  if (event.type === "message.assistant-delta") {
    const delta =
      typeof event.payload.text === "string" ? event.payload.text : "";
    return {
      ...state,
      messages: updateStreamingMessage(state.messages, (message) => ({
        ...message,
        text: `${message.text}${delta}`.slice(0, 16_384),
        streaming: true,
      })),
    };
  }
  if (event.type === "message.assistant-final") {
    const text =
      typeof event.payload.text === "string" ? event.payload.text : "";
    return {
      ...state,
      messages: updateStreamingMessage(state.messages, (message) => ({
        ...message,
        text,
        streaming: false,
      })),
    };
  }
  if (
    event.type === "tool.started" ||
    event.type === "tool.completed" ||
    event.type === "tool.failed"
  ) {
    const toolName =
      typeof event.payload.toolName === "string"
        ? event.payload.toolName
        : "unknown";
    return {
      ...state,
      toolStatuses: [
        ...state.toolStatuses,
        `${toolName} · ${event.type.slice("tool.".length)}`,
      ].slice(-16),
    };
  }
  return state;
}

export function completeAgentStreamTurn(
  state: AgentStreamUiState,
  finalText: string,
): AgentStreamUiState {
  const streamingIndex = state.messages.findLastIndex(
    (message) => message.role === "assistant" && message.streaming === true,
  );
  const index =
    streamingIndex === -1
      ? state.messages.findLastIndex((message) => message.role === "assistant")
      : streamingIndex;
  return {
    ...state,
    messages:
      index === -1
        ? [
            ...state.messages,
            { role: "assistant", text: finalText, streaming: false },
          ]
        : state.messages.map((message, candidate) =>
            candidate === index
              ? { ...message, text: finalText, streaming: false }
              : message,
          ),
  };
}

export function failAgentStreamTurn(
  state: AgentStreamUiState,
): AgentStreamUiState {
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.streaming ? { ...message, streaming: false } : message,
    ),
  };
}

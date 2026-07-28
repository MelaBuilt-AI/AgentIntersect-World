import {
  createWorldChatState,
  reduceWorldChat,
} from "../src/world-entry/world-chat-model.js";
import type { WorldAgentEvent } from "../src/sessions/session-client.js";
import { describe, expect, it } from "vitest";

const event = (
  sequence: number,
  type: WorldAgentEvent["type"],
  payload: Readonly<Record<string, unknown>>,
): WorldAgentEvent => ({
  schema: "aiw.agent-event/0.12",
  eventId: String(sequence),
  sessionId: "11111111-1111-4111-8111-111111111111",
  sequence,
  occurredAt: "2026-07-28T00:00:00.000Z",
  correlationId: "outer-turn",
  type,
  payload,
  redaction: { applied: false, count: 0 },
});

const startTurn = () => {
  let state = reduceWorldChat(createWorldChatState(), {
    type: "QUEUE_MESSAGE",
    id: "request",
    text: "Please inspect this.",
  });
  state = reduceWorldChat(state, { type: "SEND_STARTED", id: "request" });
  return state;
};

describe("World chat outer-turn activity", () => {
  it.each([
    ["terminal.exec", "terminal", "coding"],
    ["file-content.read", "reading", "tool"],
    ["browser.navigate", "tool", "tool"],
  ] as const)(
    "keeps %s working with bounded %s detail until SEND_COMPLETED",
    (toolName, detail, internalState) => {
      let state = startTurn();
      state = reduceWorldChat(state, {
        type: "AGENT_EVENT",
        event: event(1, "tool.started", { toolName }),
      });
      expect(state.activity).toMatchObject({
        state: internalState,
        label: "Mr Fluff is working",
        detail,
      });

      state = reduceWorldChat(state, {
        type: "AGENT_EVENT",
        event: event(2, "tool.completed", { toolName }),
      });
      expect(state.activity).toMatchObject({
        state: internalState,
        label: "Mr Fluff is working",
        detail,
      });

      state = reduceWorldChat(state, {
        type: "AGENT_EVENT",
        event: event(3, "message.assistant-delta", { text: "Result" }),
      });
      expect(state.activity).toMatchObject({
        state: internalState,
        label: "Mr Fluff is working",
        detail,
      });

      state = reduceWorldChat(state, {
        type: "AGENT_EVENT",
        event: event(4, "message.assistant-final", { text: "Result ready." }),
      });
      expect(state.activity).toMatchObject({
        state: internalState,
        label: "Mr Fluff is working",
        detail,
      });

      state = reduceWorldChat(state, {
        type: "SEND_COMPLETED",
        text: "Result ready.",
      });
      expect(state.activity).toMatchObject({
        state: "completed",
        label: "Mr Fluff completed the request",
        detail: "",
      });
    },
  );

  it("keeps plain short Q&A thinking until outer completion", () => {
    let state = startTurn();
    state = reduceWorldChat(state, {
      type: "AGENT_EVENT",
      event: event(1, "message.assistant-delta", { text: "Hello" }),
    });
    expect(state.activity).toMatchObject({
      state: "thinking",
      detail: "",
    });
    state = reduceWorldChat(state, {
      type: "AGENT_EVENT",
      event: event(2, "message.assistant-final", { text: "Hello." }),
    });
    expect(state.activity).toMatchObject({
      state: "thinking",
      detail: "",
    });
    state = reduceWorldChat(state, {
      type: "SEND_COMPLETED",
      text: "Hello.",
    });
    expect(state.activity).toMatchObject({
      state: "completed",
      detail: "",
    });
  });

  it("treats tool.failed as nonterminal activity and SEND_FAILED as terminal", () => {
    let state = startTurn();
    state = reduceWorldChat(state, {
      type: "AGENT_EVENT",
      event: event(1, "tool.started", { toolName: "snapshot.read" }),
    });
    state = reduceWorldChat(state, {
      type: "AGENT_EVENT",
      event: event(2, "tool.failed", { toolName: "snapshot.read" }),
    });
    expect(state.activity).toMatchObject({
      state: "tool",
      label: "Mr Fluff is working",
      detail: "reading",
    });

    state = reduceWorldChat(state, {
      type: "SEND_FAILED",
      message: "chat unavailable_",
    });
    expect(state.activity).toMatchObject({
      state: "failed",
      label: "Mr Fluff failed",
      detail: "",
    });
  });

  it("preserves queued transcript ordering while assistant events update only the active turn", () => {
    let state = reduceWorldChat(createWorldChatState(), {
      type: "QUEUE_MESSAGE",
      id: "first",
      text: "first",
    });
    state = reduceWorldChat(state, { type: "SEND_STARTED", id: "first" });
    state = reduceWorldChat(state, {
      type: "QUEUE_MESSAGE",
      id: "second",
      text: "second",
    });
    state = reduceWorldChat(state, {
      type: "AGENT_EVENT",
      event: event(1, "message.assistant-final", { text: "first reply" }),
    });
    state = reduceWorldChat(state, {
      type: "SEND_COMPLETED",
      text: "first reply",
    });
    state = reduceWorldChat(state, { type: "SEND_STARTED", id: "second" });
    state = reduceWorldChat(state, {
      type: "SEND_COMPLETED",
      text: "second reply",
    });

    expect(state.transcript.map(({ kind, text }) => ({ kind, text }))).toEqual([
      { kind: "user", text: "first" },
      { kind: "user", text: "second" },
      { kind: "assistant", text: "first reply" },
      { kind: "assistant", text: "second reply" },
    ]);
  });
});

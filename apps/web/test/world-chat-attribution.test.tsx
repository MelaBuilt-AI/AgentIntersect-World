import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorldHud } from "../src/world-entry/WorldHud.js";
import {
  createWorldChatState,
  reduceWorldChat,
  type WorldTranscriptItem,
} from "../src/world-entry/world-chat-model.js";

const headings = (
  transcript: readonly WorldTranscriptItem[],
  recipient: string,
) => {
  const html = renderToStaticMarkup(
    createElement(WorldHud, {
      recipient,
      status: "Connected",
      busy: false,
      queuedCount: 0,
      message: "",
      transcript,
      pushToTalkAvailable: false,
      onMessage: () => undefined,
      onSend: () => undefined,
    }),
  );
  return [...html.matchAll(/<strong>(.*?)<\/strong>/gu)].map(
    (match) => match[1],
  );
};

describe("World chat speaker attribution", () => {
  it("pins restored single-session history to its owner rather than the next selection", () => {
    const restore = {
      type: "RESTORE_HISTORY" as const,
      recipient: "Codex",
      messages: [
        { role: "user" as const, text: "hi codex" },
        { role: "assistant" as const, text: "Hi! What are we working on?" },
      ],
    };
    const state = reduceWorldChat(createWorldChatState(), restore);
    expect(headings(state.transcript, "Beans")).toEqual(["You", "Codex"]);
  });

  it("labels local repository acknowledgements as World, not a native agent", () => {
    const state = reduceWorldChat(createWorldChatState(), {
      type: "LOCAL_REPOSITORY_RESULT",
      id: "load",
      request: "/repo load",
      success: true,
      message: "Repository loaded locally",
    });
    expect(headings(state.transcript, "Beans")).toEqual(["You", "World"]);
  });

  it("does not invent authorship for a row without a recorded speaker", () => {
    expect(
      headings(
        [{ id: "legacy", kind: "assistant", text: "Old reply" }],
        "Beans",
      ),
    ).toEqual(["Agent"]);
  });

  it("keeps each single-agent answer's original name when the recipient changes", () => {
    let state = createWorldChatState();
    for (const recipient of ["Codex", "Claude", "Beans"]) {
      state = reduceWorldChat(state, {
        type: "QUEUE_MESSAGE",
        id: recipient,
        text: `Hi ${recipient}`,
      });
      const started = {
        type: "SEND_STARTED" as const,
        id: recipient,
        recipient,
      };
      state = reduceWorldChat(state, started);
      for (const [sequence, type] of [
        [1, "message.assistant-delta"],
        [2, "message.assistant-final"],
      ] as const) {
        state = reduceWorldChat(state, {
          type: "AGENT_EVENT",
          event: {
            schema: "aiw.agent-event/0.12",
            eventId: `${recipient}-${sequence}`,
            sessionId: `session-${recipient}`,
            sequence,
            occurredAt: "2026-09-20T12:00:00.000Z",
            correlationId: `turn-${recipient}`,
            type,
            payload: { text: `Reply from ${recipient}` },
            redaction: { applied: false, count: 0 },
          },
        });
        expect(state.transcript.at(-1)?.recipient).toBe(recipient);
      }
      state = reduceWorldChat(state, {
        type: "SEND_COMPLETED",
        text: `Reply from ${recipient}`,
      });
    }
    const expected = ["You", "Codex", "You", "Claude", "You", "Beans"];
    expect(headings(state.transcript, "Beans")).toEqual(expected);
    expect(headings(state.transcript, "Codex")).toEqual(expected);
    expect(headings(state.transcript, "All agents")).toEqual(expected);
  });
});

import {
  createWorldChatState,
  nameWorldActivity,
  classifyWorldMessage,
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

describe("World repository intake commands", () => {
  it("uses the selected agent identity for completion projections", () => {
    const activity = {
      state: "completed" as const,
      icon: "",
      label: "Mr Fluff completed the request",
      detail: "",
    };
    expect(nameWorldActivity(activity, "Codex").label).toBe(
      "Codex completed the request",
    );
    expect(
      nameWorldActivity({ ...activity, label: "2 agents completed" }, "Codex")
        .label,
    ).toBe("2 agents completed");
    expect(activity.label).toBe("Mr Fluff completed the request");
  });
  it("recognizes unambiguous conversational follow, relative movement, and stop without hijacking questions", () => {
    expect(classifyWorldMessage("Could you follow me please?")).toEqual({
      kind: "local-agent-movement",
      target: { kind: "follow-user", stoppingRadius: 1.5 },
    });
    expect(classifyWorldMessage("Please move left 3")).toEqual({
      kind: "local-agent-movement",
      target: { kind: "relative", direction: "left", distance: 3 },
    });
    expect(classifyWorldMessage("stop following me")).toEqual({
      kind: "local-agent-stop",
    });
    expect(classifyWorldMessage("How does follow me work?").kind).toBe(
      "remote-chat",
    );
    expect(
      classifyWorldMessage("Please follow me through this explanation").kind,
    ).toBe("remote-chat");
    expect(classifyWorldMessage("stop the build").kind).toBe("remote-chat");
  });
  it("keeps the explicit /repo load path and opens intake for a general request", () => {
    expect(classifyWorldMessage("/repo load /tmp/Notes App")).toEqual({
      kind: "local-repository-load",
      text: "/repo load /tmp/Notes App",
      requestedRoot: "/tmp/Notes App",
    });
    expect(classifyWorldMessage("Show me a repository")).toEqual({
      kind: "local-repository-load",
      text: "Show me a repository",
      requestedRoot: null,
    });
  });

  it("resolves the broader pick-up-work phrase through Repository Intake", () => {
    expect(classifyWorldMessage("Let's pick up work on the Notes App")).toEqual(
      {
        kind: "local-repository-load",
        text: "Let's pick up work on the Notes App",
        requestedRoot: null,
      },
    );
  });
});

describe("World Workbench conversation commands", () => {
  it("distinguishes demo intake, ordinary chat and explicit Workstream setup", () => {
    expect(classifyWorldMessage("Let's pick up work")).toEqual({
      kind: "remote-chat",
      text: "Let's pick up work",
    });
    expect(
      classifyWorldMessage("Let's pick up work on the spatial-screen demo")
        .kind,
    ).toBe("local-repository-load");
    expect(
      classifyWorldMessage(
        "/work start Inspect this demo without changing files",
      ),
    ).toEqual({
      kind: "local-workstream",
      action: "request",
      text: "/work start Inspect this demo without changing files",
      task: "Inspect this demo without changing files",
    });
  });
  it.each([
    ["Build a settings panel", "Build a settings panel"],
    [
      "can you please create a basic website homepage called Codex is Awesome",
      "can you please create a basic website homepage called Codex is Awesome",
    ],
    [
      "Can you fix the clipped mobile menu?",
      "Can you fix the clipped mobile menu?",
    ],
    [
      "change it to use the blue active state",
      "change it to use the blue active state",
    ],
    ["make the heading larger", "make the heading larger"],
    ["/work start Add keyboard navigation", "Add keyboard navigation"],
    ["/work continue Keep the same layout", "Keep the same layout"],
  ])("classifies %s as a Workstream request", (input, task) => {
    expect(classifyWorldMessage(input)).toEqual({
      kind: "local-workstream",
      action: "request",
      text: input,
      task,
    });
  });

  it("classifies inspect and cancel without sending them to the agent", () => {
    expect(classifyWorldMessage("inspect current workstream")).toEqual({
      kind: "local-workstream",
      action: "inspect",
      text: "inspect current workstream",
    });
    expect(classifyWorldMessage("cancel current workstream")).toEqual({
      kind: "local-workstream",
      action: "cancel",
      text: "cancel current workstream",
    });
  });

  it("leaves ordinary questions as remote chat", () => {
    expect(classifyWorldMessage("What does this package do?")).toEqual({
      kind: "remote-chat",
      text: "What does this package do?",
    });
  });
});

describe("World chat outer-turn activity", () => {
  it("adds a local repository acknowledgement only when the load result is known", () => {
    const initial = createWorldChatState();
    expect(initial.transcript).toEqual([]);

    const succeeded = reduceWorldChat(initial, {
      type: "LOCAL_REPOSITORY_RESULT",
      id: "repo-success",
      request: "/repo load MelaBuilt-AI/agentclutch",
      success: true,
      message:
        "Repository loaded locally · Current · 4 packages · 8 directories · 12 files",
    });
    expect(
      succeeded.transcript.map(({ kind, text }) => ({ kind, text })),
    ).toEqual([
      { kind: "user", text: "/repo load MelaBuilt-AI/agentclutch" },
      {
        kind: "assistant",
        text: "Repository loaded locally · Current · 4 packages · 8 directories · 12 files",
      },
    ]);

    const failed = reduceWorldChat(initial, {
      type: "LOCAL_REPOSITORY_RESULT",
      id: "repo-failure",
      request: "/repo load missing",
      success: false,
      message: "Repository load failed locally · blank floor preserved",
    });
    expect(failed.transcript.map(({ kind, text }) => ({ kind, text }))).toEqual(
      [
        { kind: "user", text: "/repo load missing" },
        {
          kind: "error",
          text: "Repository load failed locally · blank floor preserved",
        },
      ],
    );
  });

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

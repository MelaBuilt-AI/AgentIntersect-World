import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  AgentSessionClient,
  type ConstellationMessageGroup,
} from "../src/sessions/session-client.js";
import { WorldHud } from "../src/world-entry/WorldHud.js";
import {
  consumeOneSendRecipient,
  createWorldChatState,
  reduceWorldChat,
  type WorldChatAction,
} from "../src/world-entry/world-chat-model.js";

const group: ConstellationMessageGroup = {
  schema: "aiw.constellation-message/0.19",
  groupId: "30000000-0000-4000-8000-000000000001",
  requestId: "30000000-0000-4000-8000-000000000002",
  correlationId: "30000000-0000-4000-8000-000000000003",
  text: "group question",
  target: { kind: "broadcast" },
  recipientRosterIds: ["roster-hermes", "roster-codex"],
  recipients: [
    {
      rosterId: "roster-hermes",
      worldSessionId: "session-hermes",
      state: "completed",
      finalText: "Hermes succeeded",
      errorLabel: null,
    },
    {
      rosterId: "roster-codex",
      worldSessionId: "session-codex",
      state: "failed",
      finalText: null,
      errorLabel: "Agent turn failed",
    },
  ],
  createdAt: "2026-08-13T12:00:00.000Z",
  updatedAt: "2026-08-13T12:00:01.000Z",
};

describe("Phase 19 multi-agent chat", () => {
  it("sends exactly one grouped request without a browser roster fanout", async () => {
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response(JSON.stringify({ ok: true, data: group }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      },
    );
    const client = new AgentSessionClient(fetcher as typeof fetch);

    await expect(
      client.sendGrouped("group question", {
        requestId: group.requestId,
        idempotencyKey: "web-message-1",
        userDisplayName: "Mela",
      }),
    ).resolves.toEqual(group);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("/api/constellation/messages");
    expect(JSON.parse(String(init?.body))).toEqual({
      requestId: group.requestId,
      idempotencyKey: "web-message-1",
      text: "group question",
      userDisplayName: "Mela",
    });
    expect(String(init?.body)).not.toContain("recipientRosterIds");
  });

  it("reads durable grouped results for refresh restoration", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, data: [group] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new AgentSessionClient(fetcher as typeof fetch);

    expect(
      typeof (client as unknown as { messageGroups?: unknown }).messageGroups,
    ).toBe("function");
    await expect(
      (
        client as unknown as {
          messageGroups: () => Promise<readonly ConstellationMessageGroup[]>;
        }
      ).messageGroups(),
    ).resolves.toEqual([group]);
    expect(fetcher).toHaveBeenCalledWith("/api/constellation/messages", {
      headers: { accept: "application/json" },
    });
  });

  it("limits AbortSignal to response observation", async () => {
    const controller = new AbortController();
    const observed = vi.fn();
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          observed(init?.signal);
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const client = new AgentSessionClient(fetcher as typeof fetch);
    const pending = client.sendGrouped("continue server work", {
      requestId: "30000000-0000-4000-8000-000000000004",
      idempotencyKey: "web-message-2",
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toThrow();
    expect(observed).toHaveBeenCalledWith(controller.signal);
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty("cancel");
    expect(body).not.toHaveProperty("signal");
  });

  it("consumes avatar selection for one send and then resets to broadcast", () => {
    expect(consumeOneSendRecipient("roster-codex")).toEqual({
      targetRosterId: "roster-codex",
      nextSelectedRecipientId: null,
    });
    expect(consumeOneSendRecipient(null)).toEqual({
      targetRosterId: undefined,
      nextSelectedRecipientId: null,
    });
  });

  it("projects stable grouped rows while retaining success beside failure", () => {
    const state = reduceWorldChat(createWorldChatState(), {
      type: "GROUP_COMPLETED",
      group,
      displayNames: {
        "roster-hermes": "Hermes",
        "roster-codex": "Codex",
      },
    });
    expect(state.transcript.map((item) => [item.recipient, item.text])).toEqual(
      [
        ["Hermes", "Hermes succeeded"],
        ["Codex", "Agent turn failed"],
      ],
    );

    const html = renderToStaticMarkup(
      createElement(WorldHud, {
        recipient: "All agents",
        status: "Multi Agent ready",
        busy: false,
        queuedCount: 0,
        message: "",
        transcript: state.transcript,
        pushToTalkAvailable: false,
        onMessage: () => undefined,
        onSend: () => undefined,
      }),
    );
    expect(html).toContain('placeholder="Message All agents"');
    expect(html.indexOf("Hermes succeeded")).toBeLessThan(
      html.indexOf("Agent turn failed"),
    );
    expect(html).toContain("Hermes");
    expect(html).toContain("Codex");
  });

  it("restores durable groups instead of a single primary-session transcript", () => {
    const state = reduceWorldChat(createWorldChatState(), {
      type: "RESTORE_HISTORY",
      messages: [
        { role: "user", text: "group question" },
        { role: "assistant", text: "Hermes succeeded" },
      ],
      groups: [group],
      displayNames: {
        "roster-hermes": "Hermes",
        "roster-codex": "Codex",
      },
    } as unknown as WorldChatAction);

    expect(
      state.transcript.map((item) => [item.kind, item.recipient, item.text]),
    ).toEqual([
      ["user", undefined, "group question"],
      ["assistant", "Hermes", "Hermes succeeded"],
      ["error", "Codex", "Agent turn failed"],
    ]);
  });

  it("updates one stable recipient row while a durable group is still completing", () => {
    const streaming = {
      ...group,
      recipients: group.recipients.map((recipient) =>
        recipient.rosterId === "roster-hermes"
          ? { ...recipient, state: "streaming" as const, finalText: null }
          : recipient,
      ),
    };
    const displayNames = {
      "roster-hermes": "Hermes",
      "roster-codex": "Codex",
    };
    const projected = reduceWorldChat(createWorldChatState(), {
      type: "GROUP_COMPLETED",
      group: streaming,
      displayNames,
    });
    const completed = reduceWorldChat(projected, {
      type: "GROUP_COMPLETED",
      group,
      displayNames,
    });

    expect(completed.transcript).toHaveLength(2);
    expect(
      completed.transcript.map((item) => [item.recipient, item.text]),
    ).toEqual([
      ["Hermes", "Hermes succeeded"],
      ["Codex", "Agent turn failed"],
    ]);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgentSessionExperience } from "../src/sessions/AgentSessionPanel.js";
import {
  applyAgentStreamEvent,
  beginAgentStreamTurn,
  completeAgentStreamTurn,
} from "../src/sessions/agent-stream-state.js";
import { PHASE12_SESSION_FIXTURE } from "../src/sessions/session-fixtures.js";

describe("Phase 12 persistent session UI", () => {
  it("renders the numbered connector, exact identity, mode cutline, truth labels, and bounded chat", () => {
    const html = renderToStaticMarkup(
      <AgentSessionExperience
        state={PHASE12_SESSION_FIXTURE}
        onNativeSession={() => undefined}
        onMode={() => undefined}
        onConnect={() => undefined}
        onSend={() => undefined}
        onAvatarDecision={() => undefined}
        onAvatarEdit={() => undefined}
        onAvatarRevoke={() => undefined}
      />,
    );
    for (let step = 1; step <= 10; step += 1)
      expect(html).toContain(`>${step}<`);
    expect(html).toContain("default");
    expect(html).toContain("20260721_011618_330489c8");
    expect(html).toContain("repo_fixture");
    expect(html).toContain("Current");
    expect(html).toContain("Hermes transcript is canonical");
    expect(html).toMatch(/Autonomous[\s\S]*disabled/);
    expect(html).toContain("Later phase");
    expect(html).toContain("Native approvals stay in Hermes");
    expect(html).toContain("Guided Build validation preview");
    expect(html).toContain('aria-label="Edit bounded avatar display name"');
    expect(html).not.toMatch(/World Actions|WASD|voice|worktree manager/i);
  });

  it("marks enabled actions active-blue and disabled actions neutral-grey without color-only meaning", () => {
    const html = renderToStaticMarkup(
      <AgentSessionExperience
        state={PHASE12_SESSION_FIXTURE}
        onNativeSession={() => undefined}
        onMode={() => undefined}
        onConnect={() => undefined}
        onSend={() => undefined}
        onAvatarDecision={() => undefined}
        onAvatarEdit={() => undefined}
        onAvatarRevoke={() => undefined}
      />,
    );
    expect(html).toContain('class="session-action session-action--active"');
    expect(html).toContain('class="session-action session-action--disabled"');
    expect(html).toContain("Unavailable:");
  });

  it("disables and neutralizes every avatar consent control while Hermes is offline", () => {
    const html = renderToStaticMarkup(
      <AgentSessionExperience
        state={{
          ...PHASE12_SESSION_FIXTURE,
          health: "offline",
          worldSession: null,
          continuityLabel: "Unavailable",
        }}
        onNativeSession={() => undefined}
        onMode={() => undefined}
        onConnect={() => undefined}
        onSend={() => undefined}
        onAvatarDecision={() => undefined}
        onAvatarEdit={() => undefined}
        onAvatarRevoke={() => undefined}
      />,
    );
    const displayName = html.match(
      /<input[^>]*aria-label="Edit bounded avatar display name"[^>]*>/,
    )?.[0];
    expect(displayName).toContain('disabled=""');
    expect(displayName).toContain("avatar-proposal__input--disabled");
    for (const label of ["Accept / save edits", "Decline", "Revoke"]) {
      const button = html.match(
        new RegExp(`<button[^>]*>\\s*${label}\\s*</button>`),
      )?.[0];
      expect(button).toContain('disabled=""');
      expect(button).toContain("session-action--disabled");
      expect(button).not.toContain("session-action--active");
    }
  });

  it("keeps ready and recovered avatar consent actions available", () => {
    const renderConsent = (state: typeof PHASE12_SESSION_FIXTURE) =>
      renderToStaticMarkup(
        <AgentSessionExperience
          state={state}
          onNativeSession={() => undefined}
          onMode={() => undefined}
          onConnect={() => undefined}
          onSend={() => undefined}
          onAvatarDecision={() => undefined}
          onAvatarEdit={() => undefined}
          onAvatarRevoke={() => undefined}
        />,
      );
    const ready = renderConsent(PHASE12_SESSION_FIXTURE);
    const readyInput = ready.match(
      /<input[^>]*aria-label="Edit bounded avatar display name"[^>]*>/,
    )?.[0];
    expect(readyInput).not.toContain('disabled=""');
    for (const label of ["Accept / save edits", "Decline"]) {
      const button = ready.match(
        new RegExp(`<button[^>]*>\\s*${label}\\s*</button>`),
      )?.[0];
      expect(button).toContain("session-action--active");
      expect(button).not.toContain('disabled=""');
    }

    const recovered = renderConsent({
      ...PHASE12_SESSION_FIXTURE,
      continuityLabel: "Previous / recovered",
      avatarConsent: "accepted",
    });
    const revoke = recovered.match(/<button[^>]*>\s*Revoke\s*<\/button>/)?.[0];
    expect(revoke).toContain("session-action--active");
    expect(revoke).not.toContain('disabled=""');
  });

  it("updates one progressive assistant message and reconciles the final without duplication", () => {
    const started = beginAgentStreamTurn([], "hello");
    const delta = applyAgentStreamEvent(started, {
      type: "message.assistant-delta",
      payload: { text: "live " },
      redaction: { applied: false, count: 0 },
    });
    expect(delta.messages.at(-1)).toMatchObject({
      role: "assistant",
      text: "live ",
      streaming: true,
    });
    const withTool = applyAgentStreamEvent(delta, {
      type: "tool.started",
      payload: { toolName: "terminal" },
      redaction: { applied: true, count: 2 },
    });
    expect(withTool.toolStatuses).toEqual(["terminal · started"]);
    const finalEvent = applyAgentStreamEvent(withTool, {
      type: "message.assistant-final",
      payload: { text: "live reply" },
      redaction: { applied: false, count: 0 },
    });
    const completed = completeAgentStreamTurn(finalEvent, "live reply");
    expect(
      completed.messages.filter((message) => message.role === "assistant"),
    ).toEqual([{ role: "assistant", text: "live reply", streaming: false }]);
  });
});

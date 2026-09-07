import * as experienceModule from "../src/world-entry/WorldEntryExperience.js";
import * as logoModule from "../src/world-entry/WorldEntryLogo.js";
import * as roomModule from "../src/world-entry/WorldRoom.js";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const component = (value: unknown): ComponentType<Record<string, unknown>> =>
  value as ComponentType<Record<string, unknown>>;

const avatar = {
  profileId: "avatar-user",
  agentName: "Mela",
  species: "human",
  head: "round",
  hands: "hands",
  feet: "feet",
  fur: "none",
  tail: "none",
  markings: "solid",
  bodyColor: "warm-light",
  shirt: "Codex blue",
} as const;

const agents = [
  ["roster-hermes", "hermes", "Mr Fluff", "current", "connected"],
  [
    "roster-openclaw",
    "openclaw",
    "OpenClaw",
    "previous-recovered",
    "connected",
  ],
  ["roster-claude", "claude-code", "Claude", "stale", "stale"],
  ["roster-codex", "codex", "Codex", "unavailable", "unavailable"],
].map(
  ([rosterId, adapterId, displayName, continuity, connection], addedOrder) => ({
    rosterId,
    adapterId,
    sessionOwnership:
      adapterId === "hermes" ? "operator-persistent" : "world-owned",
    worldSessionId: `session-${addedOrder}`,
    worldInstanceId: "world-task10",
    nativeRootSessionRef: `native-${addedOrder}`,
    displayName,
    continuity,
    connection,
    avatar: {
      status: addedOrder < 2 ? "accepted" : "missing",
      profileId: addedOrder < 2 ? `avatar-${addedOrder}` : null,
      sessionId: addedOrder < 2 ? `session-${addedOrder}` : null,
    },
    addedOrder,
  }),
);

describe("Phase 19 Task 10 multi-agent entry UI", () => {
  it("makes Multi Agent and every endpoint actionable while locking an active attempt", () => {
    const WorldEntryLogo = component(
      (logoModule as Record<string, unknown>).WorldEntryLogo,
    );
    const html = renderToStaticMarkup(
      createElement(WorldEntryLogo, {
        userName: "Mela",
        stage: "constellation",
        reducedMotion: true,
        singleSelected: false,
        multiSelected: true,
        selectedHarness: "codex",
        connectionPending: true,
        rosterFull: false,
        onSingle: () => undefined,
        onMulti: () => undefined,
        onHarness: () => undefined,
      }),
    );

    expect(html).toContain("Multi Agent");
    expect(html).toContain("openclaw_");
    expect(html).toContain("hermes_");
    expect(html).toContain("claude_");
    expect(html).toContain("codex_");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-selected-harness="codex"');
    expect(html.match(/disabled=""/g)).toHaveLength(4);
  });

  it("projects stable server roster truth, bounded controls, and server entry readiness", () => {
    const Constellation = component(
      (experienceModule as Record<string, unknown>)
        .WorldEntryConstellationProjection,
    );
    expect(Constellation).toBeTypeOf("function");

    const html = renderToStaticMarkup(
      createElement(Constellation, {
        projection: {
          schema: "aiw.constellation/0.19",
          mode: "multi-agent",
          worldInstanceId: "world-task10",
          lifecycle: "assembling",
          revision: 7,
          agents,
          entryReady: false,
          truth: "previous-recovered",
        },
        busyRosterId: null,
        onReconnect: () => undefined,
        onRemove: () => undefined,
        onEnterWorld: () => undefined,
      }),
    );

    expect(html.indexOf("Mr Fluff")).toBeLessThan(html.indexOf("OpenClaw"));
    expect(html.indexOf("OpenClaw")).toBeLessThan(html.indexOf("Claude"));
    expect(html).toContain("Previous / recovered");
    expect(html).toContain("Stale");
    expect(html).toContain("Unavailable");
    expect(html.match(/>Reconnect</g)).toHaveLength(2);
    expect(html.match(/>Remove</g)).toHaveLength(2);
    expect(html).toContain("Enter World");
    expect(html).toContain('disabled=""');
  });

  it("renders one user and four semantic agents without the retired floating controls", () => {
    const WorldRoom = component(
      (roomModule as Record<string, unknown>).WorldRoom,
    );
    const html = renderToStaticMarkup(
      createElement(WorldRoom, {
        floor: "blank",
        objects: [],
        reducedMotion: true,
        forceNoWebGL: true,
        userName: "Mela",
        agentName: "Mr Fluff",
        userAvatar: avatar,
        agentAvatar: { ...avatar, agentName: "Mr Fluff", species: "cat" },
        agentAvatars: agents.map((agent, index) => ({
          rosterId: agent.rosterId,
          name: agent.displayName,
          avatar: {
            ...avatar,
            profileId: `avatar-${index}`,
            agentName: agent.displayName,
            species: index % 2 === 0 ? "cat" : "dog",
          },
        })),
        selectedRecipientId: "roster-claude",
        onSelectRecipient: () => undefined,
        onClearRecipient: () => undefined,
        activity: { state: "idle", icon: "", label: "Idle", detail: "" },
      }),
    );

    expect(html).toContain("Mela · user avatar");
    expect(html.match(/connected agent avatar/g)).toHaveLength(4);
    expect(html).not.toContain("world-room__agent-target");
    expect(html).not.toContain('aria-label="Code Wheel"'); // closed until requested
    expect(html).toContain("Claude");
    expect(html).toContain("position -4.2,0.8");
    expect(html).toContain("position 4.2,0.8");
    expect(html).toContain("position -3.2,-4");
    expect(html).toContain("position 3.2,-4");
  });
});

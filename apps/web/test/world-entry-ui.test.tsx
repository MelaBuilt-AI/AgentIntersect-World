import * as appModule from "../src/App.js";
import * as agentAvatarModule from "../src/world-entry/world-entry-avatar.js";
import * as appSurfaceModule from "../src/world-entry/app-surface.js";
import * as experienceModule from "../src/world-entry/WorldEntryExperience.js";
import * as activityModule from "../src/world-entry/world-chat-model.js";
import * as roomModule from "../src/world-entry/world-navigation-model.js";
import {
  parseAvatarDraft,
  type AvatarDraft,
} from "@agentintersect-world/avatar-system";
import type {
  AvatarProposal,
  WorldAgentEvent,
} from "../src/sessions/session-client.js";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type UiApi = {
  readonly WorldEntryExperience: ComponentType<Record<string, unknown>>;
  readonly WorldEntryLogo: ComponentType<Record<string, unknown>>;
  readonly WorldEntryAgentAvatar: ComponentType<Record<string, unknown>>;
  readonly WorldRoom: ComponentType<Record<string, unknown>>;
  readonly WorldHud: ComponentType<Record<string, unknown>>;
};

const api = experienceModule as unknown as Partial<UiApi>;
const activityApi = activityModule as unknown as {
  readonly createWorldChatState?: () => {
    readonly activity: { readonly state: string; readonly icon: string };
    readonly transcript: readonly {
      readonly kind: string;
      readonly text: string;
    }[];
  };
  readonly reduceWorldChat?: (
    state: ReturnType<NonNullable<typeof activityApi.createWorldChatState>>,
    action:
      | {
          readonly type: "SEND_STARTED";
          readonly id: string;
          readonly text: string;
        }
      | { readonly type: "AGENT_EVENT"; readonly event: WorldAgentEvent }
      | { readonly type: "SEND_COMPLETED"; readonly text: string }
      | { readonly type: "SEND_FAILED"; readonly message: string },
  ) => ReturnType<NonNullable<typeof activityApi.createWorldChatState>>;
};
const agentAvatarApi = agentAvatarModule as unknown as {
  readonly avatarDraftFromProposal?: (proposal: AvatarProposal) => AvatarDraft;
  readonly avatarProposalFromDraft?: (
    proposal: AvatarProposal,
    draft: AvatarDraft,
  ) => AvatarProposal;
};
const app = appSurfaceModule as unknown as {
  readonly resolveAppSurface?: (
    path: string,
    developerFlag: string | undefined,
  ) => "world-entry" | "internal-dashboard" | "internal-unavailable";
};
const roomApi = roomModule as unknown as {
  readonly moveWorldPosition?: (input: {
    readonly position: { readonly x: number; readonly z: number };
    readonly keys: readonly string[];
    readonly yaw: number;
    readonly elapsedSeconds: number;
    readonly sprint: boolean;
  }) => { readonly x: number; readonly z: number };
  readonly applyWorldCameraLook?: (
    camera: { readonly yaw: number; readonly pitch: number },
    input: { readonly movementX: number; readonly movementY: number },
  ) => { readonly yaw: number; readonly pitch: number };
  readonly isEditableWorldTarget?: (target: unknown) => boolean;
};

const component = (value: unknown): ComponentType<Record<string, unknown>> =>
  value as ComponentType<Record<string, unknown>>;

const legacyCatProposal: AvatarProposal = {
  schema: "aiw.avatar-proposal/0.12",
  proposalId: "22222222-2222-4222-8222-222222222222",
  sessionId: "11111111-1111-4111-8111-111111111111",
  displayName: "Mr Fluff",
  species: "cat",
  head: "cat",
  hands: "paws",
  feet: "paws",
  fur: "short",
  tail: "cat",
  markings: "tuxedo",
  bodyColor: "charcoal",
  shirt: "Hermes",
  movementStyle: "shared-biped-core",
  sourceDisclosure: "Bounded local proposal.",
  rationale: "Awaiting deliberate operator editing.",
  createdAt: "2026-07-25T00:00:00.000Z",
};

describe("Phase 18 World entry experience", () => {
  it("moves continuously relative to camera heading and clamps mouse look", () => {
    expect(typeof roomApi.moveWorldPosition).toBe("function");
    expect(typeof roomApi.applyWorldCameraLook).toBe("function");
    expect(typeof roomApi.isEditableWorldTarget).toBe("function");
    if (
      !roomApi.moveWorldPosition ||
      !roomApi.applyWorldCameraLook ||
      !roomApi.isEditableWorldTarget
    )
      return;
    expect(
      roomApi.moveWorldPosition({
        position: { x: 0, z: 0 },
        keys: ["w"],
        yaw: Math.PI / 2,
        elapsedSeconds: 0.25,
        sprint: false,
      }),
    ).toEqual({ x: 1.5, z: 0 });
    expect(
      roomApi.moveWorldPosition({
        position: { x: 14.9, z: -14.9 },
        keys: ["w", "d"],
        yaw: Math.PI / 2,
        elapsedSeconds: 1,
        sprint: true,
      }),
    ).toEqual({ x: 15, z: -6.415 });
    const lookRight = roomApi.applyWorldCameraLook(
      { yaw: 0, pitch: 0 },
      { movementX: 100, movementY: 0 },
    );
    const lookLeft = roomApi.applyWorldCameraLook(
      { yaw: 0, pitch: 0 },
      { movementX: -100, movementY: 0 },
    );
    const lookUp = roomApi.applyWorldCameraLook(
      { yaw: 0, pitch: 0 },
      { movementX: 0, movementY: -100 },
    );
    const lookDown = roomApi.applyWorldCameraLook(
      { yaw: 0, pitch: 0 },
      { movementX: 0, movementY: 100 },
    );
    expect(lookRight.yaw).toBeGreaterThan(0);
    expect(lookLeft.yaw).toBeLessThan(0);
    expect(lookUp.pitch).toBeLessThan(0);
    expect(lookDown.pitch).toBeGreaterThan(0);
    expect(
      roomApi.isEditableWorldTarget({
        tagName: "INPUT",
      }),
    ).toBe(true);
  });

  it("retains ordered transcript activity and classifies canonical tool lifecycle truth", () => {
    expect(typeof activityApi.createWorldChatState).toBe("function");
    expect(typeof activityApi.reduceWorldChat).toBe("function");
    if (!activityApi.createWorldChatState || !activityApi.reduceWorldChat)
      return;
    const event = (
      sequence: number,
      type: WorldAgentEvent["type"],
      payload: Readonly<Record<string, unknown>>,
    ): WorldAgentEvent => ({
      schema: "aiw.agent-event/0.12",
      eventId: `${sequence}`,
      sessionId: legacyCatProposal.sessionId,
      sequence,
      occurredAt: "2026-07-25T00:00:00.000Z",
      correlationId: "correlation",
      type,
      payload,
      redaction: { applied: false, count: 0 },
    });
    let state = activityApi.reduceWorldChat(
      activityApi.createWorldChatState(),
      { type: "SEND_STARTED", id: "request-1", text: "hi" },
    );
    expect(state.activity).toMatchObject({ state: "thinking", icon: "…" });
    state = activityApi.reduceWorldChat(state, {
      type: "AGENT_EVENT",
      event: event(1, "message.assistant-delta", { text: "Hello" }),
    });
    state = activityApi.reduceWorldChat(state, {
      type: "AGENT_EVENT",
      event: event(2, "tool.started", { toolName: "terminal.exec" }),
    });
    expect(state.activity).toMatchObject({ state: "coding", icon: "</>" });
    state = activityApi.reduceWorldChat(state, {
      type: "AGENT_EVENT",
      event: event(3, "tool.completed", { toolName: "terminal.exec" }),
    });
    state = activityApi.reduceWorldChat(state, {
      type: "SEND_COMPLETED",
      text: "Hello from Mr Fluff.",
    });
    expect(state.activity).toMatchObject({ state: "completed", icon: "✓" });
    expect(state.transcript.map(({ kind, text }) => ({ kind, text }))).toEqual([
      { kind: "user", text: "hi" },
      { kind: "assistant", text: "Hello from Mr Fluff." },
      { kind: "tool", text: "Coding started · terminal.exec" },
      { kind: "tool", text: "Coding completed · terminal.exec" },
    ]);
    state = activityApi.reduceWorldChat(state, {
      type: "SEND_FAILED",
      message: "chat unavailable_",
    });
    expect(state.activity).toMatchObject({ state: "failed", icon: "!" });
    expect(state.transcript.at(-1)).toMatchObject({
      kind: "error",
      text: "chat unavailable_",
    });
  });

  it("provides the returning identity and World composition", () => {
    expect(typeof api.WorldEntryExperience).toBe("function");
    expect(typeof api.WorldEntryLogo).toBe("function");
    expect(typeof api.WorldEntryAgentAvatar).toBe("function");
    expect(typeof api.WorldRoom).toBe("function");
    expect(typeof api.WorldHud).toBe("function");
  });

  it("renders the personalized animated logo, terminal constellation, and truthful action states", () => {
    if (!api.WorldEntryLogo) return;
    const html = renderToStaticMarkup(
      createElement(component(api.WorldEntryLogo), {
        userName: "Mela",
        stage: "constellation",
        reducedMotion: true,
        singleSelected: true,
        onSingle: () => undefined,
        onHermes: () => undefined,
      }),
    );
    expect(html).toContain(
      'src="/assets/dashboard/agentintersect_animated.svg"',
    );
    expect(html).toContain('class="world-entry-logo__name">Mela<');
    expect(html).toContain("AgentIntersect");
    expect(html).toContain("terminal-cursor");
    expect(html).toContain("Single Agent");
    expect(html).toContain("Multi Agent");
    expect(html).toContain("openclaw_");
    expect(html).toContain("hermes_");
    expect(html).toContain("claude_");
    expect(html).toContain("codex_");
    expect(html).toContain("world-action--enabled");
    expect(html).toContain("world-action--unavailable");
    expect(html).toMatch(/aria-disabled="false"[^>]*>hermes_/);
    expect(html).toMatch(/aria-disabled="true"[^>]*>Multi Agent/);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("font-family");
  });

  it("renders an explicit editable Mr Fluff avatar creator that cannot silently accept", () => {
    if (!api.WorldEntryAgentAvatar) return;
    const html = renderToStaticMarkup(
      createElement(component(api.WorldEntryAgentAvatar), {
        proposal: legacyCatProposal,
        busy: false,
        error: "",
        onAccept: () => undefined,
      }),
    );
    expect(html).toContain("Create Mr Fluff’s avatar");
    expect(html).toContain('class="avatar-builder"');
    expect(html).toContain('data-testid="avatar-preview"');
    expect(html).toContain("Loading optional 3D preview");
    expect(html).toContain("Accept and save avatar");
    expect(html).not.toContain("ᓚᘏᗢ");
    expect(html).not.toContain("world-agent-avatar__preview");
    expect(html).not.toContain("Enter World");
  });

  it("adapts representative legacy proposals into strict drafts and exact session-bound payloads", () => {
    expect(typeof agentAvatarApi.avatarDraftFromProposal).toBe("function");
    expect(typeof agentAvatarApi.avatarProposalFromDraft).toBe("function");
    if (
      !agentAvatarApi.avatarDraftFromProposal ||
      !agentAvatarApi.avatarProposalFromDraft
    )
      return;
    const draft = agentAvatarApi.avatarDraftFromProposal(legacyCatProposal);
    expect(parseAvatarDraft(draft)).toEqual(draft);
    expect(draft).toMatchObject({
      agentName: "Mr Fluff",
      species: "cat",
      head: "shorthair",
      hands: "paws",
      feet: "paws",
      fur: "short",
      tail: "cat-straight",
      markings: "socks",
      bodyColor: "fur-charcoal",
      shirt: "Hermes",
      mappingConsent: false,
      agentRef: null,
      sourceDisclosure: "manual-local-input",
    });
    const accepted = agentAvatarApi.avatarProposalFromDraft(
      legacyCatProposal,
      draft,
    );
    expect(accepted).toEqual(legacyCatProposal);
  });

  it("keeps one semantic World state, two visible avatars, minimal HUD, and unavailable adjacent PTT", () => {
    if (!api.WorldRoom || !api.WorldHud) return;
    const room = renderToStaticMarkup(
      createElement(component(api.WorldRoom), {
        floor: "repository",
        objects: [
          {
            ref: "aiw://object/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            kind: "file",
            name: "world-entry.ts",
            position: { x: 2, y: 0, z: 3 },
            bounds: { x: 1, z: 2, width: 2, depth: 2 },
          },
        ],
        reducedMotion: true,
        forceNoWebGL: true,
        userName: "Mela",
        agentName: "Mr Fluff",
        userAvatar: {
          agentName: "Mela",
          species: "human",
          head: "round",
          hands: "hands",
          feet: "feet",
          fur: "none",
          tail: "none",
          markings: "solid",
          bodyColor: "warm-light",
          shirt: "Codex",
          mappingConsent: false,
          agentRef: null,
          sourceDisclosure: "manual-local-input",
        },
        agentAvatar: {
          agentName: "Mr Fluff",
          species: "cat",
          head: "shorthair",
          hands: "paws",
          feet: "paws",
          fur: "short",
          tail: "cat-straight",
          markings: "socks",
          bodyColor: "fur-charcoal",
          shirt: "Hermes",
          mappingConsent: false,
          agentRef: null,
          sourceDisclosure: "manual-local-input",
        },
        activity: {
          state: "coding",
          icon: "</>",
          label: "Mr Fluff is coding",
        },
      }),
    );
    expect(room).toContain('data-scene-id="world-room"');
    expect(room).toContain('data-floor-state="repository"');
    expect(room).toContain("Third-person camera behind Mela");
    expect(room).toContain("Mela · user avatar");
    expect(room).toContain("Mr Fluff · connected agent avatar");
    expect(room).toContain("human · Codex");
    expect(room).toContain("cat · Hermes");
    expect(room).toContain('data-activity-state="coding"');
    expect(room).toContain("Mr Fluff is coding");
    expect(room).toContain("Repository floor");
    expect(room).toContain("world-entry.ts");
    expect(room).not.toMatch(/portal|WorldActionPanel|dashboard/i);

    const hud = renderToStaticMarkup(
      createElement(component(api.WorldHud), {
        recipient: "Mr Fluff",
        status: "Connected · Current",
        busy: false,
        message: "",
        transcript: [
          { id: "user-1", kind: "user", text: "hi" },
          {
            id: "assistant-1",
            kind: "assistant",
            text: "Hello from Mr Fluff.",
          },
          {
            id: "tool-1",
            kind: "tool",
            text: "Coding completed · terminal.exec",
          },
        ],
        pushToTalkAvailable: false,
        onMessage: () => undefined,
        onSend: () => undefined,
      }),
    );
    expect(hud).toContain("Message Mr Fluff");
    expect(hud).toContain("Push to talk");
    expect(hud).toContain("Voice provider unavailable");
    expect(hud).toContain('disabled=""');
    expect(hud).toContain('aria-live="polite"');
    expect(hud).toContain('aria-label="Conversation and activity"');
    expect(hud).toContain('tabindex="0"');
    expect(hud).toContain("Hello from Mr Fluff.");
    expect(hud).toContain("Coding completed · terminal.exec");
  });

  it("fails the internal dashboard route closed unless both exact path and flag are present", () => {
    expect(typeof app.resolveAppSurface).toBe("function");
    if (!app.resolveAppSurface) return;
    expect(app.resolveAppSurface("/", undefined)).toBe("world-entry");
    expect(app.resolveAppSurface("/internal/dashboard", undefined)).toBe(
      "internal-unavailable",
    );
    expect(app.resolveAppSurface("/internal/dashboard", "1")).toBe(
      "internal-dashboard",
    );
    expect(app.resolveAppSurface("/", "1")).toBe("world-entry");
  });

  it("preserves the logo-only first-launch identification boundary without dashboard chrome", () => {
    const html = renderToStaticMarkup(
      createElement(
        component((appModule as unknown as { readonly App: unknown }).App),
      ),
    );
    expect(html).toContain('data-testid="identify-opening"');
    expect(html).toContain(
      'src="/assets/dashboard/agentintersect_animated.svg"',
    );
    expect(html).toContain("Create Avatar");
    expect(html).not.toMatch(/DashboardShell|Diagnostics|Evidence|Recovery/);
  });

  it("keeps dashboard and control-plane imports out of normal World-entry modules", () => {
    const paths = [
      "../src/world-entry/WorldEntryExperience.tsx",
      "../src/world-entry/WorldEntryLogo.tsx",
      "../src/world-entry/WorldEntryAgentAvatar.tsx",
      "../src/world-entry/WorldRoom.tsx",
      "../src/world-entry/WorldHud.tsx",
    ];
    for (const path of paths) {
      const url = new URL(path, import.meta.url);
      expect(existsSync(fileURLToPath(url)), `${path} must exist`).toBe(true);
      if (!existsSync(fileURLToPath(url))) continue;
      const source = readFileSync(url, "utf8");
      expect(source).not.toMatch(
        /DashboardShell|WorldActionPanel|DiagnosticsPanel|EvidencePanel/,
      );
    }
  });

  it("uses real held right-button canvas Pointer Lock with complete release guards", () => {
    const source = readFileSync(
      new URL("../src/world-entry/WorldRoom.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("event.button !== 2");
    expect(source).toContain("HTMLCanvasElement");
    expect(source).toContain("requestPointerLock");
    expect(source).toContain("exitPointerLock");
    expect(source).toContain("lookRequestPending");
    expect(source).toContain("lookOwnsPointerLock");
    expect(source).toContain('"pointerlockchange"');
    expect(source).toContain('"pointerlockerror"');
    expect(source).toContain('"mousemove"');
    expect(source).not.toContain("setPointerCapture");
    expect(source).not.toContain("releasePointerCapture");
    expect(source).toContain('"pointerup"');
    expect(source).toContain('"pointercancel"');
    expect(source).toContain('"blur"');
    expect(source).toContain('"visibilitychange"');
    expect(source).toContain("onContextMenu");
    expect(source).toContain("Hold right mouse");
  });

  it("defines meaningful multi-object browser evidence and real renderer selection proof", () => {
    const e2e = readFileSync(
      new URL("../e2e/world-entry-single-agent.spec.ts", import.meta.url),
      "utf8",
    );
    const renderer = readFileSync(
      new URL(
        "../../../packages/renderer-r3f/src/world-room-canvas.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(
      (e2e.match(/kind: "(?:package|directory|file)"/g) ?? []).length,
    ).toBeGreaterThanOrEqual(8);
    expect(e2e).toContain("data-user-avatar-species");
    expect(e2e).toContain("data-agent-avatar-shirt");
    expect(renderer).toContain("<AvatarKitWorldModel");
    expect(renderer).not.toContain("new BoxGeometry(0.9");
  });

  it("defines fluid viewport sizing and bounded mobile-safe World HUD regions", () => {
    const styles = readFileSync(
      new URL("../src/styles.css", import.meta.url),
      "utf8",
    );
    expect(styles).toMatch(/\.world-experience\s*\{[^}]*height:\s*100dvh;/su);
    expect(styles).toMatch(/\.world-transcript\s*\{[^}]*overflow-y:\s*auto;/su);
    expect(styles).toMatch(
      /\[data-renderer="webgl"\] \.world-room__semantic\s*\{[^}]*clip:\s*rect\(0(?:px)?\s+0(?:px)?\s+0(?:px)?\s+0(?:px)?\);/su,
    );
    expect(styles).toMatch(
      /\[data-renderer="webgl"\] \.world-room__activity-semantic\s*\{[^}]*clip:\s*rect\(0(?:px)?\s+0(?:px)?\s+0(?:px)?\s+0(?:px)?\);/su,
    );
    expect(styles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*\.world-transcript\s*\{[^}]*max-width:\s*100%;/u,
    );
  });

  it("places transcript and composer on one responsive bottom grid track", () => {
    const styles = readFileSync(
      new URL("../src/styles.css", import.meta.url),
      "utf8",
    );
    expect(styles).toMatch(
      /\.world-hud\s*\{[^}]*grid-template-areas:[^;}]*"captions captions"[^;}]*"transcript controls"[^;}]*"voice voice"/su,
    );
    expect(styles).toMatch(
      /\.world-transcript\s*\{[^}]*position:\s*static;[^}]*grid-area:\s*transcript;[^}]*align-self:\s*end;/su,
    );
    expect(styles).toMatch(
      /\.world-hud__controls\s*\{[^}]*grid-area:\s*controls;[^}]*align-self:\s*end;/su,
    );
  });

  it("places harness centers on endpoint rows with stronger desktop spread and mobile containment", () => {
    const styles = readFileSync(
      new URL("../src/styles.css", import.meta.url),
      "utf8",
    );
    expect(styles).toMatch(
      /\.world-harness--openclaw\s*\{[^}]*top:\s*11\.5%;[^}]*left:\s*clamp\(-11\.5rem,\s*-12vw,\s*-5rem\);[^}]*transform:\s*translateY\(-50%\);/su,
    );
    expect(styles).toMatch(
      /\.world-harness--hermes\s*\{[^}]*top:\s*11\.5%;[^}]*right:\s*clamp\(-11\.5rem,\s*-12vw,\s*-5rem\);[^}]*transform:\s*translateY\(-50%\);/su,
    );
    expect(styles).toMatch(
      /\.world-harness--claude\s*\{[^}]*bottom:\s*11\.5%;[^}]*left:\s*clamp\(-11\.5rem,\s*-12vw,\s*-5rem\);[^}]*transform:\s*translateY\(50%\);/su,
    );
    expect(styles).toMatch(
      /\.world-harness--codex\s*\{[^}]*right:\s*clamp\(-11\.5rem,\s*-12vw,\s*-5rem\);[^}]*bottom:\s*11\.5%;[^}]*transform:\s*translateY\(50%\);/su,
    );
    expect(styles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*\.world-harness--openclaw,[\s\S]*left:\s*-0\.5rem;/u,
    );
  });
});

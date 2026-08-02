import { describe, expect, it, vi } from "vitest";

import {
  AVATAR_ACTIONS,
  AVATAR_ANATOMICAL_STATES,
  AVATAR_BODY_COLORS,
  AVATAR_EXPRESSION_TARGETS,
  AVATAR_HEADS,
  AVATAR_LODS,
  AVATAR_PROFILE_STORAGE_KEY,
  DEFAULT_AVATAR_DRAFT,
  LEGACY_PHASE11_AVATAR_PROFILE_STORAGE_KEY,
  LEGACY_AVATAR_PROFILE_STORAGE_KEY,
  composeAvatarAnimationState,
  createAvatarProfile,
  avatarProfileSummary,
  deleteAvatarProfiles,
  exportAvatarProfile,
  loadAvatarProfiles,
  mapRosterProfileInput,
  migrateLegacyAvatarProfile,
  parseAvatarProfile,
  projectAvatarAnimation,
  projectAvatarLayerState,
  projectWorldAvatarAction,
  saveAvatarProfile,
  validateAgentName,
  type AvatarProfile,
} from "../src/index.js";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const profile = (name = "Codex"): AvatarProfile => ({
  schema: "aiw.avatar/0.18.5",
  profileId: "avatar_0123456789abcdef0123456789abcdef",
  agentRef: null,
  agentName: name,
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
  sourceDisclosure: "manual-local-input",
  createdAt: "2026-07-20T12:00:00.000Z",
  updatedAt: "2026-07-20T12:00:00.000Z",
});

describe("aiw.avatar/0.18.5 strict profile", () => {
  it("creates a browser-safe profile ID when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab);
        return bytes;
      },
    });
    try {
      expect(
        createAvatarProfile({
          ...DEFAULT_AVATAR_DRAFT,
          agentName: "HTTP Browser",
        }).profileId,
      ).toBe("avatar_abababababab4bababababababababab");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("exposes the frozen option and action sets", () => {
    expect(Object.values(AVATAR_HEADS).flat()).toHaveLength(12);
    expect(AVATAR_BODY_COLORS).toHaveLength(12);
    expect(AVATAR_ACTIONS).toEqual([
      "Idle",
      "Walk",
      "Run",
      "TurnLeft",
      "TurnRight",
      "StartWalk",
      "StopWalk",
      "Talk",
      "Listen",
      "Wave",
      "Point",
      "Explain",
      "Think",
      "Nod",
      "Shrug",
      "Work",
      "Celebrate",
      "Error",
      "Offline",
    ]);
    expect(AVATAR_LODS).toEqual(["LOD0", "LOD1", "LOD2"]);
    expect(AVATAR_EXPRESSION_TARGETS).toEqual([
      "Blink",
      "BrowUp",
      "BrowDown",
      "EyeWide",
      "EyeSquint",
      "Smile",
      "Frown",
      "JawOpen",
      "SpeechO",
      "SpeechE",
      "SpeechMBP",
    ]);
    expect(AVATAR_ANATOMICAL_STATES).toEqual([
      "Neutral",
      "Listen",
      "Talk",
      "Celebrate",
      "Error",
    ]);
  });

  it("losslessly migrates a saved aiw.avatar/0.11 current/previous envelope", () => {
    const storage = new MemoryStorage();
    const phase11Profile = {
      ...profile("Phase Eleven"),
      schema: "aiw.avatar/0.11",
    };
    storage.setItem(
      LEGACY_PHASE11_AVATAR_PROFILE_STORAGE_KEY,
      JSON.stringify({
        schema: "aiw.avatar-store/0.11",
        current: phase11Profile,
        previous: {
          ...phase11Profile,
          agentName: "Previous Eleven",
          updatedAt: "2026-07-20T11:00:00.000Z",
        },
      }),
    );
    const loaded = loadAvatarProfiles(storage);
    expect(loaded).toMatchObject({
      status: "migrated-phase11",
      current: {
        schema: "aiw.avatar/0.18.5",
        agentName: "Phase Eleven",
        species: "human",
        head: "round",
        bodyColor: "warm-light",
      },
      previous: {
        schema: "aiw.avatar/0.18.5",
        agentName: "Previous Eleven",
      },
    });
    expect(storage.values.get(LEGACY_PHASE11_AVATAR_PROFILE_STORAGE_KEY)).toBe(
      JSON.stringify({
        schema: "aiw.avatar-store/0.11",
        current: phase11Profile,
        previous: {
          ...phase11Profile,
          agentName: "Previous Eleven",
          updatedAt: "2026-07-20T11:00:00.000Z",
        },
      }),
    );
  });

  it("normalizes names and rejects empty, control, overlong, unknown, and incompatible values", () => {
    expect(validateAgentName("  Cafe\u0301  ")).toEqual({
      ok: true,
      value: "Café",
    });
    expect(validateAgentName(" ").ok).toBe(false);
    expect(validateAgentName("bad\u0000name").ok).toBe(false);
    expect(validateAgentName("x".repeat(33)).ok).toBe(false);
    expect(parseAvatarProfile({ ...profile(), secret: "canary" })).toBeNull();
    expect(
      parseAvatarProfile({ ...profile(), species: "cat", head: "round" }),
    ).toBeNull();
    expect(
      parseAvatarProfile({
        ...profile(),
        species: "human",
        tail: "cat-curled",
      }),
    ).toBeNull();
    expect(
      parseAvatarProfile({
        ...profile(),
        assetUrl: "https://evil.invalid/x.glb",
      }),
    ).toBeNull();
  });

  it("retains current and one previous profile atomically and recovers previous", () => {
    const storage = new MemoryStorage();
    saveAvatarProfile(storage, profile("Alpha"));
    saveAvatarProfile(storage, {
      ...profile("Beta"),
      updatedAt: "2026-07-20T12:01:00.000Z",
    });
    expect(loadAvatarProfiles(storage)).toMatchObject({
      status: "saved",
      current: { agentName: "Beta" },
      previous: { agentName: "Alpha" },
    });
    const envelope = JSON.parse(
      storage.values.get(AVATAR_PROFILE_STORAGE_KEY)!,
    );
    envelope.current.secret = "hostile";
    storage.setItem(AVATAR_PROFILE_STORAGE_KEY, JSON.stringify(envelope));
    expect(loadAvatarProfiles(storage)).toMatchObject({
      status: "recovered-previous",
      current: { agentName: "Alpha" },
    });
  });

  it("migrates Phase 5 appearance once but requires the name step", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEGACY_AVATAR_PROFILE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        body: "female",
        accent: "violet",
        showHalo: true,
        showHelmet: true,
        showFace: true,
        showEyes: true,
        showGlow: true,
      }),
    );
    expect(
      migrateLegacyAvatarProfile(
        JSON.parse(storage.values.get(LEGACY_AVATAR_PROFILE_STORAGE_KEY)!),
      ),
    ).toMatchObject({
      species: "human",
      head: "round",
      bodyColor: "fantasy-violet",
      shirt: "Codex",
      agentName: "",
    });
    expect(loadAvatarProfiles(storage)).toMatchObject({
      status: "migrated-unconfigured",
      current: null,
    });
    expect(storage.values.has(AVATAR_PROFILE_STORAGE_KEY)).toBe(false);
  });

  it("does not overwrite corrupt storage and delete clears both versions", () => {
    const storage = new MemoryStorage();
    storage.setItem(AVATAR_PROFILE_STORAGE_KEY, "{broken");
    expect(loadAvatarProfiles(storage).status).toBe("corrupt-unconfigured");
    expect(storage.values.get(AVATAR_PROFILE_STORAGE_KEY)).toBe("{broken");
    deleteAvatarProfiles(storage);
    expect(storage.values.size).toBe(0);
  });

  it("allows only explicit consented roster mapping and excludes hostile canaries from exports", () => {
    const allowed = mapRosterProfileInput(
      {
        agentRef: "agent_0123456789abcdef0123456789abcdef",
        displayLabel: "Hermes",
      },
      true,
    );
    expect(allowed).toEqual({
      agentRef: "agent_0123456789abcdef0123456789abcdef",
      agentName: "Hermes",
      mappingConsent: true,
      sourceDisclosure: "phase6-roster-opt-in",
    });
    expect(
      mapRosterProfileInput(
        {
          agentRef: "agent_0123456789abcdef0123456789abcdef",
          displayLabel: "Hermes",
        },
        false,
      ),
    ).toBeNull();
    expect(
      mapRosterProfileInput(
        {
          agentRef: "agent_0123456789abcdef0123456789abcdef",
          displayLabel: "Hermes",
          prompt: "SECRET_CANARY",
        },
        true,
      ),
    ).toBeNull();
    const exported = exportAvatarProfile(profile("<script>alert(1)</script>"));
    expect(exported).not.toMatch(/SECRET_CANARY|prompt|memory|\/home\//i);
    expect(JSON.parse(exported).agentName).toBe("<script>alert(1)</script>");
    expect(avatarProfileSummary(profile())).toContain("Human");
  });
});

describe("authoritative avatar animation", () => {
  it("composes semantic upper-body, face, gaze, and secondary layers", () => {
    expect(
      composeAvatarAnimationState({
        action: "Talk",
        reducedMotion: false,
        speechShape: "SpeechO",
        gaze: "operator",
      }),
    ).toEqual({
      base: "Idle",
      upperBody: "Talk",
      face: "SpeechO",
      gaze: "operator",
      secondary: "Talk",
      crossfadeSeconds: 0.22,
      secondaryMotion: true,
    });
    expect(
      composeAvatarAnimationState({
        action: "Celebrate",
        reducedMotion: true,
        speechShape: null,
        gaze: "camera",
      }),
    ).toMatchObject({
      base: "Celebrate",
      upperBody: null,
      face: "Smile",
      secondary: "Celebrate",
      secondaryMotion: false,
    });
  });

  it("projects truthful World activity and user movement into observable actions", () => {
    expect(
      ["idle", "thinking", "tool", "coding", "completed", "failed"].map(
        (activity) =>
          projectWorldAvatarAction({
            role: "agent",
            activity,
            movement: "idle",
            terminalElapsedMs: 0,
          }),
      ),
    ).toEqual(["Idle", "Think", "Explain", "Work", "Celebrate", "Error"]);
    expect(
      ["starting", "moving", "sprinting", "stopping", "idle"].map((movement) =>
        projectWorldAvatarAction({
          role: "user",
          activity: "coding",
          movement,
          terminalElapsedMs: 0,
        }),
      ),
    ).toEqual(["StartWalk", "Walk", "Run", "StopWalk", "Idle"]);
    expect(
      projectWorldAvatarAction({
        role: "agent",
        activity: "completed",
        movement: "idle",
        terminalElapsedMs: 2201,
      }),
    ).toBe("Idle");
    expect(
      projectAvatarLayerState({
        action: "Work",
        reducedMotion: true,
        speechShape: null,
        gaze: "work",
      }),
    ).toMatchObject({
      base: "Idle",
      upperBody: "Work",
      gaze: "work",
      secondaryMotion: false,
    });
  });

  it.each([
    ["queued", "Idle"],
    ["idle", "Idle"],
    ["unknown", "Idle"],
    ["claimed", "Walk"],
    ["running", "Work"],
    ["complete", "Celebrate"],
    ["succeeded", "Celebrate"],
    ["failed", "Error"],
    ["error", "Error"],
  ] as const)(
    "maps %s to %s only after accepted truth",
    (lifecycle, action) => {
      expect(
        projectAvatarAnimation({
          lifecycle,
          integrationStatus: "ready",
          accepted: true,
          reducedMotion: false,
          elapsedMs: 0,
        }).action,
      ).toBe(action);
      expect(
        projectAvatarAnimation({
          lifecycle,
          integrationStatus: "ready",
          accepted: false,
          reducedMotion: false,
          elapsedMs: 0,
        }).action,
      ).toBe("Idle");
    },
  );

  it("uses offline/static truth and bounds terminal animation to one cycle", () => {
    expect(
      projectAvatarAnimation({
        lifecycle: "running",
        integrationStatus: "stale",
        accepted: true,
        reducedMotion: false,
        elapsedMs: 0,
      }).action,
    ).toBe("Offline");
    expect(
      projectAvatarAnimation({
        lifecycle: "complete",
        integrationStatus: "ready",
        accepted: true,
        reducedMotion: false,
        elapsedMs: 2201,
      }).action,
    ).toBe("Idle");
    expect(
      projectAvatarAnimation({
        lifecycle: "running",
        integrationStatus: "ready",
        accepted: true,
        reducedMotion: true,
        elapsedMs: 0,
      }),
    ).toMatchObject({ action: "Work", animate: false });
  });
});

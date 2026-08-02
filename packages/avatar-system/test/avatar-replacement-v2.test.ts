import { describe, expect, it } from "vitest";

import {
  AVATAR_PROFILE_STORAGE_KEY,
  createAvatarProfile,
  type AvatarDraft,
} from "../src/index.js";
import * as replacement from "../src/imported-avatar.js";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const replacementIds = [
  ...Array.from({ length: 7 }, (_, index) => `cat-agent-0${index + 1}`),
  ...Array.from({ length: 5 }, (_, index) => `dog-agent-0${index + 1}`),
  ...Array.from({ length: 5 }, (_, index) => `robot-agent-0${index + 1}`),
  ...Array.from({ length: 3 }, (_, index) => `user-male-0${index + 1}`),
  ...Array.from({ length: 3 }, (_, index) => `user-female-0${index + 1}`),
] as const;

type ReplacementApi = typeof replacement & {
  readonly importedAvatarSemanticReview?: (
    assetId: string,
    semantic: replacement.ImportedAvatarSemantic,
  ) => {
    readonly verdict: "pass" | "wrong_clip" | "ambiguous" | "unsupported";
    readonly expectedClipIndex: number | null;
    readonly rationale: string;
    readonly evidenceRefs: readonly string[];
  };
  readonly createModularImportedAvatarSource?: (
    baseModelId: string,
  ) => replacement.AvatarSourceSelection;
  readonly selectImportedAvatarSlot?: (
    source: replacement.AvatarSourceSelection,
    slotId: string,
    donorModelId: string,
  ) => replacement.AvatarSourceSelection;
  readonly importedAvatarDonorIds?: (
    source: replacement.AvatarSourceSelection,
  ) => readonly string[];
};

const api = replacement as ReplacementApi;

describe("replacement avatar source version 2", () => {
  it("requires explicit model-wide semantic review and fails closed for every non-pass decision", () => {
    expect(typeof api.importedAvatarSemanticReview).toBe("function");
    const review = api.importedAvatarSemanticReview!;
    const decisions = replacement.IMPORTED_AVATAR_ASSET_IDS.flatMap((assetId) =>
      replacement.IMPORTED_AVATAR_SEMANTICS.map((semantic) => ({
        assetId,
        semantic,
        decision: review(assetId, semantic),
      })),
    );
    expect(decisions).toHaveLength(23 * 12);
    for (const { assetId, semantic, decision } of decisions) {
      expect(decision.rationale.length).toBeGreaterThan(20);
      expect(decision.evidenceRefs.length).toBeGreaterThan(0);
      if (decision.verdict === "pass") {
        expect(decision.expectedClipIndex).toBeTypeOf("number");
        expect(
          replacement.resolveImportedAvatarWorldClip(assetId, semantic),
        ).toMatchObject({
          semantic,
          clipIndex: decision.expectedClipIndex,
          verification: "semantic-review-pass",
        });
      } else {
        expect(decision.expectedClipIndex).toBeNull();
        expect(() =>
          replacement.resolveImportedAvatarWorldClip(assetId, semantic),
        ).toThrow(/semantic review refused/iu);
      }
    }
  });

  it("resolves only the 69 reviewed model-local locomotion mappings", () => {
    const resolved = replacement.IMPORTED_AVATAR_ASSET_IDS.flatMap((assetId) =>
      replacement.IMPORTED_AVATAR_SEMANTICS.flatMap((semantic) => {
        try {
          return [
            replacement.resolveImportedAvatarWorldClip(assetId, semantic),
          ];
        } catch {
          return [];
        }
      }),
    );

    expect(resolved).toHaveLength(23 * 3);
    for (const assetId of replacement.IMPORTED_AVATAR_ASSET_IDS) {
      const asset = replacement.importedAvatarAsset(assetId)!;
      const table = resolved.filter((entry) => entry.assetId === assetId);
      expect(table).toHaveLength(3);
      expect(new Set(table.map((entry) => entry.clipIndex))).toHaveLength(3);
      expect(table.map((entry) => entry.semantic)).toEqual([
        "Idle",
        "Walk",
        "Run",
      ]);
      expect(
        table.every(
          (entry) =>
            entry.clipIndex >= 0 &&
            entry.clipIndex < asset.clipCount &&
            entry.clipName === asset.clips[entry.clipIndex] &&
            entry.verification === "semantic-review-pass" &&
            entry.oneShot ===
              !(["Idle", "Walk", "Run"] as const).includes(
                entry.semantic as "Idle" | "Walk" | "Run",
              ),
        ),
      ).toBe(true);
    }
  });

  it("resolves only evidence-backed source-local locomotion clips per complete model", () => {
    expect(
      ["Idle", "Walk", "Run"].map((action) =>
        replacement.resolveImportedAvatarWorldClip("user-male-02", action),
      ),
    ).toEqual([
      expect.objectContaining({
        assetId: "user-male-02",
        clipIndex: 5,
        clipName: "NlaTrack.005",
        semantic: "Idle",
        locomotion: "Idle",
        verification: "semantic-review-pass",
      }),
      expect.objectContaining({
        assetId: "user-male-02",
        clipIndex: 3,
        clipName: "NlaTrack.003",
        semantic: "Walk",
        locomotion: "Walk",
        verification: "semantic-review-pass",
      }),
      expect.objectContaining({
        assetId: "user-male-02",
        clipIndex: 20,
        clipName: "NlaTrack.020",
        semantic: "Run",
        locomotion: "Run",
        verification: "semantic-review-pass",
      }),
    ]);
    expect(
      replacement.resolveImportedAvatarWorldClip("robot-agent-05", "Idle"),
    ).toEqual(
      expect.objectContaining({
        assetId: "robot-agent-05",
        clipIndex: 18,
        clipName: "NlaTrack.018",
        semantic: "Idle",
        locomotion: "Idle",
        verification: "semantic-review-pass",
      }),
    );
  });

  it("maps bounded locomotion transitions locally and refuses unknown semantics", () => {
    expect(
      replacement.resolveImportedAvatarWorldClip("user-male-02", "StartWalk"),
    ).toMatchObject({ clipIndex: 3, locomotion: "Walk" });
    expect(
      replacement.resolveImportedAvatarWorldClip("user-male-02", "StopWalk"),
    ).toMatchObject({ clipIndex: 5, locomotion: "Idle" });
    expect(
      replacement.resolveImportedAvatarWorldClip("user-male-01", "Idle"),
    ).toMatchObject({ semantic: "Idle", oneShot: false });
    expect(
      replacement.resolveImportedAvatarWorldClip("robot-agent-05", "Walk"),
    ).toMatchObject({ semantic: "Walk", oneShot: false });
    expect(() =>
      replacement.resolveImportedAvatarWorldClip("cat-agent-01", "Dance"),
    ).toThrow(/semantic review refused/iu);
    expect(() =>
      replacement.resolveImportedAvatarWorldClip("cat-agent-01", "Teleport"),
    ).toThrow(/semantic review refused/iu);
  });

  it("exposes exactly 23 replacement IDs with six user and seventeen agent originals", () => {
    expect(replacement.IMPORTED_AVATAR_ASSET_IDS).toEqual(replacementIds);
    expect(
      replacement.importedAvatarAssetsForRole("user").map((asset) => asset.id),
    ).toEqual([
      "user-male-01",
      "user-male-02",
      "user-male-03",
      "user-female-01",
      "user-female-02",
      "user-female-03",
    ]);
    expect(
      replacement.importedAvatarAssetsForRole("agent").map((asset) => asset.id),
    ).toHaveLength(17);
    expect(replacement.importedAvatarAsset("cat-agent")).toBeUndefined();
    expect(replacement.importedAvatarAsset("futuristic-robot")).toBeUndefined();
    expect(replacement.importedAvatarAsset("user-male")).toBeUndefined();
  });

  it("creates and parses explicit version-2 original selections", () => {
    const draft = replacement.createDefaultImportedAvatarDraft(
      "user",
      "Operator",
    );
    expect(draft.avatarSource).toEqual({
      kind: "imported",
      version: 2,
      mode: "original",
      modelId: "user-male-01",
    });
    expect(replacement.parseImportedAvatarDraftForRole(draft, "user")).toEqual(
      draft,
    );
    expect(
      replacement.parseImportedAvatarDraftForRole(draft, "agent"),
    ).toBeNull();
  });

  it("selects a role-valid complete avatar while the Builder name is empty", () => {
    const selected = replacement.selectImportedAvatarModel(
      replacement.DEFAULT_IMPORTED_AVATAR_DRAFT,
      "user",
      "user-female-03",
    );

    expect(selected.agentName).toBe("");
    expect(selected.avatarSource).toEqual({
      kind: "imported",
      version: 2,
      mode: "original",
      modelId: "user-female-03",
    });
    expect(
      replacement.parseImportedAvatarDraftForRole(selected, "user"),
    ).toBeNull();
  });

  it("builds complete modular slots from evidence-backed donors and persists only stable IDs", () => {
    expect(typeof api.createModularImportedAvatarSource).toBe("function");
    expect(typeof api.selectImportedAvatarSlot).toBe("function");
    expect(typeof api.importedAvatarDonorIds).toBe("function");
    if (
      !api.createModularImportedAvatarSource ||
      !api.selectImportedAvatarSlot ||
      !api.importedAvatarDonorIds
    )
      return;
    const source = api.createModularImportedAvatarSource("user-male-01");
    expect(source).toMatchObject({
      kind: "imported",
      version: 2,
      mode: "modular",
      baseModelId: "user-male-01",
      slots: {
        head: { donorModelId: expect.any(String), regionId: "head-weighted" },
        torso: {
          donorModelId: expect.any(String),
          regionId: "torso-weighted",
        },
        "left-arm": {
          donorModelId: expect.any(String),
          regionId: "left-arm-weighted",
        },
        "right-arm": {
          donorModelId: expect.any(String),
          regionId: "right-arm-weighted",
        },
        "left-leg": {
          donorModelId: expect.any(String),
          regionId: "left-leg-weighted",
        },
        "right-leg": {
          donorModelId: expect.any(String),
          regionId: "right-leg-weighted",
        },
      },
    });
    expect(JSON.stringify(source)).not.toMatch(
      /assetUrl|nodeName|\/assets\/|\/mnt\//u,
    );
    expect(api.importedAvatarDonorIds(source)).toEqual(
      [...api.importedAvatarDonorIds(source)].sort(),
    );
  });

  it("truthfully refuses unsupported donor regions and accepts supported cross-role donors", () => {
    expect(typeof api.createModularImportedAvatarSource).toBe("function");
    expect(typeof api.selectImportedAvatarSlot).toBe("function");
    if (!api.createModularImportedAvatarSource || !api.selectImportedAvatarSlot)
      return;
    const source = api.createModularImportedAvatarSource("user-male-02");
    expect(() =>
      api.selectImportedAvatarSlot?.(source, "torso", "cat-agent-01"),
    ).toThrow(/Refused:.*overlapping core geometry/iu);
    expect(
      api.selectImportedAvatarSlot(source, "head", "robot-agent-03"),
    ).toMatchObject({
      slots: {
        head: {
          donorModelId: "robot-agent-03",
          regionId: "head-weighted",
        },
      },
    });
  });

  it("round-trips an original selection through profile storage", () => {
    const storage = new MemoryStorage();
    const avatarSource = {
      kind: "imported",
      version: 2,
      mode: "original",
      modelId: "user-female-02",
    } as const;
    const draft: AvatarDraft = {
      ...replacement.DEFAULT_IMPORTED_AVATAR_DRAFT,
      agentName: "Persisted Operator",
      avatarSource,
    };
    const profile = replacement.createImportedAvatarProfile(
      draft,
      null,
      "2026-07-30T21:00:00.000Z",
      "avatar_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    replacement.saveImportedAvatarProfile(storage, profile);
    const loaded = replacement.loadImportedAvatarProfiles(storage);
    expect(loaded.status).toBe("saved");
    expect(loaded.current?.avatarSource).toEqual(avatarSource);
    expect(loaded.draft.avatarSource).toEqual(avatarSource);
  });

  it("hydrates a persisted modular user profile as an unchanged migration gate", () => {
    expect(typeof api.createModularImportedAvatarSource).toBe("function");
    if (!api.createModularImportedAvatarSource) return;
    const storage = new MemoryStorage();
    const avatarSource = api.createModularImportedAvatarSource("user-male-02");
    const profile = replacement.createImportedAvatarProfile(
      {
        ...replacement.DEFAULT_IMPORTED_AVATAR_DRAFT,
        agentName: "Dormant modular",
        avatarSource,
      },
      null,
      "2026-07-30T21:00:00.000Z",
      "avatar_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    replacement.saveImportedAvatarProfile(storage, profile);
    const raw = storage.getItem(AVATAR_PROFILE_STORAGE_KEY);

    const loaded = replacement.loadImportedAvatarProfiles(storage);
    expect(loaded.status).toBe("avatar-migration-required");
    expect(loaded.current).toBeNull();
    expect(loaded.draft.avatarSource).toEqual(avatarSource);
    expect(storage.getItem(AVATAR_PROFILE_STORAGE_KEY)).toBe(raw);
  });

  it("requires explicit re-selection for a role-invalid persisted user model", () => {
    const storage = new MemoryStorage();
    const profile = replacement.createImportedAvatarProfile(
      {
        ...replacement.DEFAULT_IMPORTED_AVATAR_DRAFT,
        agentName: "Wrong role",
        avatarSource: {
          kind: "imported",
          version: 2,
          mode: "original",
          modelId: "robot-agent-05",
        },
      },
      null,
      "2026-07-30T21:00:00.000Z",
      "avatar_cccccccccccccccccccccccccccccccc",
    );
    replacement.saveImportedAvatarProfile(storage, profile);
    const raw = storage.getItem(AVATAR_PROFILE_STORAGE_KEY);

    const loaded = replacement.loadImportedAvatarProfiles(storage);
    expect(loaded.status).toBe("avatar-reselection-required");
    expect(loaded.current).toBeNull();
    expect(loaded.draft.avatarSource).toEqual({
      kind: "reselection-required",
      version: 2,
      reason: "removed-or-unknown-model",
    });
    expect(storage.getItem(AVATAR_PROFILE_STORAGE_KEY)).toBe(raw);
  });

  it("preserves stale stored bytes and requires explicit re-selection for removed IDs", () => {
    const storage = new MemoryStorage();
    const baseDraft = Object.fromEntries(
      Object.entries(replacement.DEFAULT_IMPORTED_AVATAR_DRAFT).filter(
        ([key]) => key !== "avatarSource",
      ),
    ) as AvatarDraft;
    const base = createAvatarProfile(
      {
        ...baseDraft,
        agentName: "Stale Operator",
      },
      null,
      "2026-07-30T21:00:00.000Z",
      "avatar_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    const staleEnvelope = JSON.stringify({
      schema: "aiw.avatar-store/0.18.5",
      current: {
        ...base,
        avatarSource: {
          kind: "imported",
          assetId: "cat-agent",
          previewClipIndex: 0,
        },
      },
      previous: null,
    });
    storage.setItem(AVATAR_PROFILE_STORAGE_KEY, staleEnvelope);

    const loaded = replacement.loadImportedAvatarProfiles(storage);
    expect(loaded.status).toBe("avatar-reselection-required");
    expect(loaded.current).toBeNull();
    expect(loaded.draft.avatarSource).toEqual({
      kind: "reselection-required",
      version: 2,
      reason: "removed-or-unknown-model",
    });
    expect(storage.getItem(AVATAR_PROFILE_STORAGE_KEY)).toBe(staleEnvelope);
    expect(replacement.parseImportedAvatarDraft(loaded.draft)).toBeNull();
  });
});

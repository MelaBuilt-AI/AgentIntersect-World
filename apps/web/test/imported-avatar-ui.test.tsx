import {
  createAvatarProfile,
  DEFAULT_AVATAR_DRAFT,
  type AvatarDraft,
} from "@agentintersect-world/avatar-system";
import {
  AVATAR_RESELECTION_REQUIRED,
  createImportedAvatarProfile,
  createOriginalImportedAvatarSource,
  createModularImportedAvatarSource,
  DEFAULT_IMPORTED_AVATAR_DRAFT,
  IMPORTED_AVATAR_ASSETS,
  selectImportedAvatarSlot,
  type ImportedAvatarAssetId,
} from "@agentintersect-world/avatar-system/imported-avatar";
import { readFileSync } from "node:fs";
import { Children, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AvatarBuilder } from "../src/avatar/AvatarBuilder.js";
import { AvatarPreview } from "../src/avatar/AvatarPreview.js";
import {
  parseImportedAvatarManifest,
  validateImportedAvatarManifest,
} from "../src/avatar/imported-avatar-manifest.js";
import type { AvatarProposal } from "../src/sessions/session-client.js";
import {
  avatarDraftFromProposal,
  avatarProposalFromDraft,
} from "../src/world-entry/world-entry-avatar.js";
import { WorldEntryAgentAvatar } from "../src/world-entry/WorldEntryAgentAvatar.js";
import { WorldRoom } from "../src/world-entry/WorldRoom.js";
import { worldImportedAvatarSelection } from "../src/world-entry/world-imported-avatar.js";

const importedDraft = (modelId: ImportedAvatarAssetId): AvatarDraft => ({
  ...DEFAULT_IMPORTED_AVATAR_DRAFT,
  agentName: "Preview",
  avatarSource: createOriginalImportedAvatarSource(modelId),
});

const agentProposal: AvatarProposal = {
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
  rationale: "Existing accepted fixture.",
  createdAt: "2026-07-25T00:00:00.000Z",
};

describe("replacement imported avatar creator", () => {
  it("keeps imported renderer dependencies stable while only the avatar name changes", () => {
    const avatarSource = createOriginalImportedAvatarSource("user-male-01");
    type ChildContainer = ReactElement<{ children: ReactNode }>;
    type SceneElement = ReactElement<{
      importedParts: readonly unknown[];
      hiddenPartIds: readonly string[];
    }>;
    const renderScene = (agentName: string) => {
      const preview = AvatarPreview({
        profile: {
          ...DEFAULT_IMPORTED_AVATAR_DRAFT,
          agentName,
          avatarSource,
        },
      }) as ChildContainer;
      const previewChildren = Children.toArray(preview.props.children);
      const suspense = previewChildren[1] as ChildContainer;
      const errorBoundary = suspense.props.children as ChildContainer;
      return errorBoundary.props.children as SceneElement;
    };

    const first = renderScene("A").props;
    const second = renderScene("Avatar Name").props;

    expect(first.importedParts).toBe(second.importedParts);
    expect(first.hiddenPartIds).toBe(second.hiddenPartIds);
  });

  it("shows six user and seventeen agent stance-card buttons", () => {
    const render = (role: "user" | "agent") =>
      renderToStaticMarkup(
        <AvatarBuilder
          role={role}
          initialProfile={{
            ...DEFAULT_IMPORTED_AVATAR_DRAFT,
            agentName: role,
          }}
          onSave={vi.fn()}
        />,
      );
    const userHtml = render("user");
    const agentHtml = render("agent");
    expect(userHtml.match(/aria-label="Open [^"]+ 3D preview"/gu)).toHaveLength(
      6,
    );
    expect(
      agentHtml.match(/aria-label="Open [^"]+ 3D preview"/gu),
    ).toHaveLength(17);
    expect(userHtml).toContain("User Female 3");
    expect(userHtml).not.toContain("Cat Agent");
    expect(agentHtml).toContain("Cat Agent 7");
    expect(agentHtml).toContain("Dog Agent 5");
    expect(agentHtml).toContain("Robot Agent 5");
    expect(agentHtml).not.toContain("User Female");
    expect(userHtml).toContain(
      'aria-label="User avatar stance cards (6 available)"',
    );
    expect(agentHtml).toContain(
      'aria-label="Agent avatar stance cards (17 available)"',
    );
    expect(userHtml).toContain('data-avatar-card-count="6"');
    expect(agentHtml).toContain('data-avatar-card-count="17"');
    expect(userHtml).toContain(
      "<strong>User originals</strong><span> · 6 stance cards</span>",
    );
    expect(agentHtml).toContain(
      "<strong>Agent originals</strong><span> · 17 stance cards</span>",
    );
    expect(userHtml).toContain("Complete avatar preview");
    expect(userHtml).toContain('data-testid="avatar-preview-panel"');
    expect(userHtml).toContain(
      "User Male 1 is previewed from its actual GLB. It is not selected, saved, or accepted.",
    );
  });

  it("visually preloads the first role-valid complete GLB without accepting or saving it", () => {
    const onSave = vi.fn();
    const html = renderToStaticMarkup(
      <AvatarBuilder
        role="user"
        initialProfile={importedDraft("user-male-01")}
        onSave={onSave}
      />,
    );
    expect(html).toContain(
      "User Male 1 is previewed from its actual GLB. It is not selected, saved, or accepted.",
    );
    expect(html).toContain("Loading User Male 1 GLB…");
    expect(html).not.toContain("Stance-card preview");
    expect(onSave).not.toHaveBeenCalled();
    expect(html).toContain("Use Complete Avatar");
    expect(html).toContain(
      "Preview only. Use Complete Avatar to select it; nothing is saved or accepted yet.",
    );
    expect(html).not.toContain("Modular (verification pending)");
    expect(html).not.toContain('aria-label="Avatar mode"');
    expect(html).toContain(
      "Preview</strong> — No complete avatar selected (previewing User Male 1)",
    );
    expect(html).toContain("anonymous source clips");
    expect(html).toContain(
      '<button class="primary-action" type="button" disabled="">Save avatar and enter World</button>',
    );
    expect(html).toContain(
      'aria-pressed="false" aria-label="Open User Male 1 3D preview"',
    );
  });

  it("preloads the visual GLB before the required first-launch name is entered", () => {
    expect(() =>
      renderToStaticMarkup(
        <AvatarBuilder
          role="user"
          initialProfile={{
            ...DEFAULT_IMPORTED_AVATAR_DRAFT,
            agentName: "",
          }}
          onSave={vi.fn()}
        />,
      ),
    ).not.toThrow();
    const html = renderToStaticMarkup(
      <AvatarBuilder
        role="user"
        initialProfile={{ ...DEFAULT_IMPORTED_AVATAR_DRAFT, agentName: "" }}
        onSave={vi.fn()}
      />,
    );
    expect(html).toContain('data-avatar-imported-id="user-male-01"');
    expect(html).toContain("Loading User Male 1 GLB…");
  });

  it("keeps a dormant modular profile unsaveable until explicitly converted", () => {
    const modular: AvatarDraft = {
      ...DEFAULT_IMPORTED_AVATAR_DRAFT,
      agentName: "Dormant modular",
      avatarSource: createModularImportedAvatarSource("user-male-01"),
    };
    const html = renderToStaticMarkup(
      <AvatarBuilder role="user" initialProfile={modular} onSave={vi.fn()} />,
    );
    expect(html).toContain(
      "This dormant modular draft cannot be saved. Use Complete Avatar to select the full original GLB.",
    );
    expect(html).toContain(
      '<button class="primary-action" type="button" disabled="">Save avatar and enter World</button>',
    );
  });

  it("preloads a complete GLB while preserving unsaved legacy migration state", () => {
    const legacy = createAvatarProfile(
      { ...DEFAULT_AVATAR_DRAFT, agentName: "Legacy Operator" },
      null,
      "2026-07-20T12:00:00.000Z",
      "avatar_0123456789abcdef0123456789abcdef",
    );
    const onSave = vi.fn();
    const html = renderToStaticMarkup(
      <AvatarBuilder
        role="user"
        initialProfile={legacy}
        currentProfile={legacy}
        storageStatus="saved"
        onSave={onSave}
      />,
    );
    expect(html).toContain("Preserved legacy profile");
    expect(html).toContain(
      "Accepted legacy appearance remains unchanged until save.",
    );
    expect(html).not.toContain("previewed unchanged");
    expect(html).toContain('data-avatar-source="imported"');
    expect(html).toContain('data-avatar-imported-id="user-male-01"');
    expect(html).toContain("It is not selected, saved, or accepted.");
    expect(html).toContain("Legacy Operator</strong> — Human");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Open User Male 1 3D preview");
    expect(html).toContain(
      '<button class="primary-action" type="button" disabled="">Save avatar changes</button>',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps agent migration copy consistent with its unsaved actual-GLB preload", () => {
    const html = renderToStaticMarkup(
      <WorldEntryAgentAvatar
        proposal={agentProposal}
        mode="migrate"
        busy={false}
        error=""
        AvatarBuilderComponent={AvatarBuilder}
        onAccept={vi.fn()}
      />,
    );
    expect(html).toContain('data-avatar-imported-id="cat-agent-01"');
    expect(html).toContain("Cat Agent 1 is previewed from its actual GLB");
    expect(html).toContain(
      "The accepted legacy avatar remains unchanged until explicit save.",
    );
    expect(html).not.toContain("previewed unchanged");
    expect(html).toContain(
      '<button class="primary-action" type="button" disabled="">Accept and save avatar</button>',
    );
  });

  it("restores visual draft, accepted, and invalid refresh states without conflating consent", () => {
    const unsavedSave = vi.fn();
    const unsavedHtml = renderToStaticMarkup(
      <AvatarBuilder
        role="user"
        initialProfile={importedDraft("user-female-02")}
        onSave={unsavedSave}
      />,
    );
    expect(unsavedHtml).toContain('data-avatar-imported-id="user-female-02"');
    expect(unsavedHtml).toContain("Draft is unsaved.");
    expect(unsavedHtml).toContain("<dd>Unconfigured</dd>");
    expect(unsavedSave).not.toHaveBeenCalled();

    const accepted = createImportedAvatarProfile(
      {
        ...importedDraft("user-female-03"),
        agentName: "Accepted Operator",
      },
      null,
      "2026-07-31T15:00:00.000Z",
      "avatar_cccccccccccccccccccccccccccccccc",
    );
    const acceptedSave = vi.fn();
    const acceptedHtml = renderToStaticMarkup(
      <AvatarBuilder
        role="user"
        initialProfile={accepted}
        currentProfile={accepted}
        storageStatus="saved"
        onSave={acceptedSave}
      />,
    );
    expect(acceptedHtml).toContain('data-avatar-imported-id="user-female-03"');
    expect(acceptedHtml).toContain("Saved profile loaded.");
    expect(acceptedHtml).toContain(
      "User Female 3 is your accepted complete avatar and is previewed from its actual GLB.",
    );
    expect(acceptedHtml).toContain(
      "Accepted Operator · 2026-07-31T15:00:00.000Z",
    );
    expect(acceptedSave).not.toHaveBeenCalled();

    const invalidHtml = renderToStaticMarkup(
      <AvatarBuilder
        role="user"
        initialProfile={{
          ...DEFAULT_IMPORTED_AVATAR_DRAFT,
          agentName: "Invalid Operator",
          avatarSource: AVATAR_RESELECTION_REQUIRED,
        }}
        storageStatus="avatar-reselection-required"
        onSave={vi.fn()}
      />,
    );
    expect(invalidHtml).toContain("Re-selection remains required.");
    expect(invalidHtml).toContain('data-avatar-preview-state="closed"');
    expect(invalidHtml).toContain("No complete avatar preview selected");
    expect(invalidHtml).not.toContain("aiw-avatar-contact-sheet");
    expect(invalidHtml).not.toContain("Stance-card preview");
  });

  it("keeps the single visual GLB behind the lazy 3D boundary", () => {
    const builder = readFileSync(
      new URL("../src/avatar/AvatarBuilder.tsx", import.meta.url),
      "utf8",
    );
    const preview = readFileSync(
      new URL("../src/avatar/AvatarPreview.tsx", import.meta.url),
      "utf8",
    );
    expect(builder).toContain("previewAssetId");
    expect(builder).not.toMatch(/useLoader|GLTFLoader/u);
    expect(preview).toContain("lazy(async () =>");
    expect(preview).toContain("load3d");
    const renderer = readFileSync(
      new URL(
        "../../../packages/renderer-r3f/src/imported-avatar-canvas.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(renderer).toContain("3D preview ready");
    expect(renderer).toContain("Rendering 3D preview");
  });

  it("round-trips the v2 original source through agent consent", () => {
    const accepted = avatarProposalFromDraft(
      agentProposal,
      importedDraft("cat-agent-01"),
    );
    expect(accepted.avatarSource).toEqual({
      kind: "imported",
      version: 2,
      mode: "original",
      modelId: "cat-agent-01",
    });
    expect(avatarDraftFromProposal(accepted).avatarSource).toEqual(
      accepted.avatarSource,
    );
  });

  it("preserves legacy proposals without fabricating an imported source", () => {
    const legacyDraft = avatarDraftFromProposal(agentProposal);
    expect(legacyDraft.avatarSource).toBeUndefined();
    expect(
      avatarProposalFromDraft(agentProposal, legacyDraft),
    ).not.toHaveProperty("avatarSource");
    expect(
      worldImportedAvatarSelection(legacyDraft, "Idle", "agent"),
    ).toBeUndefined();
    expect(() =>
      avatarProposalFromDraft(agentProposal, importedDraft("user-male-01")),
    ).toThrow(/role-valid agent avatar/iu);
  });

  it("routes a role-valid original into World without preview-only state", () => {
    expect(
      worldImportedAvatarSelection(
        importedDraft("user-male-01"),
        "Idle",
        "user",
      ),
    ).toMatchObject({
      assetId: "user-male-01",
      assetUrl: "/assets/imported-avatars/user-male-01.glb",
      resolvedClip: {
        clipIndex: 15,
        clipName: "NlaTrack.015",
        locomotion: "Idle",
        semantic: "Idle",
        verification: "semantic-review-pass",
      },
    });
    expect(
      worldImportedAvatarSelection(
        importedDraft("user-male-01"),
        "Idle",
        "agent",
      ),
    ).toBeUndefined();
  });

  it("routes each model's evidence-backed World actions", () => {
    expect(
      worldImportedAvatarSelection(
        importedDraft("user-male-02"),
        "Idle",
        "user",
      ),
    ).toMatchObject({
      assetId: "user-male-02",
      resolvedClip: {
        clipIndex: 5,
        clipName: "NlaTrack.005",
        locomotion: "Idle",
      },
    });
    expect(
      worldImportedAvatarSelection(
        importedDraft("user-male-02"),
        "Walk",
        "user",
      ),
    ).toMatchObject({
      resolvedClip: {
        clipIndex: 3,
        clipName: "NlaTrack.003",
        locomotion: "Walk",
      },
    });
    expect(
      worldImportedAvatarSelection(
        importedDraft("user-male-02"),
        "Run",
        "user",
      ),
    ).toMatchObject({
      resolvedClip: {
        clipIndex: 20,
        clipName: "NlaTrack.020",
        locomotion: "Run",
      },
    });
    expect(
      worldImportedAvatarSelection(
        importedDraft("robot-agent-05"),
        "Idle",
        "agent",
      ),
    ).toMatchObject({
      assetId: "robot-agent-05",
      resolvedClip: {
        clipIndex: 18,
        clipName: "NlaTrack.018",
        locomotion: "Idle",
      },
    });
    expect(
      worldImportedAvatarSelection(
        importedDraft("robot-agent-05"),
        "Walk",
        "agent",
      ),
    ).toMatchObject({
      resolvedClip: {
        clipIndex: 20,
        clipName: "NlaTrack.020",
        locomotion: "Walk",
        semantic: "Walk",
        verification: "semantic-review-pass",
      },
    });
  });

  it("uses each imported model's verified Idle clip for the temporary Work/static fallback", () => {
    expect(
      worldImportedAvatarSelection(
        importedDraft("cat-agent-02"),
        "Work",
        "agent",
      ),
    ).toMatchObject({
      assetId: "cat-agent-02",
      resolvedClip: {
        clipIndex: 0,
        clipName: "NlaTrack",
        locomotion: "Idle",
        semantic: "Idle",
        verification: "semantic-review-pass",
        error: "",
      },
    });
    expect(
      worldImportedAvatarSelection(
        importedDraft("cat-agent-03"),
        "Work",
        "agent",
      ),
    ).toMatchObject({
      assetId: "cat-agent-03",
      resolvedClip: {
        clipIndex: 18,
        clipName: "NlaTrack.018",
        locomotion: "Idle",
        semantic: "Idle",
        verification: "semantic-review-pass",
        error: "",
      },
    });
  });

  it("refuses the measured dog pair without loading or substituting either GLB", () => {
    let source = createModularImportedAvatarSource("dog-agent-01");
    for (const slot of [
      "head",
      "torso",
      "left-arm",
      "right-arm",
      "left-leg",
      "right-leg",
    ] as const)
      source = selectImportedAvatarSlot(source, slot, "dog-agent-02");
    const modular: AvatarDraft = {
      ...DEFAULT_IMPORTED_AVATAR_DRAFT,
      agentName: "Modular",
      avatarSource: source,
    };
    expect(
      worldImportedAvatarSelection(modular, "Idle", "agent"),
    ).toBeUndefined();
    const room = renderToStaticMarkup(
      <WorldRoom
        floor="blank"
        objects={[]}
        reducedMotion={false}
        forceNoWebGL={false}
        userName="Operator"
        agentName="Modular"
        userAvatar={importedDraft("user-male-01")}
        agentAvatar={modular}
        activity={{ state: "idle", icon: "", label: "idle", detail: "" }}
      />,
    );
    expect(room).toContain("imported-modular-unavailable");
    expect(room).toContain(
      "No complete donor or custom avatar was substituted",
    );
    expect(room).toContain('data-renderer="semantic"');
    expect(room).not.toContain("dog-agent-01.glb");
    expect(room).not.toContain("dog-agent-02.glb");
    expect(room).not.toContain('data-testid="world-room-canvas"');
  });

  it("validates the exact 23-model replacement manifest projection", () => {
    const raw = JSON.parse(
      readFileSync(
        new URL(
          "../public/assets/imported-avatars/manifest.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const manifest = validateImportedAvatarManifest(raw);
    expect(parseImportedAvatarManifest(raw)).not.toBeNull();
    expect(manifest.schema).toBe("aiw.replacement-avatar-assets/3");
    expect(manifest.assets).toHaveLength(23);
    expect(manifest.assets.map((asset) => asset.id)).toEqual(
      IMPORTED_AVATAR_ASSETS.map((asset) => asset.id),
    );
    expect(
      manifest.assets.every(
        (asset) =>
          /^[a-f0-9]{64}$/u.test(asset.sha256) &&
          /^[a-f0-9]{64}$/u.test(asset.thumbnailSha256) &&
          (
            asset.registry as unknown as {
              provenance: { suppliedLicenseStatus: string };
            }
          ).provenance.suppliedLicenseStatus ===
            "tripo3d-subscription-user-confirmed-unrestricted-use",
      ),
    ).toBe(true);

    const duplicate = structuredClone(raw);
    duplicate.assets.push(duplicate.assets[0]);
    expect(() => validateImportedAvatarManifest(duplicate)).toThrow(
      /duplicate manifest asset/iu,
    );
  });
});

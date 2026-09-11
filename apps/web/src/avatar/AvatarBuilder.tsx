import {
  validateAgentName,
  type AvatarDraft,
  type AvatarProfile,
} from "@agentintersect-world/avatar-system";
import {
  CUSTOM_AVATAR_SOURCE,
  createOriginalImportedAvatarSource,
  exportImportedAvatarProfile,
  importedAvatarAsset,
  importedAvatarAssetsForRole,
  importedAvatarProfileSummary,
  parseImportedAvatarDraftForRole,
  prepareAvatarBuilderDraft,
  selectImportedAvatarModel,
  selectImportedAvatarMode,
  type AvatarBuilderRole,
  type ImportedAvatarAssetId,
} from "@agentintersect-world/avatar-system/imported-avatar";
import { useId, useMemo, useState } from "react";
import { AvatarPreview } from "./AvatarPreview.js";
import { useReducedMotion } from "../motion/use-reduced-motion.js";

export function AvatarBuilder({
  onboarding = false,
  role = "user",
  initialProfile,
  currentProfile = null,
  previousProfile = null,
  storageStatus = "unconfigured",
  onSave,
  onDelete,
  title = "Create your World avatar",
  intro = "Manual choices stay in this browser. Automatic profile mapping is off; prompts, memory, transcripts, paths, secrets, traits, and biometrics are never accepted.",
  saveLabel,
  saveDisabled = false,
  successMessage = "Avatar saved locally. Current and previous recovery updated.",
  preserveInitialLegacy = false,
}: {
  readonly onboarding?: boolean;
  readonly role?: AvatarBuilderRole;
  readonly initialProfile: AvatarDraft;
  readonly currentProfile?: AvatarProfile | null;
  readonly previousProfile?: AvatarProfile | null;
  readonly storageStatus?:
    | "unconfigured"
    | "saved"
    | "recovered-previous"
    | "migrated-phase11"
    | "migrated-unconfigured"
    | "corrupt-unconfigured"
    | "avatar-migration-required"
    | "avatar-reselection-required";
  readonly onSave: (profile: AvatarDraft) => void;
  readonly onDelete?: () => void;
  readonly title?: string;
  readonly intro?: string;
  readonly saveLabel?: string;
  readonly saveDisabled?: boolean;
  readonly successMessage?: string;
  readonly preserveInitialLegacy?: boolean;
}) {
  const roleAssets = useMemo(() => importedAvatarAssetsForRole(role), [role]);
  const reducedMotion = useReducedMotion();
  const previewTitleId = useId();
  const roleLabel = role === "user" ? "User" : "Agent";
  const preserveLegacy =
    preserveInitialLegacy ||
    currentProfile !== null ||
    storageStatus === "migrated-phase11" ||
    storageStatus === "migrated-unconfigured";
  const initialBuilder = useMemo(
    () => prepareAvatarBuilderDraft(initialProfile, role, preserveLegacy),
    [initialProfile, preserveLegacy, role],
  );
  const acceptedSource = currentProfile?.avatarSource;
  const initialAcceptedImportedId =
    acceptedSource?.kind === "imported" && acceptedSource.mode === "original"
      ? acceptedSource.modelId
      : null;
  const [draft, setDraft] = useState<AvatarDraft>(() => initialBuilder.draft);
  const [previewIntent, setPreviewIntent] = useState<
    "accepted" | "preload" | "preview" | "confirmed"
  >(initialAcceptedImportedId ? "accepted" : "preload");
  const completeAvatarConfirmed =
    previewIntent === "accepted" || previewIntent === "confirmed";
  const [textOnly, setTextOnly] = useState(
    typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("avatar3d") === "text",
  );
  const [previewAssetId, setPreviewAssetId] =
    useState<ImportedAvatarAssetId | null>(() => {
      if (initialBuilder.state === "reselection-required") return null;
      const source = initialBuilder.draft.avatarSource;
      if (source?.kind === "imported")
        return source.mode === "original" ? source.modelId : source.baseModelId;
      return roleAssets[0]?.id ?? null;
    });
  const [previewClipIndex, setPreviewClipIndex] = useState(0);
  const [result, setResult] = useState(
    storageStatus === "avatar-reselection-required"
      ? "The saved imported model was removed. Choose a replacement explicitly; the stored record was not rewritten."
      : storageStatus === "avatar-migration-required"
        ? "The saved modular avatar requires explicit complete-avatar conversion; the stored record was not rewritten."
        : storageStatus === "migrated-unconfigured"
          ? "Legacy appearance migrated. A valid name is required before save."
          : storageStatus === "corrupt-unconfigured"
            ? "Stored profile is invalid and was preserved. Save or delete to replace it."
            : currentProfile
              ? "Saved profile loaded."
              : "Draft is unsaved.",
  );
  const name = validateAgentName(draft.agentName);
  const valid = parseImportedAvatarDraftForRole(draft, role);
  const source = draft.avatarSource ?? CUSTOM_AVATAR_SOURCE;
  const importedSource = source.kind === "imported" ? source : undefined;
  const dormantModularDraft = importedSource?.mode === "modular";
  const imported = importedSource
    ? importedAvatarAsset(
        importedSource.mode === "original"
          ? importedSource.modelId
          : importedSource.baseModelId,
      )
    : undefined;
  const previewAsset = previewAssetId
    ? roleAssets.find((asset) => asset.id === previewAssetId)
    : undefined;
  const previewDraft = previewAsset
    ? {
        ...draft,
        avatarSource: createOriginalImportedAvatarSource(previewAsset.id),
      }
    : draft;
  const previewIsAccepted =
    previewIntent === "accepted" &&
    initialAcceptedImportedId === previewAsset?.id;
  const previewIsConfirmedDraft =
    previewIntent === "confirmed" && imported?.id === previewAsset?.id;
  const saveBlocked =
    !valid || saveDisabled || dormantModularDraft || !completeAvatarConfirmed;
  const update = <K extends keyof AvatarDraft>(
    key: K,
    value: AvatarDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setResult("Draft is unsaved.");
  };
  const chooseImportedAsset = (assetId: ImportedAvatarAssetId) => {
    setPreviewAssetId(assetId);
    setPreviewClipIndex(0);
    setPreviewIntent("preview");
    setResult("Preview changed. Use Complete Avatar to select it.");
  };
  const useCompleteAvatar = () => {
    if (!previewAsset) {
      setResult("Choose a role-valid complete avatar preview first.");
      return;
    }
    setDraft((current) =>
      selectImportedAvatarMode(
        selectImportedAvatarModel(current, role, previewAsset.id),
        "original",
      ),
    );
    setPreviewIntent("confirmed");
    setResult("Complete avatar selected. Save to persist this choice.");
  };
  const save = () => {
    if (saveBlocked) {
      if (dormantModularDraft)
        setResult(
          "Save blocked: use Complete Avatar to select the full original GLB.",
        );
      else if (!completeAvatarConfirmed)
        setResult("Use Complete Avatar before saving.");
      else if (!valid)
        setResult(
          name.ok
            ? "Save blocked: one or more selections is invalid."
            : `Save blocked: ${name.reason}`,
        );
      return;
    }
    onSave(valid);
    setResult(successMessage);
  };
  if (onboarding) {
    const selected = previewAsset
      ? parseImportedAvatarDraftForRole(previewDraft, role)
      : null;
    return (
      <section
        className="avatar-builder avatar-builder--onboarding"
        aria-label={`${roleLabel} avatar selection`}
      >
        <div className="avatar-onboarding__choices">
          <input
            aria-label={`${roleLabel} name`}
            aria-invalid={!name.ok}
            value={draft.agentName}
            maxLength={96}
            onChange={(event) => update("agentName", event.target.value)}
          />
          <div
            className="imported-avatar-options"
            aria-label={`${roleLabel} avatars`}
            data-avatar-card-count={roleAssets.length}
          >
            {roleAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className="imported-avatar-option"
                aria-pressed={previewAssetId === asset.id}
                aria-label={`Open ${asset.label} 3D preview`}
                onClick={() => chooseImportedAsset(asset.id)}
              >
                <img src={asset.thumbnailUrl} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <button
            className="primary-action"
            type="button"
            disabled={!selected || saveDisabled}
            onClick={() => {
              if (selected && !saveDisabled) onSave(selected);
            }}
          >
            {role === "user" ? "Accept user Avatar" : "Accept Agent Avatar"}
          </button>
        </div>
        <aside
          className="avatar-builder__preview"
          aria-label="3D avatar preview"
          data-testid="avatar-preview-panel"
        >
          <AvatarPreview
            profile={previewDraft}
            textOnly={textOnly}
            previewClipIndex={previewAsset?.semanticClips.Idle.clipIndex ?? 0}
            animate={!reducedMotion}
            load3d={previewAsset !== undefined}
            showFallbackImage={false}
            minimal
          />
        </aside>
      </section>
    );
  }
  return (
    <section className="avatar-builder" aria-labelledby="avatar-builder-title">
      <div className="avatar-builder__copy">
        <span className="terminal-kicker">aiw_avatar_0_11_</span>
        <h1 id="avatar-builder-title">{title}</h1>
        <p>{intro}</p>
        <fieldset>
          <legend>
            <b>1</b> Name
          </legend>
          <label>
            Required agent name
            <input
              value={draft.agentName}
              maxLength={96}
              aria-invalid={!name.ok}
              onChange={(e) => update("agentName", e.target.value)}
            />
          </label>
          <small>
            {name.ok
              ? `${[...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(name.value)].length}/32 visible characters`
              : name.reason}
          </small>
        </fieldset>
        <fieldset className="avatar-source-picker">
          <legend>
            <b>2</b> Imported model
          </legend>
          {source.kind === "custom" ? (
            <aside className="avatar-legacy-notice" role="status">
              <strong>Preserved legacy profile</strong>
              <p>
                Accepted legacy appearance remains unchanged until save. The
                visual complete-avatar preload is only a preview; choose a card
                to begin migration.
              </p>
            </aside>
          ) : null}
          <div className="imported-avatar-catalog__summary">
            <strong>{roleLabel} originals</strong>
            <span> · {roleAssets.length} stance cards</span>
          </div>
          <div
            className="imported-avatar-options"
            aria-label={`${roleLabel} avatar stance cards (${roleAssets.length} available)`}
            data-avatar-card-count={roleAssets.length}
          >
            {roleAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className="imported-avatar-option"
                aria-pressed={
                  previewIntent !== "preload" && previewAssetId === asset.id
                }
                aria-label={`Open ${asset.label} 3D preview`}
                onClick={() => chooseImportedAsset(asset.id)}
              >
                <img
                  src={asset.thumbnailUrl}
                  alt={`${asset.label} stance`}
                  loading="lazy"
                />
                <strong>{asset.label}</strong>
              </button>
            ))}
          </div>
          {previewAsset ? (
            <>
              <div className="avatar-actions">
                <button
                  type="button"
                  className="primary-action"
                  onClick={useCompleteAvatar}
                >
                  Use Complete Avatar
                </button>
              </div>
              <p role="status">
                {dormantModularDraft
                  ? "This dormant modular draft cannot be saved. Use Complete Avatar to select the full original GLB."
                  : previewIsAccepted
                    ? "The accepted complete avatar uses the full original GLB."
                    : previewIsConfirmedDraft
                      ? "The selected complete avatar uses the full original GLB. Save to accept this draft."
                      : "Preview only. Use Complete Avatar to select it; nothing is saved or accepted yet."}
              </p>
              <label className="imported-animation-control">
                Source clip preview (unlabeled)
                <select
                  aria-label="Source clip preview"
                  value={previewClipIndex}
                  onChange={(event) =>
                    setPreviewClipIndex(Number(event.target.value))
                  }
                >
                  {previewAsset.clips.map((clip, index) => (
                    <option key={`${index}:${clip}`} value={index}>
                      Clip {index + 1} — {clip}
                    </option>
                  ))}
                </select>
                <small>
                  {previewAsset.clips.length} anonymous source clips. Semantic
                  labels remain pending visual verification and are not saved
                  here.
                </small>
              </label>
            </>
          ) : null}
        </fieldset>
        <fieldset>
          <legend>
            <b>3</b> Review and save
          </legend>
          <p data-testid="avatar-semantic-summary">
            <strong>{draft.agentName || "Name required"}</strong> —{" "}
            {source.kind === "imported" && !completeAvatarConfirmed
              ? `No complete avatar selected${previewAsset ? ` (previewing ${previewAsset.label})` : ""}`
              : importedAvatarProfileSummary(draft)}
          </p>
          <label className="avatar-consent">
            <input type="checkbox" checked={false} disabled /> Automatic Phase 6
            roster label mapping is off. Opt-in is offered only beside an owned
            roster record.
          </label>
          <label>
            <input
              type="checkbox"
              checked={textOnly}
              onChange={(e) => setTextOnly(e.target.checked)}
            />{" "}
            Text-only mode (does not load the GLB)
          </label>
          <dl>
            <dt>Current</dt>
            <dd>
              {currentProfile
                ? `${currentProfile.agentName} · ${currentProfile.updatedAt}`
                : "Unconfigured"}
            </dd>
            <dt>Previous</dt>
            <dd>
              {previousProfile
                ? `${previousProfile.agentName} · ${previousProfile.updatedAt}`
                : "None"}
            </dd>
          </dl>
          <div className="avatar-actions">
            <button
              className="primary-action"
              type="button"
              onClick={save}
              disabled={saveBlocked}
            >
              {saveLabel ??
                `Save avatar${currentProfile ? " changes" : " and enter World"}`}
            </button>
            {currentProfile && (
              <button
                type="button"
                onClick={() => {
                  const value = exportImportedAvatarProfile(currentProfile);
                  setResult(
                    `Export preview ready (${new TextEncoder().encode(value).byteLength} bytes).`,
                  );
                }}
              >
                Preview local export
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  setResult(
                    "Avatar deleted; neutral unconfigured draft restored.",
                  );
                }}
              >
                Delete/reset avatar
              </button>
            )}
          </div>
        </fieldset>
        <div
          className="avatar-builder__status"
          role="status"
          aria-live="polite"
        >
          <strong>Result:</strong> {result}
        </div>
      </div>
      <aside
        className="avatar-builder__preview"
        aria-labelledby={previewTitleId}
        data-testid="avatar-preview-panel"
      >
        <header>
          <span className="terminal-kicker">actual_glb_preview_</span>
          <h2 id={previewTitleId}>Complete avatar preview</h2>
          <p>
            {previewAsset
              ? previewIsAccepted
                ? `${previewAsset.label} is your accepted complete avatar and is previewed from its actual GLB.`
                : previewIsConfirmedDraft
                  ? `${previewAsset.label} is selected in this unsaved draft and previewed from its actual GLB.`
                  : `${previewAsset.label} is previewed from its actual GLB. It is not selected, saved, or accepted.`
              : "Choose a role-valid stance card to load its actual GLB. Re-selection remains required."}
          </p>
        </header>
        <AvatarPreview
          profile={previewDraft}
          textOnly={textOnly}
          previewClipIndex={previewClipIndex}
          load3d={previewAsset !== undefined}
          showFallbackImage={false}
        />
      </aside>
    </section>
  );
}

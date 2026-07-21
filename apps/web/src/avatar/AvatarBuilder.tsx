import {
  AVATAR_BODY_COLORS,
  AVATAR_COLOR_HEX,
  AVATAR_FEET,
  AVATAR_FUR,
  AVATAR_HANDS,
  AVATAR_HEADS,
  AVATAR_MARKINGS,
  AVATAR_SHIRTS,
  AVATAR_SHIRT_COLORS,
  AVATAR_SPECIES,
  AVATAR_TAILS,
  avatarDraftFrom,
  avatarProfileSummary,
  exportAvatarProfile,
  parseAvatarDraft,
  validateAgentName,
  type AvatarDraft,
  type AvatarLoadResult,
  type AvatarProfile,
} from "@agentintersect-world/avatar-system";
import { useState } from "react";
import { AvatarPreview } from "./AvatarPreview.js";

const label = (value: string) =>
  value.replaceAll("-", " ").replace(/^./, (c) => c.toUpperCase());
export function AvatarBuilder({
  initialProfile,
  currentProfile = null,
  previousProfile = null,
  storageStatus = "unconfigured",
  onSave,
  onDelete,
  title = "Create your World avatar",
}: {
  readonly initialProfile: AvatarDraft;
  readonly currentProfile?: AvatarProfile | null;
  readonly previousProfile?: AvatarProfile | null;
  readonly storageStatus?: AvatarLoadResult["status"];
  readonly onSave: (profile: AvatarDraft) => void;
  readonly onDelete?: () => void;
  readonly title?: string;
}) {
  const [draft, setDraft] = useState<AvatarDraft>(() =>
    avatarDraftFrom(initialProfile),
  );
  const [textOnly, setTextOnly] = useState(
    typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("avatar3d") === "text",
  );
  const [result, setResult] = useState(
    storageStatus === "migrated-unconfigured"
      ? "Legacy appearance migrated. A valid name is required before save."
      : storageStatus === "corrupt-unconfigured"
        ? "Stored profile is invalid and was preserved. Save or delete to replace it."
        : currentProfile
          ? "Saved profile loaded."
          : "Draft is unsaved.",
  );
  const name = validateAgentName(draft.agentName);
  const valid = parseAvatarDraft(draft);
  const update = <K extends keyof AvatarDraft>(
    key: K,
    value: AvatarDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setResult("Draft is unsaved.");
  };
  const chooseSpecies = (species: AvatarDraft["species"]) =>
    setDraft((current) => ({
      ...current,
      species,
      head: AVATAR_HEADS[species][0],
      tail:
        species === "human"
          ? "none"
          : current.tail.startsWith(`${species}-`)
            ? current.tail
            : "none",
    }));
  const choices = <T extends string>(
    groupLabel: string,
    name: string,
    values: readonly T[],
    selected: T,
    set: (value: T) => void,
    colors?: Readonly<Record<string, string>>,
  ) => (
    <fieldset className="avatar-option-group">
      <legend>{groupLabel}</legend>
      <div className="avatar-choice-grid">
        {values.map((value) => {
          const id = `${name}-${value}`;
          return (
            <label
              key={value}
              htmlFor={id}
              style={
                colors
                  ? ({
                      "--choice-color": colors[value],
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={value}
                checked={selected === value}
                onChange={() => set(value)}
              />
              <span>{label(value)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
  const save = () => {
    if (!valid) {
      setResult(
        name.ok
          ? "Save blocked: one or more selections is invalid."
          : `Save blocked: ${name.reason}`,
      );
      return;
    }
    onSave(valid);
    setResult("Avatar saved locally. Current and previous recovery updated.");
  };
  return (
    <section className="avatar-builder" aria-labelledby="avatar-builder-title">
      <div className="avatar-builder__copy">
        <span className="terminal-kicker">aiw_avatar_0_11_</span>
        <h1 id="avatar-builder-title">{title}</h1>
        <p>
          Manual choices stay in this browser. Automatic profile mapping is off;
          prompts, memory, transcripts, paths, secrets, traits, and biometrics
          are never accepted.
        </p>
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
        <fieldset>
          <legend>
            <b>2</b> Species/head
          </legend>
          {choices(
            "Species",
            "avatar-species",
            AVATAR_SPECIES,
            draft.species,
            chooseSpecies,
          )}
          {choices(
            "Head",
            "avatar-head",
            AVATAR_HEADS[draft.species],
            draft.head as never,
            (head) => update("head", head),
          )}
        </fieldset>
        <fieldset>
          <legend>
            <b>3</b> Body parts
          </legend>
          {choices("Hands", "avatar-hands", AVATAR_HANDS, draft.hands, (v) =>
            update("hands", v),
          )}
          {choices("Feet", "avatar-feet", AVATAR_FEET, draft.feet, (v) =>
            update("feet", v),
          )}
          {choices("Fur", "avatar-fur", AVATAR_FUR, draft.fur, (v) =>
            update("fur", v),
          )}
          {choices(
            "Tail",
            "avatar-tail",
            AVATAR_TAILS.filter(
              (v) => v === "none" || v.startsWith(`${draft.species}-`),
            ),
            draft.tail,
            (v) => update("tail", v),
          )}
        </fieldset>
        <fieldset>
          <legend>
            <b>4</b> Color/markings
          </legend>
          {choices(
            "Body color",
            "avatar-color",
            AVATAR_BODY_COLORS,
            draft.bodyColor,
            (v) => update("bodyColor", v),
            AVATAR_COLOR_HEX,
          )}
          {choices(
            "Markings",
            "avatar-markings",
            AVATAR_MARKINGS,
            draft.markings,
            (v) => update("markings", v),
          )}
        </fieldset>
        <fieldset>
          <legend>
            <b>5</b> Tee shirt
          </legend>
          {choices(
            "Tee shirt",
            "avatar-shirt",
            AVATAR_SHIRTS,
            draft.shirt,
            (v) => update("shirt", v),
            AVATAR_SHIRT_COLORS,
          )}
        </fieldset>
        <fieldset>
          <legend>
            <b>6</b> Review and save
          </legend>
          <p data-testid="avatar-semantic-summary">
            <strong>{draft.agentName || "Name required"}</strong> —{" "}
            {avatarProfileSummary(draft)}
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
              disabled={!valid}
            >
              Save avatar{currentProfile ? " changes" : " and enter World"}
            </button>
            {currentProfile && (
              <button
                type="button"
                onClick={() => {
                  const value = exportAvatarProfile(currentProfile);
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
      <AvatarPreview profile={draft} textOnly={textOnly} />
    </section>
  );
}

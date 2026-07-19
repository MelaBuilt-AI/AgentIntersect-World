import {
  AVATAR_ACCENTS,
  AVATAR_BODIES,
  parseAvatarProfile,
  type AvatarProfile,
} from "@agentintersect-world/avatar-system";
import { useState } from "react";

import { AvatarPreview } from "./AvatarPreview.js";

const layerOptions = [
  ["showHalo", "Halo rings"],
  ["showHelmet", "Hair / helmet"],
  ["showFace", "Face layer"],
  ["showEyes", "Eyes layer"],
  ["showGlow", "Foreground glow"],
] as const;

export function AvatarBuilder({
  initialProfile,
  onSave,
  title = "Choose your World appearance",
}: {
  readonly initialProfile: AvatarProfile;
  readonly onSave: (profile: AvatarProfile) => void;
  readonly title?: string;
}) {
  const [draft, setDraft] = useState(initialProfile);
  const update = <K extends keyof AvatarProfile>(
    key: K,
    value: AvatarProfile[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const save = () => {
    const valid = parseAvatarProfile(draft);
    if (valid !== null) onSave(valid);
  };
  return (
    <section className="avatar-builder" aria-labelledby="avatar-builder-title">
      <div className="avatar-builder__copy">
        <span className="terminal-kicker">appearance_profile_</span>
        <h1 id="avatar-builder-title">{title}</h1>
        <p>
          Compose the inherited 2D layers locally. This only stores appearance
          choices; it does not infer memory, personality, identity, or
          biometrics.
        </p>
        <fieldset>
          <legend>Base frame</legend>
          <div className="segmented-control">
            {AVATAR_BODIES.map((body) => (
              <label key={body}>
                <input
                  type="radio"
                  name="avatar-body"
                  value={body}
                  checked={draft.body === body}
                  onChange={() => update("body", body)}
                />
                <span>{body}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Terminal accent</legend>
          <div className="segmented-control">
            {AVATAR_ACCENTS.map((accent) => (
              <label key={accent}>
                <input
                  type="radio"
                  name="avatar-accent"
                  value={accent}
                  checked={draft.accent === accent}
                  onChange={() => update("accent", accent)}
                />
                <span>{accent}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Visible inherited layers</legend>
          <div className="layer-options">
            {layerOptions.map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(event) => update(key, event.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button className="primary-action" type="button" onClick={save}>
          Save appearance and enter World
        </button>
      </div>
      <AvatarPreview profile={draft} />
    </section>
  );
}

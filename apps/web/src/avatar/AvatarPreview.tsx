import {
  avatarFallbackSheet,
  avatarLayersFor,
  type AvatarProfile,
} from "@agentintersect-world/avatar-system";

export function AvatarPreview({
  profile,
  compact = false,
}: {
  readonly profile: AvatarProfile;
  readonly compact?: boolean;
}) {
  const layers = avatarLayersFor(profile);
  return (
    <figure
      className={`avatar-preview avatar-preview--${profile.accent}${compact ? " avatar-preview--compact" : ""}`}
      aria-label={`${profile.body} 2D avatar appearance preview`}
      data-testid="avatar-preview"
    >
      <img
        className="avatar-preview__fallback"
        src={avatarFallbackSheet(profile)}
        alt=""
        aria-hidden="true"
      />
      {layers.map((layer) => (
        <img
          key={layer.id}
          className={`avatar-preview__layer avatar-preview__layer--${layer.id}`}
          src={layer.src}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      ))}
      <figcaption className="sr-only">
        Live inherited 2D avatar compositor preview. No personal traits are
        inferred.
      </figcaption>
    </figure>
  );
}

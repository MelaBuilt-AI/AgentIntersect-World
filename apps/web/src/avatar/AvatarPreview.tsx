import {
  AVATAR_CONTACT_SHEET,
  avatarProfileSummary,
  type AvatarDraft,
  type AvatarAction,
} from "@agentintersect-world/avatar-system";
import { lazy, Suspense } from "react";
const AvatarScene = lazy(async () => {
  const module = await import("./AvatarScene.js");
  return { default: module.AvatarScene };
});

export function AvatarPreview({
  profile,
  compact = false,
  textOnly = false,
  action = "Idle",
  animate = true,
}: {
  readonly profile: AvatarDraft;
  readonly compact?: boolean;
  readonly textOnly?: boolean;
  readonly action?: AvatarAction;
  readonly animate?: boolean;
}) {
  const forcedFallback =
    typeof window !== "undefined" &&
    (["off", "text"].includes(
      new URLSearchParams(window.location.search).get("avatar3d") ?? "",
    ) ||
      !window.WebGLRenderingContext);
  return (
    <figure
      className={`avatar-preview avatar-preview--3d${compact ? " avatar-preview--compact" : ""}`}
      aria-label={`${profile.agentName || "Unnamed agent"} ${profile.species} avatar preview`}
      data-testid="avatar-preview"
    >
      <div className="avatar-nameplate" data-anchor="ATTACH_NAMEPLATE">
        {profile.agentName || "Name required"}
      </div>
      {textOnly || forcedFallback ? (
        <div className="avatar-static-fallback">
          <img
            src={AVATAR_CONTACT_SHEET}
            alt="Rendered contact sheet fallback for the modular avatar kit"
          />
          <strong>
            {forcedFallback ? "WebGL unavailable" : "Text-only mode"}
          </strong>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="avatar-static-fallback" role="status">
              Loading optional 3D preview…
            </div>
          }
        >
          <AvatarScene profile={profile} action={action} animate={animate} />
        </Suspense>
      )}
      <figcaption>
        <span className="sr-only">
          Agent name: {profile.agentName || "not configured"}.{" "}
        </span>
        {avatarProfileSummary(profile)}. Animation: {action}
        {animate ? "" : " (static pose)"}.
      </figcaption>
    </figure>
  );
}

import {
  AVATAR_CONTACT_SHEET,
  type AvatarDraft,
  type AvatarAction,
} from "@agentintersect-world/avatar-system";
import {
  importedAvatarAsset,
  importedAvatarProfileSummary,
} from "@agentintersect-world/avatar-system/imported-avatar";
import type { ImportedAvatarPart } from "@agentintersect-world/renderer-r3f/imported-avatar";
import { Component, lazy, Suspense, type ReactNode } from "react";
import { compactAvatarPreviewUses3d } from "./avatar-preview-policy.js";

const EMPTY_IMPORTED_AVATAR_PARTS: readonly ImportedAvatarPart[] = [];
const EMPTY_HIDDEN_IMPORTED_PART_IDS: readonly string[] = [];

const AvatarScene = lazy(async () => {
  const module = await import("./AvatarScene.js");
  return { default: module.AvatarScene };
});

class AvatarPreviewErrorBoundary extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // The creator keeps the validated selection and offers a truthful retry
    // path through source/model selection without mutating the custom draft.
  }
  render() {
    return this.state.failed ? (
      <div className="avatar-static-fallback" role="alert">
        <strong>Imported model failed to load.</strong>
        <span>
          The selected model was not replaced. Choose another stance card to
          retry with that model.
        </span>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function AvatarPreview({
  profile,
  compact = false,
  textOnly = false,
  action = "Idle",
  animate = true,
  previewClipIndex = 0,
  load3d = true,
  showFallbackImage = true,
  importedParts = EMPTY_IMPORTED_AVATAR_PARTS,
  hiddenPartIds = EMPTY_HIDDEN_IMPORTED_PART_IDS,
}: {
  readonly profile: AvatarDraft;
  readonly compact?: boolean;
  readonly textOnly?: boolean;
  readonly action?: AvatarAction;
  readonly animate?: boolean;
  readonly previewClipIndex?: number;
  readonly load3d?: boolean;
  readonly showFallbackImage?: boolean;
  readonly importedParts?: readonly ImportedAvatarPart[];
  readonly hiddenPartIds?: readonly string[];
}) {
  const imported =
    profile.avatarSource?.kind === "imported"
      ? importedAvatarAsset(
          profile.avatarSource.mode === "original"
            ? profile.avatarSource.modelId
            : profile.avatarSource.baseModelId,
        )
      : undefined;
  const importedClip = imported?.clips[previewClipIndex];
  const optional3dReady = compactAvatarPreviewUses3d(compact);
  const forcedFallback =
    typeof window !== "undefined" &&
    (["off", "text"].includes(
      new URLSearchParams(window.location.search).get("avatar3d") ?? "",
    ) ||
      !window.WebGLRenderingContext);
  return (
    <figure
      className={`avatar-preview avatar-preview--3d${compact ? " avatar-preview--compact" : ""}`}
      aria-label={`${profile.agentName || "Unnamed agent"} ${
        imported?.label ?? profile.species
      } avatar preview`}
      data-testid="avatar-preview"
      data-avatar-source={imported ? "imported" : "custom"}
      data-avatar-imported-id={imported?.id}
      data-avatar-preview-state={
        !load3d
          ? "closed"
          : textOnly
            ? "text-only"
            : forcedFallback
              ? "no-webgl"
              : !optional3dReady
                ? "static-compact"
                : "loading-or-ready"
      }
    >
      <div className="avatar-nameplate" data-anchor="ATTACH_NAMEPLATE">
        {profile.agentName || "Name required"}
      </div>
      {!load3d || textOnly || forcedFallback || !optional3dReady ? (
        <div className="avatar-static-fallback">
          {showFallbackImage ? (
            <img
              src={imported?.thumbnailUrl ?? AVATAR_CONTACT_SHEET}
              alt={
                imported
                  ? `${imported.label} supplied reference thumbnail`
                  : "Rendered contact sheet fallback for the modular avatar kit"
              }
            />
          ) : null}
          <strong>
            {forcedFallback
              ? "WebGL unavailable"
              : !load3d
                ? "No complete avatar preview selected"
                : textOnly
                  ? "Text-only mode"
                  : "Compact static preview"}
          </strong>
        </div>
      ) : (
        <Suspense
          key={`${imported?.id ?? "custom"}:${importedClip ?? action}`}
          fallback={
            <div className="avatar-static-fallback" role="status">
              {imported
                ? `Loading ${imported.label} GLB…`
                : "Loading optional 3D preview…"}
            </div>
          }
        >
          <AvatarPreviewErrorBoundary
            key={`${imported?.id ?? "custom"}:${importedClip ?? action}`}
          >
            <AvatarScene
              profile={profile}
              action={action}
              animate={animate}
              previewClipIndex={previewClipIndex}
              importedParts={importedParts}
              hiddenPartIds={hiddenPartIds}
            />
          </AvatarPreviewErrorBoundary>
        </Suspense>
      )}
      <figcaption>
        <span className="sr-only">
          Agent name: {profile.agentName || "not configured"}.{" "}
        </span>
        {importedAvatarProfileSummary(profile)}.{" "}
        {imported && profile.avatarSource?.kind === "imported"
          ? load3d
            ? `Imported clip ${previewClipIndex + 1}: ${
                importedClip ?? "missing"
              }`
            : "No complete model is selected for 3D preview"
          : `Animation: ${action}`}
        {animate ? "" : " (static pose)"}.
      </figcaption>
    </figure>
  );
}

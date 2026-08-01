import type {
  AvatarAction,
  AvatarDraft,
} from "@agentintersect-world/avatar-system";
import { importedAvatarAsset } from "@agentintersect-world/avatar-system/imported-avatar";
import { AvatarKitCanvas } from "@agentintersect-world/renderer-r3f/avatar-kit";
import {
  ImportedAvatarCanvas,
  type ImportedAvatarPart,
} from "@agentintersect-world/renderer-r3f/imported-avatar";
export function AvatarScene({
  profile,
  action,
  animate,
  previewClipIndex = 0,
  importedParts = [],
  hiddenPartIds = [],
}: {
  readonly profile: AvatarDraft;
  readonly action: AvatarAction;
  readonly animate: boolean;
  readonly previewClipIndex?: number;
  readonly importedParts?: readonly ImportedAvatarPart[];
  readonly hiddenPartIds?: readonly string[];
}) {
  if (profile.avatarSource?.kind === "imported") {
    if (profile.avatarSource.mode !== "original")
      throw new Error(
        "Modular layered 3D preview is unavailable until donor-region rendering is verified.",
      );
    const asset = importedAvatarAsset(profile.avatarSource.modelId);
    if (!asset) throw new Error("Unsupported imported avatar asset.");
    const clipIndex =
      Number.isInteger(previewClipIndex) &&
      previewClipIndex >= 0 &&
      previewClipIndex < asset.clips.length
        ? previewClipIndex
        : 0;
    return (
      <ImportedAvatarCanvas
        selection={{
          assetId: asset.id,
          assetUrl: asset.assetUrl,
          clipIndex,
          clipName: asset.clips[clipIndex] ?? "missing",
          parts: importedParts,
          hiddenPartIds,
        }}
        animate={animate}
        position={asset.preview.position}
        rotation={asset.preview.rotation}
        scale={asset.preview.scale}
      />
    );
  }
  return (
    <AvatarKitCanvas
      asset="/assets/avatar/aiw-avatar-kit.glb"
      selection={profile}
      action={action}
      animate={animate}
    />
  );
}

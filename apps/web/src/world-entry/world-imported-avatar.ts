import type {
  AvatarAction,
  AvatarDraft,
} from "@agentintersect-world/avatar-system";
import {
  importedAvatarAssetsForRole,
  resolveImportedAvatarWorldClip,
  type AvatarBuilderRole,
} from "@agentintersect-world/avatar-system/imported-avatar";
import type {
  ImportedAvatarPart,
  ImportedAvatarWorldSelection,
} from "@agentintersect-world/renderer-r3f/imported-avatar";

export function worldImportedAvatarSelection(
  avatar: AvatarDraft,
  action: AvatarAction | string,
  role: AvatarBuilderRole,
  parts?: readonly ImportedAvatarPart[],
): ImportedAvatarWorldSelection | undefined {
  const source = avatar.avatarSource;
  if (source?.kind !== "imported" || source.mode !== "original")
    return undefined;
  const asset = importedAvatarAssetsForRole(role).find(
    (candidate) => candidate.id === source.modelId,
  );
  if (!asset) return undefined;
  let resolvedClip: ImportedAvatarWorldSelection["resolvedClip"];
  try {
    const resolved = resolveImportedAvatarWorldClip(asset.id, action);
    resolvedClip = {
      clipIndex: resolved.clipIndex,
      clipName: resolved.clipName,
      locomotion: resolved.locomotion,
      semantic: resolved.semantic,
      oneShot: resolved.oneShot,
      durationSeconds: resolved.durationSeconds,
      verification: resolved.verification,
      error: "",
    };
  } catch {
    resolvedClip = {
      clipIndex: -1,
      clipName: "unverified-static-pose",
      locomotion: "Idle",
      semantic: "Idle",
      oneShot: false,
      durationSeconds: 0,
      verification: "evidence-refused",
      error: "missing-or-invalid-model-local-semantic-mapping",
    };
  }
  return {
    assetId: asset.id,
    assetUrl: asset.assetUrl,
    resolvedClip,
    rotation: asset.world.rotation,
    scale: asset.world.scale,
    groundOffset: asset.world.groundOffset,
    ...(parts?.length ? { parts } : {}),
  };
}

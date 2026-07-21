import type {
  AvatarAction,
  AvatarDraft,
} from "@agentintersect-world/avatar-system";
import { AvatarKitCanvas } from "@agentintersect-world/renderer-r3f";
export function AvatarScene({
  profile,
  action,
  animate,
}: {
  readonly profile: AvatarDraft;
  readonly action: AvatarAction;
  readonly animate: boolean;
}) {
  return (
    <AvatarKitCanvas
      asset="/assets/avatar/aiw-avatar-kit.glb"
      selection={profile}
      action={action}
      animate={animate}
    />
  );
}

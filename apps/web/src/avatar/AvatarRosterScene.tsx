import type {
  AvatarAction,
  AvatarDraft,
} from "@agentintersect-world/avatar-system";
import { AvatarKitRosterCanvas } from "@agentintersect-world/renderer-r3f";
export function AvatarRosterScene({
  avatars,
}: {
  readonly avatars: readonly {
    readonly selection: AvatarDraft;
    readonly action: AvatarAction;
    readonly animate: boolean;
  }[];
}) {
  return (
    <AvatarKitRosterCanvas
      asset="/assets/avatar/aiw-avatar-kit.glb"
      avatars={avatars}
    />
  );
}

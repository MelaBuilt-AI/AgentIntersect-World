import type { AvatarDraft } from "@agentintersect-world/avatar-system";
import type { ComponentType } from "react";

import {
  AvatarBuilderLoader,
  type AvatarBuilderProps,
} from "../avatar/AvatarBuilderLoader.js";
import type { AvatarProposal } from "../sessions/session-client.js";
import {
  avatarDraftFromProposal,
  avatarProposalFromDraft,
} from "./world-entry-avatar.js";

export function WorldEntryAgentAvatar({
  proposal,
  mode = "create",
  busy,
  error,
  onAccept,
  AvatarBuilderComponent,
}: {
  readonly proposal: AvatarProposal;
  readonly mode?: "create" | "migrate" | "change";
  readonly busy: boolean;
  readonly error: string;
  readonly onAccept: (proposal: AvatarProposal, draft: AvatarDraft) => void;
  readonly AvatarBuilderComponent?: ComponentType<AvatarBuilderProps>;
}) {
  const initialDraft = avatarDraftFromProposal(proposal);
  const migrating = mode === "migrate";
  const changing = mode === "change";
  return (
    <section
      className="world-agent-avatar world-agent-avatar--builder"
      aria-busy={busy}
    >
      <AvatarBuilderLoader
        {...(AvatarBuilderComponent
          ? { component: AvatarBuilderComponent }
          : {})}
        key={proposal.proposalId}
        role="agent"
        initialProfile={initialDraft}
        preserveInitialLegacy={migrating || changing}
        title={
          migrating || changing
            ? `Change ${proposal.displayName}’s avatar`
            : `Create ${proposal.displayName}’s avatar`
        }
        intro={
          migrating
            ? "The accepted legacy avatar remains unchanged until explicit save. The first role-valid replacement GLB is visually preloaded only; choose one of the 17 originals, then save the migration to this exact connected session."
            : changing
              ? "Choose a role-valid imported avatar, then explicitly save it to this exact connected session."
              : "Choose a role-valid imported avatar, then deliberately accept and save it to this exact connected session."
        }
        saveLabel={busy ? "Saving avatar…" : "Accept and save avatar"}
        saveDisabled={busy}
        successMessage="Avatar submitted for exact-session acceptance."
        onSave={(draft) =>
          onAccept(avatarProposalFromDraft(proposal, draft), draft)
        }
      />
      {error ? (
        <p className="world-entry-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

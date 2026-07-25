import type { AvatarDraft } from "@agentintersect-world/avatar-system";

import { AvatarBuilder } from "../avatar/AvatarBuilder.js";
import type { AvatarProposal } from "../sessions/session-client.js";
import {
  avatarDraftFromProposal,
  avatarProposalFromDraft,
} from "./world-entry-avatar.js";

export function WorldEntryAgentAvatar({
  proposal,
  busy,
  error,
  onAccept,
}: {
  readonly proposal: AvatarProposal;
  readonly busy: boolean;
  readonly error: string;
  readonly onAccept: (proposal: AvatarProposal, draft: AvatarDraft) => void;
}) {
  const initialDraft = avatarDraftFromProposal(proposal);
  return (
    <section
      className="world-agent-avatar world-agent-avatar--builder"
      aria-busy={busy}
    >
      <AvatarBuilder
        key={proposal.proposalId}
        initialProfile={initialDraft}
        title="Create Mr Fluff’s avatar"
        intro="Edit this exact connected agent’s modular appearance, then deliberately accept and save it to the current session."
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

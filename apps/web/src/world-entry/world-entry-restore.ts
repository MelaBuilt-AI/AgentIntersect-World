import type { HermesConnectionResult } from "./world-entry-client.js";

export type WorldEntryRestoreDisposition =
  "clear" | "world" | "avatar-create" | "avatar-migrate";

export function resolveWorldEntryRestore(
  result: HermesConnectionResult,
): WorldEntryRestoreDisposition {
  if (
    (result.status !== "connected" && result.status !== "recovered") ||
    !result.proposal ||
    result.proposal.sessionId !== result.session.sessionId ||
    result.history.sessionId !== result.session.sessionId ||
    result.history.continuity !== result.continuity ||
    result.history.transcriptAuthority !== "hermes"
  )
    return "clear";
  if (!result.avatarAccepted)
    return result.history.avatarConsent === null ? "avatar-create" : "clear";
  if (
    result.history.avatarConsent?.state !== "accepted" ||
    result.history.avatarConsent.current?.sessionId !==
      result.session.sessionId ||
    result.history.avatarConsent.current.proposalId !==
      result.proposal.proposalId
  )
    return "clear";
  return result.avatarSetup === "complete" ? "world" : "avatar-migrate";
}

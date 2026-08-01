import {
  AVATAR_BODY_COLORS,
  AVATAR_HEADS,
  AVATAR_MARKINGS,
  AVATAR_SHIRTS,
  AVATAR_TAILS,
  parseAvatarDraft,
  type AvatarBodyColor,
  type AvatarDraft,
  type AvatarHead,
  type AvatarMarkings,
} from "@agentintersect-world/avatar-system";
import { parseImportedAvatarDraftForRole } from "@agentintersect-world/avatar-system/imported-avatar";

import type { AvatarProposal } from "../sessions/session-client.js";

function includes<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return values.includes(value as T);
}

const legacyMarkingToDraft: Readonly<
  Record<AvatarProposal["markings"], AvatarMarkings>
> = {
  solid: "solid",
  tuxedo: "socks",
  points: "mask",
  patches: "muzzle",
};

const draftMarkingToLegacy: Readonly<
  Record<AvatarMarkings, AvatarProposal["markings"]>
> = {
  solid: "solid",
  socks: "tuxedo",
  mask: "points",
  muzzle: "patches",
};

const legacyColorToDraft: Readonly<Record<string, AvatarBodyColor>> = {
  charcoal: "fur-charcoal",
  cream: "fur-cream",
  blue: "fantasy-blue",
};

const draftColorToLegacy: Readonly<Partial<Record<AvatarBodyColor, string>>> = {
  "fur-charcoal": "charcoal",
  "fur-cream": "cream",
  "fantasy-blue": "blue",
};

export function avatarDraftFromProposal(proposal: AvatarProposal): AvatarDraft {
  const species = proposal.species;
  const proposedHead = String(proposal.head);
  const head = (AVATAR_HEADS[species] as readonly AvatarHead[]).includes(
    proposedHead as AvatarHead,
  )
    ? (proposedHead as AvatarHead)
    : species === "cat"
      ? "shorthair"
      : species === "dog"
        ? "labrador"
        : proposedHead === "angular"
          ? "angular"
          : "round";
  const proposedTail = String(proposal.tail);
  const tail =
    includes(AVATAR_TAILS, proposedTail) &&
    (proposedTail === "none" || proposedTail.startsWith(`${species}-`))
      ? proposedTail
      : proposal.tail === "cat" && species === "cat"
        ? "cat-straight"
        : proposal.tail === "dog" && species === "dog"
          ? "dog-straight"
          : "none";
  const proposedMarking = String(proposal.markings);
  const markings = includes(AVATAR_MARKINGS, proposedMarking)
    ? proposedMarking
    : legacyMarkingToDraft[proposal.markings];
  const proposedColor = String(proposal.bodyColor);
  const bodyColor = includes(AVATAR_BODY_COLORS, proposedColor)
    ? proposedColor
    : (legacyColorToDraft[proposedColor] ?? "fur-charcoal");
  const proposedShirt = String(proposal.shirt);
  const shirt = includes(AVATAR_SHIRTS, proposedShirt)
    ? proposedShirt
    : "Hermes";
  const draft: AvatarDraft = {
    agentName: proposal.displayName,
    species,
    head,
    hands: proposal.hands === "claws" ? "clawed-paws" : proposal.hands,
    feet: proposal.feet === "claws" ? "clawed-paws" : proposal.feet,
    fur: proposal.fur,
    tail,
    markings,
    bodyColor,
    shirt,
    mappingConsent: false,
    agentRef: null,
    sourceDisclosure: "manual-local-input",
    ...(proposal.avatarSource ? { avatarSource: proposal.avatarSource } : {}),
  };
  const valid = proposal.avatarSource
    ? parseImportedAvatarDraftForRole(draft, "agent")
    : parseAvatarDraft(draft);
  if (!valid)
    throw new TypeError("Avatar proposal could not map to a valid draft.");
  return valid;
}

export function avatarProposalFromDraft(
  proposal: AvatarProposal,
  draft: AvatarDraft,
): AvatarProposal {
  const valid = parseImportedAvatarDraftForRole(draft, "agent");
  if (!valid)
    throw new TypeError("Only a role-valid agent avatar can be accepted.");
  const head: AvatarProposal["head"] =
    valid.species === "cat"
      ? "cat"
      : valid.species === "dog"
        ? "dog"
        : valid.head === "angular"
          ? "angular"
          : "round";
  const tail: AvatarProposal["tail"] =
    valid.tail === "none"
      ? "none"
      : valid.tail.startsWith("cat-")
        ? "cat"
        : "dog";
  const shirt: AvatarProposal["shirt"] =
    valid.shirt === "Hermes" || valid.shirt === "Codex"
      ? valid.shirt
      : valid.shirt === "Claude"
        ? "AgentIntersect"
        : "World";
  return {
    ...proposal,
    displayName: valid.agentName,
    species: valid.species,
    head,
    hands: valid.hands === "clawed-paws" ? "claws" : valid.hands,
    feet: valid.feet === "clawed-paws" ? "claws" : valid.feet,
    fur: valid.fur,
    tail,
    markings: draftMarkingToLegacy[valid.markings],
    bodyColor: draftColorToLegacy[valid.bodyColor] ?? valid.bodyColor,
    shirt,
    ...(valid.avatarSource?.kind === "imported"
      ? { avatarSource: valid.avatarSource }
      : {}),
  };
}

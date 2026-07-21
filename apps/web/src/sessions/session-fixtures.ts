import type { AgentSessionViewState } from "./AgentSessionPanel.js";
import type { WorldAgentSession } from "./session-client.js";

const fixtureSession: WorldAgentSession = {
  schema: "aiw.agent-session/0.12",
  sessionId: "11111111-1111-4111-8111-111111111111",
  adapterId: "hermes",
  adapterSessionRef: "20260721_011618_330489c8",
  profile: "default",
  workspaceId: "ws_fixture",
  repositoryRef: "repo_fixture",
  mode: "explore",
  permissionRevision: 0,
  capabilitySnapshotHash: "a".repeat(64),
  continuity: "current",
  status: "ready",
};

export const PHASE12_SESSION_FIXTURE: AgentSessionViewState = {
  health: "ready",
  profile: "default",
  capabilities: [
    {
      adapterId: "hermes",
      capabilities: {
        attach: true,
        sendText: true,
        streamDeltas: true,
        toolStatus: true,
        approvals: false,
        interrupt: false,
        avatarProposal: true,
      },
      unavailable: {
        approvals:
          "Native approvals stay in Hermes for this exact-session transport.",
        interrupt:
          "No exact World-owned run identity is exposed by this transport.",
      },
    },
  ],
  nativeSessions: [
    {
      id: "20260721_011618_330489c8",
      source: "discord",
      title: "Existing Discord lane",
      messageCount: 8,
    },
  ],
  selectedNativeSession: "20260721_011618_330489c8",
  mode: "explore",
  worldSession: fixtureSession,
  repositoryRef: "repo_fixture",
  workspaceId: "ws_fixture",
  continuityLabel: "Current",
  messages: [
    { role: "user", text: "Find the handoff for this repository." },
    {
      role: "assistant",
      text: "The bounded fixture continuity reply is ready.",
    },
  ],
  toolStatuses: [],
  avatarProposal: {
    schema: "aiw.avatar-proposal/0.12",
    proposalId: "22222222-2222-4222-8222-222222222222",
    sessionId: fixtureSession.sessionId,
    displayName: "Hermes",
    species: "cat",
    head: "cat",
    hands: "paws",
    feet: "paws",
    fur: "short",
    tail: "cat",
    markings: "tuxedo",
    bodyColor: "charcoal",
    shirt: "Hermes",
    movementStyle: "shared-biped-core",
    sourceDisclosure: "Derived locally from allowlisted persona traits.",
    rationale: "A bounded visual proposal awaiting operator consent.",
    createdAt: "2026-07-21T05:00:00.000Z",
  },
  avatarConsent: "pending",
  designs: [
    {
      relativePath: "docs/PHASE_12_SCOPE.md",
      name: "Phase 12",
      validation: "Frozen",
      phaseHeadings: ["Phase 12"],
      acceptanceHeadings: ["Acceptance evidence"],
    },
  ],
  lastResult: "Exact session resumed. Hermes transcript is canonical.",
  busy: false,
};

export const PHASE12_OFFLINE_SESSION_FIXTURE: AgentSessionViewState = {
  ...PHASE12_SESSION_FIXTURE,
  health: "offline",
  worldSession: null,
  continuityLabel: "Unavailable",
  lastResult:
    "Hermes plugin/API is offline; send and consent controls are unavailable.",
};

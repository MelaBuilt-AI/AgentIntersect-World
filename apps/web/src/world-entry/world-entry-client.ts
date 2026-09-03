import type {
  RepositoryIndexOperation,
  WorldSnapshot,
} from "@agentintersect-world/world-schema";

import {
  getRepositoryIndex,
  startRepositoryIndex,
  type RepositoryApiResult,
} from "../repository-index-client.js";
import {
  AgentSessionClient,
  type AddConstellationAgentInput,
  type AvatarProposal,
  type ConstellationMutation,
  type ConstellationState,
  type NativeSession,
  type Phase19AdapterId,
  type SessionCapability,
  type SessionHistory,
  type SetConstellationAvatarInput,
  type WorldAgentEvent,
  type WorldAgentSession,
} from "../sessions/session-client.js";
import {
  importedAvatarAssetsForRole,
  parseImportedAvatarSource,
} from "@agentintersect-world/avatar-system/imported-avatar";
import { getCurrentWorld } from "../world-client.js";
import type { WorkstreamReference } from "./workstream-client.js";

export const WORLD_ENTRY_CLIENT_VERSION = "phase19-task13";

export type HermesDisplayResolution =
  | { readonly status: "matched"; readonly nativeSessionId: string }
  | { readonly status: "not_found"; readonly message: "agent not found_" };

export type HermesConnectionResult =
  | {
      readonly status: "connected" | "recovered";
      readonly continuity: "current" | "previous-recovered";
      readonly session: WorldAgentSession;
      readonly proposal: AvatarProposal | null;
      readonly avatarAccepted: boolean;
      readonly avatarSetup: WorldEntryAvatarSetup;
      readonly history: SessionHistory;
    }
  | {
      readonly status: "not_found";
      readonly message: "agent not found_";
    }
  | {
      readonly status: "unavailable" | "stale";
      readonly message: "agent unavailable_";
    };

export type WorldEntryAvatarSetup =
  "required" | "legacy-migration" | "complete";

export type RepositoryLoadResult =
  | {
      readonly status: "current" | "previous-recovered";
      readonly generationId: string;
      readonly snapshot: WorldSnapshot;
      readonly repository: WorkstreamReference;
    }
  | {
      readonly status: "failed";
      readonly message: "repository unavailable_";
    };

export type WorldEntrySessionPort = {
  capabilities(): Promise<readonly SessionCapability[]>;
  nativeSessions(
    adapterId: Phase19AdapterId,
  ): Promise<readonly NativeSession[]>;
  status(sessionId: string): Promise<WorldAgentSession>;
  attach(input: {
    readonly adapterId: Phase19AdapterId;
    readonly adapterSessionRef: string;
    readonly profile: string;
    readonly workspaceId: string;
    readonly repositoryRef: string;
    readonly mode: "explore" | "collaborate";
    readonly modeConfirmed?: boolean;
    readonly worldInstanceId?: string;
  }): Promise<WorldAgentSession>;
  createWorldSession(input: {
    readonly adapterId: Exclude<Phase19AdapterId, "hermes">;
    readonly worldInstanceId: string;
    readonly displayName: string;
    readonly profile: string;
    readonly workspaceId: string;
    readonly repositoryRef: string;
    readonly mode: "explore" | "collaborate";
    readonly modeConfirmed?: boolean;
  }): Promise<WorldAgentSession>;
  avatarProposal(sessionId: string): Promise<AvatarProposal | null>;
  history(sessionId: string): Promise<SessionHistory>;
  avatarConsent(
    sessionId: string,
    decision: "accepted",
    proposal: unknown,
  ): Promise<{ readonly state: string }>;
  stream(
    session: WorldAgentSession,
    text: string,
    options?: {
      readonly onEvent?: (event: WorldAgentEvent) => Promise<void> | void;
      readonly signal?: AbortSignal;
      readonly userDisplayName?: string;
    },
  ): Promise<{
    readonly finalText: string;
    readonly deltas: readonly string[];
  }>;
  currentConstellation(): Promise<ConstellationState>;
  addConstellationAgent(
    input: AddConstellationAgentInput,
  ): Promise<ConstellationState>;
  reconnectConstellationAgent(
    rosterId: string,
    input: ConstellationMutation,
  ): Promise<ConstellationState>;
  removeConstellationAgent(
    rosterId: string,
    input: ConstellationMutation,
  ): Promise<ConstellationState>;
  setConstellationAvatar(
    rosterId: string,
    input: SetConstellationAvatarInput,
  ): Promise<ConstellationState>;
  endConstellation(input: ConstellationMutation): Promise<ConstellationState>;
};

type RepositoryIndexPort = (
  rootPath: string,
  idempotencyKey: string,
) => Promise<RepositoryApiResult<RepositoryIndexOperation>>;

type RepositoryStatusPort = (
  operationId: string,
) => Promise<RepositoryApiResult<RepositoryIndexOperation>>;

type CurrentWorldPort = () => ReturnType<typeof getCurrentWorld>;

function normalizedDisplayName(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function safeDisplayLabel(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 80 &&
    ![...trimmed].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code === 127;
    })
  );
}

export function prepareWorldUserContext(displayName: string): {
  readonly userDisplayName: string;
} {
  const userDisplayName = displayName.normalize("NFC").trim();
  if (!safeDisplayLabel(userDisplayName)) throw new Error("chat unavailable_");
  return { userDisplayName };
}

export function resolveHermesDisplayName(
  enteredName: string,
  sessions: readonly NativeSession[],
): HermesDisplayResolution {
  if (!safeDisplayLabel(enteredName))
    return { status: "not_found", message: "agent not found_" };
  const normalized = normalizedDisplayName(enteredName);
  const matches = sessions.filter((session) => {
    const identity = session.displayName ?? session.title;
    return (
      safeDisplayLabel(identity) &&
      normalizedDisplayName(identity) === normalized
    );
  });
  return matches.length === 1
    ? { status: "matched", nativeSessionId: matches[0]!.id }
    : { status: "not_found", message: "agent not found_" };
}

function currentCapability(
  capabilities: readonly SessionCapability[],
  adapterId: Phase19AdapterId = "hermes",
): SessionCapability | null {
  return (
    capabilities.find((capability) => capability.adapterId === adapterId) ??
    null
  );
}

function validAttachedSession(
  session: WorldAgentSession,
  adapterId: Phase19AdapterId = "hermes",
): session is WorldAgentSession & {
  readonly continuity: "current" | "previous-recovered";
} {
  return (
    session.adapterId === adapterId &&
    session.status === "ready" &&
    (session.continuity === "current" ||
      session.continuity === "previous-recovered")
  );
}

function resolveAvatarState(
  sessionId: string,
  liveProposal: AvatarProposal | null,
  history: SessionHistory,
): {
  readonly proposal: AvatarProposal | null;
  readonly avatarAccepted: boolean;
  readonly avatarSetup: WorldEntryAvatarSetup;
} {
  const acceptedHistoryProposal =
    history.avatarConsent?.state === "accepted" &&
    history.avatarConsent.current?.sessionId === sessionId
      ? history.avatarConsent.current
      : null;
  const liveProposalMatchesAccepted =
    liveProposal !== null &&
    acceptedHistoryProposal !== null &&
    liveProposal.sessionId === sessionId &&
    liveProposal.proposalId === acceptedHistoryProposal.proposalId;
  const proposal = liveProposalMatchesAccepted
    ? acceptedHistoryProposal
    : (liveProposal ?? acceptedHistoryProposal);
  const avatarAccepted =
    acceptedHistoryProposal !== null &&
    proposal?.sessionId === sessionId &&
    acceptedHistoryProposal.proposalId === proposal.proposalId;
  const parsedAvatarSource = parseImportedAvatarSource(proposal?.avatarSource);
  const importedAgentSource =
    parsedAvatarSource?.kind === "imported" &&
    parsedAvatarSource.mode === "original" &&
    importedAvatarAssetsForRole("agent").some(
      (asset) => asset.id === parsedAvatarSource.modelId,
    );
  return {
    proposal,
    avatarAccepted,
    avatarSetup: !avatarAccepted
      ? "required"
      : importedAgentSource
        ? "complete"
        : "legacy-migration",
  };
}

const repositoryFailed = (): RepositoryLoadResult => ({
  status: "failed",
  message: "repository unavailable_",
});

export function createWorldEntryClient(
  ports: {
    readonly sessionClient?: WorldEntrySessionPort;
    readonly startRepositoryIndex?: RepositoryIndexPort;
    readonly getRepositoryIndex?: RepositoryStatusPort;
    readonly getCurrentWorld?: CurrentWorldPort;
  } = {},
) {
  const sessionClient =
    ports.sessionClient ??
    (new AgentSessionClient() as unknown as WorldEntrySessionPort);
  const startIndex = ports.startRepositoryIndex ?? startRepositoryIndex;
  const readIndex = ports.getRepositoryIndex ?? getRepositoryIndex;
  const readWorld = ports.getCurrentWorld ?? getCurrentWorld;

  return {
    async refreshSession(sessionId: string): Promise<WorldAgentSession> {
      return sessionClient.status(sessionId);
    },

    currentConstellation(): Promise<ConstellationState> {
      return sessionClient.currentConstellation();
    },

    addConstellationAgent(
      input: AddConstellationAgentInput,
    ): Promise<ConstellationState> {
      return sessionClient.addConstellationAgent(input);
    },

    reconnectConstellationAgent(
      rosterId: string,
      input: ConstellationMutation,
    ): Promise<ConstellationState> {
      return sessionClient.reconnectConstellationAgent(rosterId, input);
    },

    removeConstellationAgent(
      rosterId: string,
      input: ConstellationMutation,
    ): Promise<ConstellationState> {
      return sessionClient.removeConstellationAgent(rosterId, input);
    },

    setConstellationAvatar(
      rosterId: string,
      input: SetConstellationAvatarInput,
    ): Promise<ConstellationState> {
      return sessionClient.setConstellationAvatar(rosterId, input);
    },

    endConstellation(
      input: ConstellationMutation,
    ): Promise<ConstellationState> {
      return sessionClient.endConstellation(input);
    },

    async restoreHermes(sessionId: string): Promise<HermesConnectionResult> {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
          sessionId,
        )
      )
        return { status: "stale", message: "agent unavailable_" };
      try {
        const persisted = await sessionClient.status(sessionId);
        if (!validAttachedSession(persisted))
          return { status: "stale", message: "agent unavailable_" };
        const rootSessionRef =
          typeof persisted.adapterRootSessionRef === "string"
            ? persisted.adapterRootSessionRef
            : persisted.adapterSessionRef;
        const nativeSessions = await sessionClient.nativeSessions("hermes");
        if (
          !nativeSessions.some(
            (nativeSession) => nativeSession.id === rootSessionRef,
          )
        )
          return { status: "stale", message: "agent unavailable_" };
        if (persisted.mode !== "explore" && persisted.mode !== "collaborate")
          return { status: "stale", message: "agent unavailable_" };
        const session = await sessionClient.attach({
          adapterId: "hermes",
          adapterSessionRef: rootSessionRef,
          profile: persisted.profile,
          workspaceId: persisted.workspaceId,
          repositoryRef: persisted.repositoryRef,
          mode: persisted.mode,
          ...(persisted.mode === "collaborate" ? { modeConfirmed: true } : {}),
        });
        const refreshedRootSessionRef =
          typeof session.adapterRootSessionRef === "string"
            ? session.adapterRootSessionRef
            : session.adapterSessionRef;
        if (
          !validAttachedSession(session) ||
          session.sessionId !== sessionId ||
          refreshedRootSessionRef !== rootSessionRef
        )
          return { status: "stale", message: "agent unavailable_" };
        const [proposal, history] = await Promise.all([
          sessionClient.avatarProposal(session.sessionId).catch(() => null),
          sessionClient.history(session.sessionId),
        ]);
        const avatar = resolveAvatarState(session.sessionId, proposal, history);
        return {
          status:
            session.continuity === "previous-recovered"
              ? "recovered"
              : "connected",
          continuity: session.continuity,
          session,
          ...avatar,
          history,
        };
      } catch {
        return { status: "unavailable", message: "agent unavailable_" };
      }
    },

    async restoreConstellationAgent(
      sessionId: string,
      adapterId: Exclude<Phase19AdapterId, "hermes">,
    ): Promise<HermesConnectionResult> {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
          sessionId,
        )
      )
        return { status: "stale", message: "agent unavailable_" };
      try {
        const session = await sessionClient.status(sessionId);
        if (
          !validAttachedSession(session, adapterId) ||
          session.sessionId !== sessionId
        )
          return { status: "stale", message: "agent unavailable_" };
        const [proposal, history] = await Promise.all([
          sessionClient.avatarProposal(sessionId).catch(() => null),
          sessionClient.history(sessionId),
        ]);
        const avatar = resolveAvatarState(sessionId, proposal, history);
        return {
          status:
            session.continuity === "previous-recovered"
              ? "recovered"
              : "connected",
          continuity: session.continuity,
          session,
          ...avatar,
          history,
        };
      } catch {
        return { status: "unavailable", message: "agent unavailable_" };
      }
    },

    async connectWorldOwnedAgent(
      adapterId: Exclude<Phase19AdapterId, "hermes">,
      worldInstanceId: string,
      name: string,
    ): Promise<HermesConnectionResult> {
      const displayName = name.normalize("NFC").trim();
      if (!safeDisplayLabel(displayName) || !worldInstanceId)
        return { status: "unavailable", message: "agent unavailable_" };
      try {
        const session = await sessionClient.createWorldSession({
          adapterId,
          worldInstanceId,
          displayName,
          profile: "default",
          workspaceId: "world-entry",
          repositoryRef: "current",
          mode: "explore",
        });
        if (!validAttachedSession(session, adapterId))
          return { status: "stale", message: "agent unavailable_" };
        const history = await sessionClient
          .history(session.sessionId)
          .catch((): SessionHistory => ({
            sessionId: session.sessionId,
            continuity: session.continuity,
            messages: [],
            transcriptAuthority: adapterId,
            avatarConsent: null,
          }));
        const proposal: AvatarProposal = {
          schema: "aiw.avatar-proposal/0.12",
          proposalId: crypto.randomUUID(),
          sessionId: session.sessionId,
          displayName,
          species: "human",
          head: "round",
          hands: "hands",
          feet: "feet",
          fur: "none",
          tail: "none",
          markings: "solid",
          bodyColor: "warm-light",
          shirt: adapterId === "codex" ? "Codex" : "World",
          movementStyle: "shared-biped-core",
          sourceDisclosure: "manual-local-input",
          rationale: "User-selected World-owned agent avatar setup.",
          createdAt: new Date().toISOString(),
        };
        return {
          status:
            session.continuity === "previous-recovered"
              ? "recovered"
              : "connected",
          continuity:
            session.continuity === "previous-recovered"
              ? "previous-recovered"
              : "current",
          session,
          proposal,
          avatarAccepted: false,
          avatarSetup: "required",
          history,
        };
      } catch {
        return { status: "unavailable", message: "agent unavailable_" };
      }
    },

    async connectHermes(name: string): Promise<HermesConnectionResult> {
      try {
        const capabilities = await sessionClient.capabilities();
        const hermes = currentCapability(capabilities);
        if (!hermes?.capabilities.attach || !hermes.capabilities.sendText)
          return { status: "unavailable", message: "agent unavailable_" };
        const resolution = resolveHermesDisplayName(
          name,
          await sessionClient.nativeSessions("hermes"),
        );
        if (resolution.status === "not_found") return resolution;
        const session = await sessionClient.attach({
          adapterId: "hermes",
          adapterSessionRef: resolution.nativeSessionId,
          profile: "default",
          workspaceId: "world-entry",
          repositoryRef: "current",
          mode: "explore",
        });
        if (!validAttachedSession(session))
          return { status: "stale", message: "agent unavailable_" };
        const [proposal, history] = await Promise.all([
          sessionClient.avatarProposal(session.sessionId).catch(() => null),
          sessionClient
            .history(session.sessionId)
            .catch((): SessionHistory => ({
              sessionId: session.sessionId,
              continuity: session.continuity,
              messages: [],
              transcriptAuthority: "hermes",
              avatarConsent: null,
            })),
        ]);
        const avatar = resolveAvatarState(session.sessionId, proposal, history);
        if (avatar.proposal === null)
          return { status: "unavailable", message: "agent unavailable_" };
        return {
          status:
            session.continuity === "previous-recovered"
              ? "recovered"
              : "connected",
          continuity: session.continuity,
          session,
          ...avatar,
          history,
        };
      } catch {
        return { status: "unavailable", message: "agent unavailable_" };
      }
    },

    async acceptAgentAvatar(
      session: WorldAgentSession,
      proposal: AvatarProposal,
    ): Promise<boolean> {
      if (proposal.sessionId !== session.sessionId) return false;
      try {
        const result = await sessionClient.avatarConsent(
          session.sessionId,
          "accepted",
          proposal,
        );
        return result.state === "accepted";
      } catch {
        return false;
      }
    },

    async sendExactSession(
      session: WorldAgentSession,
      text: string,
      options: {
        readonly onEvent?: (event: WorldAgentEvent) => Promise<void> | void;
        readonly signal?: AbortSignal;
        readonly userDisplayName?: string;
      } = {},
    ): Promise<{
      readonly finalText: string;
      readonly deltas: readonly string[];
    }> {
      const bounded = text.trim().slice(0, 4_000);
      if (!bounded) throw new Error("chat unavailable_");
      const userContext =
        options.userDisplayName === undefined
          ? {}
          : prepareWorldUserContext(options.userDisplayName);
      return await sessionClient.stream(session, bounded, {
        ...options,
        ...userContext,
      });
    },

    async currentRepository(): Promise<Exclude<
      RepositoryLoadResult,
      { readonly status: "failed" }
    > | null> {
      const current = await readWorld();
      if (current.status !== "ok") return null;
      const snapshot = current.data.snapshot;
      return {
        status: "current",
        generationId: snapshot.generationFingerprint,
        snapshot,
        repository: {
          repositoryId: snapshot.repositoryRef,
          revision: snapshot.generationFingerprint,
        },
      };
    },

    async loadRepository(rootPath: string): Promise<RepositoryLoadResult> {
      const boundedRoot = rootPath.trim();
      if (!boundedRoot || boundedRoot.length > 4_096) return repositoryFailed();
      const idempotencyKey = `phase18-${globalThis.crypto.randomUUID()}`;
      const started = await startIndex(boundedRoot, idempotencyKey);
      if (started.status !== "ok") return repositoryFailed();
      let operation = started.data;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (operation.status === "succeeded") break;
        if (operation.status === "failed" || operation.status === "cancelled")
          return repositoryFailed();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const next = await readIndex(operation.id);
        if (next.status !== "ok") return repositoryFailed();
        operation = next.data;
      }
      if (operation.status !== "succeeded" || !operation.generation)
        return repositoryFailed();
      const current = await readWorld();
      if (current.status !== "ok") return repositoryFailed();
      return {
        status: "current",
        generationId: current.data.snapshot.generationFingerprint,
        snapshot: current.data.snapshot,
        repository: {
          repositoryId: current.data.snapshot.repositoryRef,
          revision: operation.generation.id,
        },
      };
    },
  };
}

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
  type AvatarProposal,
  type NativeSession,
  type SessionCapability,
  type SessionHistory,
  type WorldAgentEvent,
  type WorldAgentSession,
} from "../sessions/session-client.js";
import { getCurrentWorld } from "../world-client.js";

export const WORLD_ENTRY_CLIENT_VERSION = "phase18";

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
    }
  | {
      readonly status: "not_found";
      readonly message: "agent not found_";
    }
  | {
      readonly status: "unavailable" | "stale";
      readonly message: "agent unavailable_";
    };

export type RepositoryLoadResult =
  | {
      readonly status: "current" | "previous-recovered";
      readonly generationId: string;
      readonly snapshot: WorldSnapshot;
    }
  | {
      readonly status: "failed";
      readonly message: "repository unavailable_";
    };

export type WorldEntrySessionPort = {
  capabilities(): Promise<readonly SessionCapability[]>;
  nativeSessions(adapterId: string): Promise<readonly NativeSession[]>;
  status(sessionId: string): Promise<WorldAgentSession>;
  attach(input: {
    readonly adapterId: string;
    readonly adapterSessionRef: string;
    readonly profile: string;
    readonly workspaceId: string;
    readonly repositoryRef: string;
    readonly mode: "explore";
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
  const matches = sessions.filter(
    (session) =>
      safeDisplayLabel(session.title) &&
      normalizedDisplayName(session.title) === normalized,
  );
  return matches.length === 1
    ? { status: "matched", nativeSessionId: matches[0]!.id }
    : { status: "not_found", message: "agent not found_" };
}

function currentCapability(
  capabilities: readonly SessionCapability[],
): SessionCapability | null {
  return (
    capabilities.find((capability) => capability.adapterId === "hermes") ?? null
  );
}

function validAttachedSession(
  session: WorldAgentSession,
): session is WorldAgentSession & {
  readonly continuity: "current" | "previous-recovered";
} {
  return (
    session.adapterId === "hermes" &&
    session.status === "ready" &&
    (session.continuity === "current" ||
      session.continuity === "previous-recovered")
  );
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
    async restoreHermes(sessionId: string): Promise<HermesConnectionResult> {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
          sessionId,
        )
      )
        return { status: "stale", message: "agent unavailable_" };
      try {
        const session = await sessionClient.status(sessionId);
        if (!validAttachedSession(session))
          return { status: "stale", message: "agent unavailable_" };
        const [proposal, history] = await Promise.all([
          sessionClient.avatarProposal(session.sessionId).catch(() => null),
          sessionClient.history(session.sessionId),
        ]);
        return {
          status:
            session.continuity === "previous-recovered"
              ? "recovered"
              : "connected",
          continuity: session.continuity,
          session,
          proposal,
          avatarAccepted:
            proposal?.sessionId === session.sessionId &&
            history.avatarConsent?.state === "accepted",
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
        const avatarAccepted =
          proposal?.sessionId === session.sessionId &&
          history.avatarConsent?.state === "accepted";
        return {
          status:
            session.continuity === "previous-recovered"
              ? "recovered"
              : "connected",
          continuity: session.continuity,
          session,
          proposal,
          avatarAccepted,
        };
      } catch {
        return { status: "unavailable", message: "agent unavailable_" };
      }
    },

    async acceptAgentAvatar(
      session: WorldAgentSession,
      proposal: AvatarProposal,
    ): Promise<boolean> {
      if (
        session.adapterId !== "hermes" ||
        proposal.sessionId !== session.sessionId
      )
        return false;
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
      if (!bounded || session.adapterId !== "hermes")
        throw new Error("chat unavailable_");
      const userContext =
        options.userDisplayName === undefined
          ? {}
          : prepareWorldUserContext(options.userDisplayName);
      return await sessionClient.stream(session, bounded, {
        ...options,
        ...userContext,
      });
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
      if (operation.status !== "succeeded") return repositoryFailed();
      const current = await readWorld();
      if (current.status !== "ok") return repositoryFailed();
      return {
        status: "current",
        generationId: current.data.snapshot.generationFingerprint,
        snapshot: current.data.snapshot,
      };
    },
  };
}

import type {
  AvatarDraft,
  AvatarProfile,
} from "@agentintersect-world/avatar-system";
import type { RepositoryRenderObject } from "@agentintersect-world/renderer-r3f";
import type {
  WorldObject,
  WorldSnapshot,
} from "@agentintersect-world/world-schema";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { useReducedMotion } from "../motion/use-reduced-motion.js";
import type {
  AvatarProposal,
  WorldAgentEvent,
  WorldAgentSession,
} from "../sessions/session-client.js";
import {
  createWorldEntryClient,
  type HermesConnectionResult,
} from "./world-entry-client.js";
import { avatarDraftFromProposal } from "./world-entry-avatar.js";
import { WorldEntryAgentAvatar } from "./WorldEntryAgentAvatar.js";
import { WorldEntryLogo, WorldTypeLine } from "./WorldEntryLogo.js";
import { WorldHud } from "./WorldHud.js";
import { WorldRoom } from "./WorldRoom.js";
import {
  canEnterWorld,
  createReturningWorldEntryState,
  reduceWorldEntry,
} from "./world-entry-machine.js";
import { createWorldChatState, reduceWorldChat } from "./world-chat-model.js";

const SESSION_POINTER_KEY = "aiw.agent-session.pointer.0.12";
const SESSION_POINTER_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type PendingWorldMessage = {
  readonly id: string;
  readonly text: string;
};

function renderObjects(
  snapshot: WorldSnapshot,
): readonly RepositoryRenderObject[] {
  return snapshot.objects
    .filter(
      (
        object,
      ): object is Extract<
        WorldObject,
        { kind: "package" | "directory" | "file" }
      > =>
        object.kind === "package" ||
        object.kind === "directory" ||
        object.kind === "file",
    )
    .map((object) => ({
      ref: object.ref,
      kind: object.kind,
      name: object.name,
      position: object.position,
      bounds: object.bounds,
      ...(object.kind === "file"
        ? {
            fileKind: object.fileKind,
            language: object.language,
            size: object.size,
          }
        : {}),
    }));
}

function connectionLabel(result: HermesConnectionResult): string {
  if (result.status === "recovered") return "Previous / recovered";
  if (result.status === "connected") return "Current";
  if (result.status === "stale") return "Stale / unavailable";
  if (result.status === "unavailable") return "Unavailable";
  return "Retry";
}

function repositoryRequest(text: string): boolean {
  return (
    /\b(load|open|index|map|show)\b/iu.test(text) &&
    /\b(repo|repository|project|codebase)\b/iu.test(text)
  );
}

export type WorldEntryClient = ReturnType<typeof createWorldEntryClient>;

export function WorldEntryExperience({
  profile,
  client: providedClient,
  forceNoWebGL = false,
}: {
  readonly profile: AvatarProfile;
  readonly client?: WorldEntryClient;
  readonly forceNoWebGL?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const client = useMemo(
    () => providedClient ?? createWorldEntryClient(),
    [providedClient],
  );
  const [state, dispatch] = useReducer(
    reduceWorldEntry,
    {
      profileId: profile.profileId,
      name: profile.agentName,
    },
    createReturningWorldEntryState,
  );
  const [agentName, setAgentName] = useState("");
  const [session, setSession] = useState<WorldAgentSession | null>(null);
  const [proposal, setProposal] = useState<AvatarProposal | null>(null);
  const [agentAvatar, setAgentAvatar] = useState<AvatarDraft | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [status, setStatus] = useState("Restored user avatar · Current");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [chat, updateChat] = useReducer(
    reduceWorldChat,
    undefined,
    createWorldChatState,
  );
  const [restorePending, setRestorePending] = useState(true);
  const [chatBusy, setChatBusy] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [objects, setObjects] = useState<readonly RepositoryRenderObject[]>([]);
  const connectAttempt = useRef(0);
  const mounted = useRef(true);
  const processingChat = useRef(false);
  const pendingMessages = useRef<PendingWorldMessage[]>([]);
  const nextMessageId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingMessages.current = [];
    };
  }, []);

  useEffect(() => {
    let active = true;
    const pointer = window.localStorage.getItem(SESSION_POINTER_KEY);
    const finishWithoutRestore = (clearPointer: boolean) => {
      if (!active) return;
      if (clearPointer) window.localStorage.removeItem(SESSION_POINTER_KEY);
      setRestorePending(false);
    };
    if (!pointer) {
      finishWithoutRestore(false);
      return () => {
        active = false;
      };
    }
    if (!SESSION_POINTER_PATTERN.test(pointer)) {
      finishWithoutRestore(true);
      return () => {
        active = false;
      };
    }
    void client
      .restoreHermes(pointer)
      .then((result) => {
        if (!active) return;
        if (
          (result.status !== "connected" && result.status !== "recovered") ||
          !result.avatarAccepted ||
          !result.proposal ||
          result.history.sessionId !== result.session.sessionId ||
          result.history.transcriptAuthority !== "hermes" ||
          result.history.avatarConsent?.state !== "accepted" ||
          result.history.avatarConsent.current?.sessionId !==
            result.session.sessionId ||
          result.history.avatarConsent.current.proposalId !==
            result.proposal.proposalId
        ) {
          finishWithoutRestore(true);
          return;
        }
        setSession(result.session);
        setProposal(result.proposal);
        setAgentAvatar(avatarDraftFromProposal(result.proposal));
        setStatus(
          `agent connected · ${connectionLabel(result)} · avatar accepted`,
        );
        updateChat({
          type: "RESTORE_HISTORY",
          messages: result.history.messages,
        });
        dispatch({
          type: "RESTORE_WORLD",
          sessionId: result.session.sessionId,
          continuity: result.continuity,
          agentName: result.proposal.displayName,
          avatarProfileId: result.proposal.proposalId,
        });
        setRestorePending(false);
      })
      .catch(() => finishWithoutRestore(true));
    return () => {
      active = false;
    };
  }, [client]);

  useEffect(() => {
    if (restorePending) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "PRESENT_IDENTITY" }),
      reducedMotion ? 0 : 560,
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, restorePending]);

  const connect = async () => {
    const entered = agentName.trim();
    if (!entered || state.step !== "agent_prompt") return;
    const attempt = connectAttempt.current + 1;
    connectAttempt.current = attempt;
    setError("");
    setStatus("connecting agent");
    dispatch({ type: "SUBMIT_AGENT_NAME", name: entered });
    const result = await client.connectHermes(entered);
    if (attempt !== connectAttempt.current) return;
    if (result.status === "not_found") {
      setStatus("Retry");
      dispatch({ type: "CONNECTION_NOT_FOUND" });
      return;
    }
    if (result.status === "unavailable" || result.status === "stale") {
      setStatus(connectionLabel(result));
      setError(result.message);
      dispatch({
        type: "CONNECTION_UNAVAILABLE",
        stale: result.status === "stale",
      });
      return;
    }
    if (!("session" in result)) return;
    setSession(result.session);
    setProposal(result.proposal);
    setAgentAvatar(
      result.avatarAccepted && result.proposal
        ? avatarDraftFromProposal(result.proposal)
        : null,
    );
    updateChat({
      type: "RESTORE_HISTORY",
      messages: result.history.messages,
    });
    setStatus(`agent connected · ${connectionLabel(result)}`);
    window.localStorage.setItem(SESSION_POINTER_KEY, result.session.sessionId);
    dispatch({
      type: "CONNECTION_ATTACHED",
      sessionId: result.session.sessionId,
      continuity: result.continuity,
    });
    window.setTimeout(
      () => {
        dispatch({ type: "OPEN_AGENT_AVATAR" });
        if (result.avatarAccepted && result.proposal)
          dispatch({
            type: "ACCEPT_AGENT_AVATAR",
            sessionId: result.session.sessionId,
            avatarProfileId: result.proposal.proposalId,
          });
        else if (!result.proposal) setError("avatar unavailable_");
      },
      reducedMotion ? 0 : 620,
    );
  };

  const acceptAvatar = async (
    acceptedProposal: AvatarProposal,
    acceptedDraft: AvatarDraft,
  ) => {
    if (
      !session ||
      acceptedProposal.sessionId !== session.sessionId ||
      acceptedDraft.agentName !== acceptedProposal.displayName
    )
      return;
    setAvatarBusy(true);
    setError("");
    const accepted = await client.acceptAgentAvatar(session, acceptedProposal);
    setAvatarBusy(false);
    if (!accepted) {
      setError("avatar save unavailable_");
      return;
    }
    setProposal(acceptedProposal);
    setAgentAvatar(acceptedDraft);
    setStatus(
      `agent connected · ${
        session.continuity === "previous-recovered"
          ? "Previous / recovered"
          : "Current"
      } · avatar accepted`,
    );
    dispatch({
      type: "ACCEPT_AGENT_AVATAR",
      sessionId: session.sessionId,
      avatarProfileId: acceptedProposal.proposalId,
    });
  };

  const enterWorld = () => {
    if (!canEnterWorld(state)) return;
    dispatch({ type: "ENTER_WORLD" });
    window.setTimeout(
      () => dispatch({ type: "WORLD_READY" }),
      reducedMotion ? 0 : 520,
    );
  };

  const loadRequestedRepository = async (text: string) => {
    if (!repositoryRequest(text) || !mounted.current) return;
    dispatch({ type: "REQUEST_REPOSITORY", request: text });
    setStatus("Repository loading · blank floor preserved");
    const result = await client.loadRepository(".");
    if (!mounted.current) return;
    if (result.status === "failed") {
      dispatch({
        type: "REPOSITORY_FAILED",
        reason: result.message,
      });
      setStatus("Repository unavailable · blank floor preserved · Retry");
      return;
    }
    const nextObjects = renderObjects(result.snapshot);
    const repositoryCounts = {
      packages: nextObjects.filter((object) => object.kind === "package")
        .length,
      directories: nextObjects.filter((object) => object.kind === "directory")
        .length,
      files: nextObjects.filter((object) => object.kind === "file").length,
    };
    const repositorySummary = `${repositoryCounts.packages} packages · ${repositoryCounts.directories} directories · ${repositoryCounts.files} files`;
    setObjects(nextObjects);
    dispatch({
      type: "ACTIVATE_REPOSITORY",
      generationId: result.generationId,
      projectionTruth: result.status,
    });
    setStatus(
      result.status === "previous-recovered"
        ? `Repository floor · Previous / recovered · ${repositorySummary}`
        : `Repository floor · Current · ${repositorySummary}`,
    );
  };

  const processChatQueue = async () => {
    if (processingChat.current || !session) return;
    processingChat.current = true;
    if (mounted.current) setChatBusy(true);
    try {
      while (mounted.current && pendingMessages.current.length > 0) {
        const current = pendingMessages.current.shift();
        if (!current) break;
        setQueuedCount(pendingMessages.current.length);
        updateChat({ type: "SEND_STARTED", id: current.id });
        try {
          const answer = await client.sendExactSession(session, current.text, {
            userDisplayName: profile.agentName,
            onEvent: (event: WorldAgentEvent) => {
              if (mounted.current) updateChat({ type: "AGENT_EVENT", event });
            },
          });
          if (!mounted.current) return;
          await loadRequestedRepository(current.text);
          if (!mounted.current) return;
          updateChat({ type: "SEND_COMPLETED", text: answer.finalText });
        } catch {
          if (mounted.current)
            updateChat({ type: "SEND_FAILED", message: "chat unavailable_" });
        }
      }
    } finally {
      processingChat.current = false;
      if (mounted.current) {
        setChatBusy(false);
        setQueuedCount(pendingMessages.current.length);
      }
    }
  };

  const send = () => {
    const text = message.trim();
    if (!session || !text) return;
    const pending = {
      id: `${Date.now()}-${nextMessageId.current++}`,
      text,
    };
    setMessage("");
    pendingMessages.current.push(pending);
    setQueuedCount(pendingMessages.current.length);
    updateChat({ type: "QUEUE_MESSAGE", ...pending });
    void processChatQueue();
  };

  const inWorld =
    state.step === "world_entering" ||
    state.step === "world_blank" ||
    state.step === "repository_loading" ||
    state.step === "world_repository";
  if (inWorld) {
    if (!proposal || !agentAvatar)
      return (
        <main className="world-experience world-experience--room">
          <div className="world-entry-overlay" role="alert">
            World entry unavailable · accepted avatar required
          </div>
        </main>
      );
    const activeProposal = proposal;
    const activeAgentAvatar = agentAvatar;
    return (
      <div className="world-experience world-experience--room">
        <WorldRoom
          floor={state.world.floor}
          objects={objects}
          reducedMotion={reducedMotion}
          forceNoWebGL={forceNoWebGL}
          userName={profile.agentName}
          agentName={activeProposal.displayName}
          userAvatar={profile}
          agentAvatar={activeAgentAvatar}
          activity={chat.activity}
        />
        {state.step !== "world_entering" ? (
          <WorldHud
            recipient={activeProposal.displayName}
            status={status}
            busy={chatBusy || state.step === "repository_loading"}
            queuedCount={queuedCount}
            message={message}
            transcript={chat.transcript}
            pushToTalkAvailable={false}
            onMessage={setMessage}
            onSend={() => void send()}
          />
        ) : (
          <div className="world-entry-overlay" role="status" aria-live="polite">
            Entering World
          </div>
        )}
      </div>
    );
  }

  if (restorePending)
    return (
      <main className="world-experience world-experience--entry">
        <div className="world-entry-overlay" role="status" aria-live="polite">
          restoring agent
        </div>
      </main>
    );

  if (state.step === "agent_avatar" && proposal)
    return (
      <main className="world-experience world-experience--avatar">
        <WorldEntryAgentAvatar
          proposal={proposal}
          busy={avatarBusy}
          error={error}
          onAccept={(acceptedProposal, acceptedDraft) =>
            void acceptAvatar(acceptedProposal, acceptedDraft)
          }
        />
      </main>
    );

  const stage =
    state.step === "returning_identity"
      ? "identity"
      : state.step === "session_select"
        ? "session"
        : state.step === "enter_ready"
          ? "ready"
          : state.step === "agent_prompt" ||
              state.step === "agent_resolving" ||
              state.step === "agent_not_found" ||
              state.step === "agent_connected"
            ? "prompt"
            : "constellation";
  return (
    <main className="world-experience world-experience--entry">
      <WorldEntryLogo
        userName={profile.agentName}
        stage={stage}
        reducedMotion={reducedMotion}
        singleSelected={
          state.selectedHarness === "hermes" || state.step !== "session_select"
        }
        onSingle={() => dispatch({ type: "SELECT_SINGLE_AGENT" })}
        onHermes={() => dispatch({ type: "SELECT_HERMES" })}
      />
      {state.step === "agent_prompt" ? (
        <form
          className="world-agent-prompt"
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          <WorldTypeLine text="agent name?" reducedMotion={reducedMotion} />
          <span className="world-agent-prompt__newline" aria-hidden="true">
            ↵
          </span>
          <label className="sr-only" htmlFor="world-agent-name">
            Agent name
          </label>
          <input
            id="world-agent-name"
            aria-label="Agent name"
            value={agentName}
            maxLength={80}
            autoFocus
            onChange={(event) => setAgentName(event.target.value)}
          />
          <button
            type="submit"
            className={
              agentName.trim()
                ? "world-primary-action world-action--enabled"
                : "world-primary-action world-action--unavailable"
            }
            disabled={!agentName.trim()}
          >
            Connect agent
          </button>
          {error ? (
            <p className="world-entry-error" role="status" aria-live="polite">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
      {state.step === "agent_not_found" ? (
        <div className="world-agent-prompt world-agent-prompt--retry">
          <WorldTypeLine text="agent not found" reducedMotion={reducedMotion} />
          <button
            type="button"
            className="world-primary-action world-action--enabled"
            onClick={() => dispatch({ type: "RETRY_CONNECTION" })}
          >
            Retry
          </button>
        </div>
      ) : null}
      {state.step === "agent_resolving" || state.step === "agent_connected" ? (
        <div className="world-entry-overlay" role="status" aria-live="polite">
          {state.step === "agent_resolving"
            ? "connecting agent"
            : `agent connected · ${connectionLabel({
                status:
                  state.connection.continuity === "previous-recovered"
                    ? "recovered"
                    : "connected",
              } as HermesConnectionResult)}`}
        </div>
      ) : null}
      {state.step === "enter_ready" ? (
        <button
          type="button"
          className="world-enter-action world-action--enabled"
          onClick={enterWorld}
        >
          Enter World
        </button>
      ) : null}
    </main>
  );
}

export { WorldEntryAgentAvatar } from "./WorldEntryAgentAvatar.js";
export { WorldEntryLogo } from "./WorldEntryLogo.js";
export { WorldHud } from "./WorldHud.js";
export { WorldRoom } from "./WorldRoom.js";

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
  const [chatBusy, setChatBusy] = useState(false);
  const [objects, setObjects] = useState<readonly RepositoryRenderObject[]>([]);
  const connectAttempt = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(
      () => dispatch({ type: "PRESENT_IDENTITY" }),
      reducedMotion ? 0 : 560,
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

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

  const streamCaption = (event: WorldAgentEvent) =>
    updateChat({ type: "AGENT_EVENT", event });

  const send = async () => {
    if (!session || chatBusy || !message.trim()) return;
    const text = message.trim();
    setMessage("");
    setChatBusy(true);
    updateChat({
      type: "SEND_STARTED",
      id: `${Date.now()}-${chat.transcript.length}`,
      text,
    });
    try {
      const answer = await client.sendExactSession(session, text, {
        userDisplayName: profile.agentName,
        onEvent: streamCaption,
      });
      updateChat({ type: "SEND_COMPLETED", text: answer.finalText });
      if (repositoryRequest(text)) {
        dispatch({ type: "REQUEST_REPOSITORY", request: text });
        setStatus("Repository loading · blank floor preserved");
        const result = await client.loadRepository(".");
        if (result.status === "failed") {
          dispatch({
            type: "REPOSITORY_FAILED",
            reason: result.message,
          });
          setStatus("Repository unavailable · blank floor preserved · Retry");
        } else {
          const nextObjects = renderObjects(result.snapshot);
          const repositoryCounts = {
            packages: nextObjects.filter((object) => object.kind === "package")
              .length,
            directories: nextObjects.filter(
              (object) => object.kind === "directory",
            ).length,
            files: nextObjects.filter((object) => object.kind === "file")
              .length,
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
        }
      }
    } catch {
      updateChat({ type: "SEND_FAILED", message: "chat unavailable_" });
    } finally {
      setChatBusy(false);
    }
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

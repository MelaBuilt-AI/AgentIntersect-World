import type {
  AvatarDraft,
  AvatarProfile,
} from "@agentintersect-world/avatar-system";
import type { RepositoryRenderObject } from "@agentintersect-world/renderer-r3f";
import type {
  WorldObject,
  WorldSnapshot,
} from "@agentintersect-world/world-schema";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { useReducedMotion } from "../motion/use-reduced-motion.js";
import { AvatarBuilderLoader } from "../avatar/AvatarBuilderLoader.js";
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
import { WorldEscapeMenu } from "./WorldEscapeMenu.js";
import { WorldEntryLogo, WorldTypeLine } from "./WorldEntryLogo.js";
import { WorldHud } from "./WorldHud.js";
import {
  canEnterWorld,
  createReturningWorldEntryState,
  reduceWorldEntry,
} from "./world-entry-machine.js";
import {
  classifyWorldMessage,
  createWorldChatState,
  reduceWorldChat,
  type AvatarOneShotSemantic,
} from "./world-chat-model.js";
import type {
  AgentMovementEvent,
  AgentMovementRequest,
} from "./world-agent-movement-model.js";
import {
  postUserDirectedMovement,
  postUserDirectedStop,
} from "./world-agent-direction.js";
import {
  DEFAULT_WORLD_DISPLAY_PREFERENCES,
  loadWorldDisplayPreferences,
  saveWorldDisplayPreferences,
  type WorldDisplayPreferences,
} from "./world-escape-menu-model.js";

const SESSION_POINTER_KEY = "aiw.agent-session.pointer.0.12";
const SESSION_POINTER_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const LazyWorldRoom = lazy(async () => {
  const module = await import("./WorldRoom.js");
  return { default: module.WorldRoom };
});

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
  onUserAvatarSave,
}: {
  readonly profile: AvatarProfile;
  readonly client?: WorldEntryClient;
  readonly forceNoWebGL?: boolean;
  readonly onUserAvatarSave?: (draft: AvatarDraft) => AvatarProfile | void;
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
  const [agentAvatarMode, setAgentAvatarMode] = useState<
    "create" | "migrate" | "change"
  >("create");
  const [avatarTarget, setAvatarTarget] = useState<"user" | "agent" | null>(
    null,
  );
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
  const [userAnimationCue, setUserAnimationCue] = useState<{
    readonly sequence: number;
    readonly semantic: AvatarOneShotSemantic;
    readonly source: "local-command";
  } | null>(null);
  const [objects, setObjects] = useState<readonly RepositoryRenderObject[]>([]);
  const [layoutGeneration, setLayoutGeneration] = useState("blank-world");
  const [agentMovementRequest, setAgentMovementRequest] =
    useState<AgentMovementRequest | null>(null);
  const [
    agentMovementCancellationGeneration,
    setAgentMovementCancellationGeneration,
  ] = useState(0);
  const [preferences, setPreferences] = useState<WorldDisplayPreferences>(() =>
    typeof window === "undefined"
      ? DEFAULT_WORLD_DISPLAY_PREFERENCES
      : loadWorldDisplayPreferences(window.localStorage),
  );
  const connectAttempt = useRef(0);
  const mounted = useRef(true);
  const processingChat = useRef(false);
  const pendingMessages = useRef<PendingWorldMessage[]>([]);
  const nextMessageId = useRef(0);
  const nextUserAnimationCue = useRef(1);
  const presentationGeneration = useRef(0);
  const activeChatAbort = useRef<AbortController | null>(null);
  const processedMovementActions = useRef(new Set<string>());

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
        updateChat({
          type: "RESTORE_HISTORY",
          messages: result.history.messages,
        });
        if (result.avatarSetup === "complete") {
          setAgentAvatar(avatarDraftFromProposal(result.proposal));
          setStatus(
            `agent connected · ${connectionLabel(result)} · avatar accepted`,
          );
          dispatch({
            type: "RESTORE_WORLD",
            sessionId: result.session.sessionId,
            continuity: result.continuity,
            agentName: result.proposal.displayName,
            avatarProfileId: result.proposal.proposalId,
          });
        } else {
          setAgentAvatar(null);
          setAgentAvatarMode("migrate");
          setStatus(
            `agent connected · ${connectionLabel(result)} · avatar change required`,
          );
          dispatch({
            type: "RESTORE_AGENT_AVATAR",
            sessionId: result.session.sessionId,
            continuity: result.continuity,
            agentName: result.proposal.displayName,
          });
        }
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
      result.avatarSetup === "complete" && result.proposal
        ? avatarDraftFromProposal(result.proposal)
        : null,
    );
    setAgentAvatarMode(
      result.avatarSetup === "legacy-migration" ? "migrate" : "create",
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
        if (result.avatarSetup === "complete" && result.proposal)
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
    returnToWorld = false,
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
    if (returnToWorld) {
      setAvatarTarget(null);
      return;
    }
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
    setLayoutGeneration(result.generationId);
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
    const generation = presentationGeneration.current;
    processingChat.current = true;
    if (mounted.current) setChatBusy(true);
    try {
      while (
        mounted.current &&
        presentationGeneration.current === generation &&
        pendingMessages.current.length > 0
      ) {
        const current = pendingMessages.current.shift();
        if (!current) break;
        setQueuedCount(pendingMessages.current.length);
        updateChat({ type: "SEND_STARTED", id: current.id });
        const controller = new AbortController();
        activeChatAbort.current = controller;
        try {
          const answer = await client.sendExactSession(session, current.text, {
            signal: controller.signal,
            userDisplayName: profile.agentName,
            onEvent: (event: WorldAgentEvent) => {
              if (mounted.current) updateChat({ type: "AGENT_EVENT", event });
            },
          });
          if (!mounted.current || presentationGeneration.current !== generation)
            return;
          await loadRequestedRepository(current.text);
          if (!mounted.current) return;
          updateChat({ type: "SEND_COMPLETED", text: answer.finalText });
        } catch {
          if (mounted.current && presentationGeneration.current === generation)
            updateChat({ type: "SEND_FAILED", message: "chat unavailable_" });
        } finally {
          if (activeChatAbort.current === controller)
            activeChatAbort.current = null;
        }
      }
    } finally {
      processingChat.current = false;
      if (mounted.current && presentationGeneration.current === generation) {
        setChatBusy(false);
        setQueuedCount(pendingMessages.current.length);
      }
    }
  };

  const send = async () => {
    if (!session || !message.trim()) return;
    const classified = classifyWorldMessage(message);
    setMessage("");
    if (classified.kind === "local-animation") {
      setUserAnimationCue({
        sequence: nextUserAnimationCue.current++,
        semantic: classified.semantic,
        source: "local-command",
      });
      return;
    }
    if (classified.kind === "local-refusal") {
      setStatus(classified.message);
      return;
    }
    if (classified.kind === "local-agent-movement") {
      setStatus("agent movement requested · user-directed");
      try {
        await postUserDirectedMovement(
          fetch,
          session.sessionId,
          classified.target,
        );
        if (mounted.current)
          setStatus("agent movement accepted · user-directed");
      } catch {
        if (mounted.current) setStatus("agent movement refused · unavailable");
      }
      return;
    }
    if (classified.kind === "local-agent-stop") {
      setStatus("agent movement cancellation requested");
      try {
        await postUserDirectedStop(fetch, session.sessionId);
        if (mounted.current) {
          setAgentMovementRequest(null);
          setAgentMovementCancellationGeneration((current) => current + 1);
          setStatus("agent movement cancelled · Idle");
        }
      } catch {
        if (mounted.current)
          setStatus("agent movement stop refused · unavailable");
      }
      return;
    }
    const text = classified.text;
    const pending = {
      id: `${Date.now()}-${nextMessageId.current++}`,
      text,
    };
    pendingMessages.current.push(pending);
    setQueuedCount(pendingMessages.current.length);
    updateChat({ type: "QUEUE_MESSAGE", ...pending });
    void processChatQueue();
  };

  const updatePreferences = (next: WorldDisplayPreferences) => {
    setPreferences(next);
    saveWorldDisplayPreferences(window.localStorage, next);
  };

  const leaveWorld = (destination: "session_select" | "agent_prompt") => {
    presentationGeneration.current += 1;
    activeChatAbort.current?.abort();
    activeChatAbort.current = null;
    connectAttempt.current += 1;
    pendingMessages.current = [];
    processingChat.current = false;
    window.localStorage.removeItem(SESSION_POINTER_KEY);
    setSession(null);
    setProposal(null);
    setAgentAvatar(null);
    setAvatarTarget(null);
    setAgentName("");
    setMessage("");
    setUserAnimationCue(null);
    setObjects([]);
    setLayoutGeneration("blank-world");
    setAgentMovementRequest(null);
    setAgentMovementCancellationGeneration(0);
    processedMovementActions.current.clear();
    setChatBusy(false);
    setQueuedCount(0);
    setError("");
    setStatus("Restored user avatar · Current");
    updateChat({ type: "RESET_PRESENTATION" });
    dispatch({ type: "LEAVE_WORLD", destination });
  };

  const inWorld =
    state.step === "world_entering" ||
    state.step === "world_blank" ||
    state.step === "repository_loading" ||
    state.step === "world_repository";
  const movementSessionId = inWorld ? session?.sessionId : undefined;
  useEffect(() => {
    if (!movementSessionId) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/world-actions/${movementSessionId}`);
        if (!response.ok || !active) return;
        const body = (await response.json()) as {
          readonly executions?: readonly {
            readonly envelope?: {
              readonly actions?: readonly Record<string, unknown>[];
            };
          }[];
        };
        for (const execution of body.executions ?? [])
          for (const action of execution.envelope?.actions ?? []) {
            if (
              action.kind !== "move-agent" ||
              action.schema !== "aiw.agent-movement/1" ||
              typeof action.actionId !== "string" ||
              processedMovementActions.current.has(action.actionId)
            )
              continue;
            const candidate = {
              schema: action.schema,
              requestId: action.actionId,
              actorId: action.actorId,
              source: action.source,
              speed: action.speed,
              target: action.target,
            } as AgentMovementRequest;
            processedMovementActions.current.add(action.actionId);
            setAgentMovementRequest(candidate);
          }
      } catch {
        // Movement capability remains truthful through the existing action status.
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [movementSessionId]);

  const reportAgentMovementEvent = (
    movementEvent: AgentMovementEvent,
    position: { readonly x: number; readonly z: number },
  ) => {
    if (!movementSessionId) return;
    if (movementEvent.state === "moving")
      setStatus(`agent moving · ${movementEvent.source}`);
    else if (movementEvent.state === "arrived") setStatus("agent arrived");
    else if (movementEvent.state === "cancelled")
      setStatus("agent movement cancelled · Idle");
    else if (movementEvent.state === "target-stale")
      setStatus("agent movement target stale");
    else if (movementEvent.state === "refused")
      setStatus("agent movement refused");
    const actionUrl = `/world-actions/${movementSessionId}/actions/${movementEvent.requestId}`;
    if (movementEvent.state === "moving" || movementEvent.state === "arrived")
      void fetch(`${actionUrl}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: movementEvent.state,
          ...(movementEvent.state === "arrived"
            ? { actorPosition: position }
            : {}),
        }),
      }).catch(() => undefined);
    else if (movementEvent.state === "cancelled")
      void fetch(`${actionUrl}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }).catch(() => undefined);
    else if (
      movementEvent.state === "refused" ||
      movementEvent.state === "target-stale"
    )
      void fetch(`${actionUrl}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "blocked" }),
      }).catch(() => undefined);
  };
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
    if (avatarTarget === "user")
      return (
        <main className="world-experience world-experience--avatar">
          <AvatarBuilderLoader
            role="user"
            initialProfile={profile}
            currentProfile={profile}
            title={`Change ${profile.agentName}’s avatar`}
            intro="Choose the role-valid user avatar, then save it locally and return to this World."
            saveLabel="Save user avatar"
            successMessage="User avatar saved locally."
            onSave={(draft) => {
              onUserAvatarSave?.(draft);
              setAvatarTarget(null);
            }}
          />
          <button
            type="button"
            className="world-avatar-cancel world-action--enabled"
            onClick={() => setAvatarTarget(null)}
          >
            Cancel avatar change
          </button>
        </main>
      );
    if (avatarTarget === "agent")
      return (
        <main className="world-experience world-experience--avatar">
          <WorldEntryAgentAvatar
            proposal={activeProposal}
            mode="change"
            busy={avatarBusy}
            error={error}
            onAccept={(acceptedProposal, acceptedDraft) =>
              void acceptAvatar(acceptedProposal, acceptedDraft, true)
            }
          />
          <button
            type="button"
            className="world-avatar-cancel world-action--enabled"
            onClick={() => setAvatarTarget(null)}
          >
            Cancel avatar change
          </button>
        </main>
      );
    return (
      <div className="world-experience world-experience--room">
        <Suspense
          fallback={
            <p className="world-entry-overlay" role="status">
              Loading World
            </p>
          }
        >
          <LazyWorldRoom
            floor={state.world.floor}
            objects={objects}
            reducedMotion={reducedMotion}
            forceNoWebGL={forceNoWebGL}
            userName={profile.agentName}
            agentName={activeProposal.displayName}
            userAvatar={profile}
            agentAvatar={activeAgentAvatar}
            activity={chat.activity}
            userCue={userAnimationCue}
            agentCue={chat.animationCue}
            agentActorId={movementSessionId}
            agentMovementRequest={agentMovementRequest}
            agentMovementCancellationGeneration={
              agentMovementCancellationGeneration
            }
            layoutGeneration={layoutGeneration}
            onAgentMovementEvent={reportAgentMovementEvent}
            showControlHints={preferences.showControlHints}
          />
        </Suspense>
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
        {state.step !== "world_entering" ? (
          <WorldEscapeMenu
            userName={profile.agentName}
            agentName={activeProposal.displayName}
            preferences={preferences}
            onPreferences={updatePreferences}
            onLogout={() => leaveWorld("session_select")}
            onResetSession={() => leaveWorld("session_select")}
            onChangeAvatar={setAvatarTarget}
            onChangeAgent={() => leaveWorld("agent_prompt")}
          />
        ) : null}
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
          mode={agentAvatarMode}
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

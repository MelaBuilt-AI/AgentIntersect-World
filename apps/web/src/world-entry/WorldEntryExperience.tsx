import {
  audioCue,
  worldAudioState,
  connectingAudioState,
  agentAudioState,
} from "../audio/world-audio.js";
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
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { AgentSetupContext } from "./agent-setup-context.js";
import { useReducedMotion } from "../motion/use-reduced-motion.js";
import { AvatarBuilderLoader } from "../avatar/AvatarBuilderLoader.js";
import {
  AgentSessionClient,
  type AgentRepositoryWorkFocus,
  type AvatarProposal,
  type ConstellationState,
  type WorldAgentEvent,
  type WorldAgentSession,
} from "../sessions/session-client.js";
import type { ConstellationMessageGroup } from "../sessions/session-client.js";
import {
  createWorldEntryClient,
  type HermesConnectionResult,
} from "./world-entry-client.js";
import { avatarDraftFromProposal } from "./world-entry-avatar.js";
import { WorldEntryAgentAvatar } from "./WorldEntryAgentAvatar.js";
const WorldAddAgent = lazy(() => import("./WorldAddAgent.js"));

import { WorldEscapeMenu } from "./WorldEscapeMenu.js";
import { startWorldPolling } from "./world-entry-polling.js";
import { WorldEntryLogo, WorldTypeLine } from "./WorldEntryLogo.js";
import { WorldHud } from "./WorldHud.js";
import {
  canEnterWorld,
  createReturningWorldEntryState,
  reduceWorldEntry,
} from "./world-entry-machine.js";
import {
  classifyWorldMessage,
  resolveChatRecipientRosterIds,
  createWorldChatState,
  reduceWorldChat,
  workstreamChatReports,
  type AvatarOneShotSemantic,
  type WorkstreamConversationAction,
} from "./world-chat-model.js";
import type {
  AgentMovementEvent,
  AgentMovementRequest,
} from "./world-agent-movement-model.js";
import {
  parseAgentMovementAuthoritySnapshot,
  postUserDirectedMovement,
  postUserDirectedStop,
  resolveDirectedMovementRecipients,
} from "./world-agent-direction.js";
import {
  DEFAULT_WORLD_DISPLAY_PREFERENCES,
  loadWorldDisplayPreferences,
  saveWorldDisplayPreferences,
  type WorldDisplayPreferences,
} from "./world-escape-menu-model.js";
import {
  resolveWorldEntryRestore,
  retainedWorldEntryConstellationProjection,
  restoreAvailableWorldEntryConstellationAgents,
  restoreWorldEntryConstellation,
} from "./world-entry-restore.js";
import {
  WorkstreamClient,
  type WorkstreamAuthorityDescriptor,
  type WorkstreamReference,
  type WorkstreamApiRecord,
} from "./workstream-client.js";
import {
  executeWorkstreamConversation,
  resolveWorkstreamTask,
} from "./workstream-create.js";
import {
  projectAuthoritativeWorkstream,
  type Workstream,
} from "./workstream-tracer.js";
import { WorldWorkstreamStatus } from "./WorkInspector.js";
import {
  PreviewManagerClient,
  type PreviewProjection,
  type PreviewRecipe,
} from "./preview-manager-client.js";
import { WorldView } from "./WorldView.js";
import { WorldScreenProvider } from "./WorldScreenProvider.js";
import {
  resolveWorldViewLauncher,
  type WorldInputOwner,
} from "./world-view-model.js";
import {
  resolveIterationRefresh,
  previewIterationKey,
  type IterationStatus,
} from "./workbench-iteration-model.js";
import {
  RepositoryIntakeDialog,
  type RepositoryProject,
} from "./RepositoryIntakeDialog.js";
import {
  cloneRepositoryProject,
  createRepositoryProject,
  listRepositoryProjects,
  openRepositoryProject,
  pinRepositoryProject,
} from "./repository-intake-client.js";

const SESSION_POINTER_KEY = "aiw.agent-session.pointer.0.12";
const SESSION_POINTER_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const LazyWorldRoom = lazy(async () => {
  const module = await import("./WorldRoom.js");
  return { default: module.WorldRoom };
});

type PendingWorldMessage = {
  readonly intent: "discussion" | "work";
  readonly id: string;
  readonly text: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly targetRosterId?: string;
};

const RepositoryWorkbench = lazy(() =>
  import("./RepositoryWorkbench.js").then((module) => ({
    default: module.RepositoryWorkbench,
  })),
);
const NewWorkstreamDialog = lazy(() =>
  import("./NewWorkstreamDialog.js").then((module) => ({
    default: module.NewWorkstreamDialog,
  })),
);

function renderObjects(
  snapshot: WorldSnapshot,
): readonly RepositoryRenderObject[] {
  const byRef = new Map(snapshot.objects.map((object) => [object.ref, object]));
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
    .map((object) => {
      const parent = object.parentRef ? byRef.get(object.parentRef) : null;
      const directChildren = object.childRefs
        .slice(0, 8)
        .flatMap((ref) => {
          const child = byRef.get(ref);
          if (!child) return [];
          return ["path" in child ? child.path : child.name];
        })
        .join(", ");
      return {
        ref: object.ref,
        repositoryRef: snapshot.repositoryRef,
        kind: object.kind,
        name: object.name,
        path: object.path,
        parentRef: object.parentRef,
        ...(parent
          ? {
              parentLabel: parent.name,
              ...("path" in parent ? { parentPath: parent.path } : {}),
            }
          : {}),
        childCount: object.childRefs.length,
        ...(directChildren ? { directChildren } : {}),
        position: object.position,
        bounds: object.bounds,
        ...(object.kind === "directory" ? { fileCount: object.fileCount } : {}),
        ...(object.kind === "package"
          ? {
              packageKind: object.packageKind,
              packageName: object.packageName,
            }
          : {}),
        ...(object.kind === "file"
          ? {
              fileKind: object.fileKind,
              language: object.language,
              size: object.size,
            }
          : {}),
      };
    });
}

function connectionLabel(result: HermesConnectionResult): string {
  if (result.status === "recovered") return "Previous / recovered";
  if (result.status === "connected") return "Current";
  if (result.status === "stale") return "Stale / unavailable";
  if (result.status === "unavailable") return "Unavailable";
  return "Retry";
}

type ConstellationProjection = ConstellationState["projection"];

const constellationTruthLabel = (
  continuity: ConstellationProjection["agents"][number]["continuity"],
): string => {
  if (continuity === "previous-recovered") return "Previous / recovered";
  if (continuity === "stale") return "Stale";
  if (continuity === "unavailable") return "Unavailable";
  return "Current";
};

export function WorldEntryConstellationProjection({
  projection,
  busyRosterId,
  onReconnect,
  onRemove,
  onEnterWorld,
}: {
  readonly projection: ConstellationProjection;
  readonly busyRosterId: string | null;
  readonly onReconnect: (rosterId: string) => void;
  readonly onRemove: (rosterId: string) => void;
  readonly onEnterWorld: () => void;
}) {
  const agents = [...projection.agents].sort(
    (left, right) => left.addedOrder - right.addedOrder,
  );
  return (
    <section
      className="world-constellation-projection"
      aria-label="Connected agent constellation"
      aria-live="polite"
    >
      <ol>
        {agents.map((agent) => {
          const unavailable =
            agent.connection === "stale" || agent.connection === "unavailable";
          const busy = busyRosterId === agent.rosterId;
          return (
            <li key={agent.rosterId} data-connection={agent.connection}>
              <span>
                {agent.displayName} · {agent.adapterId} ·{" "}
                {constellationTruthLabel(agent.continuity)}
              </span>
              {unavailable ? (
                <span className="world-constellation-projection__actions">
                  <button
                    type="button"
                    className="world-action--enabled"
                    disabled={busy}
                    onClick={() => onReconnect(agent.rosterId)}
                  >
                    Reconnect
                  </button>
                  <button
                    type="button"
                    className="world-action--enabled"
                    disabled={busy}
                    onClick={() => onRemove(agent.rosterId)}
                  >
                    Remove
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className={`world-enter-action ${
          projection.entryReady
            ? "world-action--enabled"
            : "world-action--unavailable"
        }`}
        disabled={!projection.entryReady}
        aria-disabled={!projection.entryReady}
        data-audio="handled"
        onClick={onEnterWorld}
      >
        Enter World
      </button>
    </section>
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
  const groupedClient = useMemo(() => new AgentSessionClient(), []);
  const [state, dispatch] = useReducer(
    reduceWorldEntry,
    {
      profileId: profile.profileId,
      name: profile.agentName,
    },
    createReturningWorldEntryState,
  );
  const savedSetup = useContext(AgentSetupContext);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const selectedConnection = savedSetup?.registrations.find(
    (entry) =>
      entry.id === selectedConnectionId &&
      entry.adapterId === state.selectedHarness,
  );
  const [agentName, setAgentName] = useState("");
  const [session, setSession] = useState<WorldAgentSession | null>(null);
  const [proposal, setProposal] = useState<AvatarProposal | null>(null);
  const [agentAvatar, setAgentAvatar] = useState<AvatarDraft | null>(null);
  const [constellation, setConstellation] =
    useState<ConstellationProjection | null>(null);
  const [constellationBusyRosterId, setConstellationBusyRosterId] = useState<
    string | null
  >(null);
  const [acceptedAgentAvatars, setAcceptedAgentAvatars] = useState<
    Readonly<Record<string, AvatarDraft>>
  >({});
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(
    null,
  );
  const [agentAvatarMode, setAgentAvatarMode] = useState<
    "create" | "migrate" | "change"
  >("create");
  const [avatarTarget, setAvatarTarget] = useState<"user" | "agent" | null>(
    null,
  );
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [status, setStatus] = useState("Restored user avatar · Current");
  const [directionRefusal, setDirectionRefusal] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [chat, updateChat] = useReducer(
    reduceWorldChat,
    undefined,
    createWorldChatState,
  );
  const [restorePending, setRestorePending] = useState(true);
  const [chatBusy, setChatBusy] = useState(false);
  const [activeMessageRosterIds, setActiveMessageRosterIds] = useState<
    readonly string[]
  >([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const [userAnimationCue, setUserAnimationCue] = useState<{
    readonly sequence: number;
    readonly semantic: AvatarOneShotSemantic;
    readonly source: "local-command";
  } | null>(null);
  const [objects, setObjects] = useState<readonly RepositoryRenderObject[]>([]);
  const [repositoryReadiness, setRepositoryReadiness] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [layoutGeneration, setLayoutGeneration] = useState("blank-world");
  const [repositoryName, setRepositoryName] = useState("Loaded repository");
  const [activeRepositoryAuthority, setActiveRepositoryAuthority] =
    useState<WorkstreamReference | null>(null);
  const [repositoryIntakeOpen, setRepositoryIntakeOpen] = useState(false);
  const [repositoryProjects, setRepositoryProjects] = useState<
    readonly RepositoryProject[]
  >([]);
  const [repositoryIntakeBusy, setRepositoryIntakeBusy] = useState(false);
  const [repositoryIntakeMessage, setRepositoryIntakeMessage] = useState(
    "Choose a repository for this World.",
  );
  const workstreamClient = useMemo(() => new WorkstreamClient(), []);
  const [storedWorkstream, setStoredWorkstream] = useState<Workstream | null>(
    null,
  );
  // Publish status and its report together, whichever UI path refreshed it.
  // Previously only the one-second poll published reports after the avatar idled.
  const setNormalWorkstream = useCallback(
    (work: Workstream | null) => {
      setStoredWorkstream(work);
      if (work)
        updateChat({
          type: "WORKSTREAM_REPORTS",
          reports: workstreamChatReports(
            work,
            constellation?.agents.find(
              (agent) => agent.worldSessionId === work.authority?.agent.agentId,
            )?.displayName ||
              agentName ||
              "Agent",
          ),
        });
    },
    [agentName, constellation],
  );
  const owner = storedWorkstream?.authority;
  const normalWorkstream =
    owner &&
    owner.repository.repositoryId === activeRepositoryAuthority?.repositoryId &&
    (state.sessionMode === "multi"
      ? constellation?.agents.some(
          (agent) =>
            agent.worldSessionId === owner.agent.agentId &&
            agent.connection === "connected",
        )
      : session?.sessionId === owner.agent.agentId)
      ? storedWorkstream
      : null;
  const [normalWorkstreamOpen, setNormalWorkstreamOpen] = useState(false);
  const [wheelTaskOpen, setWheelTaskOpen] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [newWorkstreamBase, setNewWorkstreamBase] = useState("HEAD");
  const [normalWorkstreamPending, setNormalWorkstreamPending] = useState(false);
  const [normalWorkstreamMessage, setNormalWorkstreamMessage] = useState<
    string | null
  >(null);
  const previewManagerClient = useMemo(() => new PreviewManagerClient(), []);
  const [previewRecipeState, setPreviewRecipeState] = useState<{
    readonly repositoryId: string;
    readonly recipes: readonly PreviewRecipe[];
    readonly error: string | null;
  } | null>(null);
  const [previewProjectionState, setPreviewProjectionState] = useState<{
    readonly workstreamId: string;
    readonly projection: PreviewProjection | null;
    readonly error: string | null;
  } | null>(null);
  const [previewActionPending, setPreviewActionPending] = useState(false);
  const [iterationStatus, setIterationStatus] =
    useState<IterationStatus | null>(null);
  const [worldInputOwner, setWorldInputOwner] =
    useState<WorldInputOwner>("world");
  const previewStartPending = useRef(false);
  const attemptedIterationRefresh = useRef<string | null>(null);
  const pendingIterationRefresh = useRef<{
    readonly workstreamId: string;
    readonly recipe: PreviewRecipe;
  } | null>(null);
  const [agentMovementRequest, setAgentMovementRequest] =
    useState<AgentMovementRequest | null>(null);
  const [agentMovementControl, setAgentMovementControl] = useState<{
    readonly sequence: number;
    readonly requestId: string;
    readonly state: "cancelled" | "interrupted";
    readonly reason: string;
  } | null>(null);
  const [agentWorkFocus, setAgentWorkFocus] =
    useState<AgentRepositoryWorkFocus | null>(null);
  const [rosterMovementRequests, setRosterMovementRequests] = useState<
    Readonly<Record<string, AgentMovementRequest | null>>
  >({});
  const [rosterMovementControls, setRosterMovementControls] = useState<
    Readonly<
      Record<
        string,
        {
          readonly sequence: number;
          readonly requestId: string;
          readonly state: "cancelled" | "interrupted";
          readonly reason: string;
        } | null
      >
    >
  >({});
  const [rosterWorkFocus, setRosterWorkFocus] = useState<
    Readonly<Record<string, AgentRepositoryWorkFocus | null>>
  >({});
  const [preferences, setPreferences] = useState<WorldDisplayPreferences>(() =>
    typeof window === "undefined"
      ? DEFAULT_WORLD_DISPLAY_PREFERENCES
      : loadWorldDisplayPreferences(window.localStorage),
  );
  const [addingAgent, setAddingAgent] = useState(false);
  useEffect(() => {
    const open = () => setAddingAgent(true);
    window.addEventListener("aiw:open-add-agent", open);
    return () => window.removeEventListener("aiw:open-add-agent", open);
  }, []);
  const connectAttempt = useRef(0);
  const connectController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const processingChat = useRef(false);
  const pendingMessages = useRef<PendingWorldMessage[]>([]);
  const nextMessageId = useRef(0);
  const nextUserAnimationCue = useRef(1);
  const presentationGeneration = useRef(0);
  const activeChatAbort = useRef<AbortController | null>(null);
  const processedMovementActions = useRef(new Set<string>());
  const processedMovementOutcomes = useRef(new Map<string, string>());
  const processedRosterMovementOutcomes = useRef(new Map<string, string>());
  const nextMovementControl = useRef(1);
  const repositoryIntakeRequest = useRef("Load repository");

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
    const liveWorkstreamTracer =
      new URLSearchParams(window.location.search).get("workstreamTracer") ===
      "live";
    const validPointer =
      pointer && SESSION_POINTER_PATTERN.test(pointer) ? pointer : null;
    void (async () => {
      const currentConstellation = await client
        .currentConstellation()
        .catch(() => null);
      const retainedProjection =
        currentConstellation?.projection.mode === "multi-agent" &&
        currentConstellation.projection.lifecycle !== "ended" &&
        currentConstellation.projection.agents.length >= 2 &&
        currentConstellation.projection.agents.every(
          (agent) =>
            agent.avatar.status === "accepted" &&
            typeof agent.avatar.profileId === "string" &&
            agent.avatar.sessionId === agent.worldSessionId,
        )
          ? currentConstellation.projection
          : null;
      if (retainedProjection) {
        let restoreProjection = retainedProjection;
        const restoredRepository = await client.currentRepository();
        const restoredMessageGroups = await groupedClient
          .messageGroups()
          .catch(() => []);
        const applyRestoredRepository = () => {
          if (!restoredRepository) return;
          const nextObjects = renderObjects(restoredRepository.snapshot);
          setObjects(nextObjects);
          setRepositoryName(
            restoredRepository.snapshot.objects.find(
              (object) => object.kind === "repository",
            )?.name ?? "Loaded repository",
          );
          setLayoutGeneration(`layout-${restoredRepository.generationId}`);
          setActiveRepositoryAuthority(restoredRepository.repository);
          setRepositoryReadiness("loading");
        };
        let plan = await restoreWorldEntryConstellation(
          client,
          restoreProjection,
        );
        let availableAgents:
          | Awaited<
              ReturnType<typeof restoreAvailableWorldEntryConstellationAgents>
            >
          | undefined;
        if (!plan) {
          availableAgents = await restoreAvailableWorldEntryConstellationAgents(
            client,
            restoreProjection,
          );
          const refreshedConstellation = await client
            .currentConstellation()
            .catch(() => null);
          const refreshedProjection = refreshedConstellation?.projection;
          if (
            refreshedProjection?.mode === "multi-agent" &&
            refreshedProjection.worldInstanceId ===
              restoreProjection.worldInstanceId &&
            refreshedProjection.lifecycle !== "ended" &&
            refreshedProjection.entryReady &&
            refreshedProjection.agents.length >= 2 &&
            refreshedProjection.agents.length <= 4 &&
            refreshedProjection.agents.every(
              (agent) =>
                agent.avatar.status === "accepted" &&
                typeof agent.avatar.profileId === "string" &&
                agent.avatar.sessionId === agent.worldSessionId,
            )
          ) {
            restoreProjection = refreshedProjection;
            setConstellation(restoreProjection);
            plan = await restoreWorldEntryConstellation(
              client,
              restoreProjection,
            );
          }
        }
        if (!active) return;
        setConstellation(restoreProjection);
        if (plan) {
          const primary = plan.agents.find(
            (agent) => agent.rosterId === plan.primaryRosterId,
          );
          if (!primary) throw new Error("agent unavailable_");
          setSession(primary.session);
          setProposal(primary.proposal);
          setAgentAvatar(avatarDraftFromProposal(primary.proposal));
          setAcceptedAgentAvatars(
            Object.fromEntries(
              plan.agents.map((agent) => [
                agent.rosterId,
                avatarDraftFromProposal(agent.proposal),
              ]),
            ),
          );
          window.localStorage.setItem(
            SESSION_POINTER_KEY,
            primary.session.sessionId,
          );
          updateChat({
            type: "RESTORE_HISTORY",
            messages: primary.history.messages,
            groups: restoredMessageGroups.filter((group) =>
              group.recipientRosterIds.every((rosterId) =>
                restoreProjection.agents.some(
                  (agent) => agent.rosterId === rosterId,
                ),
              ),
            ),
            displayNames: Object.fromEntries(
              restoreProjection.agents.map((agent) => [
                agent.rosterId,
                agent.displayName,
              ]),
            ),
          });
          setStatus(
            "agent constellation restored · avatar identities preserved",
          );
          dispatch({
            type: "RESTORE_CONSTELLATION",
            ...(restoredRepository
              ? {
                  repository: {
                    generationId: restoredRepository.generationId,
                    projectionTruth: restoredRepository.status,
                  },
                }
              : {}),
            agents: plan.agents.map((agent) => ({
              rosterId: agent.rosterId,
              adapterId: agent.adapterId,
              agentName: agent.displayName,
              sessionId: agent.worldSessionId,
              continuity: agent.continuity,
              avatarProfileId: agent.avatarProfileId,
            })),
          });
          applyRestoredRepository();
          if (restoredRepository) {
            setStatus("agent constellation and repository restored");
          }
          setRestorePending(false);
          return;
        }
        const restoredAgents =
          availableAgents ??
          (await restoreAvailableWorldEntryConstellationAgents(
            client,
            restoreProjection,
          ));
        if (!active) return;
        restoreProjection = retainedWorldEntryConstellationProjection(
          restoreProjection,
          restoredAgents,
        );
        setConstellation(restoreProjection);
        setAcceptedAgentAvatars(
          Object.fromEntries(
            restoredAgents.map((agent) => [
              agent.rosterId,
              avatarDraftFromProposal(agent.proposal),
            ]),
          ),
        );
        const primary =
          restoredAgents.find((agent) => agent.adapterId === "hermes") ??
          restoredAgents[0];
        if (primary) {
          setSession(primary.session);
          setProposal(primary.proposal);
          setAgentAvatar(avatarDraftFromProposal(primary.proposal));
          window.localStorage.setItem(
            SESSION_POINTER_KEY,
            primary.session.sessionId,
          );
          updateChat({
            type: "RESTORE_HISTORY",
            messages: primary.history.messages,
            groups: restoredMessageGroups.filter((group) =>
              group.recipientRosterIds.every((rosterId) =>
                restoreProjection.agents.some(
                  (agent) => agent.rosterId === rosterId,
                ),
              ),
            ),
            displayNames: Object.fromEntries(
              restoreProjection.agents.map((agent) => [
                agent.rosterId,
                agent.displayName,
              ]),
            ),
          });
        }
        dispatch({
          type: "RESTORE_CONSTELLATION",
          enterWorld: false,
          agents: restoreProjection.agents.map((agent) => ({
            rosterId: agent.rosterId,
            adapterId: agent.adapterId,
            agentName: agent.displayName,
            sessionId: agent.worldSessionId,
            connectionStatus:
              agent.connection === "connected" || agent.connection === "stale"
                ? agent.connection
                : "unavailable",
            continuity:
              agent.continuity === "current" ||
              agent.continuity === "previous-recovered"
                ? agent.continuity
                : "none",
            avatarProfileId: agent.avatar.profileId!,
          })),
        });
        applyRestoredRepository();
        setStatus(
          "agent constellation retained · reconnect or remove stale agents",
        );
        setRestorePending(false);
        return;
      }
      if (!validPointer && !liveWorkstreamTracer) {
        finishWithoutRestore(pointer !== null);
        return;
      }
      let result: HermesConnectionResult | null = validPointer
        ? await client.restoreHermes(validPointer)
        : null;
      let disposition = result ? resolveWorldEntryRestore(result) : null;
      if (
        (!result ||
          disposition === "clear" ||
          (result.status !== "connected" && result.status !== "recovered") ||
          !result.proposal) &&
        liveWorkstreamTracer
      ) {
        const workstream = await new WorkstreamClient().current();
        const currentAgentId = workstream?.agent.agentId;
        if (
          currentAgentId &&
          currentAgentId !== validPointer &&
          SESSION_POINTER_PATTERN.test(currentAgentId)
        ) {
          result = await client.restoreHermes(currentAgentId);
          disposition = resolveWorldEntryRestore(result);
        }
      }
      if (!active) return;
      if (
        !result ||
        disposition === "clear" ||
        (result.status !== "connected" && result.status !== "recovered") ||
        !result.proposal
      ) {
        finishWithoutRestore(pointer !== null);
        return;
      }
      setSession(result.session);
      setProposal(result.proposal);
      window.localStorage.setItem(
        SESSION_POINTER_KEY,
        result.session.sessionId,
      );
      updateChat({
        type: "RESTORE_HISTORY",
        messages: result.history.messages,
      });
      if (disposition === "world") {
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
        setAgentAvatarMode(
          disposition === "avatar-migrate" ? "migrate" : "create",
        );
        setStatus(
          `agent connected · ${connectionLabel(result)} · ${
            disposition === "avatar-migrate"
              ? "avatar change required"
              : "avatar acceptance required"
          }`,
        );
        dispatch({
          type: "RESTORE_AGENT_AVATAR",
          sessionId: result.session.sessionId,
          continuity: result.continuity,
          agentName: result.proposal.displayName,
        });
      }
      setRestorePending(false);
    })().catch(() => finishWithoutRestore(pointer !== null));
    return () => {
      active = false;
    };
  }, [client, groupedClient]);

  useEffect(() => {
    if (restorePending) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "PRESENT_IDENTITY" }),
      reducedMotion ? 0 : 560,
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, restorePending]);

  const connect = async () => {
    const entered = selectedConnection?.displayName ?? agentName.trim();
    if (savedSetup && !selectedConnection) return;
    if (!entered || state.step !== "agent_prompt") return;
    const attempt = connectAttempt.current + 1;
    connectAttempt.current = attempt;
    const controller = new AbortController();
    connectController.current = controller;
    setError("");
    setStatus("connecting agent");
    dispatch({ type: "SUBMIT_AGENT_NAME", name: entered });
    let nextConstellation = constellation;
    const selectedHarness = state.selectedHarness;
    const result =
      selectedHarness === "hermes" && !selectedConnection
        ? await client.connectHermes(entered)
        : selectedHarness
          ? await (async () => {
              try {
                const current =
                  nextConstellation ??
                  (await client.currentConstellation()).projection;
                nextConstellation = current;
                return await client.connectWorldOwnedAgent(
                  selectedHarness,
                  current.worldInstanceId,
                  entered,
                  selectedConnection?.id,
                  controller.signal,
                );
              } catch {
                return {
                  status: "unavailable" as const,
                  message: "agent unavailable_" as const,
                };
              }
            })()
          : {
              status: "unavailable" as const,
              message: "agent unavailable_" as const,
            };
    if (attempt !== connectAttempt.current) return;
    if (result.status === "not_found") {
      setStatus("Retry");
      dispatch({ type: "CONNECTION_NOT_FOUND" });
      return;
    }
    if (result.status === "unavailable" || result.status === "stale") {
      setStatus(connectionLabel(result));
      setError(result.message);
      if (selectedConnection)
        window.dispatchEvent(
          new CustomEvent("aiw:agent-connection-unavailable", {
            detail: { connectionId: selectedConnection.id },
          }),
        );
      dispatch({
        type: "CONNECTION_UNAVAILABLE",
        stale: result.status === "stale",
      });
      return;
    }
    if (!("session" in result)) return;
    if (state.sessionMode === "multi") {
      try {
        const current =
          nextConstellation ?? (await client.currentConstellation()).projection;
        const nativeRootSessionRef =
          typeof result.session.adapterRootSessionRef === "string"
            ? result.session.adapterRootSessionRef
            : result.session.adapterSessionRef;
        nextConstellation = (
          await client.addConstellationAgent({
            worldInstanceId: current.worldInstanceId,
            expectedRevision: current.revision,
            idempotencyKey: `task10-add-${crypto.randomUUID()}`,
            agent: {
              rosterId: result.session.sessionId,
              adapterId: result.session.adapterId,
              sessionOwnership:
                result.session.adapterId === "hermes" &&
                !result.session.connectionId
                  ? "operator-persistent"
                  : "world-owned",
              worldSessionId: result.session.sessionId,
              nativeRootSessionRef,
              displayName: result.proposal?.displayName ?? entered,
            },
          })
        ).projection;
        setConstellation(nextConstellation);
      } catch {
        setStatus("Unavailable");
        setError("agent unavailable_");
        dispatch({ type: "CONNECTION_UNAVAILABLE", stale: false });
        return;
      }
    }
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
    dispatch(
      state.sessionMode === "multi"
        ? {
            type: "AGENT_ATTACHED",
            rosterId: result.session.sessionId,
            sessionId: result.session.sessionId,
            continuity: result.continuity,
          }
        : {
            type: "CONNECTION_ATTACHED",
            sessionId: result.session.sessionId,
            continuity: result.continuity,
          },
    );
    window.setTimeout(
      () => {
        dispatch({ type: "OPEN_AGENT_AVATAR" });
        if (
          state.sessionMode === "single" &&
          result.avatarSetup === "complete" &&
          result.proposal
        )
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
    const pendingRosterId = state.pendingAgent?.rosterId;
    if (state.sessionMode === "multi") {
      if (!constellation || !pendingRosterId) {
        setError("avatar save unavailable_");
        return;
      }
      try {
        const next = await client.setConstellationAvatar(pendingRosterId, {
          worldInstanceId: constellation.worldInstanceId,
          expectedRevision: constellation.revision,
          idempotencyKey: `task10-avatar-${crypto.randomUUID()}`,
          avatar: {
            status: "accepted",
            profileId: acceptedProposal.proposalId,
            sessionId: session.sessionId,
          },
        });
        setConstellation(next.projection);
        setAcceptedAgentAvatars((current) => ({
          ...current,
          [pendingRosterId]: acceptedDraft,
        }));
        setSelectedRecipientId((current) => current ?? pendingRosterId);
      } catch {
        setError("avatar save unavailable_");
        return;
      }
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
    if (state.sessionMode === "multi" && pendingRosterId)
      dispatch({
        type: "AGENT_AVATAR_ACCEPTED",
        rosterId: pendingRosterId,
        sessionId: session.sessionId,
        avatarProfileId: acceptedProposal.proposalId,
      });
    else
      dispatch({
        type: "ACCEPT_AGENT_AVATAR",
        sessionId: session.sessionId,
        avatarProfileId: acceptedProposal.proposalId,
      });
    if (state.sessionMode === "multi")
      window.setTimeout(
        () => dispatch({ type: "RETURN_TO_CONSTELLATION" }),
        reducedMotion ? 0 : 320,
      );
  };

  const selectMultiAgent = () => {
    dispatch({ type: "SELECT_MULTI_AGENT" });
    setError("");
    void client
      .currentConstellation()
      .then((current) => setConstellation(current.projection))
      .catch(() => setError("agent constellation unavailable_"));
  };

  const reconnectConstellationAgent = async (rosterId: string) => {
    if (!constellation || constellationBusyRosterId) return;
    setConstellationBusyRosterId(rosterId);
    try {
      const next = await client.reconnectConstellationAgent(rosterId, {
        worldInstanceId: constellation.worldInstanceId,
        expectedRevision: constellation.revision,
        idempotencyKey: `task10-reconnect-${crypto.randomUUID()}`,
      });
      setConstellation(next.projection);
      const agent = next.projection.agents.find(
        (candidate) => candidate.rosterId === rosterId,
      );
      if (
        agent?.connection === "connected" &&
        (agent.continuity === "current" ||
          agent.continuity === "previous-recovered")
      ) {
        const restored =
          agent.adapterId === "hermes"
            ? await client.restoreHermes(
                agent.worldSessionId,
                agent.sessionOwnership === "world-owned"
                  ? agent.worldInstanceId
                  : undefined,
              )
            : await client.restoreConstellationAgent(
                agent.worldSessionId,
                agent.adapterId,
              );
        if (
          (restored.status !== "connected" &&
            restored.status !== "recovered") ||
          !restored.proposal ||
          !restored.avatarAccepted ||
          restored.avatarSetup !== "complete"
        )
          throw new Error("agent unavailable_");
        const restoredAvatar = avatarDraftFromProposal(restored.proposal);
        setAcceptedAgentAvatars((current) => ({
          ...current,
          [rosterId]: restoredAvatar,
        }));
        if (!session || agent.adapterId === "hermes") {
          setSession(restored.session);
          setProposal(restored.proposal);
          setAgentAvatar(restoredAvatar);
          window.localStorage.setItem(
            SESSION_POINTER_KEY,
            restored.session.sessionId,
          );
        }
        dispatch({
          type: "RECONNECT_AGENT",
          rosterId,
          status: "connected",
          sessionId: agent.worldSessionId,
          continuity: agent.continuity,
        });
      } else if (agent)
        dispatch({
          type: "RECONNECT_AGENT",
          rosterId,
          status: agent.connection === "stale" ? "stale" : "unavailable",
        });
    } catch {
      setError("agent unavailable_");
    } finally {
      setConstellationBusyRosterId(null);
    }
  };

  const removeConstellationAgent = async (rosterId: string) => {
    if (!constellation || constellationBusyRosterId) return;
    setConstellationBusyRosterId(rosterId);
    try {
      const next = await client.removeConstellationAgent(rosterId, {
        worldInstanceId: constellation.worldInstanceId,
        expectedRevision: constellation.revision,
        idempotencyKey: `task10-remove-${crypto.randomUUID()}`,
      });
      const removed = constellation.agents.find(
        (agent) => agent.rosterId === rosterId,
      );
      if (removed) agentAudioState(removed.worldSessionId, "idle");
      setConstellation(next.projection);
      setAcceptedAgentAvatars((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([key]) => key !== rosterId),
        ),
      );
      setSelectedRecipientId((current) =>
        current === rosterId ? null : current,
      );
      dispatch({ type: "REMOVE_AGENT", rosterId });
    } catch {
      setError("agent unavailable_");
    } finally {
      setConstellationBusyRosterId(null);
    }
  };

  const enterWorld = () => {
    if (
      !canEnterWorld(state) ||
      (state.sessionMode === "multi" && !constellation?.entryReady)
    )
      return;
    audioCue("world-jack-in");
    dispatch({ type: "ENTER_WORLD" });
    window.setTimeout(
      () => dispatch({ type: "WORLD_READY" }),
      reducedMotion ? 0 : 520,
    );
  };

  const activateRepository = async (rootPath: string, text: string) => {
    if (!mounted.current) return;
    const acknowledgementId = `${Date.now()}-${nextMessageId.current++}`;
    const preservingPrevious = state.world.floor === "repository";
    dispatch({ type: "REQUEST_REPOSITORY", request: text });
    setRepositoryReadiness("loading");
    setStatus(
      preservingPrevious
        ? "Repository loading · previous World preserved"
        : "Repository loading · blank floor preserved",
    );
    const result = await client.loadRepository(rootPath);
    if (!mounted.current) return;
    if (result.status === "failed") {
      setRepositoryReadiness(preservingPrevious ? "ready" : "error");
      dispatch({
        type: "REPOSITORY_FAILED",
        reason: result.message,
      });
      setStatus(
        preservingPrevious
          ? "Repository unavailable · previous World preserved · Retry"
          : "Repository unavailable · blank floor preserved · Retry",
      );
      updateChat({
        type: "LOCAL_REPOSITORY_RESULT",
        id: acknowledgementId,
        request: text,
        success: false,
        message: preservingPrevious
          ? "Repository load failed locally · previous World preserved"
          : "Repository load failed locally · blank floor preserved",
      });
      return;
    }
    audioCue("repo-city-spawn");
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
    setRepositoryName(
      result.snapshot.objects.find((object) => object.kind === "repository")
        ?.name ?? "Loaded repository",
    );
    setLayoutGeneration(`layout-${result.generationId}`);
    setActiveRepositoryAuthority(result.repository);
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
    updateChat({
      type: "LOCAL_REPOSITORY_RESULT",
      id: acknowledgementId,
      request: text,
      success: true,
      message:
        result.status === "previous-recovered"
          ? `Repository loaded locally · Previous / recovered · ${repositorySummary}`
          : `Repository loaded locally · Current · ${repositorySummary}`,
    });
  };

  const activateSelectedProject = async (
    operation: Promise<RepositoryProject>,
  ) => {
    setRepositoryIntakeBusy(true);
    setRepositoryIntakeMessage("Preparing repository…");
    try {
      const project = await operation;
      setRepositoryProjects(await listRepositoryProjects());
      setRepositoryIntakeOpen(false);
      await activateRepository(
        project.rootPath,
        repositoryIntakeRequest.current,
      );
    } catch (error) {
      if (!mounted.current) return;
      setRepositoryIntakeMessage(
        error instanceof Error
          ? error.message
          : "Repository intake unavailable",
      );
    } finally {
      if (mounted.current) setRepositoryIntakeBusy(false);
    }
  };

  const loadRequestedRepository = async (
    text: string,
    requestedRoot: string | null,
  ) => {
    repositoryIntakeRequest.current = text;
    if (requestedRoot) {
      await activateSelectedProject(
        openRepositoryProject({ rootPath: requestedRoot }),
      );
      return;
    }
    setRepositoryIntakeBusy(true);
    try {
      const projects = await listRepositoryProjects();
      const normalized = text.toLocaleLowerCase();
      const matches = projects.filter((project) =>
        normalized.includes(project.name.toLocaleLowerCase()),
      );
      if (matches.length === 1) {
        await activateSelectedProject(
          openRepositoryProject({
            rootPath: matches[0]!.rootPath,
            name: matches[0]!.name,
          }),
        );
        return;
      }
      setRepositoryProjects(projects);
      setRepositoryIntakeMessage(
        matches.length > 1
          ? "Choose the matching saved project."
          : "Choose a repository for this World.",
      );
      setRepositoryIntakeOpen(true);
    } catch (error) {
      setRepositoryProjects([]);
      setRepositoryIntakeMessage(
        error instanceof Error
          ? error.message
          : "Repository intake unavailable",
      );
      setRepositoryIntakeOpen(true);
    } finally {
      if (mounted.current) setRepositoryIntakeBusy(false);
    }
  };

  const repositoryRendered = useCallback(() => {
    setRepositoryReadiness("ready");
    setStatus("Repository city · ready");
  }, []);
  const repositoryRenderFailed = useCallback(() => {
    setRepositoryReadiness("error");
    setStatus("Repository city renderer unavailable · semantic scene active");
  }, []);

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
        const next = pendingMessages.current[0];
        if (next?.intent === "discussion" && activeRepositoryAuthority) {
          const work = await workstreamClient.current();
          const targetSessionId = next.targetRosterId
            ? constellation?.agents.find(
                (agent) => agent.rosterId === next.targetRosterId,
              )?.worldSessionId
            : session.sessionId;
          if (
            work &&
            ["planning", "working", "validating"].includes(work.status) &&
            (work.agent.agentId === targetSessionId ||
              (state.sessionMode === "multi" && !next.targetRosterId))
          ) {
            setQueuedCount(pendingMessages.current.length);
            await new Promise((resolve) => window.setTimeout(resolve, 500));
            continue;
          }
        }
        if (!mounted.current || presentationGeneration.current !== generation)
          break;
        const current = pendingMessages.current.shift();
        if (!current) break;
        setQueuedCount(pendingMessages.current.length);
        updateChat({ type: "SEND_STARTED", id: current.id });
        const recipientRosterIds =
          state.sessionMode === "multi"
            ? resolveChatRecipientRosterIds(
                current.text,
                (constellation?.agents ?? []).filter(
                  (agent) =>
                    agent.connection === "connected" &&
                    ["current", "previous-recovered"].includes(
                      agent.continuity,
                    ) &&
                    agent.avatar.status === "accepted",
                ),
                current.targetRosterId,
              )
            : [session.sessionId];
        const audioAgents =
          state.sessionMode === "multi"
            ? (constellation?.agents
                .filter((agent) => recipientRosterIds.includes(agent.rosterId))
                .map((agent) => agent.worldSessionId) ?? [])
            : [session.sessionId];
        setActiveMessageRosterIds(recipientRosterIds);
        const controller = new AbortController();
        activeChatAbort.current = controller;
        let groupPoll: number | null = null;
        try {
          let groupedAnswer: ConstellationMessageGroup | null = null;
          let singleAnswer: { readonly finalText: string } | null = null;
          if (state.sessionMode === "multi") {
            const projectGroup = (group: ConstellationMessageGroup) => {
              if (
                !mounted.current ||
                presentationGeneration.current !== generation
              )
                return;
              group.recipients.forEach((recipient) =>
                agentAudioState(
                  recipient.worldSessionId,
                  recipient.state === "completed"
                    ? "complete"
                    : recipient.state === "streaming"
                      ? "coding"
                      : recipient.state === "queued"
                        ? "idle"
                        : "failed",
                ),
              );
              if (
                mounted.current &&
                presentationGeneration.current === generation
              )
                updateChat({
                  type: "GROUP_COMPLETED",
                  group,
                  displayNames: Object.fromEntries(
                    (constellation?.agents ?? []).map((agent) => [
                      agent.rosterId,
                      agent.displayName,
                    ]),
                  ),
                });
            };
            groupPoll = window.setInterval(
              () =>
                void groupedClient
                  .messageGroup(current.requestId)
                  .then(projectGroup)
                  .catch(() => undefined),
              500,
            );
            groupedAnswer = await groupedClient.sendGrouped(current.text, {
              requestId: current.requestId,
              idempotencyKey: current.idempotencyKey,
              ...(current.targetRosterId
                ? { targetRosterId: current.targetRosterId }
                : {}),
              userDisplayName: profile.agentName,
              intent: current.intent,
              signal: controller.signal,
            });
          } else
            singleAnswer = await client.sendExactSession(
              session,
              current.text,
              {
                signal: controller.signal,
                userDisplayName: profile.agentName,
                intent: current.intent,
                onEvent: (event: WorldAgentEvent) => {
                  if (
                    mounted.current &&
                    presentationGeneration.current === generation
                  ) {
                    if (event.type === "tool.started")
                      agentAudioState(session.sessionId, "coding");
                    updateChat({ type: "AGENT_EVENT", event });
                  }
                },
              },
            );
          if (!mounted.current || presentationGeneration.current !== generation)
            return;
          if (groupedAnswer)
            groupedAnswer.recipients.forEach((recipient) =>
              agentAudioState(
                recipient.worldSessionId,
                recipient.state === "completed"
                  ? "complete"
                  : recipient.state === "streaming"
                    ? "coding"
                    : recipient.state === "queued"
                      ? "idle"
                      : "failed",
              ),
            );
          else audioAgents.forEach((id) => agentAudioState(id, "complete"));
          if (groupedAnswer)
            updateChat({
              type: "GROUP_COMPLETED",
              group: groupedAnswer,
              displayNames: Object.fromEntries(
                (constellation?.agents ?? []).map((agent) => [
                  agent.rosterId,
                  agent.displayName,
                ]),
              ),
            });
          else if (singleAnswer)
            updateChat({
              type: "SEND_COMPLETED",
              text: singleAnswer.finalText,
            });
        } catch {
          if (mounted.current && presentationGeneration.current === generation)
            audioAgents.forEach((id) => agentAudioState(id, "failed"));
          if (mounted.current && presentationGeneration.current === generation)
            updateChat({ type: "SEND_FAILED", message: "chat unavailable_" });
        } finally {
          if (groupPoll !== null) window.clearInterval(groupPoll);
          setActiveMessageRosterIds([]);
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

  const enqueueAgentMessage = (
    text: string,
    targetRosterId?: string,
    intent: "discussion" | "work" = "discussion",
  ) => {
    const requestId = crypto.randomUUID();
    const pending = {
      id: `${Date.now()}-${nextMessageId.current++}`,
      text,
      requestId,
      idempotencyKey: `task11-${requestId}`,
      ...(targetRosterId ? { targetRosterId } : {}),
    };
    pendingMessages.current.push({ ...pending, intent });
    setQueuedCount(pendingMessages.current.length);
    updateChat({ type: "QUEUE_MESSAGE", ...pending });
    void processChatQueue();
  };

  const workstreamAuthorityForConversation = async (
    selectedOnly = false,
  ): Promise<WorkstreamAuthorityDescriptor | null> => {
    if (!activeRepositoryAuthority || !session) return null;
    const continuingAgentId =
      normalWorkstream?.authority &&
      !["completed", "cancelled"].includes(normalWorkstream.status)
        ? normalWorkstream.authority.agent.agentId
        : null;
    const targetAgentId =
      (!selectedOnly ? continuingAgentId : null) ??
      (state.sessionMode === "multi"
        ? (constellation?.agents.find(
            (agent) => agent.rosterId === selectedRecipientId,
          )?.worldSessionId ?? null)
        : session.sessionId);
    if (!targetAgentId) return null;
    const targetSession = await client.refreshSession(targetAgentId);
    return {
      repository: activeRepositoryAuthority,
      agent: {
        agentId: targetSession.sessionId,
        nativeSessionId: targetSession.adapterSessionRef,
        rootNativeSessionId:
          typeof targetSession.adapterRootSessionRef === "string"
            ? targetSession.adapterRootSessionRef
            : targetSession.adapterSessionRef,
        revision: String(targetSession.permissionRevision),
      },
    };
  };

  const runWorkstreamConversation = async (
    action: WorkstreamConversationAction,
    announceInChat = true,
  ) => {
    if (normalWorkstreamPending) return;
    setNormalWorkstreamPending(true);
    try {
      const authority =
        action.action === "request"
          ? await workstreamAuthorityForConversation().catch(() => null)
          : null;
      const outcome = await executeWorkstreamConversation(
        action,
        authority,
        workstreamClient,
        (text, agentId) => {
          if (
            state.sessionMode === "multi" &&
            !constellation?.agents.some(
              (agent) =>
                agent.worldSessionId === agentId &&
                agent.connection === "connected",
            )
          )
            throw new Error("Workstream agent is not connected");
          enqueueAgentMessage(
            text,
            state.sessionMode === "multi" ? agentId : undefined,
            "work",
          );
        },
      );
      if (outcome.workstream) setNormalWorkstream(outcome.workstream);
      if (outcome.openInspector) setNormalWorkstreamOpen(true);
      let outcomeMessage = outcome.message;
      if (outcome.continued && outcome.workstream) {
        const displayedPreview =
          previewProjectionState?.workstreamId ===
          outcome.workstream.workstreamId
            ? previewProjectionState.projection?.display?.preview
            : null;
        const matchingRecipes =
          previewRecipeState &&
          previewRecipeState.repositoryId ===
            outcome.workstream.authority?.repository.repositoryId
            ? previewRecipeState.recipes
            : [];
        const recipe = matchingRecipes.length === 1 ? matchingRecipes[0] : null;
        if (displayedPreview && recipe) {
          pendingIterationRefresh.current = {
            workstreamId: outcome.workstream.workstreamId,
            recipe,
          };
          outcomeMessage = `Updating from visual feedback · preview revision ${displayedPreview.revision} remains verified.`;
          setIterationStatus({ state: "updating", message: outcomeMessage });
        }
      }
      setNormalWorkstreamMessage(outcomeMessage);
      if (outcomeMessage) setStatus(outcomeMessage);
      else if (outcome.continued) setStatus("Continuing current Workstream");
      if (announceInChat && !outcome.continued && outcomeMessage) {
        const id = `workstream-${Date.now()}-${nextMessageId.current++}`;
        updateChat({ type: "QUEUE_MESSAGE", id, text: action.text });
        updateChat({ type: "SEND_STARTED", id });
        updateChat(
          outcomeMessage.startsWith("Workbench error")
            ? { type: "SEND_FAILED", message: outcomeMessage }
            : { type: "SEND_COMPLETED", text: outcomeMessage },
        );
      }
      const boundAgentId = outcome.workstream?.authority?.agent.agentId;
      if (boundAgentId && boundAgentId === session?.sessionId) {
        const refreshed = await client
          .refreshSession(boundAgentId)
          .catch(() => null);
        if (refreshed && mounted.current) setSession(refreshed);
      }
    } finally {
      if (mounted.current) setNormalWorkstreamPending(false);
    }
  };

  useEffect(() => {
    connectingAudioState(state.step === "agent_resolving");
    return () => connectingAudioState(false);
  }, [state.step]);

  const [movementRefresh, setMovementRefresh] = useState(0);
  const sendText = async (input: string) => {
    if (!session || !input.trim()) return;
    setDirectionRefusal(null);
    const movementRecipients =
      state.sessionMode === "multi"
        ? resolveDirectedMovementRecipients(
            input,
            constellation?.agents ?? [],
            selectedRecipientId,
          )
        : { text: input, sessionIds: [session.sessionId] };
    const directed = classifyWorldMessage(movementRecipients.text);
    const classified =
      directed.kind === "local-agent-movement" ||
      directed.kind === "local-agent-stop" ||
      directed.kind === "local-refusal"
        ? directed
        : classifyWorldMessage(
            input,
            normalWorkstream?.authority?.agent.agentId === session.sessionId,
          );
    if (classified.kind === "local-animation") {
      setUserAnimationCue({
        sequence: nextUserAnimationCue.current++,
        semantic: classified.semantic,
        source: "local-command",
      });
      return;
    }
    if (classified.kind === "local-refusal") {
      setDirectionRefusal(classified.message);
      return;
    }
    if (
      classified.kind === "local-agent-movement" ||
      classified.kind === "local-agent-stop"
    ) {
      if (!movementRecipients.sessionIds.length) {
        setDirectionRefusal("agent movement refused · recipient unavailable");
        return;
      }
      const stopping = classified.kind === "local-agent-stop";
      setStatus(
        stopping
          ? "agent movement cancellation requested"
          : "agent movement requested · user-directed",
      );
      // Stop the visible actor immediately; the authority interrupt prevents
      // later polls from reviving the request.
      if (stopping) {
        if (
          agentMovementRequest &&
          movementRecipients.sessionIds.includes(agentMovementRequest.actorId)
        ) {
          setAgentMovementControl({
            sequence: nextMovementControl.current++,
            requestId: agentMovementRequest.requestId,
            state: "interrupted",
            reason: "user-directed-stop",
          });
          setAgentMovementRequest(null);
        }
        for (const agent of constellation?.agents ?? []) {
          const request = rosterMovementRequests[agent.rosterId];
          if (
            !request ||
            !movementRecipients.sessionIds.includes(agent.worldSessionId)
          )
            continue;
          setRosterMovementControls((current) => ({
            ...current,
            [agent.rosterId]: {
              sequence: nextMovementControl.current++,
              requestId: request.requestId,
              state: "interrupted",
              reason: "user-directed-stop",
            },
          }));
        }
      }
      const results = await Promise.allSettled(
        movementRecipients.sessionIds.map((id) =>
          classified.kind === "local-agent-stop"
            ? postUserDirectedStop(fetch, id)
            : postUserDirectedMovement(fetch, id, classified.target),
        ),
      );
      if (mounted.current) {
        setMovementRefresh((value) => value + 1);
        setStatus(
          results.some((result) => result.status === "rejected")
            ? "agent movement authority unavailable · some commands were not confirmed"
            : stopping
              ? "agent movement cancelled · Idle"
              : "agent movement accepted · user-directed",
        );
      }
      return;
    }
    if (classified.kind === "local-repository-load") {
      await loadRequestedRepository(classified.text, classified.requestedRoot);
      return;
    }
    if (classified.kind === "local-workstream") {
      await runWorkstreamConversation(classified);
      return;
    }
    const text = classified.text;
    enqueueAgentMessage(
      text,
      state.sessionMode === "multi"
        ? (selectedRecipientId ?? undefined)
        : undefined,
    );
  };

  const send = async () => {
    const input = message;
    setMessage("");
    await sendText(input);
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
    setRepositoryIntakeOpen(false);
    setRepositoryIntakeBusy(false);
    setUserAnimationCue(null);
    setObjects([]);
    setLayoutGeneration("blank-world");
    setActiveRepositoryAuthority(null);
    setNormalWorkstream(null);
    setNormalWorkstreamOpen(false);
    setNormalWorkstreamMessage(null);
    setNormalWorkstreamPending(false);
    setPreviewRecipeState(null);
    setPreviewProjectionState(null);
    setPreviewActionPending(false);
    setIterationStatus(null);
    setWorldInputOwner("world");
    previewStartPending.current = false;
    pendingIterationRefresh.current = null;
    setAgentMovementRequest(null);
    setAgentMovementControl(null);
    processedMovementActions.current.clear();
    processedMovementOutcomes.current.clear();
    setChatBusy(false);
    setActiveMessageRosterIds([]);
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
  useEffect(() => {
    worldAudioState(inWorld);
    return () => worldAudioState(false);
  }, [inWorld]);
  useEffect(() => {
    if (!normalWorkstream?.authority) return;
    const status = normalWorkstream.status;
    agentAudioState(
      normalWorkstream.authority.agent.agentId,
      status === "working"
        ? "coding"
        : status === "ready-for-review" || status === "completed"
          ? "complete"
          : status === "blocked" ||
              status === "cancelled" ||
              status === "cleanup-required"
            ? "failed"
            : "idle",
    );
  }, [normalWorkstream]);
  const primaryConstellationAgent =
    state.sessionMode === "multi" && constellation
      ? [...constellation.agents]
          .sort((left, right) => left.addedOrder - right.addedOrder)
          .find((agent) => agent.connection === "connected")
      : undefined;
  const movementSessionId = inWorld
    ? (primaryConstellationAgent?.worldSessionId ?? session?.sessionId)
    : undefined;
  const workstreamAuthority = useMemo<WorkstreamAuthorityDescriptor | null>(
    () =>
      activeRepositoryAuthority && session
        ? {
            repository: activeRepositoryAuthority,
            agent: {
              agentId: session.sessionId,
              nativeSessionId: session.adapterSessionRef,
              rootNativeSessionId:
                typeof session.adapterRootSessionRef === "string"
                  ? session.adapterRootSessionRef
                  : session.adapterSessionRef,
              revision: String(session.permissionRevision),
            },
          }
        : null,
    [activeRepositoryAuthority, session],
  );
  const workstreamTask = useMemo(
    () => resolveWorkstreamTask(chat.transcript, chatBusy || queuedCount > 0),
    [chat.transcript, chatBusy, queuedCount],
  );
  const normalWorkstreamId = normalWorkstream?.workstreamId ?? null;
  const normalPreviewAuthority = normalWorkstream?.authority ?? null;
  const previewEligible = Boolean(
    normalPreviewAuthority &&
    normalWorkstream?.status !== "cancelled" &&
    ["current", "dirty"].includes(normalPreviewAuthority.worktreeState),
  );
  const previewRepositoryId = previewEligible
    ? (normalPreviewAuthority?.repository.repositoryId ?? null)
    : null;
  const previewRecipes =
    previewRecipeState?.repositoryId === previewRepositoryId
      ? previewRecipeState.recipes
      : null;
  const previewRecipeError =
    previewRecipeState?.repositoryId === previewRepositoryId
      ? previewRecipeState.error
      : null;
  const previewProjection =
    previewEligible &&
    previewProjectionState?.workstreamId === normalWorkstreamId
      ? previewProjectionState.projection
      : null;
  const previewProjectionError =
    previewEligible &&
    previewProjectionState?.workstreamId === normalWorkstreamId
      ? previewProjectionState.error
      : null;
  const refreshWorkstreamSession = useCallback(async () => {
    if (!session) return;
    try {
      const refreshed = await client.refreshSession(session.sessionId);
      if (mounted.current) setSession(refreshed);
    } catch {
      if (mounted.current) setStatus("Workstream session refresh unavailable_");
    }
  }, [client, session]);
  useEffect(() => {
    if (!inWorld || !normalWorkstreamId) return;
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const current = await workstreamClient.current();
        if (active) {
          const projected = current
            ? projectAuthoritativeWorkstream(current)
            : null;
          setNormalWorkstream(projected);
        }
      } catch {
        if (active)
          setNormalWorkstreamMessage(
            "Workbench status temporarily unavailable.",
          );
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 1_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [inWorld, normalWorkstreamId, workstreamClient, setNormalWorkstream]);
  useEffect(() => {
    if (!inWorld || !previewRepositoryId) return;
    let active = true;
    void previewManagerClient
      .recipes(previewRepositoryId)
      .then((recipes) => {
        if (!active) return;
        setPreviewRecipeState({
          repositoryId: previewRepositoryId,
          recipes: recipes.filter(
            (recipe) => recipe.repositoryId === previewRepositoryId,
          ),
          error: null,
        });
      })
      .catch(() => {
        if (!active) return;
        setPreviewRecipeState({
          repositoryId: previewRepositoryId,
          recipes: [],
          error: "Preview Manager temporarily unavailable.",
        });
      });
    return () => {
      active = false;
    };
  }, [inWorld, previewManagerClient, previewRepositoryId]);
  useEffect(() => {
    if (!inWorld || !previewEligible || !normalWorkstreamId) return;
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const projection =
          await previewManagerClient.current(normalWorkstreamId);
        if (!active) return;
        setPreviewProjectionState({
          workstreamId: normalWorkstreamId,
          projection,
          error: null,
        });
      } catch {
        if (active)
          setPreviewProjectionState((current) => ({
            workstreamId: normalWorkstreamId,
            projection:
              current?.workstreamId === normalWorkstreamId
                ? current.projection
                : null,
            error: "Preview Manager temporarily unavailable.",
          }));
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 1_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [inWorld, normalWorkstreamId, previewEligible, previewManagerClient]);
  const refreshIterationKey =
    normalWorkstream && previewProjection?.display
      ? previewIterationKey(normalWorkstream, previewProjection.display.preview)
      : null;
  useEffect(() => {
    const recipe = previewRecipes?.find(
      (item) => item.recipeId === previewProjection?.display?.preview.recipeId,
    );
    const automatic =
      refreshIterationKey &&
      refreshIterationKey !== attemptedIterationRefresh.current &&
      recipe &&
      normalWorkstream
        ? { workstreamId: normalWorkstream.workstreamId, recipe }
        : null;
    const pending = pendingIterationRefresh.current ?? automatic;
    if (
      !pending ||
      normalWorkstream?.status === "working" ||
      normalWorkstreamPending ||
      chatBusy ||
      queuedCount > 0 ||
      previewStartPending.current
    )
      return;
    pendingIterationRefresh.current = null;
    attemptedIterationRefresh.current = refreshIterationKey;
    previewStartPending.current = true;
    setPreviewActionPending(true);
    void (async () => {
      try {
        const current = await workstreamClient.current();
        if (!mounted.current) return;
        if (
          !current ||
          current.workstreamId !== pending.workstreamId ||
          current.status === "cancelled" ||
          current.status === "cleanup-required" ||
          current.worktreeState === "missing" ||
          current.worktreeState === "removed"
        )
          throw new Error(
            "Current Workstream authority changed during iteration",
          );
        const workstream = projectAuthoritativeWorkstream(current);
        setNormalWorkstream(workstream);
        const readiness = resolveIterationRefresh(workstream);
        if (!readiness.ready) {
          setIterationStatus({ state: "failed", message: readiness.message });
          setNormalWorkstreamMessage(readiness.message);
          setStatus(readiness.message);
          return;
        }
        setIterationStatus({ state: "refreshing", message: readiness.message });
        setNormalWorkstreamMessage(readiness.message);
        setStatus(readiness.message);
        const started = await previewManagerClient.start(
          current,
          pending.recipe,
        );
        const projection = await previewManagerClient.current(
          current.workstreamId,
        );
        if (!mounted.current) return;
        setPreviewProjectionState({
          workstreamId: current.workstreamId,
          projection,
          error: null,
        });
        if (
          started.preview.state !== "ready" ||
          projection.display?.preview.previewId !== started.preview.previewId
        ) {
          const message = `${
            started.preview.error ?? "Replacement preview did not become ready."
          } Verified preview retained.`;
          setIterationStatus({ state: "failed", message });
          setNormalWorkstreamMessage(message);
          setStatus(message);
          return;
        }
        const message = `Updated World View ready · preview revision ${started.preview.revision}.`;
        setIterationStatus({ state: "ready", message });
        setNormalWorkstreamMessage(message);
        setStatus(message);
      } catch (error) {
        if (!mounted.current) return;
        const message = `Iteration refresh unavailable · ${
          error instanceof Error ? error.message : "Request failed"
        }. Verified preview retained.`;
        setIterationStatus({ state: "failed", message });
        setNormalWorkstreamMessage(message);
        setStatus(message);
      } finally {
        previewStartPending.current = false;
        if (mounted.current) setPreviewActionPending(false);
      }
    })();
  }, [
    refreshIterationKey,
    normalWorkstream,
    previewRecipes,
    previewProjection,
    chatBusy,
    normalWorkstreamPending,
    previewManagerClient,
    queuedCount,
    workstreamClient,
    setNormalWorkstream,
  ]);
  const startWorldView = useCallback(async () => {
    const recipe = previewRecipes?.length === 1 ? previewRecipes[0] : null;
    if (
      !normalPreviewAuthority ||
      !recipe ||
      !previewEligible ||
      previewStartPending.current
    )
      return;
    previewStartPending.current = true;
    setPreviewActionPending(true);
    setPreviewProjectionState((current) => ({
      workstreamId: normalPreviewAuthority.workstreamId,
      projection:
        current?.workstreamId === normalPreviewAuthority.workstreamId
          ? current.projection
          : null,
      error: null,
    }));
    try {
      const currentWorkstream = await workstreamClient.current();
      if (
        !currentWorkstream ||
        currentWorkstream.workstreamId !== normalPreviewAuthority.workstreamId
      )
        throw new Error(
          "Workstream changed. Inspect the current Workstream before previewing.",
        );
      await previewManagerClient.start(currentWorkstream, recipe);
      const projection = await previewManagerClient.current(
        normalPreviewAuthority.workstreamId,
      );
      if (mounted.current)
        setPreviewProjectionState({
          workstreamId: normalPreviewAuthority.workstreamId,
          projection,
          error: null,
        });
      if (
        mounted.current &&
        iterationStatus?.state === "failed" &&
        projection.display?.truth === "current"
      ) {
        const message = `Updated World View ready · preview revision ${projection.display.preview.revision}.`;
        setIterationStatus({ state: "ready", message });
        setNormalWorkstreamMessage(message);
        setStatus(message);
      }
    } catch {
      if (mounted.current)
        setPreviewProjectionState((current) => ({
          workstreamId: normalPreviewAuthority.workstreamId,
          projection:
            current?.workstreamId === normalPreviewAuthority.workstreamId
              ? current.projection
              : null,
          error: "Preview Manager temporarily unavailable.",
        }));
    } finally {
      previewStartPending.current = false;
      if (mounted.current) setPreviewActionPending(false);
    }
  }, [
    workstreamClient,
    normalPreviewAuthority,
    previewEligible,
    previewManagerClient,
    previewRecipes,
    iterationStatus,
  ]);
  const worldViewLauncher = normalWorkstream
    ? resolveWorldViewLauncher({
        workstream: normalWorkstream,
        recipeCount: previewRecipes?.length ?? 0,
        projection: previewProjection,
        loading: previewEligible && previewRecipes === null,
        pending: previewActionPending,
        unavailableReason: previewRecipeError ?? previewProjectionError,
      })
    : null;
  useEffect(() => {
    if (!movementSessionId || state.sessionMode === "multi") return;
    let active = true;
    const load = async (signal: AbortSignal) => {
      try {
        const response = await fetch(
          `/api/world-actions/${movementSessionId}`,
          { signal },
        );
        if (!response.ok || !active) {
          if (active)
            setStatus(
              `agent movement refused · authority unavailable (${response.status})`,
            );
          return;
        }
        const snapshot = parseAgentMovementAuthoritySnapshot(
          await response.json(),
          movementSessionId,
        );
        if (!active) return;
        for (const [outcomeIndex, outcome] of snapshot.outcomes.entries()) {
          if (
            processedMovementOutcomes.current.get(outcome.requestId) ===
            outcome.state
          )
            continue;
          processedMovementOutcomes.current.set(
            outcome.requestId,
            outcome.state,
          );
          const detail = outcome.reason ? ` · ${outcome.reason}` : "";
          if (outcomeIndex === 0) {
            if (outcome.state === "intent") setStatus(`agent intent${detail}`);
            else if (outcome.state === "moving")
              setStatus(`agent moving${detail}`);
            else if (outcome.state === "arrived") setStatus("agent arrived");
            else if (outcome.state === "refused")
              setStatus(`agent movement refused${detail}`);
            else if (outcome.state === "cancelled")
              setStatus(`agent movement cancelled${detail} · Idle`);
            else setStatus(`agent movement interrupted${detail} · Idle`);
          }
          if (
            outcome.state === "refused" ||
            outcome.state === "cancelled" ||
            outcome.state === "interrupted"
          )
            setAgentMovementControl({
              sequence: nextMovementControl.current++,
              requestId: outcome.requestId,
              state:
                outcome.state === "cancelled" ? "cancelled" : "interrupted",
              reason: outcome.reason ?? outcome.state,
            });
        }
        for (const candidate of snapshot.requests) {
          if (processedMovementActions.current.has(candidate.requestId))
            continue;
          processedMovementActions.current.add(candidate.requestId);
          setStatus(
            `agent intent · ${
              candidate.source === "agent-autonomous"
                ? "autonomous"
                : "user-directed"
            }`,
          );
          setAgentMovementRequest(candidate);
        }
      } catch {
        if (active) setStatus("agent movement refused · authority unavailable");
      }
    };
    const stop = startWorldPolling(load);
    return () => {
      active = false;
      stop();
    };
  }, [movementSessionId, movementRefresh, state.sessionMode]);

  useEffect(() => {
    if (!movementSessionId || state.sessionMode === "multi") return;
    let active = true;
    const load = async (signal: AbortSignal) => {
      try {
        const result = await groupedClient.workFocus(movementSessionId, signal);
        if (active) setAgentWorkFocus(result.focus);
      } catch {
        if (active) setAgentWorkFocus(null);
      }
    };
    const stop = startWorldPolling(load);
    return () => {
      active = false;
      stop();
    };
  }, [groupedClient, movementSessionId, state.sessionMode]);

  useEffect(() => {
    if (!inWorld || state.sessionMode !== "multi" || !constellation) {
      processedRosterMovementOutcomes.current.clear();
      return;
    }
    const agents = constellation.agents.filter(
      (agent) => agent.connection === "connected",
    );
    let active = true;
    const stops = agents.map((agent) =>
      startWorldPolling(async (signal) => {
        try {
          const movementResponse = await fetch(
            `/api/world-actions/${agent.worldSessionId}`,
            { signal },
          );
          if (!movementResponse.ok || !active) return;
          const snapshot = parseAgentMovementAuthoritySnapshot(
            await movementResponse.json(),
            agent.worldSessionId,
          );
          const focusResult = await groupedClient.workFocus(
            agent.worldSessionId,
            signal,
          );
          if (!active) return;
          const request = snapshot.requests.at(-1) ?? null;
          const terminal = snapshot.outcomes.find(
            (outcome) =>
              outcome.state === "cancelled" ||
              outcome.state === "interrupted" ||
              outcome.state === "refused",
          );
          setRosterMovementRequests((current) => ({
            ...current,
            [agent.rosterId]: request,
          }));
          setRosterWorkFocus((current) => ({
            ...current,
            [agent.rosterId]: focusResult.focus,
          }));
          if (
            terminal &&
            (terminal.state === "cancelled" ||
              terminal.state === "interrupted" ||
              terminal.state === "refused") &&
            processedRosterMovementOutcomes.current.get(agent.rosterId) !==
              `${terminal.requestId}:${terminal.state}`
          ) {
            processedRosterMovementOutcomes.current.set(
              agent.rosterId,
              `${terminal.requestId}:${terminal.state}`,
            );
            setRosterMovementControls((current) => ({
              ...current,
              [agent.rosterId]: {
                sequence: nextMovementControl.current++,
                requestId: terminal.requestId,
                state:
                  terminal.state === "cancelled" ? "cancelled" : "interrupted",
                reason: terminal.reason ?? terminal.state,
              },
            }));
          }
        } catch {
          if (active)
            setRosterWorkFocus((current) => ({
              ...current,
              [agent.rosterId]: null,
            }));
        }
      }),
    );
    return () => {
      active = false;
      stops.forEach((stop) => stop());
    };
  }, [
    constellation,
    groupedClient,
    inWorld,
    state.sessionMode,
    movementRefresh,
  ]);

  const reportAgentMovementEvent = (
    movementEvent: AgentMovementEvent,
    position: { readonly x: number; readonly z: number },
  ) => {
    if (!movementSessionId) return;
    if (movementEvent.state === "moving")
      setStatus(`agent moving · ${movementEvent.source}`);
    else if (movementEvent.state === "arrived") setStatus("agent arrived");
    else if (movementEvent.state === "cancelled")
      setStatus(`agent movement cancelled · ${movementEvent.reason} · Idle`);
    else if (movementEvent.state === "interrupted")
      setStatus(`agent movement interrupted · ${movementEvent.reason} · Idle`);
    else if (movementEvent.state === "target-stale")
      setStatus(`agent movement target stale · ${movementEvent.reason}`);
    else if (movementEvent.state === "refused")
      setStatus(`agent movement refused · ${movementEvent.reason}`);
    const actionUrl = `/api/world-actions/${movementEvent.actorId}/actions/${movementEvent.requestId}`;
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
    const worldAgentAvatars =
      state.sessionMode === "multi" && constellation
        ? [...constellation.agents]
            .sort((left, right) => left.addedOrder - right.addedOrder)
            .flatMap((agent) => {
              const avatar =
                acceptedAgentAvatars[agent.rosterId] ??
                (agent.worldSessionId === session?.sessionId
                  ? activeAgentAvatar
                  : null);
              return avatar
                ? [
                    {
                      rosterId: agent.rosterId,
                      worldSessionId: agent.worldSessionId,
                      name: agent.displayName,
                      avatar,
                    },
                  ]
                : [];
            })
        : [
            {
              rosterId: session?.sessionId ?? "agent-local",
              worldSessionId: session?.sessionId ?? "agent-local",
              name: activeProposal.displayName,
              avatar: activeAgentAvatar,
            },
          ];
    const primaryRosterId = worldAgentAvatars.find(
      (agent) => agent.worldSessionId === movementSessionId,
    )?.rosterId;
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
      <WorldScreenProvider>
        <div
          className="world-experience world-experience--room"
          data-repository-readiness={repositoryReadiness}
        >
          {addingAgent && session && activeProposal ? (
            <Suspense fallback={<p role="status">Loading Add Agent…</p>}>
              <WorldAddAgent
                currentSession={session}
                currentProposal={activeProposal}
                onClose={() => setAddingAgent(false)}
                onAdded={(next, _sessions, addedProposal, draft) => {
                  setConstellation(next.projection);
                  setAcceptedAgentAvatars((current) => {
                    const avatars = { ...current };
                    for (const agent of next.projection.agents) {
                      if (agent.worldSessionId === addedProposal.sessionId)
                        avatars[agent.rosterId] = draft;
                      else if (agent.worldSessionId === session.sessionId)
                        avatars[agent.rosterId] =
                          current[agent.rosterId] ??
                          agentAvatar ??
                          avatarDraftFromProposal(activeProposal);
                    }
                    return avatars;
                  });
                  dispatch({
                    type: "WORLD_ROSTER_ADDED",
                    roster: next.projection.agents.map((a) => ({
                      rosterId: a.rosterId,
                      adapterId: a.adapterId,
                      agentName: a.displayName,
                      connection: {
                        status: a.connection,
                        sessionId: a.worldSessionId,
                        continuity:
                          a.continuity === "previous-recovered"
                            ? "previous-recovered"
                            : "current",
                      },
                      agentAvatar: a.avatar,
                    })),
                  });
                  setAddingAgent(false);
                }}
              />
            </Suspense>
          ) : null}
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
              inputOwner={worldInputOwner}
              userName={profile.agentName}
              agentName={activeProposal.displayName}
              userAvatar={profile}
              agentAvatar={activeAgentAvatar}
              {...(state.sessionMode === "multi"
                ? { agentAvatars: worldAgentAvatars }
                : {})}
              selectedRecipientId={selectedRecipientId}
              onSelectRecipient={(rosterId) => {
                setSelectedRecipientId(rosterId);
                const target = worldAgentAvatars.find(
                  (agent) => agent.rosterId === rosterId,
                );
                if (target)
                  setStatus(`Next message recipient · ${target.name}`);
              }}
              onClearRecipient={() => {
                setSelectedRecipientId(null);
                setStatus("Next message recipient · All agents");
              }}
              activity={chat.activity}
              activeAgentRosterIds={activeMessageRosterIds}
              userCue={userAnimationCue}
              agentCue={chat.animationCue}
              agentActorId={movementSessionId}
              agentMovementRequest={
                state.sessionMode === "multi" && primaryRosterId
                  ? (rosterMovementRequests[primaryRosterId] ?? null)
                  : agentMovementRequest
              }
              agentMovementControl={
                state.sessionMode === "multi" && primaryRosterId
                  ? (rosterMovementControls[primaryRosterId] ?? null)
                  : agentMovementControl
              }
              agentWorkFocus={
                state.sessionMode === "multi" && primaryRosterId
                  ? (rosterWorkFocus[primaryRosterId] ?? null)
                  : movementSessionId
                    ? agentWorkFocus
                    : null
              }
              {...(state.sessionMode === "multi"
                ? {
                    agentMovementBindings: worldAgentAvatars.map((agent) => ({
                      rosterId: agent.rosterId,
                      actorId: agent.worldSessionId,
                      request: rosterMovementRequests[agent.rosterId] ?? null,
                      control: rosterMovementControls[agent.rosterId] ?? null,
                      workFocus: rosterWorkFocus[agent.rosterId] ?? null,
                    })),
                  }
                : {})}
              layoutGeneration={layoutGeneration}
              onAgentMovementEvent={reportAgentMovementEvent}
              showControlHints={preferences.showControlHints}
              repositoryReadiness={repositoryReadiness}
              liveWorkstream={normalWorkstream}
              projectName={repositoryName}
              onInspectWorkstream={() => setNormalWorkstreamOpen(true)}
              workstreamAuthority={workstreamAuthority}
              workstreamTask={workstreamTask.task}
              workstreamCreateUnavailableReason={
                workstreamTask.unavailableReason
              }
              onWorkstreamSessionChanged={refreshWorkstreamSession}
              onRepositoryReady={repositoryRendered}
              onRepositoryError={repositoryRenderFailed}
              onCodeWheelAction={(action) => {
                if (action === "follow" || action === "stop") {
                  void sendText(
                    action === "follow" ? "/agent follow" : "/agent stop",
                  );
                  return;
                }
                if (action === "load-repo") {
                  void loadRequestedRepository("/repo load", null);
                  return;
                }
                if (action === "workbench") {
                  setWheelTaskOpen(false);
                  setWorkbenchOpen(true);
                  return;
                }
                setWorkbenchOpen(false);
                setNewWorkstreamBase("HEAD");
                setWheelTaskOpen(true);
              }}
              onAskAgent={(prompt) => {
                const name =
                  state.sessionMode === "multi"
                    ? worldAgentAvatars.find(
                        (agent) => agent.rosterId === selectedRecipientId,
                      )?.name
                    : activeProposal.displayName;
                setMessage(name ? `@${name} ${prompt}` : prompt);
              }}
            />
          </Suspense>
          {state.step !== "world_entering" ? (
            <WorldHud
              recipient={
                state.sessionMode === "multi"
                  ? (worldAgentAvatars.find(
                      (agent) => agent.rosterId === selectedRecipientId,
                    )?.name ?? "All agents")
                  : activeProposal.displayName
              }
              status={directionRefusal ?? status}
              busy={chatBusy || state.step === "repository_loading"}
              queuedCount={queuedCount}
              workstreamOpen={Boolean(normalWorkstream)}
              message={message}
              transcript={chat.transcript}
              pushToTalkAvailable={Boolean(session)}
              voiceSession={session}
              onMessage={setMessage}
              onSend={() => void send()}
              onVoiceSend={(text) => void sendText(text)}
            />
          ) : (
            <div
              className="world-entry-overlay"
              role="status"
              aria-live="polite"
            >
              Entering World
            </div>
          )}
          {state.step !== "world_entering" && normalWorkstream ? (
            <WorldWorkstreamStatus
              workstream={normalWorkstream}
              open={normalWorkstreamOpen}
              pending={normalWorkstreamPending || previewActionPending}
              onApproveStaticPreview={
                previewEligible &&
                previewRecipes?.length === 0 &&
                previewRepositoryId
                  ? () => {
                      const repositoryId = previewRepositoryId;
                      setPreviewActionPending(true);
                      void previewManagerClient
                        .approveStaticSite(repositoryId)
                        .then((recipes) => {
                          if (mounted.current)
                            setPreviewRecipeState({
                              repositoryId,
                              recipes,
                              error: null,
                            });
                        })
                        .catch((error) => {
                          if (mounted.current)
                            setPreviewRecipeState({
                              repositoryId,
                              recipes: [],
                              error:
                                error instanceof Error
                                  ? error.message
                                  : "Preview approval unavailable",
                            });
                        })
                        .finally(() => {
                          if (mounted.current) setPreviewActionPending(false);
                        });
                    }
                  : undefined
              }
              message={normalWorkstreamMessage}
              onInspect={() => {
                setNormalWorkstreamOpen((open) => !open);
                setNormalWorkstreamMessage(
                  `Current Workstream is ${normalWorkstream.status}.`,
                );
              }}
              onCancel={() =>
                void runWorkstreamConversation(
                  {
                    action: "cancel",
                    text: "Cancel current Workstream",
                  },
                  false,
                )
              }
              {...(worldViewLauncher
                ? {
                    worldViewAction: {
                      ...worldViewLauncher,
                      onStart: () => void startWorldView(),
                    },
                  }
                : {})}
            />
          ) : null}
          {state.step !== "world_entering" &&
          normalWorkstream &&
          previewEligible &&
          previewProjection?.display ? (
            <WorldView
              key={normalWorkstream.workstreamId}
              workstream={normalWorkstream}
              projection={previewProjection}
              iterationStatus={iterationStatus}
              onInputOwnerChange={setWorldInputOwner}
              onRefresh={() => void startWorldView()}
              refreshPending={previewActionPending}
            />
          ) : null}
          {workbenchOpen || wheelTaskOpen ? (
            <Suspense
              fallback={
                <p className="code-wheel-task" role="status">
                  Loading repository tools…
                </p>
              }
            >
              {workbenchOpen ? (
                <RepositoryWorkbench
                  hasCurrentWork={!!normalWorkstream}
                  key={
                    activeRepositoryAuthority?.repositoryId ?? "no-repository"
                  }
                  repositoryId={activeRepositoryAuthority?.repositoryId ?? null}
                  agentName={
                    state.sessionMode === "multi"
                      ? (worldAgentAvatars.find(
                          (agent) => agent.rosterId === selectedRecipientId,
                        )?.name ?? null)
                      : activeProposal.displayName
                  }
                  onClose={() => setWorkbenchOpen(false)}
                  onContinue={async (record: WorkstreamApiRecord) => {
                    const authority =
                      await workstreamAuthorityForConversation(true);
                    if (!authority)
                      throw new Error(
                        "Load a repository and select one connected agent first",
                      );
                    const result = await workstreamClient.continueSaved(
                      record,
                      authority,
                    );
                    setNormalWorkstream(
                      projectAuthoritativeWorkstream(result.workstream),
                    );
                    setNormalWorkstreamMessage(
                      "Saved Workstream restored. No coding turn sent.",
                    );
                    const refreshed = await client.refreshSession(
                      authority.agent.agentId,
                    );
                    if (refreshed.sessionId === session?.sessionId)
                      setSession(refreshed);
                  }}
                  onInspect={() => {
                    setWorkbenchOpen(false);
                    setNormalWorkstreamOpen(true);
                  }}
                  onNew={(sha) => {
                    setWorkbenchOpen(false);
                    setNewWorkstreamBase(sha);
                    setWheelTaskOpen(true);
                  }}
                />
              ) : null}
              {wheelTaskOpen ? (
                <NewWorkstreamDialog
                  key={`${activeRepositoryAuthority?.repositoryId ?? "none"}:${newWorkstreamBase}`}
                  repositoryId={activeRepositoryAuthority?.repositoryId ?? null}
                  agentName={
                    state.sessionMode === "multi"
                      ? (worldAgentAvatars.find(
                          (agent) => agent.rosterId === selectedRecipientId,
                        )?.name ?? null)
                      : activeProposal.displayName
                  }
                  startPoint={newWorkstreamBase}
                  onClose={() => setWheelTaskOpen(false)}
                  onWorkbench={() => {
                    setWheelTaskOpen(false);
                    setWorkbenchOpen(true);
                  }}
                  onStart={async (options) => {
                    const authority =
                      await workstreamAuthorityForConversation(true);
                    if (!authority)
                      throw new Error(
                        "Load a repository and select one connected agent first",
                      );
                    const result = await workstreamClient.create({
                      ...options,
                      ...authority,
                      title: options.task.slice(0, 160),
                      requestId: crypto.randomUUID(),
                      correlationId: crypto.randomUUID(),
                    });
                    setNormalWorkstream(
                      projectAuthoritativeWorkstream(result.workstream),
                    );
                    setNormalWorkstreamOpen(true);
                    setNormalWorkstreamMessage(
                      "New Workstream started. Branch and delivery intent saved locally; nothing published.",
                    );
                    setWheelTaskOpen(false);
                    const refreshed = await client.refreshSession(
                      authority.agent.agentId,
                    );
                    if (refreshed.sessionId === session?.sessionId)
                      setSession(refreshed);
                  }}
                />
              ) : null}
            </Suspense>
          ) : null}
          {repositoryIntakeOpen ? (
            <RepositoryIntakeDialog
              projects={repositoryProjects}
              busy={repositoryIntakeBusy}
              message={repositoryIntakeMessage}
              onOpen={(rootPath, name) =>
                void activateSelectedProject(
                  openRepositoryProject({
                    rootPath,
                    ...(name ? { name } : {}),
                  }),
                )
              }
              onCreate={(rootPath, name) =>
                void activateSelectedProject(
                  createRepositoryProject({ rootPath, name }),
                )
              }
              onClone={(repository, destination, name) =>
                void activateSelectedProject(
                  cloneRepositoryProject({
                    repository,
                    destination,
                    ...(name ? { name } : {}),
                  }),
                )
              }
              onPin={(projectId, pinned) => {
                setRepositoryIntakeBusy(true);
                void pinRepositoryProject(projectId, pinned)
                  .then(() => listRepositoryProjects())
                  .then((projects) => setRepositoryProjects(projects))
                  .catch((error: unknown) =>
                    setRepositoryIntakeMessage(
                      error instanceof Error
                        ? error.message
                        : "Project pin unavailable",
                    ),
                  )
                  .finally(() => setRepositoryIntakeBusy(false));
              }}
              onClose={() => {
                setRepositoryIntakeOpen(false);
                setStatus("Repository selection cancelled");
              }}
            />
          ) : null}
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
      </WorldScreenProvider>
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
        singleSelected={state.sessionMode === "single"}
        multiSelected={state.sessionMode === "multi"}
        selectedHarness={state.selectedHarness}
        connectionPending={state.step === "agent_resolving"}
        rosterFull={(constellation?.agents.length ?? state.roster.length) >= 4}
        onSingle={() => dispatch({ type: "SELECT_SINGLE_AGENT" })}
        onMulti={selectMultiAgent}
        onHarness={(harness) => dispatch({ type: "SELECT_HARNESS", harness })}
      />
      <div className="world-entry-connections">
        {["agent_prompt", "agent_resolving", "agent_not_found"].includes(
          state.step,
        ) ? (
          <button
            type="button"
            className="world-action--enabled world-agent-cancel"
            onClick={() => {
              connectAttempt.current += 1;
              connectController.current?.abort();
              setError("");
              setStatus("Agent selection cancelled");
              setSelectedConnectionId("");
              dispatch({ type: "CANCEL_AGENT_SELECTION" });
            }}
          >
            Cancel
          </button>
        ) : null}
        {state.sessionMode === "multi" && constellation ? (
          <WorldEntryConstellationProjection
            projection={{
              ...constellation,
              entryReady:
                constellation.entryReady &&
                state.step === "enter_ready" &&
                canEnterWorld(state),
            }}
            busyRosterId={constellationBusyRosterId}
            onReconnect={(rosterId) =>
              void reconnectConstellationAgent(rosterId)
            }
            onRemove={(rosterId) => void removeConstellationAgent(rosterId)}
            onEnterWorld={enterWorld}
          />
        ) : null}
        {state.step === "agent_prompt" ? (
          <form
            className="world-agent-prompt"
            onSubmit={(event) => {
              event.preventDefault();
              void connect();
            }}
          >
            {savedSetup ? (
              <label>
                Saved agent
                <select
                  aria-label="Saved agent"
                  value={selectedConnection?.id ?? ""}
                  onChange={(event) =>
                    setSelectedConnectionId(event.target.value)
                  }
                >
                  <option value="">Choose a saved connection</option>
                  {savedSetup.registrations
                    .filter(
                      (entry) => entry.adapterId === state.selectedHarness,
                    )
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.displayName} · {entry.environment.label} ·{" "}
                        {entry.identity.label}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            {!savedSetup ? (
              <>
                <WorldTypeLine
                  text="agent name?"
                  reducedMotion={reducedMotion}
                />
                <span
                  className="world-agent-prompt__newline"
                  aria-hidden="true"
                >
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
              </>
            ) : null}
            <button
              type="submit"
              className={
                (savedSetup ? selectedConnection : agentName.trim())
                  ? "world-primary-action world-action--enabled"
                  : "world-primary-action world-action--unavailable"
              }
              disabled={savedSetup ? !selectedConnection : !agentName.trim()}
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
            <WorldTypeLine
              text="agent not found"
              reducedMotion={reducedMotion}
            />
            <button
              type="button"
              className="world-primary-action world-action--enabled"
              onClick={() => dispatch({ type: "RETRY_CONNECTION" })}
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>
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
      {state.step === "enter_ready" && state.sessionMode === "single" ? (
        <button
          type="button"
          className="world-enter-action world-action--enabled"
          data-audio="handled"
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

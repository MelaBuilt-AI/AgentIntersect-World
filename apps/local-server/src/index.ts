import {
  ConfigurationError,
  loadLocalServerConfig,
} from "@agentintersect-world/config/node";
import { AgentIntersectReadClient } from "@agentintersect-world/agentintersect-client/read";
import { WorldEventStore } from "@agentintersect-world/persistence";
import {
  PHASE19_ADAPTER_IDS,
  capabilitySnapshotHash,
} from "@agentintersect-world/agent-session-protocol";
import { buildNavigationMesh } from "@agentintersect-world/navigation";
import { randomUUID } from "node:crypto";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ReadIntegrationService } from "./agentintersect-integration.js";
import {
  AgentIntersectCommandClient,
  CommandIntentService,
  CommandIntentStore,
} from "./command-intents.js";
import {
  createLocalServer,
  type CurrentRepositorySelection,
} from "./server.js";
import { EvidenceService } from "./evidence-service.js";
import {
  AdapterRegistry,
  AgentSessionGateway,
  AgentSessionStore,
  HermesSessionAdapter,
  readPluginAvatarProposal,
  readPluginWorldActionProposal,
} from "./agent-sessions.js";
import {
  OpenClawSessionAdapter,
  resolveOpenClawCredential,
} from "./openclaw-session-adapter.js";
import { CodexSessionAdapter } from "./codex-session-adapter.js";
import { ClaudeCodeSessionAdapter } from "./claude-code-session-adapter.js";
import {
  importWorldActionProposal,
  WorldActionService,
  type WorldActionContext,
  type WorldActionProposalResult,
} from "./world-actions.js";
import { Phase14Service } from "./phase14-service.js";
import { WhisperCliProvider } from "@agentintersect-world/voice/node";
import { VoiceService, VoiceStore } from "./voice-service.js";
import { CoordinationService } from "./coordination-service.js";
import { loadProductionCoordinationGitConfig } from "./coordination-production-config.js";
import { Phase17Service } from "./phase17-service.js";
import { matchesSelectedRepository } from "./repository-selection-authority.js";
import {
  WorkstreamService,
  WorkstreamServiceError,
  type WorkstreamAgentBinding,
} from "./workstream-service.js";
import { WorktreeAuthority } from "./worktree-authority.js";
import { ConstellationService } from "./constellation-service.js";
import { ConstellationMessageService } from "./constellation-message-service.js";

const config = (() => {
  try {
    return loadLocalServerConfig();
  } catch (error) {
    const message =
      error instanceof ConfigurationError
        ? error.message
        : "Local server configuration is invalid";
    process.stderr.write(`Configuration error: ${message}\n`);
    process.exitCode = 1;
    return undefined;
  }
})();

const coordinationGitConfig =
  config === undefined
    ? undefined
    : await (async () => {
        try {
          return await loadProductionCoordinationGitConfig();
        } catch (error) {
          process.stderr.write(
            `Phase 16 configuration error: ${
              error instanceof Error ? error.message : "invalid Git boundary"
            }\n`,
          );
          process.exitCode = 1;
          return undefined;
        }
      })();

if (config !== undefined && coordinationGitConfig !== undefined) {
  let selectedRepository: () => CurrentRepositorySelection | null = () => null;
  const readClient = config.agentIntersectRead
    ? new AgentIntersectReadClient({
        daemonUrl: config.agentIntersectRead.daemonUrl,
        dashboardUrl: config.agentIntersectRead.dashboardUrl,
        expectedWorkspace: config.agentIntersectRead.expectedWorkspace,
        protectedPids: [process.pid, process.ppid],
      })
    : undefined;
  const integrationService = config.agentIntersectRead
    ? new ReadIntegrationService({
        enabled: true,
        client: readClient as AgentIntersectReadClient,
        store: new WorldEventStore(config.agentIntersectRead.dataDir),
        staleAfterMs: config.agentIntersectRead.staleAfterMs,
        maxQueuedFrames: config.agentIntersectRead.maxQueuedFrames,
      })
    : new ReadIntegrationService({ enabled: false });
  const evidenceService = config.agentIntersectRead
    ? new EvidenceService({
        root: config.agentIntersectRead.dataDir,
        selectedRepository: () => selectedRepository(),
      })
    : undefined;
  const commandIntentService =
    config.agentIntersectCommands && config.agentIntersectRead && readClient
      ? new CommandIntentService({
          store: new CommandIntentStore(config.agentIntersectRead.dataDir),
          client: new AgentIntersectCommandClient({
            daemonUrl: config.agentIntersectRead.daemonUrl,
            readClient,
            rawLogDirectory: path.join(
              config.agentIntersectRead.dataDir,
              "raw-command-logs",
            ),
          }),
          expectedPhaseId: config.agentIntersectCommands.expectedPhaseId,
          expectedRevision: config.agentIntersectCommands.expectedRevision,
          ...(evidenceService ? { evidenceService } : {}),
        })
      : undefined;
  const hermesAdapter = config.agentSessions
    ? new HermesSessionAdapter({
        baseUrl: config.agentSessions.hermesApiUrl,
        apiKey: config.agentSessions.hermesApiKey,
        profile: config.agentSessions.hermesProfile,
        ...(config.agentSessions.pluginCapabilityPath
          ? {
              pluginCapabilityPath: config.agentSessions.pluginCapabilityPath,
            }
          : {}),
        ...(config.agentSessions.pinnedSessionRef
          ? {
              pinnedSessionRef: config.agentSessions.pinnedSessionRef,
              agentDisplayName: config.agentSessions.agentDisplayName as string,
            }
          : {}),
      })
    : undefined;
  const openclawAdapter = config.agentSessions?.openclaw
    ? new OpenClawSessionAdapter({
        gatewayUrl: config.agentSessions.openclaw.gatewayUrl,
        credential: () =>
          resolveOpenClawCredential(
            config.agentSessions?.openclaw?.credentialRef as string,
          ),
      })
    : undefined;
  const codexAdapter = config.agentSessions?.codex
    ? new CodexSessionAdapter(config.agentSessions.codex)
    : undefined;
  const claudeCodeAdapter = config.agentSessions?.claudeCode
    ? new ClaudeCodeSessionAdapter(config.agentSessions.claudeCode)
    : undefined;
  const agentAdapterRegistry = new AdapterRegistry(
    [hermesAdapter, openclawAdapter, codexAdapter, claudeCodeAdapter].filter(
      (
        adapter,
      ): adapter is
        | HermesSessionAdapter
        | OpenClawSessionAdapter
        | CodexSessionAdapter
        | ClaudeCodeSessionAdapter => adapter !== undefined,
    ),
    PHASE19_ADAPTER_IDS,
  );
  const agentSessionGateway = config.agentSessions
    ? new AgentSessionGateway({
        registry: agentAdapterRegistry,
        store: new AgentSessionStore(config.agentSessions.dataDir),
      })
    : undefined;
  const constellationService =
    agentSessionGateway && config.agentSessions
      ? await ConstellationService.open({
          directory: path.join(config.agentSessions.dataDir, "constellation"),
          worldInstanceId: randomUUID(),
          lifecycle: {
            validateBinding: async (binding) => {
              const session = agentSessionGateway.status(
                binding.worldSessionId,
              );
              const rootSessionRef =
                session.adapterRootSessionRef ?? session.adapterSessionRef;
              if (
                session.adapterId !== binding.adapterId ||
                rootSessionRef !== binding.nativeRootSessionRef
              )
                return {
                  ...binding,
                  adapterId: session.adapterId as typeof binding.adapterId,
                  nativeRootSessionRef: rootSessionRef,
                  continuity: "unavailable" as const,
                };
              const attached = await agentSessionGateway.attach({
                adapterId: binding.adapterId,
                adapterSessionRef: binding.nativeRootSessionRef,
                profile: session.profile,
                workspaceId: session.workspaceId,
                repositoryRef: session.repositoryRef,
                mode: session.mode,
                ...(binding.sessionOwnership === "world-owned"
                  ? { worldInstanceId: binding.worldInstanceId }
                  : {}),
              });
              const continuity =
                attached.status === "ready" &&
                (attached.continuity === "current" ||
                  attached.continuity === "previous-recovered")
                  ? attached.continuity
                  : "unavailable";
              return {
                ...binding,
                adapterId: attached.adapterId as typeof binding.adapterId,
                worldSessionId: attached.sessionId,
                nativeRootSessionRef:
                  attached.adapterRootSessionRef ?? attached.adapterSessionRef,
                continuity,
              };
            },
            endWorldSession: async (worldSessionId, worldInstanceId) => {
              if (
                agentSessionGateway.status(worldSessionId).status === "closed"
              )
                return;
              await agentSessionGateway.endWorldSession(
                worldSessionId,
                worldInstanceId,
              );
            },
          },
        })
      : undefined;
  const constellationMessageService =
    constellationService && agentSessionGateway && config.agentSessions
      ? await ConstellationMessageService.open({
          directory: path.join(
            config.agentSessions.dataDir,
            "constellation-messages",
          ),
          constellation: constellationService,
          gateway: agentSessionGateway,
        })
      : undefined;
  const worldActionService = config.agentSessions
    ? new WorldActionService(
        path.join(config.agentSessions.dataDir, "world-actions"),
      )
    : undefined;
  const phase14Service = new Phase14Service({
    fixtureRoot: fileURLToPath(
      new URL("../../../examples/phase14-magic-slice", import.meta.url),
    ),
    storePath: path.join(
      config.presentationSync.dataDir,
      "..",
      "phase14",
      "operations.json",
    ),
  });
  const voiceService = agentSessionGateway
    ? new VoiceService({
        provider: new WhisperCliProvider({
          ...(process.env.AIW_PHASE15_STT_PROVIDER_ROOT
            ? { providerRoot: process.env.AIW_PHASE15_STT_PROVIDER_ROOT }
            : {}),
          tempRoot: path.join(
            config.presentationSync.dataDir,
            "..",
            "phase15",
            "volatile-audio",
          ),
        }),
        gateway: agentSessionGateway,
        store: new VoiceStore(
          path.join(config.presentationSync.dataDir, "..", "phase15"),
        ),
      })
    : undefined;
  const coordinationService = new CoordinationService({
    directory: path.join(
      config.presentationSync.dataDir,
      "..",
      "phase16",
      "coordination",
    ),
    ...(coordinationGitConfig ?? {}),
    requireApprovedGitBoundary: true,
  });
  const workstreamAgentBinding = (
    agentId: string,
  ): WorkstreamAgentBinding | null => {
    if (!agentSessionGateway) return null;
    try {
      const session = agentSessionGateway.status(agentId);
      if (
        session.sessionId !== agentId ||
        session.status !== "ready" ||
        session.continuity !== "current" ||
        (session.mode !== "explore" && session.mode !== "collaborate")
      )
        return null;
      return {
        agentId: session.sessionId,
        nativeSessionId: session.adapterSessionRef,
        rootNativeSessionId:
          session.adapterRootSessionRef ?? session.adapterSessionRef,
        revision: String(session.permissionRevision),
        worktreeRef: session.worktreeRef,
        currentTaskRef: session.currentTaskRef,
        mode: session.mode,
        eventSequence: session.lastEventSequence,
      };
    } catch {
      return null;
    }
  };
  const workstreamService =
    coordinationGitConfig && agentSessionGateway
      ? new WorkstreamService({
          directory: path.join(
            config.presentationSync.dataDir,
            "..",
            "workbench",
            "workstreams",
          ),
          worktreeAuthority: new WorktreeAuthority({
            approvedRepositoryRoot:
              coordinationGitConfig.approvedRepositoryRoot,
            allowedWorktreeParent: coordinationGitConfig.allowedWorktreeParent,
          }),
          worktreeParent: coordinationGitConfig.allowedWorktreeParent,
          currentRepository: () => {
            const selection = selectedRepository();
            return selection
              ? {
                  repositoryId: selection.snapshot.repositoryRef,
                  revision: selection.generation.id,
                }
              : null;
          },
          connectedAgent: (agentId) => {
            try {
              const session = agentSessionGateway.status(agentId);
              if (
                session.sessionId !== agentId ||
                session.status !== "ready" ||
                session.continuity !== "current"
              )
                return null;
              return {
                agentId: session.sessionId,
                nativeSessionId: session.adapterSessionRef,
                rootNativeSessionId:
                  session.adapterRootSessionRef ?? session.adapterSessionRef,
                revision: String(session.permissionRevision),
              };
            } catch {
              return null;
            }
          },
          evidenceReader: {
            read: (operationRefs) => {
              if (operationRefs.length > 0)
                throw new WorkstreamServiceError(
                  "unavailable",
                  "Workstream evidence is unavailable until the Phase 14 adapter is composed",
                );
              return [];
            },
          },
          agentPort: {
            current: workstreamAgentBinding,
            busy: (agentId) => agentSessionGateway.isBusy(agentId),
            bind: ({ agent, worktreeRef, taskRef }) => {
              const current = workstreamAgentBinding(agent.agentId);
              if (
                !current ||
                current.nativeSessionId !== agent.nativeSessionId ||
                current.rootNativeSessionId !==
                  (agent.rootNativeSessionId ?? agent.nativeSessionId) ||
                current.revision !== agent.revision
              )
                throw new Error(
                  "Selected World agent binding changed before Workstream creation",
                );
              agentSessionGateway.bindWorkstream(agent.agentId, {
                worktreeRef,
                taskRef,
              });
              const bound = workstreamAgentBinding(agent.agentId);
              if (!bound) throw new Error("Workstream agent binding failed");
              return bound;
            },
            dispatch: async ({ agentId, task, systemContext, signal }) => {
              const binding = agentSessionGateway.status(agentId);
              await agentSessionGateway.sendText(
                agentId,
                {
                  text: task,
                  binding,
                  context: { systemMessage: systemContext },
                },
                { signal },
              );
            },
            evidence: (agentId, afterSequence) =>
              agentSessionGateway
                .events(agentId)
                .filter(
                  (event) =>
                    event.sequence > afterSequence &&
                    event.type !== "message.assistant-delta",
                )
                .slice(-64)
                .map((event) => ({
                  ref: `agent-event:${event.eventId}`,
                  summary:
                    event.type === "tool.started" ||
                    event.type === "tool.completed" ||
                    event.type === "tool.failed"
                      ? `Hermes ${event.type} · ${String(event.payload.toolName ?? "unknown")}.`
                      : `Hermes ${event.type}.`,
                })),
            unbind: ({ agentId, worktreeRef, taskRef }) => {
              agentSessionGateway.unbindWorkstream(agentId, {
                worktreeRef,
                taskRef,
              });
            },
          },
        })
      : undefined;
  if (workstreamService && agentSessionGateway) {
    agentSessionGateway.setWorkstreamContextResolver((session) =>
      workstreamService.contextForAgent({
        agentId: session.sessionId,
        worktreeRef: session.worktreeRef,
        currentTaskRef: session.currentTaskRef,
      }),
    );
    agentSessionGateway.setRepositoryWorkFocusRecoveryResolver(() =>
      workstreamService.current(),
    );
  }
  const phase17Service = new Phase17Service({
    directory:
      process.env.AIW_PHASE17_STATE_DIR ??
      path.join(
        config.presentationSync.dataDir,
        "..",
        "phase17",
        "observability",
      ),
  });
  const server: ReturnType<typeof createLocalServer> = createLocalServer({
    config,
    integrationService,
    ...(commandIntentService ? { commandIntentService } : {}),
    ...(evidenceService ? { evidenceService } : {}),
    phase14Service,
    coordinationService,
    phase17Service,
    ...(workstreamService ? { workstreamService } : {}),
    ...(constellationService ? { constellationService } : {}),
    ...(constellationMessageService ? { constellationMessageService } : {}),
    ...(voiceService ? { voiceService } : {}),
    ...(agentSessionGateway
      ? {
          agentSessionGateway,
          agentAdapterRegistry,
          ...(config.agentSessions?.designRepositoryRoot
            ? {
                designRepositoryRoot: config.agentSessions.designRepositoryRoot,
              }
            : {}),
          ...(config.agentSessions?.pluginAvatarProposalPath
            ? {
                avatarProposal: (sessionId: string) =>
                  readPluginAvatarProposal(
                    config.agentSessions?.pluginAvatarProposalPath as string,
                    sessionId,
                    agentSessionGateway.status(sessionId).adapterSessionRef,
                  ),
              }
            : {}),
          ...(worldActionService
            ? {
                worldActionService,
                worldActionContext: async (sessionId: string) => {
                  const session = agentSessionGateway.status(sessionId);
                  const selection = server.currentRepositorySelection();
                  if (
                    selection &&
                    !matchesSelectedRepository(
                      session.repositoryRef,
                      selection.snapshot.repositoryRef,
                    )
                  )
                    return null;
                  const manifest = (
                    await agentAdapterRegistry.capabilities()
                  ).find(({ adapterId }) => adapterId === session.adapterId);
                  if (!manifest) return null;
                  const worldActionsEnabled =
                    manifest.capabilities.worldActions &&
                    capabilitySnapshotHash(manifest) ===
                      session.capabilitySnapshotHash;
                  if (!selection) {
                    const worldGeneration = "blank-world";
                    const layoutGeneration = "blank-world";
                    return {
                      binding: {
                        sessionId,
                        adapterSessionRef: session.adapterSessionRef,
                        repositoryRef: "aiw://object/blank-world",
                        worldGeneration,
                        layoutGeneration,
                        graphGeneration: null,
                        capabilitySnapshotHash: session.capabilitySnapshotHash,
                      },
                      worldActionsEnabled,
                      targets: [],
                      navigationMesh: buildNavigationMesh({
                        worldGeneration,
                        layoutGeneration,
                        navigationBounds: {
                          x: -15,
                          z: -15,
                          width: 30,
                          depth: 30,
                        },
                        avatarRadius: 0.35,
                        clearance: 0.15,
                        obstacles: [],
                      }),
                      positions: new Map(),
                      relationships: [],
                    };
                  }
                  const objects = selection.snapshot.objects;
                  const minimumX = Math.min(
                    ...objects.map(({ bounds }) => bounds.x),
                  );
                  const minimumZ = Math.min(
                    ...objects.map(({ bounds }) => bounds.z),
                  );
                  const maximumX = Math.max(
                    ...objects.map(({ bounds }) => bounds.x + bounds.width),
                  );
                  const maximumZ = Math.max(
                    ...objects.map(({ bounds }) => bounds.z + bounds.depth),
                  );
                  const worldGeneration = selection.generation.id;
                  const layoutGeneration = `layout-${selection.snapshot.generationFingerprint}`;
                  const graphGeneration =
                    server.codeGraphService.status().current?.generationId ??
                    null;
                  const relationships = (() => {
                    if (!graphGeneration) return [];
                    try {
                      return server.codeGraphService
                        .aggregate(1, 1_024)
                        .edges.flatMap((edge) =>
                          edge.targetRef
                            ? [
                                {
                                  ref: edge.key,
                                  sourceRef: edge.sourceRef,
                                  targetRef: edge.targetRef,
                                  confidence:
                                    edge.confidence.find(
                                      (value) =>
                                        value === "exact_file" ||
                                        value === "exact_workspace_package",
                                    ) ??
                                    edge.confidence[0] ??
                                    "unavailable",
                                  evidenceRef: edge.key,
                                },
                              ]
                            : [],
                        );
                    } catch {
                      return [];
                    }
                  })();
                  const positions = new Map(
                    objects.map((object) => [
                      object.ref,
                      {
                        x: object.bounds.x + object.bounds.width / 2,
                        z: object.bounds.z - 0.75,
                        interactionRadius: 0.75,
                      },
                    ]),
                  );
                  const firstTourObject = objects.find(
                    (object) =>
                      "path" in object &&
                      object.path === "packages/spatial-code-graph",
                  );
                  return {
                    binding: {
                      sessionId,
                      adapterSessionRef: session.adapterSessionRef,
                      repositoryRef: selection.snapshot.repositoryRef,
                      worldGeneration,
                      layoutGeneration,
                      graphGeneration,
                      capabilitySnapshotHash: session.capabilitySnapshotHash,
                    },
                    worldActionsEnabled,
                    targets: objects.map((object) => ({
                      objectRef: object.ref,
                      repositoryRef: selection.snapshot.repositoryRef,
                      state:
                        object.kind === "tombstone"
                          ? ("tombstone" as const)
                          : ("current" as const),
                      ...(object.kind === "tombstone"
                        ? { path: object.lastKnownPath }
                        : "path" in object
                          ? { path: object.path }
                          : {}),
                      ...("pathHistory" in object
                        ? {
                            previousPaths: object.pathHistory.map(
                              ({ path: previousPath }) => previousPath,
                            ),
                            continuity: "authoritative" as const,
                          }
                        : {}),
                    })),
                    navigationMesh: buildNavigationMesh({
                      worldGeneration,
                      layoutGeneration,
                      navigationBounds: {
                        x: minimumX - 2,
                        z: minimumZ - 2,
                        width: Math.max(4, maximumX - minimumX + 4),
                        depth: Math.max(4, maximumZ - minimumZ + 4),
                      },
                      avatarRadius: 0.35,
                      clearance: 0.15,
                      obstacles: objects.flatMap((object) =>
                        object.kind === "package"
                          ? [{ ref: object.ref, bounds: object.bounds }]
                          : [],
                      ),
                    }),
                    positions,
                    relationships,
                    ...(firstTourObject
                      ? {
                          actorPosition: {
                            x:
                              firstTourObject.bounds.x +
                              firstTourObject.bounds.width / 2,
                            z: firstTourObject.bounds.z - 0.75,
                          },
                        }
                      : {}),
                  };
                },
                worldActionImport: async (
                  sessionId: string,
                  context: WorldActionContext,
                ) => {
                  const capabilityPath =
                    config.agentSessions?.pluginCapabilityPath;
                  if (!capabilityPath) return [];
                  const directory = path.join(
                    path.dirname(capabilityPath),
                    "world-action-proposals",
                  );
                  let names: string[];
                  try {
                    names = (await readdir(directory))
                      .filter((name) =>
                        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i.test(
                          name,
                        ),
                      )
                      .slice(0, 32);
                  } catch {
                    return [];
                  }
                  const nativeSession = agentSessionGateway.status(sessionId);
                  const proposalOwners = [
                    nativeSession.adapterSessionRef,
                    ...(nativeSession.adapterPreviousSessionRef
                      ? [nativeSession.adapterPreviousSessionRef]
                      : []),
                  ];
                  const proposals = names.flatMap((name) => {
                    const file = path.join(directory, name);
                    const proposal = readPluginWorldActionProposal(
                      file,
                      proposalOwners,
                      sessionId,
                    );
                    return proposal ? [{ file, ...proposal }] : [];
                  });
                  proposals.sort(
                    (left, right) =>
                      Date.parse(left.createdAt) -
                        Date.parse(right.createdAt) ||
                      left.sourceStreamId.localeCompare(right.sourceStreamId) ||
                      left.sequence - right.sequence ||
                      left.proposalId.localeCompare(right.proposalId),
                  );
                  const executions: WorldActionProposalResult[] = [];
                  for (const proposal of proposals) {
                    const imported = await importWorldActionProposal(
                      worldActionService,
                      sessionId,
                      proposal,
                      context,
                    );
                    if (imported.consume)
                      await unlink(proposal.file).catch(() => undefined);
                    if (imported.result.accepted)
                      executions.push(imported.result);
                  }
                  return executions.filter(
                    (execution) =>
                      execution.accepted &&
                      worldActionService.isBatchExecutable(
                        sessionId,
                        execution.envelope.batchId,
                      ),
                  );
                },
              }
            : {}),
        }
      : {}),
  });
  selectedRepository = () => server.currentRepositorySelection();
  let closePromise: Promise<void> | undefined;

  const closeOnce = (): Promise<void> => {
    closePromise ??= server.close();
    return closePromise;
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      process.stderr.write(
        `AgentIntersect World local server received ${signal}; stopping\n`,
      );
      void closeOnce()
        .then(() => {
          process.stderr.write("AgentIntersect World local server stopped\n");
          process.exitCode = 0;
        })
        .catch(() => {
          process.stderr.write(
            "AgentIntersect World local server could not stop cleanly\n",
          );
          process.exitCode = 1;
        });
    });
  }

  try {
    const address = await server.listen({
      host: config.host,
      port: config.port,
    });
    await integrationService.start();
    process.stdout.write(
      `AgentIntersect World local server ready at ${address} (bound at ${config.host}:${config.port}; network scope: ${config.networkScope})\n`,
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      process.stderr.write(
        `Port ${config.port} is already in use on ${config.host}. Choose another AIW_PORT or stop the existing listener.\n`,
      );
    } else {
      process.stderr.write(
        "AgentIntersect World local server failed to start\n",
      );
    }
    await closeOnce().catch(() => undefined);
    process.exitCode = 1;
  }
}

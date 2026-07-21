import {
  ConfigurationError,
  loadLocalServerConfig,
} from "@agentintersect-world/config/node";
import { AgentIntersectReadClient } from "@agentintersect-world/agentintersect-client/read";
import { WorldEventStore } from "@agentintersect-world/persistence";
import path from "node:path";

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
} from "./agent-sessions.js";

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

if (config !== undefined) {
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
      })
    : undefined;
  const agentAdapterRegistry = new AdapterRegistry(
    hermesAdapter ? [hermesAdapter] : [],
  );
  const agentSessionGateway = config.agentSessions
    ? new AgentSessionGateway({
        registry: agentAdapterRegistry,
        store: new AgentSessionStore(config.agentSessions.dataDir),
      })
    : undefined;
  const server = createLocalServer({
    config,
    integrationService,
    ...(commandIntentService ? { commandIntentService } : {}),
    ...(evidenceService ? { evidenceService } : {}),
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

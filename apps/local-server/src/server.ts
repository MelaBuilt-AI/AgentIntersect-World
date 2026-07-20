import { createHash, timingSafeEqual } from "node:crypto";
import net from "node:net";
import { resolve } from "node:path";

import {
  APP_METADATA,
  type LocalServerConfig,
} from "@agentintersect-world/config";
import {
  loadLocalServerConfig,
  toSafeConfig,
} from "@agentintersect-world/config/node";
import { createCorrelationId } from "@agentintersect-world/observability";
import { indexRepository } from "@agentintersect-world/repo-indexer";
import {
  PresentationValidationError,
  type PresentationIdentity,
} from "@agentintersect-world/sync-yjs";
import { PresentationSnapshotStore } from "@agentintersect-world/sync-yjs/node";
import {
  WorldProjectionError,
  projectRepositoryGeneration,
  queryWorldTiles,
} from "@agentintersect-world/spatial-code-graph";
import {
  CodeGraphCacheStore,
  CodeGraphGenerationEngine,
} from "@agentintersect-world/spatial-code-graph/node";
import {
  ApiErrorSchema,
  ApiResultSchema,
  CommandIntentListDataSchema,
  CommandIntentRecordSchema,
  CommandIntentRequestSchema,
  CorrelationIdSchema,
  DoctorDataSchema,
  EvidenceCurrentDataSchema,
  EvidenceLookupDataSchema,
  EvidenceLookupQuerySchema,
  HealthResponseSchema,
  OperationListDataSchema,
  OperationRecordSchema,
  OperationRequestSchema,
  ReadyDataSchema,
  CurrentRepositoryGenerationDataSchema,
  CurrentWorldSnapshotDataSchema,
  RepositoryIndexListDataSchema,
  RepositoryIndexOperationSchema,
  RepositoryIndexRequestSchema,
  SafeConfigSchema,
  WorldTileQueryResponseSchema,
  WorldTileQuerySchema,
  type ApiError,
  type CorrelationId,
  type DoctorData,
  type HealthResponse,
  type ReadyData,
  type RepositoryGeneration,
  type SafeConfig,
  type WorldSnapshot,
} from "@agentintersect-world/world-schema";
import swagger from "@fastify/swagger";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import { DemoOperationService, OperationServiceError } from "./operations.js";
import {
  RepositoryIndexService,
  RepositoryIndexServiceError,
} from "./repository-indexes.js";
import { ReadIntegrationService } from "./agentintersect-integration.js";
import {
  CommandIntentError,
  type CommandIntentService,
} from "./command-intents.js";
import {
  EvidenceServiceError,
  type EvidenceService,
} from "./evidence-service.js";
import { PresentationSyncService } from "./presentation-sync.js";
import { PresentationWebSocketTransport } from "./presentation-websocket.js";
import { CodeGraphService } from "./code-graph-service.js";
import { registerCodeGraphRoutes } from "./code-graph-routes.js";

type EvidenceReader = Pick<EvidenceService, "latest" | "lookup">;

export type CurrentRepositorySelection = {
  generation: RepositoryGeneration;
  snapshot: WorldSnapshot;
};

export type LocalServer = FastifyInstance & {
  readonly operationService: DemoOperationService;
  readonly repositoryIndexService: RepositoryIndexService;
  readonly integrationService: ReadIntegrationService;
  readonly commandIntentService?: CommandIntentService;
  readonly evidenceService?: EvidenceReader;
  readonly presentationService: PresentationSyncService;
  readonly codeGraphService: CodeGraphService;
  readonly currentRepositorySelection: () => CurrentRepositorySelection | null;
};

export type LocalServerOptions = {
  readonly config?: LocalServerConfig;
  readonly generateCorrelationId?: () => string;
  readonly repositoryIndexer?: typeof indexRepository;
  readonly integrationService?: ReadIntegrationService;
  readonly commandIntentService?: CommandIntentService;
  readonly evidenceService?: EvidenceReader;
  readonly presentationStore?: PresentationSnapshotStore;
  readonly presentationIdentity?: () => PresentationIdentity | null;
  readonly presentationObjects?: () => ReadonlyMap<string, string>;
  readonly codeGraphService?: CodeGraphService;
  readonly codeGraphDataDir?: string;
};

const metaSchema = "aiw.api/0.3" as const;

export function createLocalServer(
  options: LocalServerOptions = {},
): LocalServer {
  const server = Fastify({ logger: false, trustProxy: false });
  const config = options.config ?? loadLocalServerConfig();
  const safeConfig = SafeConfigSchema.parse(toSafeConfig(config));
  const generateCorrelationId =
    options.generateCorrelationId ?? createCorrelationId;
  const correlations = new WeakMap<FastifyRequest, CorrelationId>();
  const operationService = new DemoOperationService(config.demoOperationMaxMs);
  const integrationService =
    options.integrationService ??
    new ReadIntegrationService({ enabled: false });
  const commandIntentService = options.commandIntentService;
  const evidenceService = options.evidenceService;
  const codeGraphService =
    options.codeGraphService ??
    new CodeGraphService(
      new CodeGraphGenerationEngine({
        store: new CodeGraphCacheStore(
          options.codeGraphDataDir ??
            resolve(config.presentationSync.dataDir, "..", "code-graph"),
        ),
      }),
    );
  let cachedWorldSnapshot: WorldSnapshot | undefined;
  let cachedGenerationId: string | undefined;
  let cachedProjectionError: unknown;
  const projectSuccessfulGeneration = (
    generation: NonNullable<ReturnType<RepositoryIndexService["current"]>>,
  ) => {
    try {
      const snapshot = projectRepositoryGeneration(
        generation,
        cachedWorldSnapshot ? { previousSnapshot: cachedWorldSnapshot } : {},
      );
      cachedWorldSnapshot = snapshot;
      cachedProjectionError = undefined;
      void codeGraphService.indexGeneration(generation, snapshot);
    } catch (error) {
      cachedProjectionError = error;
    }
    cachedGenerationId = generation.id;
  };
  const repositoryIndexService = new RepositoryIndexService(
    config.repositoryMaxFiles,
    20,
    options.repositoryIndexer ?? indexRepository,
    projectSuccessfulGeneration,
  );
  const currentRepositorySelection = (): CurrentRepositorySelection | null => {
    const generation = repositoryIndexService.current();
    if (generation === null) return null;
    if (cachedGenerationId !== generation.id)
      projectSuccessfulGeneration(generation);
    if (cachedProjectionError !== undefined) throw cachedProjectionError;
    if (!cachedWorldSnapshot)
      throw new WorldProjectionError(
        "invalid_generation",
        "Current generation could not produce a World snapshot",
      );
    return { generation, snapshot: cachedWorldSnapshot };
  };
  const presentationService = new PresentationSyncService({
    store:
      options.presentationStore ??
      new PresentationSnapshotStore({
        directory: config.presentationSync.dataDir,
      }),
    identity:
      options.presentationIdentity ??
      (() => {
        const selection = currentRepositorySelection();
        return selection
          ? {
              workspaceId: selection.snapshot.workspaceRef.slice(
                "aiw://object/".length,
              ),
              repositoryId: selection.snapshot.repositoryRef.slice(
                "aiw://object/".length,
              ),
            }
          : null;
      }),
    ...(options.presentationObjects
      ? { objects: options.presentationObjects }
      : {}),
  });
  let presentationTransport: PresentationWebSocketTransport | undefined;
  server.decorate("operationService", operationService);
  server.decorate("repositoryIndexService", repositoryIndexService);
  server.decorate("integrationService", integrationService);
  server.decorate("commandIntentService", commandIntentService);
  server.decorate("evidenceService", evidenceService);
  server.decorate("presentationService", presentationService);
  server.decorate("codeGraphService", codeGraphService);
  server.decorate("currentRepositorySelection", currentRepositorySelection);
  server.addHook("onReady", async () => {
    await codeGraphService.initialize();
  });
  server.addHook("preClose", () => {
    presentationTransport?.close();
  });
  server.addHook("onClose", async () => {
    operationService.close();
    await repositoryIndexService.close();
    await integrationService.close();
    presentationService.close();
    await codeGraphService.close();
  });

  const correlationFor = (request: FastifyRequest): CorrelationId => {
    const correlationId = correlations.get(request);
    if (correlationId === undefined) {
      throw new Error("correlation hook did not run");
    }
    return correlationId;
  };

  const success = <T>(request: FastifyRequest, data: T) => ({
    ok: true as const,
    data,
    meta: { correlationId: correlationFor(request), schema: metaSchema },
  });

  const failure = (
    request: FastifyRequest,
    code: ApiError["error"]["code"],
    message: string,
    retryable = false,
  ): ApiError =>
    ApiErrorSchema.parse({
      ok: false,
      error: { code, message, retryable },
      meta: { correlationId: correlationFor(request), schema: metaSchema },
    });

  server.addHook("onRequest", async (request, reply) => {
    const supplied = request.headers["x-correlation-id"];
    const parsed =
      typeof supplied === "string"
        ? CorrelationIdSchema.safeParse(supplied)
        : { success: false as const };
    const correlationId = CorrelationIdSchema.parse(
      parsed.success ? parsed.data : generateCorrelationId(),
    );
    correlations.set(request, correlationId);
    void reply.header("x-correlation-id", correlationId);
  });

  server.setNotFoundHandler(async (request, reply) =>
    reply.code(404).send(failure(request, "not_found", "Route not found")),
  );

  server.setErrorHandler(async (error, request, reply) => {
    const validation =
      typeof error === "object" && error !== null && "validation" in error;
    return reply
      .code(validation ? 400 : 500)
      .send(
        failure(
          request,
          validation ? "validation" : "internal",
          validation ? "Request validation failed" : "Internal server error",
        ),
      );
  });

  void server.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "AgentIntersect World Local Authority API",
        version: APP_METADATA.version,
      },
    },
  });

  server.after(() => {
    const runtime = { name: "node" as const, version: process.version };

    registerCodeGraphRoutes(server, codeGraphService, { success, failure });

    server.get<{ Reply: HealthResponse }>("/health", async (request, reply) => {
      const correlationId = correlationFor(request);
      const health = HealthResponseSchema.parse({
        service: "agentintersect-world-local-server",
        status: "ok",
        version: APP_METADATA.version,
        runtime,
        correlationId,
      });
      return reply.send(health);
    });

    server.get("/ready", async (request) => {
      const data: ReadyData = ReadyDataSchema.parse({
        service: "agentintersect-world-local-server",
        status: "ready",
        version: APP_METADATA.version,
        runtime,
        config: safeConfig,
      });
      return ApiResultSchema(ReadyDataSchema).parse(success(request, data));
    });

    server.get("/config", async (request) =>
      ApiResultSchema(SafeConfigSchema).parse(
        success<SafeConfig>(request, safeConfig),
      ),
    );

    server.get("/doctor", async (request) => {
      const data: DoctorData = DoctorDataSchema.parse({
        status: "ready",
        checks: [
          {
            name: "runtime",
            status: "pass",
            message: `Node ${process.versions.node} is ready`,
          },
          {
            name: "configuration",
            status: "pass",
            message: `${config.networkScope} configuration is valid`,
          },
          {
            name: "operation-service",
            status: "pass",
            message: "In-memory demo operation service is ready",
          },
        ],
      });
      return ApiResultSchema(DoctorDataSchema).parse(success(request, data));
    });

    const integrationRoute = {
      schema: {
        tags: ["agentintersect-read-integration"],
        summary: "Read-only Phase 6 integration projection",
      },
    } as const;
    server.get("/integration/state", integrationRoute, async (request) =>
      success(request, integrationService.markStaleIfNeeded()),
    );
    server.get("/integration/phase-board", integrationRoute, async (request) =>
      success(request, integrationService.snapshot().projection.phaseBoard),
    );
    server.get("/integration/roster", integrationRoute, async (request) =>
      success(request, {
        roster: integrationService.snapshot().projection.roster,
      }),
    );
    server.get(
      "/integration/timeline",
      {
        schema: {
          tags: ["agentintersect-read-integration"],
          querystring: {
            type: "object",
            additionalProperties: false,
            properties: {
              limit: {
                type: "integer",
                minimum: 1,
                maximum: 500,
                default: 200,
              },
            },
          },
        },
      },
      async (request) => {
        const query = request.query as { limit?: number };
        const timeline = integrationService
          .snapshot()
          .projection.timeline.slice(-(query.limit ?? 200));
        return success(request, { timeline });
      },
    );
    server.get("/integration/replay", integrationRoute, async (request) => {
      const snapshot = integrationService.snapshot();
      return success(request, {
        replay: snapshot.replay,
        reconciliation: snapshot.reconciliation,
      });
    });
    server.get(
      "/integration/harness/:harness/readiness",
      {
        schema: {
          tags: ["agentintersect-read-integration"],
          params: {
            type: "object",
            required: ["harness"],
            additionalProperties: false,
            properties: {
              harness: {
                type: "string",
                enum: ["openclaw", "hermes", "claude-code", "codex"],
              },
            },
          },
        },
      },
      async (request) => {
        const { harness } = request.params as { harness: string };
        return success(request, integrationService.harnessReadiness(harness));
      },
    );

    const commandFailure = (
      error: unknown,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      if (!(error instanceof CommandIntentError)) throw error;
      const statusCode =
        error.code === "validation"
          ? 400
          : error.code === "conflict"
            ? 409
            : error.code === "not_found"
              ? 404
              : error.code === "authority_unavailable"
                ? 503
                : 502;
      const apiCode =
        error.code === "store_corrupt"
          ? "authority_unavailable"
          : error.code === "upstream"
            ? "upstream"
            : error.code;
      return reply
        .code(statusCode)
        .send(failure(request, apiCode, error.message));
    };

    const isAllowedCommandAddress = (address: string): boolean => {
      const normalized = address.startsWith("::ffff:")
        ? address.slice("::ffff:".length)
        : address;
      if (
        normalized === "127.0.0.1" ||
        normalized === "::1" ||
        normalized.startsWith("127.")
      )
        return true;
      if (config.networkScope !== "lan") return false;
      if (net.isIPv4(normalized)) {
        const [first = 0, second = 0] = normalized
          .split(".")
          .map((part) => Number(part));
        return (
          first === 10 ||
          (first === 172 && second >= 16 && second <= 31) ||
          (first === 192 && second === 168) ||
          (first === 169 && second === 254)
        );
      }
      const lower = normalized.toLowerCase();
      return (
        net.isIPv6(lower) &&
        (lower.startsWith("fc") ||
          lower.startsWith("fd") ||
          lower.startsWith("fe8") ||
          lower.startsWith("fe9") ||
          lower.startsWith("fea") ||
          lower.startsWith("feb"))
      );
    };
    presentationTransport ??= new PresentationWebSocketTransport({
      server: server.server,
      service: presentationService,
      allowedOrigin: config.presentationSync.allowedOrigin,
      allowedHost: config.presentationSync.allowedHost,
      isAllowedAddress: isAllowedCommandAddress,
    });

    const sameCommandToken = (supplied: string, expected: string): boolean => {
      const digest = (value: string) =>
        createHash("sha256").update(value).digest();
      return timingSafeEqual(digest(supplied), digest(expected));
    };

    const authorizeCommand = async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      if (!config.agentIntersectCommands || !commandIntentService)
        return reply
          .code(503)
          .send(
            failure(
              request,
              "authority_unavailable",
              "AgentIntersect command authority is disabled",
            ),
          );
      if (!isAllowedCommandAddress(request.ip))
        return reply
          .code(403)
          .send(
            failure(
              request,
              "forbidden",
              "Command client is outside the configured loopback/trusted-LAN scope",
            ),
          );
      const header = request.headers.authorization;
      const supplied =
        typeof header === "string" && header.startsWith("Bearer ")
          ? header.slice("Bearer ".length)
          : "";
      if (!sameCommandToken(supplied, config.agentIntersectCommands.token))
        return reply
          .code(401)
          .send(
            failure(
              request,
              "unauthorized",
              "A valid dedicated command bearer token is required",
            ),
          );
    };

    const authorizePresentation = async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      if (!isAllowedCommandAddress(request.ip)) {
        return reply
          .code(403)
          .send(
            failure(
              request,
              "forbidden",
              "Presentation client is outside the configured loopback/trusted-LAN scope",
            ),
          );
      }
      if (
        request.headers.origin !== config.presentationSync.allowedOrigin ||
        request.headers.host !== config.presentationSync.allowedHost
      ) {
        return reply
          .code(403)
          .send(
            failure(
              request,
              "forbidden",
              "Presentation Origin and Host must exactly match local configuration",
            ),
          );
      }
      if (config.networkScope === "lan") {
        const header = request.headers.authorization;
        const supplied =
          typeof header === "string" && header.startsWith("Bearer ")
            ? header.slice("Bearer ".length)
            : "";
        if (
          !config.presentationSync.bearerToken ||
          !sameCommandToken(supplied, config.presentationSync.bearerToken)
        ) {
          return reply
            .code(401)
            .send(
              failure(
                request,
                "unauthorized",
                "A valid dedicated presentation bearer token is required",
              ),
            );
        }
      }
    };

    const presentationFailure = (
      error: unknown,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      if (!(error instanceof PresentationValidationError)) throw error;
      return reply
        .code(400)
        .send(failure(request, "validation", error.message));
    };

    const presentationRoute = {
      onRequest: authorizePresentation,
      schema: { tags: ["phase9-presentation-sync"] },
    } as const;

    server.get(
      "/presentation/status",
      {
        ...presentationRoute,
        schema: {
          tags: ["phase9-presentation-sync"],
          summary: "Get local presentation synchronization capability status",
        },
      },
      async (request) =>
        success(request, {
          ...presentationService.capabilityStatus(config.networkScope),
          transport: safeConfig.presentationSync.transport,
          encrypted: safeConfig.presentationSync.encrypted,
          unencryptedLanWarning:
            safeConfig.presentationSync.unencryptedLanWarning,
        }),
    );

    server.post(
      "/presentation/tickets",
      {
        ...presentationRoute,
        schema: {
          tags: ["phase9-presentation-sync"],
          summary: "Issue a short-lived single-use presentation join ticket",
          body: {
            type: "object",
            additionalProperties: false,
            required: ["documentId"],
            properties: {
              documentId: {
                type: "string",
                pattern: "^doc_[a-f0-9]{32}$",
              },
            },
          },
        },
      },
      async (request, reply) => {
        try {
          const { documentId } = request.body as { documentId: string };
          return reply.code(201).send(
            success(request, {
              ...presentationService.issueTicket(documentId),
              documentId,
              websocketPath: "/presentation-sync",
            }),
          );
        } catch (error) {
          return presentationFailure(error, request, reply);
        }
      },
    );

    const presentationDocumentParams = {
      type: "object",
      additionalProperties: false,
      required: ["documentId"],
      properties: {
        documentId: { type: "string", pattern: "^doc_[a-f0-9]{32}$" },
      },
    } as const;

    server.get(
      "/presentation/documents/:documentId/export",
      {
        ...presentationRoute,
        schema: {
          tags: ["phase9-presentation-sync"],
          summary: "Export deterministic sanitized presentation JSON",
          params: presentationDocumentParams,
        },
      },
      async (request, reply) => {
        try {
          const { documentId } = request.params as { documentId: string };
          return reply
            .type("application/json; charset=utf-8")
            .header(
              "content-disposition",
              `attachment; filename="${documentId}.presentation.json"`,
            )
            .send(await presentationService.export(documentId));
        } catch (error) {
          return presentationFailure(error, request, reply);
        }
      },
    );

    server.delete(
      "/presentation/documents/:documentId",
      {
        ...presentationRoute,
        schema: {
          tags: ["phase9-presentation-sync"],
          summary: "Delete exact local presentation document state",
          params: presentationDocumentParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["documentId", "confirmed"],
            properties: {
              documentId: {
                type: "string",
                pattern: "^doc_[a-f0-9]{32}$",
              },
              confirmed: { type: "boolean" },
            },
          },
        },
      },
      async (request, reply) => {
        try {
          const { documentId } = request.params as { documentId: string };
          const confirmation = request.body as {
            documentId: string;
            confirmed: boolean;
          };
          await presentationService.delete(documentId, confirmation);
          presentationTransport?.deleteDocument(documentId);
          return success(request, { documentId, deleted: true });
        } catch (error) {
          return presentationFailure(error, request, reply);
        }
      },
    );

    server.post(
      "/commands/intents",
      {
        onRequest: authorizeCommand,
        schema: {
          tags: ["phase7-command-intents"],
          headers: {
            type: "object",
            required: ["idempotency-key"],
            properties: {
              "idempotency-key": {
                type: "string",
                minLength: 1,
                maxLength: 128,
                pattern: "^[ -~]+$",
              },
            },
          },
          body: {
            type: "object",
            additionalProperties: false,
            required: [
              "schema",
              "kind",
              "phaseId",
              "harness",
              "expectedRevision",
              "fixture",
            ],
            properties: {
              schema: {
                type: "string",
                const: "aiw.command-intent.request/0.7",
              },
              kind: { type: "string", const: "worker.enqueue-phase" },
              phaseId: { type: "string", minLength: 1, maxLength: 128 },
              harness: {
                type: "string",
                enum: ["openclaw", "hermes", "claude-code", "codex"],
              },
              expectedRevision: {
                type: "string",
                minLength: 1,
                maxLength: 128,
              },
              fixture: {
                type: "string",
                const: "phase7-disposable-artifact-v1",
              },
            },
          },
        },
      },
      async (request, reply) => {
        try {
          if (!commandIntentService)
            throw new CommandIntentError(
              "authority_unavailable",
              "AgentIntersect command authority is disabled",
            );
          commandIntentService.reconcile(
            integrationService.snapshot().projection,
          );
          const body = CommandIntentRequestSchema.parse(request.body);
          const key = request.headers["idempotency-key"];
          const submitted = await commandIntentService.submit(
            typeof key === "string" ? key : "",
            body,
            correlationFor(request),
          );
          if (submitted.replay)
            void reply.header("x-idempotent-replay", "true");
          return reply
            .code(submitted.replay ? 200 : 202)
            .send(
              ApiResultSchema(CommandIntentRecordSchema).parse(
                success(request, submitted.intent),
              ),
            );
        } catch (error) {
          if (error instanceof CommandIntentError)
            return commandFailure(error, request, reply);
          return reply
            .code(400)
            .send(failure(request, "validation", "Command intent is invalid"));
        }
      },
    );
    server.get(
      "/commands/intents",
      { schema: { tags: ["phase7-command-intents"] } },
      async (request) => {
        const intents = commandIntentService
          ? commandIntentService.reconcile(
              integrationService.snapshot().projection,
            )
          : [];
        return ApiResultSchema(CommandIntentListDataSchema).parse(
          success(request, { intents }),
        );
      },
    );
    server.get(
      "/commands/intents/:id",
      {
        schema: {
          tags: ["phase7-command-intents"],
          params: {
            type: "object",
            required: ["id"],
            properties: { id: { type: "string", format: "uuid" } },
          },
        },
      },
      async (request, reply) => {
        try {
          if (!commandIntentService)
            throw new CommandIntentError(
              "not_found",
              "Command intent not found",
            );
          commandIntentService.reconcile(
            integrationService.snapshot().projection,
          );
          const { id } = request.params as { id: string };
          return ApiResultSchema(CommandIntentRecordSchema).parse(
            success(request, commandIntentService.require(id)),
          );
        } catch (error) {
          return commandFailure(error, request, reply);
        }
      },
    );

    const evidenceResponses = {
      200: {
        description: "Correlated strict sanitized Phase 8 evidence payload",
        type: "object",
        additionalProperties: true,
      },
      400: {
        description: "Evidence lookup identity is malformed or not exclusive",
        type: "object",
        additionalProperties: true,
      },
      404: {
        description: "No evidence matches the exact identity",
        type: "object",
        additionalProperties: true,
      },
      503: {
        description: "Local evidence storage is unavailable or corrupt",
        type: "object",
        additionalProperties: true,
      },
    } as const;

    server.get(
      "/evidence/current",
      {
        schema: {
          tags: ["phase8-evidence"],
          summary: "Get current and previous sanitized local evidence",
          response: {
            200: evidenceResponses[200],
            503: evidenceResponses[503],
          },
        },
      },
      async (request) =>
        ApiResultSchema(EvidenceCurrentDataSchema).parse(
          success(
            request,
            evidenceService?.latest() ?? { current: null, previous: null },
          ),
        ),
    );

    server.get(
      "/evidence",
      {
        onRequest: async (request, reply) => {
          const search = new URL(request.raw.url ?? "/evidence", "http://local")
            .searchParams;
          if (
            [...search.keys()].some(
              (key) => !["intentId", "jobId", "runId"].includes(key),
            )
          )
            return reply
              .code(400)
              .send(
                failure(
                  request,
                  "validation",
                  "Evidence lookup contains an unsupported parameter",
                ),
              );
        },
        schema: {
          tags: ["phase8-evidence"],
          summary: "Look up sanitized local evidence by one exact identity",
          querystring: {
            type: "object",
            additionalProperties: false,
            properties: {
              intentId: { type: "string", format: "uuid" },
              jobId: {
                type: "string",
                minLength: 1,
                maxLength: 128,
                pattern: "^[ -~]+$",
              },
              runId: {
                type: "string",
                minLength: 1,
                maxLength: 128,
                pattern: "^[ -~]+$",
              },
            },
          },
          response: evidenceResponses,
        },
      },
      async (request, reply) => {
        const parsed = EvidenceLookupQuerySchema.safeParse(request.query);
        if (!parsed.success)
          return reply
            .code(400)
            .send(
              failure(
                request,
                "validation",
                "Exactly one valid intentId, jobId, or runId is required",
              ),
            );
        if (!evidenceService)
          return reply
            .code(503)
            .send(
              failure(
                request,
                "authority_unavailable",
                "Local evidence storage is unavailable",
              ),
            );
        try {
          return ApiResultSchema(EvidenceLookupDataSchema).parse(
            success(request, evidenceService.lookup(parsed.data)),
          );
        } catch (error) {
          if (!(error instanceof EvidenceServiceError)) throw error;
          return reply
            .code(error.code === "not_found" ? 404 : 503)
            .send(
              failure(
                request,
                error.code === "not_found"
                  ? "not_found"
                  : "authority_unavailable",
                error.message,
              ),
            );
        }
      },
    );

    const repositoryIndexRouteSchema = {
      tags: ["repository-indexes"],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    } as const;

    const openApiEnvelope = {
      type: "object",
      additionalProperties: true,
    } as const;

    const worldResponses = {
      200: {
        description: "Correlated strict Phase 4 World payload",
        ...openApiEnvelope,
      },
      400: {
        description: "Current generation cannot satisfy World projection",
        ...openApiEnvelope,
      },
      404: {
        description: "No successful repository generation is available",
        ...openApiEnvelope,
      },
      409: {
        description: "Current generation cannot be projected without collision",
        ...openApiEnvelope,
      },
    } as const;

    const currentWorldSnapshot = (): WorldSnapshot | null => {
      return currentRepositorySelection()?.snapshot ?? null;
    };

    const worldProjectionFailure = (
      error: unknown,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      if (!(error instanceof WorldProjectionError)) throw error;
      const validation = error.code !== "canonical_collision";
      return reply
        .code(validation ? 400 : 409)
        .send(
          failure(
            request,
            validation ? "validation" : "conflict",
            error.message,
          ),
        );
    };

    server.get(
      "/world/current",
      {
        schema: {
          tags: ["world"],
          summary: "Get the current deterministic World snapshot",
          response: worldResponses,
        },
      },
      async (request, reply) => {
        try {
          const snapshot = currentWorldSnapshot();
          if (snapshot === null)
            return reply
              .code(404)
              .send(
                failure(
                  request,
                  "not_found",
                  "No successful repository generation is available",
                ),
              );
          return ApiResultSchema(CurrentWorldSnapshotDataSchema).parse(
            success(request, { snapshot }),
          );
        } catch (error) {
          return worldProjectionFailure(error, request, reply);
        }
      },
    );

    server.get(
      "/world/tiles",
      {
        preValidation: async (request, reply) => {
          const allowed = new Set([
            "lod",
            "minX",
            "maxX",
            "minZ",
            "maxZ",
            "limit",
          ]);
          const query = request.query as Record<string, unknown>;
          if (Object.keys(query).some((key) => !allowed.has(key)))
            return reply
              .code(400)
              .send(
                failure(
                  request,
                  "validation",
                  "Tile query is malformed or out of range",
                ),
              );
        },
        schema: {
          tags: ["world"],
          summary: "Query bounded deterministic World LOD tiles",
          querystring: {
            type: "object",
            required: ["lod", "minX", "maxX", "minZ", "maxZ", "limit"],
            additionalProperties: false,
            properties: {
              lod: { type: "integer", minimum: 0, maximum: 4 },
              minX: { type: "integer", minimum: 0, maximum: 15 },
              maxX: { type: "integer", minimum: 0, maximum: 15 },
              minZ: { type: "integer", minimum: 0, maximum: 15 },
              maxZ: { type: "integer", minimum: 0, maximum: 15 },
              limit: { type: "integer", minimum: 1, maximum: 128 },
            },
          },
          response: {
            ...worldResponses,
            400: {
              description: "Malformed or out-of-range bounded tile query",
              ...openApiEnvelope,
            },
          },
        },
      },
      async (request, reply) => {
        const parsedQuery = WorldTileQuerySchema.safeParse(request.query);
        if (!parsedQuery.success)
          return reply
            .code(400)
            .send(
              failure(
                request,
                "validation",
                "Tile query is malformed or out of range",
              ),
            );
        try {
          const snapshot = currentWorldSnapshot();
          if (snapshot === null)
            return reply
              .code(404)
              .send(
                failure(
                  request,
                  "not_found",
                  "No successful repository generation is available",
                ),
              );
          return ApiResultSchema(WorldTileQueryResponseSchema).parse(
            success(request, queryWorldTiles(snapshot, parsedQuery.data)),
          );
        } catch (error) {
          return worldProjectionFailure(error, request, reply);
        }
      },
    );

    const repositoryIndexFailure = (
      error: unknown,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      if (!(error instanceof RepositoryIndexServiceError)) throw error;
      const statusCode =
        error.code === "validation"
          ? 400
          : error.code === "conflict"
            ? 409
            : 404;
      return reply
        .code(statusCode)
        .send(failure(request, error.code, error.message));
    };

    server.post(
      "/repository-indexes",
      {
        schema: {
          tags: ["repository-indexes"],
          headers: {
            type: "object",
            required: ["idempotency-key"],
            properties: {
              "idempotency-key": {
                type: "string",
                minLength: 1,
                maxLength: 128,
              },
            },
          },
          body: {
            type: "object",
            required: ["rootPath"],
            additionalProperties: false,
            properties: {
              rootPath: { type: "string", minLength: 1, maxLength: 4096 },
            },
          },
        },
      },
      async (request, reply) => {
        try {
          const body = RepositoryIndexRequestSchema.parse(request.body);
          const key = request.headers["idempotency-key"];
          const created = repositoryIndexService.create(
            typeof key === "string" ? key : undefined,
            body,
          );
          if (created.replay) void reply.header("x-idempotent-replay", "true");
          return reply
            .code(created.replay ? 200 : 202)
            .send(
              ApiResultSchema(RepositoryIndexOperationSchema).parse(
                success(request, created.operation),
              ),
            );
        } catch (error) {
          if (error instanceof RepositoryIndexServiceError)
            return repositoryIndexFailure(error, request, reply);
          return reply
            .code(400)
            .send(failure(request, "validation", "Request validation failed"));
        }
      },
    );
    server.get(
      "/repository-indexes",
      { schema: { tags: ["repository-indexes"] } },
      async (request) =>
        ApiResultSchema(RepositoryIndexListDataSchema).parse(
          success(request, { operations: repositoryIndexService.list() }),
        ),
    );
    server.get(
      "/repository-indexes/current",
      { schema: { tags: ["repository-indexes"] } },
      async (request) =>
        ApiResultSchema(CurrentRepositoryGenerationDataSchema).parse(
          success(request, { generation: repositoryIndexService.current() }),
        ),
    );
    server.get(
      "/repository-indexes/:id",
      { schema: repositoryIndexRouteSchema },
      async (request, reply) => {
        try {
          const { id } = request.params as { id: string };
          return ApiResultSchema(RepositoryIndexOperationSchema).parse(
            success(request, repositoryIndexService.require(id)),
          );
        } catch (error) {
          return repositoryIndexFailure(error, request, reply);
        }
      },
    );
    server.post(
      "/repository-indexes/:id/cancel",
      { schema: repositoryIndexRouteSchema },
      async (request, reply) => {
        try {
          const { id } = request.params as { id: string };
          return ApiResultSchema(RepositoryIndexOperationSchema).parse(
            success(request, repositoryIndexService.cancel(id)),
          );
        } catch (error) {
          return repositoryIndexFailure(error, request, reply);
        }
      },
    );

    const operationRouteSchema = {
      tags: ["operations"],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    } as const;

    const operationFailure = (
      error: unknown,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      if (!(error instanceof OperationServiceError)) throw error;
      const statusCode =
        error.code === "validation"
          ? 400
          : error.code === "conflict"
            ? 409
            : 404;
      return reply
        .code(statusCode)
        .send(failure(request, error.code, error.message));
    };

    server.post(
      "/operations",
      {
        schema: {
          tags: ["operations"],
          body: {
            type: "object",
            required: ["kind", "durationMs"],
            additionalProperties: false,
            properties: {
              kind: { type: "string", enum: ["demo-delay"] },
              durationMs: { type: "integer", minimum: 1 },
              label: { type: "string", minLength: 1, maxLength: 80 },
            },
          },
        },
      },
      async (request, reply) => {
        try {
          const body = OperationRequestSchema.parse(request.body);
          const idempotencyKey = request.headers["idempotency-key"];
          const created = operationService.create(
            typeof idempotencyKey === "string" ? idempotencyKey : undefined,
            body,
          );
          if (created.replay) void reply.header("x-idempotent-replay", "true");
          return reply
            .code(created.replay ? 200 : 202)
            .send(
              ApiResultSchema(OperationRecordSchema).parse(
                success(request, created.operation),
              ),
            );
        } catch (error) {
          if (error instanceof OperationServiceError)
            return operationFailure(error, request, reply);
          return reply
            .code(400)
            .send(failure(request, "validation", "Request validation failed"));
        }
      },
    );
    server.get(
      "/operations",
      { schema: { tags: ["operations"] } },
      async (request) =>
        ApiResultSchema(OperationListDataSchema).parse(
          success(request, { operations: operationService.list() }),
        ),
    );
    server.get(
      "/operations/:id",
      { schema: operationRouteSchema },
      async (request, reply) => {
        try {
          const { id } = request.params as { id: string };
          return ApiResultSchema(OperationRecordSchema).parse(
            success(request, operationService.require(id)),
          );
        } catch (error) {
          return operationFailure(error, request, reply);
        }
      },
    );
    server.post(
      "/operations/:id/cancel",
      { schema: operationRouteSchema },
      async (request, reply) => {
        try {
          const { id } = request.params as { id: string };
          return ApiResultSchema(OperationRecordSchema).parse(
            success(request, operationService.cancel(id)),
          );
        } catch (error) {
          return operationFailure(error, request, reply);
        }
      },
    );

    server.get("/openapi.json", async (_request, reply) =>
      reply.type("application/json").send(server.swagger()),
    );
  });

  return server as unknown as LocalServer;
}

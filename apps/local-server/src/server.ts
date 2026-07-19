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
  WorldProjectionError,
  projectRepositoryGeneration,
  queryWorldTiles,
} from "@agentintersect-world/spatial-code-graph";
import {
  ApiErrorSchema,
  ApiResultSchema,
  CorrelationIdSchema,
  DoctorDataSchema,
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

export type LocalServer = FastifyInstance & {
  readonly operationService: DemoOperationService;
  readonly repositoryIndexService: RepositoryIndexService;
};

export type LocalServerOptions = {
  readonly config?: LocalServerConfig;
  readonly generateCorrelationId?: () => string;
  readonly repositoryIndexer?: typeof indexRepository;
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
  server.decorate("operationService", operationService);
  server.decorate("repositoryIndexService", repositoryIndexService);
  server.addHook("onClose", async () => {
    operationService.close();
    await repositoryIndexService.close();
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
      return cachedWorldSnapshot;
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

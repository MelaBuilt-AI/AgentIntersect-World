import {
  APP_METADATA,
  type LocalServerConfig,
} from "@agentintersect-world/config";
import {
  loadLocalServerConfig,
  toSafeConfig,
} from "@agentintersect-world/config/node";
import { createCorrelationId } from "@agentintersect-world/observability";
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
  SafeConfigSchema,
  type ApiError,
  type CorrelationId,
  type DoctorData,
  type HealthResponse,
  type ReadyData,
  type SafeConfig,
} from "@agentintersect-world/world-schema";
import swagger from "@fastify/swagger";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import { DemoOperationService, OperationServiceError } from "./operations.js";

export type LocalServer = FastifyInstance & {
  readonly operationService: DemoOperationService;
};

export type LocalServerOptions = {
  readonly config?: LocalServerConfig;
  readonly generateCorrelationId?: () => string;
};

const metaSchema = "aiw.api/0.2" as const;

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
  server.decorate("operationService", operationService);
  server.addHook("onClose", async () => operationService.close());

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

import {
  ApiResultSchema,
  CodeGraphAggregateDataSchema,
  CodeGraphAggregateQuerySchema,
  CodeGraphCurrentDataSchema,
  FocusedFileGraphQuerySchema,
  FocusedFileGraphSchema,
  type ApiError,
} from "@agentintersect-world/world-schema";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  CodeGraphService,
  CodeGraphServiceError,
} from "./code-graph-service.js";

type RouteEnvelopes = {
  readonly success: <T>(request: FastifyRequest, data: T) => unknown;
  readonly failure: (
    request: FastifyRequest,
    code: ApiError["error"]["code"],
    message: string,
    retryable?: boolean,
  ) => ApiError;
};

const envelopeSchema = { type: "object", additionalProperties: true } as const;
const responses = {
  200: {
    description: "Strict path-private Phase 10 graph payload",
    ...envelopeSchema,
  },
  400: {
    description: "Malformed or forbidden graph detail request",
    ...envelopeSchema,
  },
  404: {
    description: "No matching current graph/file exists",
    ...envelopeSchema,
  },
  503: {
    description: "Graph generation is in progress or unavailable",
    ...envelopeSchema,
  },
} as const;

export function registerCodeGraphRoutes(
  server: FastifyInstance,
  service: CodeGraphService,
  envelopes: RouteEnvelopes,
): void {
  const fail = (
    error: unknown,
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    if (!(error instanceof CodeGraphServiceError)) throw error;
    const status =
      error.code === "validation"
        ? 400
        : error.code === "not_found"
          ? 404
          : 503;
    const code =
      error.code === "validation"
        ? "validation"
        : error.code === "not_found"
          ? "not_found"
          : "authority_unavailable";
    return reply
      .code(status)
      .send(envelopes.failure(request, code, error.message));
  };

  server.get(
    "/code-graph/current",
    {
      schema: {
        tags: ["code-graph"],
        summary:
          "Get current/previous Phase 10 parser coverage and graph status",
        response: responses,
      },
    },
    async (request) =>
      ApiResultSchema(CodeGraphCurrentDataSchema).parse(
        envelopes.success(request, service.status()),
      ),
  );

  server.get(
    "/code-graph/aggregates",
    {
      preValidation: async (request, reply) => {
        const query = request.query as Record<string, unknown>;
        if (Object.keys(query).some((key) => !["lod", "limit"].includes(key)))
          return reply
            .code(400)
            .send(
              envelopes.failure(
                request,
                "validation",
                "Whole-repository symbol detail is forbidden; request bounded LOD 0-2 aggregates",
              ),
            );
      },
      schema: {
        tags: ["code-graph"],
        summary: "Get bounded LOD 0-2 dependency aggregates",
        querystring: {
          type: "object",
          required: ["lod", "limit"],
          additionalProperties: false,
          properties: {
            lod: { type: "integer", minimum: 0, maximum: 2 },
            limit: { type: "integer", minimum: 1, maximum: 1024 },
          },
        },
        response: responses,
      },
    },
    async (request, reply) => {
      const parsed = CodeGraphAggregateQuerySchema.safeParse(request.query);
      if (!parsed.success)
        return reply
          .code(400)
          .send(
            envelopes.failure(
              request,
              "validation",
              "Aggregate query is malformed",
            ),
          );
      try {
        return ApiResultSchema(CodeGraphAggregateDataSchema).parse(
          envelopes.success(
            request,
            service.aggregate(parsed.data.lod, parsed.data.limit),
          ),
        );
      } catch (error) {
        return fail(error, request, reply);
      }
    },
  );

  server.get(
    "/code-graph/files/:fileId",
    {
      preValidation: async (request, reply) => {
        const query = request.query as Record<string, unknown>;
        if (Object.keys(query).some((key) => key !== "lod"))
          return reply
            .code(400)
            .send(
              envelopes.failure(
                request,
                "validation",
                "Only one focused file may request symbol detail",
              ),
            );
      },
      schema: {
        tags: ["code-graph"],
        summary: "Get LOD 3-4 symbols for one focused authoritative file",
        params: {
          type: "object",
          required: ["fileId"],
          additionalProperties: false,
          properties: { fileId: { type: "string", pattern: "^[0-9a-f]{32}$" } },
        },
        querystring: {
          type: "object",
          required: ["lod"],
          additionalProperties: false,
          properties: { lod: { type: "integer", minimum: 3, maximum: 4 } },
        },
        response: responses,
      },
    },
    async (request, reply) => {
      const query = FocusedFileGraphQuerySchema.safeParse(request.query);
      const { fileId } = request.params as { fileId: string };
      if (!query.success || !/^[0-9a-f]{32}$/u.test(fileId))
        return reply
          .code(400)
          .send(
            envelopes.failure(
              request,
              "validation",
              "Focused-file query is malformed",
            ),
          );
      try {
        return ApiResultSchema(FocusedFileGraphSchema).parse(
          envelopes.success(request, service.focused(`aiw://object/${fileId}`)),
        );
      } catch (error) {
        return fail(error, request, reply);
      }
    },
  );
}

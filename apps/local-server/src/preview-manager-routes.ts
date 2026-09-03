import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  PreviewManagerService,
  PreviewManagerServiceError,
} from "./preview-manager-service.js";

type RouteEnvelope = {
  readonly success: <T>(request: FastifyRequest, data: T) => unknown;
  readonly failure: (
    request: FastifyRequest,
    code:
      | "validation"
      | "not_found"
      | "conflict"
      | "revision_conflict"
      | "correlation_conflict"
      | "unavailable",
    message: string,
  ) => unknown;
};

const identifier = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$",
} as const;
const repositoryReference = {
  type: "object",
  additionalProperties: false,
  required: ["repositoryId", "revision"],
  properties: { repositoryId: identifier, revision: identifier },
} as const;
const agentReference = {
  type: "object",
  additionalProperties: false,
  required: ["agentId", "nativeSessionId", "revision"],
  properties: {
    agentId: identifier,
    nativeSessionId: identifier,
    rootNativeSessionId: identifier,
    revision: identifier,
  },
} as const;
const workstreamParams = {
  type: "object",
  additionalProperties: false,
  required: ["workstreamId"],
  properties: { workstreamId: identifier },
} as const;

function rejectUnknownKeys(value: unknown, allowed: readonly string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (!unknown) return;
  const error = new Error(`Unknown request field: ${unknown}`) as Error & {
    validation?: readonly unknown[];
  };
  error.validation = [];
  throw error;
}

function validateReferences(body: unknown): void {
  if (!body || typeof body !== "object" || Array.isArray(body)) return;
  const value = body as { repository?: unknown; agent?: unknown };
  rejectUnknownKeys(value.repository, ["repositoryId", "revision"]);
  rejectUnknownKeys(value.agent, [
    "agentId",
    "nativeSessionId",
    "rootNativeSessionId",
    "revision",
  ]);
}

function fail(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
  envelope: RouteEnvelope,
) {
  if (!(error instanceof PreviewManagerServiceError)) throw error;
  const status =
    error.code === "validation"
      ? 400
      : error.code === "recipe-not-found" || error.code === "preview-not-found"
        ? 404
        : error.code === "unavailable"
          ? 503
          : 409;
  const code =
    error.code === "validation"
      ? "validation"
      : error.code === "recipe-not-found" || error.code === "preview-not-found"
        ? "not_found"
        : error.code === "recipe-revision-conflict" ||
            error.code === "preview-revision-conflict"
          ? "revision_conflict"
          : error.code === "correlation-conflict"
            ? "correlation_conflict"
            : error.code === "unavailable"
              ? "unavailable"
              : "conflict";
  return reply
    .code(status)
    .send(envelope.failure(request, code, error.message.slice(0, 512)));
}

export function registerPreviewManagerRoutes(
  server: FastifyInstance,
  service: PreviewManagerService,
  envelope: RouteEnvelope,
): void {
  const tags = ["preview-manager"];

  server.post(
    "/preview-recipes",
    {
      bodyLimit: 16 * 1024,
      preValidation: async (request) =>
        rejectUnknownKeys(request.body, [
          "requestId",
          "correlationId",
          "recipeId",
          "expectedRevision",
          "repositoryId",
          "label",
          "executable",
          "args",
          "readinessPath",
          "browserPath",
        ]),
      schema: {
        tags,
        summary: "Explicitly approve one repository browser-preview recipe",
        body: {
          type: "object",
          additionalProperties: false,
          required: [
            "requestId",
            "correlationId",
            "recipeId",
            "expectedRevision",
            "repositoryId",
            "label",
            "executable",
            "args",
            "readinessPath",
            "browserPath",
          ],
          properties: {
            requestId: identifier,
            correlationId: identifier,
            recipeId: identifier,
            expectedRevision: {
              anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
            },
            repositoryId: identifier,
            label: { type: "string", minLength: 1, maxLength: 160 },
            executable: { type: "string", minLength: 1, maxLength: 512 },
            args: {
              type: "array",
              maxItems: 32,
              items: { type: "string", minLength: 1, maxLength: 1024 },
            },
            readinessPath: { type: "string", minLength: 1, maxLength: 512 },
            browserPath: { type: "string", minLength: 1, maxLength: 512 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return reply
          .code(201)
          .send(
            envelope.success(
              request,
              await service.approveRecipe(request.body),
            ),
          );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.get<{ Querystring: { repositoryId?: string } }>(
    "/preview-recipes",
    {
      schema: {
        tags,
        summary: "List approved browser-preview recipes",
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: { repositoryId: identifier },
        },
      },
    },
    async (request) =>
      envelope.success(
        request,
        await service.recipes(request.query.repositoryId),
      ),
  );

  server.post<{
    Params: { workstreamId: string };
    Body: Record<string, unknown>;
  }>(
    "/workstreams/:workstreamId/previews",
    {
      bodyLimit: 16 * 1024,
      preValidation: async (request) => {
        rejectUnknownKeys(request.body, [
          "requestId",
          "correlationId",
          "expectedWorkstreamRevision",
          "repository",
          "agent",
          "recipeId",
          "expectedRecipeRevision",
        ]);
        validateReferences(request.body);
      },
      schema: {
        tags,
        summary: "Start or refresh an exact Workstream preview",
        params: workstreamParams,
        body: {
          type: "object",
          additionalProperties: false,
          required: [
            "requestId",
            "correlationId",
            "expectedWorkstreamRevision",
            "repository",
            "agent",
            "recipeId",
            "expectedRecipeRevision",
          ],
          properties: {
            requestId: identifier,
            correlationId: identifier,
            expectedWorkstreamRevision: { type: "integer", minimum: 0 },
            repository: repositoryReference,
            agent: agentReference,
            recipeId: identifier,
            expectedRecipeRevision: { type: "integer", minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return reply.code(201).send(
          envelope.success(
            request,
            await service.start({
              ...request.body,
              workstreamId: request.params.workstreamId,
            }),
          ),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.get<{ Params: { workstreamId: string } }>(
    "/workstreams/:workstreamId/previews/current",
    {
      schema: {
        tags,
        summary: "Read current and previous-verified preview truth",
        params: workstreamParams,
      },
    },
    async (request) => {
      const projection = await service.current();
      const belongs = [
        projection.active,
        projection.latestAttempt,
        projection.previousVerified,
      ].some(
        (preview) => preview?.workstreamId === request.params.workstreamId,
      );
      if (!belongs)
        return envelope.success(request, {
          ...projection,
          active: null,
          latestAttempt: null,
          previousVerified: null,
          display: null,
        });
      return envelope.success(request, projection);
    },
  );

  server.post<{
    Params: { workstreamId: string };
    Body: Record<string, unknown>;
  }>(
    "/workstreams/:workstreamId/previews/current/stop",
    {
      bodyLimit: 8 * 1024,
      preValidation: async (request) =>
        rejectUnknownKeys(request.body, [
          "requestId",
          "correlationId",
          "expectedPreviewRevision",
        ]),
      schema: {
        tags,
        summary: "Stop only the exact owned Workstream preview",
        params: workstreamParams,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["requestId", "correlationId", "expectedPreviewRevision"],
          properties: {
            requestId: identifier,
            correlationId: identifier,
            expectedPreviewRevision: { type: "integer", minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.stop({
            ...request.body,
            workstreamId: request.params.workstreamId,
          }),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
}

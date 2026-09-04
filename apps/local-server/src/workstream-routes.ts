import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  WorkstreamService,
  WorkstreamServiceError,
} from "./workstream-service.js";

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
  required: ["agentId", "nativeSessionId", "rootNativeSessionId", "revision"],
  properties: {
    agentId: identifier,
    nativeSessionId: identifier,
    rootNativeSessionId: identifier,
    revision: identifier,
  },
} as const;
const params = {
  type: "object",
  additionalProperties: false,
  required: ["workstreamId"],
  properties: { workstreamId: identifier },
} as const;

function rejectUnknownKeys(value: unknown, allowed: readonly string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) {
    const error = new Error(`Unknown request field: ${unknown}`) as Error & {
      validation?: readonly unknown[];
    };
    error.validation = [];
    throw error;
  }
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
  if (!(error instanceof WorkstreamServiceError)) throw error;
  const status =
    error.code === "validation"
      ? 400
      : error.code === "not-found"
        ? 404
        : error.code === "unavailable"
          ? 503
          : 409;
  const code =
    error.code === "not-found"
      ? "not_found"
      : error.code === "revision-conflict"
        ? "revision_conflict"
        : error.code === "correlation-conflict"
          ? "correlation_conflict"
          : error.code === "unavailable"
            ? "unavailable"
            : error.code === "validation"
              ? "validation"
              : "conflict";
  return reply
    .code(status)
    .send(envelope.failure(request, code, error.message.slice(0, 512)));
}

export function registerWorkstreamRoutes(
  server: FastifyInstance,
  service: WorkstreamService,
  envelope: RouteEnvelope,
): void {
  const tags = ["workstreams"];
  server.post(
    "/workstreams",
    {
      bodyLimit: 8 * 1024,
      preValidation: async (request) => {
        rejectUnknownKeys(request.body, [
          "requestId",
          "correlationId",
          "title",
          "task",
          "repository",
          "agent",
        ]);
        validateReferences(request.body);
      },
      schema: {
        tags,
        summary: "Create one bounded owned Workstream",
        body: {
          type: "object",
          additionalProperties: false,
          required: [
            "requestId",
            "correlationId",
            "title",
            "task",
            "repository",
            "agent",
          ],
          properties: {
            requestId: identifier,
            correlationId: identifier,
            title: { type: "string", minLength: 1, maxLength: 160 },
            task: { type: "string", minLength: 1, maxLength: 2000 },
            repository: repositoryReference,
            agent: agentReference,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return reply
          .code(201)
          .send(envelope.success(request, await service.create(request.body)));
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.get(
    "/workstreams/current",
    { schema: { tags, summary: "Read the current Workstream" } },
    async (request, reply) => {
      try {
        const workstream = await service.current();
        return workstream
          ? envelope.success(request, workstream)
          : reply
              .code(404)
              .send(
                envelope.failure(request, "not_found", "No current Workstream"),
              );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.get<{ Params: { workstreamId: string } }>(
    "/workstreams/:workstreamId",
    { schema: { tags, summary: "Read one Workstream", params } },
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.read(request.params.workstreamId),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.post<{
    Params: { workstreamId: string };
    Body: Record<string, unknown>;
  }>(
    "/workstreams/:workstreamId/iterations",
    {
      bodyLimit: 8 * 1024,
      preValidation: async (request) => {
        rejectUnknownKeys(request.body, [
          "requestId",
          "correlationId",
          "expectedRevision",
          "feedback",
          "repository",
          "agent",
        ]);
        validateReferences(request.body);
      },
      schema: {
        tags,
        summary: "Record one exact feedback iteration on an owned Workstream",
        params,
        body: {
          type: "object",
          additionalProperties: false,
          required: [
            "requestId",
            "correlationId",
            "expectedRevision",
            "feedback",
            "repository",
            "agent",
          ],
          properties: {
            requestId: identifier,
            correlationId: identifier,
            expectedRevision: { type: "integer", minimum: 0 },
            feedback: { type: "string", minLength: 1, maxLength: 2000 },
            repository: repositoryReference,
            agent: agentReference,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.iterate({
            ...request.body,
            workstreamId: request.params.workstreamId,
          }),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.post<{
    Params: { workstreamId: string };
    Body: Record<string, unknown>;
  }>(
    "/workstreams/:workstreamId/cancel",
    {
      bodyLimit: 8 * 1024,
      preValidation: async (request) => {
        rejectUnknownKeys(request.body, [
          "requestId",
          "correlationId",
          "expectedRevision",
          "repository",
          "agent",
        ]);
        validateReferences(request.body);
      },
      schema: {
        tags,
        summary: "Cancel one owned Workstream",
        params,
        body: {
          type: "object",
          additionalProperties: false,
          required: [
            "requestId",
            "correlationId",
            "expectedRevision",
            "repository",
            "agent",
          ],
          properties: {
            requestId: identifier,
            correlationId: identifier,
            expectedRevision: { type: "integer", minimum: 0 },
            repository: repositoryReference,
            agent: agentReference,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.cancel({
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

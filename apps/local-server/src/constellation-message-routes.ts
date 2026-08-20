import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  ConstellationMessageService,
  ConstellationMessageServiceError,
  type ConstellationMessageRequest,
} from "./constellation-message-service.js";

type RouteEnvelope = {
  readonly success: <T>(request: FastifyRequest, data: T) => unknown;
  readonly failure: (
    request: FastifyRequest,
    code:
      | "validation"
      | "not_found"
      | "conflict"
      | "resource_limit"
      | "authority_unavailable",
    message: string,
  ) => unknown;
};

function fail(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
  envelope: RouteEnvelope,
) {
  if (!(error instanceof ConstellationMessageServiceError)) throw error;
  const status =
    error.code === "validation"
      ? 400
      : error.code === "not_found"
        ? 404
        : error.code === "conflict"
          ? 409
          : error.code === "resource_limit"
            ? 413
            : 503;
  return reply
    .code(status)
    .send(
      envelope.failure(
        request,
        error.code === "unavailable" ? "authority_unavailable" : error.code,
        error.message,
      ),
    );
}

export function registerConstellationMessageRoutes(
  server: FastifyInstance,
  service: ConstellationMessageService,
  envelope: RouteEnvelope,
): void {
  const tags = ["phase19-constellation-messages"];
  const allowedBody = new Set([
    "requestId",
    "idempotencyKey",
    "text",
    "targetRosterId",
    "userDisplayName",
  ]);
  server.post(
    "/constellation/messages",
    {
      preValidation: async (request, reply) => {
        const body = request.body as Record<string, unknown> | null;
        if (body && Object.keys(body).some((key) => !allowedBody.has(key)))
          return reply
            .code(400)
            .send(
              envelope.failure(
                request,
                "validation",
                "Request body contains an unsupported property",
              ),
            );
      },
      schema: {
        tags,
        summary: "Send one durable server-owned constellation message group",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["requestId", "idempotencyKey", "text"],
          properties: {
            requestId: { type: "string", format: "uuid" },
            idempotencyKey: {
              type: "string",
              minLength: 1,
              maxLength: 128,
              pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
            },
            text: { type: "string", minLength: 1, maxLength: 16_384 },
            targetRosterId: {
              type: "string",
              minLength: 1,
              maxLength: 256,
              pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
            },
            userDisplayName: { type: "string", minLength: 1, maxLength: 80 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const group = await service.send(
          request.body as ConstellationMessageRequest,
        );
        return reply.code(201).send(envelope.success(request, group));
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.get(
    "/constellation/messages/:requestId",
    {
      schema: {
        tags,
        summary: "Read one durable constellation message group",
        params: {
          type: "object",
          additionalProperties: false,
          required: ["requestId"],
          properties: { requestId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      try {
        const { requestId } = request.params as { requestId: string };
        return envelope.success(request, service.get(requestId));
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
}

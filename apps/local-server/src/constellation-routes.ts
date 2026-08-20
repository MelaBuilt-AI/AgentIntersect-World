import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  ConstellationService,
  ConstellationServiceError,
  type AddConstellationAgentRequest,
  type ConstellationRosterMutationRequest,
  type SetConstellationAvatarRequest,
} from "./constellation-service.js";

type RouteEnvelope = {
  readonly success: <T>(request: FastifyRequest, data: T) => unknown;
  readonly failure: (
    request: FastifyRequest,
    code:
      | "validation"
      | "not_found"
      | "conflict"
      | "revision_conflict"
      | "resource_limit"
      | "authority_unavailable"
      | "upstream",
    message: string,
  ) => unknown;
};

type MutationBody = {
  readonly worldInstanceId: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
};

const identityProperties = {
  worldInstanceId: {
    type: "string",
    minLength: 1,
    maxLength: 256,
    pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
  },
  expectedRevision: {
    type: "integer",
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
  },
  idempotencyKey: {
    type: "string",
    minLength: 1,
    maxLength: 128,
    pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
  },
} as const;

const identityBody = {
  type: "object",
  additionalProperties: false,
  required: ["worldInstanceId", "expectedRevision", "idempotencyKey"],
  properties: identityProperties,
} as const;

const rosterParams = {
  type: "object",
  additionalProperties: false,
  required: ["rosterId"],
  properties: {
    rosterId: {
      type: "string",
      minLength: 1,
      maxLength: 256,
      pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    },
  },
} as const;

function strictBody(
  envelope: RouteEnvelope,
  allowed: readonly string[],
  nested?: { readonly property: string; readonly allowed: readonly string[] },
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    const nestedValue = nested ? body?.[nested.property] : null;
    const unsupported =
      (body && Object.keys(body).some((key) => !allowed.includes(key))) ||
      (nested &&
        nestedValue !== null &&
        typeof nestedValue === "object" &&
        !Array.isArray(nestedValue) &&
        Object.keys(nestedValue).some((key) => !nested.allowed.includes(key)));
    if (unsupported)
      return reply
        .code(400)
        .send(
          envelope.failure(
            request,
            "validation",
            "Request body contains an unsupported property",
          ),
        );
  };
}

function fail(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
  envelope: RouteEnvelope,
) {
  const serviceError =
    error instanceof ConstellationServiceError
      ? error
      : new ConstellationServiceError(
          "upstream",
          "Constellation operation failed",
        );
  const status =
    serviceError.code === "validation"
      ? 400
      : serviceError.code === "not_found"
        ? 404
        : serviceError.code === "conflict" ||
            serviceError.code === "revision_conflict"
          ? 409
          : serviceError.code === "resource_limit"
            ? 413
            : serviceError.code === "unavailable"
              ? 503
              : 502;
  const code =
    serviceError.code === "unavailable"
      ? "authority_unavailable"
      : serviceError.code;
  return reply
    .code(status)
    .send(envelope.failure(request, code, serviceError.message.slice(0, 240)));
}

export function registerConstellationRoutes(
  server: FastifyInstance,
  service: ConstellationService,
  envelope: RouteEnvelope,
): void {
  const tags = ["phase19-constellation"];

  server.get(
    "/constellation/current",
    { schema: { tags, summary: "Get durable constellation truth" } },
    async (request, reply) => {
      const current = service.current();
      if (current.projection === null)
        return fail(
          new ConstellationServiceError(
            "unavailable",
            current.unavailableReason,
          ),
          request,
          reply,
          envelope,
        );
      return envelope.success(request, current);
    },
  );

  server.post(
    "/constellation/agents",
    {
      preValidation: strictBody(
        envelope,
        ["worldInstanceId", "expectedRevision", "idempotencyKey", "agent"],
        {
          property: "agent",
          allowed: [
            "rosterId",
            "adapterId",
            "sessionOwnership",
            "worldSessionId",
            "nativeRootSessionRef",
            "displayName",
          ],
        },
      ),
      schema: {
        tags,
        summary: "Retain one already-attached exact agent binding",
        body: {
          type: "object",
          additionalProperties: false,
          required: [
            "worldInstanceId",
            "expectedRevision",
            "idempotencyKey",
            "agent",
          ],
          properties: {
            ...identityProperties,
            agent: {
              type: "object",
              additionalProperties: false,
              required: [
                "rosterId",
                "adapterId",
                "sessionOwnership",
                "worldSessionId",
                "nativeRootSessionRef",
                "displayName",
              ],
              properties: {
                rosterId: rosterParams.properties.rosterId,
                adapterId: {
                  type: "string",
                  enum: ["hermes", "openclaw", "codex", "claude-code"],
                },
                sessionOwnership: {
                  type: "string",
                  enum: ["operator-persistent", "world-owned"],
                },
                worldSessionId: rosterParams.properties.rosterId,
                nativeRootSessionRef: rosterParams.properties.rosterId,
                displayName: { type: "string", minLength: 1, maxLength: 64 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return reply
          .code(201)
          .send(
            await service
              .addAgent(request.body as AddConstellationAgentRequest)
              .then((data) => envelope.success(request, data)),
          );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.post(
    "/constellation/agents/:rosterId/reconnect",
    {
      preValidation: strictBody(envelope, [
        "worldInstanceId",
        "expectedRevision",
        "idempotencyKey",
      ]),
      schema: {
        tags,
        summary: "Explicitly revalidate one exact retained binding",
        params: rosterParams,
        body: identityBody,
      },
    },
    async (request, reply) => {
      try {
        const { rosterId } = request.params as { rosterId: string };
        const body = request.body as MutationBody;
        return envelope.success(
          request,
          await service.reconnect({ ...body, rosterId }),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.delete(
    "/constellation/agents/:rosterId",
    {
      preValidation: strictBody(envelope, [
        "worldInstanceId",
        "expectedRevision",
        "idempotencyKey",
      ]),
      schema: {
        tags,
        summary: "Detach only one roster and avatar association",
        params: rosterParams,
        body: identityBody,
      },
    },
    async (request, reply) => {
      try {
        const { rosterId } = request.params as { rosterId: string };
        const body = request.body as Omit<
          ConstellationRosterMutationRequest,
          "rosterId"
        >;
        return envelope.success(
          request,
          await service.removeAgent({ ...body, rosterId }),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.post(
    "/constellation/agents/:rosterId/avatar",
    {
      preValidation: strictBody(
        envelope,
        ["worldInstanceId", "expectedRevision", "idempotencyKey", "avatar"],
        {
          property: "avatar",
          allowed: ["status", "profileId", "sessionId"],
        },
      ),
      schema: {
        tags,
        summary: "Associate bounded avatar truth with one roster entry",
        params: rosterParams,
        body: {
          type: "object",
          additionalProperties: false,
          required: [
            "worldInstanceId",
            "expectedRevision",
            "idempotencyKey",
            "avatar",
          ],
          properties: {
            ...identityProperties,
            avatar: {
              type: "object",
              additionalProperties: false,
              required: ["status", "profileId", "sessionId"],
              properties: {
                status: {
                  type: "string",
                  enum: ["missing", "editing", "accepted"],
                },
                profileId: {
                  anyOf: [rosterParams.properties.rosterId, { type: "null" }],
                },
                sessionId: {
                  anyOf: [rosterParams.properties.rosterId, { type: "null" }],
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { rosterId } = request.params as { rosterId: string };
        const body = request.body as Omit<
          SetConstellationAvatarRequest,
          "rosterId"
        >;
        return envelope.success(
          request,
          await service.setAvatar({ ...body, rosterId }),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.post(
    "/constellation/end",
    {
      preValidation: strictBody(envelope, [
        "worldInstanceId",
        "expectedRevision",
        "idempotencyKey",
      ]),
      schema: {
        tags,
        summary: "Idempotently end only World-owned roster sessions",
        body: identityBody,
      },
    },
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.end(request.body as MutationBody),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
}

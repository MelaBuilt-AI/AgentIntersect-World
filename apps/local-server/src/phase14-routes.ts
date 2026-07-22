import type { FastifyInstance, FastifyReply } from "fastify";

import { Phase14Service, Phase14ServiceError } from "./phase14-service.js";

const emptyBody = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const;

const operationParams = {
  type: "object",
  additionalProperties: false,
  required: ["operationId"],
  properties: { operationId: { type: "string", format: "uuid" } },
} as const;

function failure(error: unknown, reply: FastifyReply) {
  if (!(error instanceof Phase14ServiceError)) throw error;
  const status =
    error.code === "operation-not-found"
      ? 404
      : error.code === "fixture-invalid" ||
          error.code === "target-path" ||
          error.code === "target-binary" ||
          error.code === "target-nul" ||
          error.code === "target-size"
        ? 400
        : 409;
  return reply.code(status).send({
    error: { code: error.code, message: error.message, retryable: false },
  });
}

export function registerPhase14Routes(
  server: FastifyInstance,
  service: Phase14Service,
): void {
  const emptyMutation = { params: operationParams, body: emptyBody } as const;

  server.post<{ Body: Record<string, never> }>(
    "/phase14/journeys",
    {
      schema: {
        tags: ["phase14"],
        summary: "Create the exact disposable Phase 14 fixture journey",
      },
    },
    async (request, reply) => {
      try {
        if (Object.keys(request.body).length !== 0)
          return reply.code(400).send({
            error: {
              code: "validation",
              message: "Phase 14 setup accepts no root or command fields",
              retryable: false,
            },
          });
        return reply.code(201).send(await service.createJourney());
      } catch (error) {
        return failure(error, reply);
      }
    },
  );

  server.get(
    "/phase14/journeys",
    { schema: { tags: ["phase14"] } },
    async (_request, reply) =>
      reply.send({ journeys: await service.recover() }),
  );

  server.get(
    "/phase14/journeys/current",
    { schema: { tags: ["phase14"] } },
    async (_request, reply) => {
      await service.recover();
      const current = service.latest();
      return current
        ? reply.send(current)
        : reply.code(404).send({ error: "No Phase 14 journey" });
    },
  );

  server.get<{ Params: { operationId: string } }>(
    "/phase14/journeys/:operationId",
    { schema: { tags: ["phase14"], params: operationParams } },
    async (request, reply) => {
      try {
        await service.recover();
        return reply.send(service.snapshot(request.params.operationId));
      } catch (error) {
        return failure(error, reply);
      }
    },
  );

  server.get<{ Params: { operationId: string } }>(
    "/phase14/journeys/:operationId/events",
    { schema: { tags: ["phase14"], params: operationParams } },
    async (request, reply) => {
      try {
        await service.recover();
        return reply.send({
          events: service.events(request.params.operationId),
        });
      } catch (error) {
        return failure(error, reply);
      }
    },
  );

  const simple = (
    suffix: string,
    action: (operationId: string) => Promise<unknown>,
  ) => {
    server.post<{
      Params: { operationId: string };
      Body: Record<string, never>;
    }>(
      `/phase14/journeys/:operationId/${suffix}`,
      { schema: { tags: ["phase14"], ...emptyMutation } },
      async (request, reply) => {
        try {
          return reply.send(await action(request.params.operationId));
        } catch (error) {
          return failure(error, reply);
        }
      },
    );
  };

  simple("inspect", (operationId) => service.inspect(operationId));
  simple("edit/preview", (operationId) => service.prepareEdit(operationId));
  simple("test", (operationId) => service.runTest(operationId));
  simple("preview/start", (operationId) => service.startPreview(operationId));
  simple("preview/stop", (operationId) => service.stopPreview(operationId));
  simple("cancel", (operationId) => service.cancel(operationId));

  server.post<{
    Params: { operationId: string };
    Body: { patchDigest: string };
  }>(
    "/phase14/journeys/:operationId/approval",
    {
      schema: {
        tags: ["phase14"],
        params: operationParams,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["patchDigest"],
          properties: {
            patchDigest: { type: "string", pattern: "^[a-f0-9]{64}$" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return reply.send(
          await service.approve(request.params.operationId, request.body),
        );
      } catch (error) {
        return failure(error, reply);
      }
    },
  );

  server.post<{
    Params: { operationId: string };
    Body: { approvalId: string };
  }>(
    "/phase14/journeys/:operationId/approval/revoke",
    {
      schema: {
        tags: ["phase14"],
        params: operationParams,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["approvalId"],
          properties: { approvalId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      try {
        return reply.send(
          await service.revokeApproval(
            request.params.operationId,
            request.body.approvalId,
          ),
        );
      } catch (error) {
        return failure(error, reply);
      }
    },
  );

  server.post<{
    Params: { operationId: string };
    Body: { approvalId: string };
  }>(
    "/phase14/journeys/:operationId/edit/apply",
    {
      schema: {
        tags: ["phase14"],
        params: operationParams,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["approvalId"],
          properties: { approvalId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      try {
        return reply.send(
          await service.apply(request.params.operationId, request.body),
        );
      } catch (error) {
        return failure(error, reply);
      }
    },
  );

  server.post<{ Body: unknown }>(
    "/phase14/tool-events",
    {
      schema: {
        tags: ["phase14"],
        summary: "Replay one strict bounded aiw.tool-event/0.14 event",
      },
    },
    async (request, reply) => {
      try {
        const result = service.acceptEvent(request.body);
        const status =
          result.kind === "conflict"
            ? 409
            : result.kind === "expired"
              ? 410
              : result.kind === "duplicate"
                ? 200
                : 202;
        return reply.code(status).send(result);
      } catch {
        return reply.code(400).send({
          error: {
            code: "validation",
            message: "Tool event validation failed",
            retryable: false,
          },
        });
      }
    },
  );
}

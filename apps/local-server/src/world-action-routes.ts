import type { FastifyInstance } from "fastify";

import { WorldActionProposalSchema } from "@agentintersect-world/world-action-protocol";

import {
  WorldActionService,
  type WorldActionContext,
  type WorldActionProposalResult,
} from "./world-actions.js";

const paramsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sessionId"],
  properties: { sessionId: { type: "string", format: "uuid" } },
} as const;

export function registerWorldActionRoutes(
  server: FastifyInstance,
  service: WorldActionService,
  contextFor: (
    sessionId: string,
  ) => Promise<WorldActionContext | null> | WorldActionContext | null,
  importProposals?: (
    sessionId: string,
    context: WorldActionContext,
  ) =>
    | Promise<readonly WorldActionProposalResult[]>
    | readonly WorldActionProposalResult[],
): void {
  server.get<{ Params: { sessionId: string } }>(
    "/world-actions/:sessionId",
    { schema: { params: paramsSchema } },
    async (request, reply) => {
      const context = await contextFor(request.params.sessionId);
      if (!context)
        return reply.code(404).send({ error: "World session is unavailable" });
      const imported =
        (await importProposals?.(request.params.sessionId, context)) ?? [];
      return reply.send({
        protocol: "aiw.world-action/0.13",
        capability: context.worldActionsEnabled
          ? { enabled: true }
          : {
              enabled: false,
              reason:
                "Structured World Actions are unavailable; persistent chat and manual navigation remain available.",
            },
        actions: service.timeline(request.params.sessionId),
        executions: imported.filter((result) => result.accepted),
      });
    },
  );

  server.post<{ Params: { sessionId: string }; Body: unknown }>(
    "/world-actions/:sessionId/proposals",
    { schema: { params: paramsSchema } },
    async (request, reply) => {
      const parsed = WorldActionProposalSchema.safeParse(request.body);
      if (!parsed.success)
        return reply
          .code(400)
          .send({ error: "World Action proposal is invalid" });
      const context = await contextFor(request.params.sessionId);
      if (!context)
        return reply.code(404).send({ error: "World session is unavailable" });
      const result = await service.propose(
        request.params.sessionId,
        parsed.data,
        context,
      );
      if (!result.accepted) {
        const status = result.reason === "capability-unavailable" ? 409 : 400;
        return reply.code(status).send(result);
      }
      return reply.code(202).send(result);
    },
  );

  server.post<{
    Params: { sessionId: string };
    Body: {
      reason:
        | "operator-movement"
        | "escape"
        | "cancel"
        | "capability-loss"
        | "invalid-target";
    };
  }>(
    "/world-actions/:sessionId/interrupt",
    {
      schema: {
        params: paramsSchema,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["reason"],
          properties: {
            reason: {
              type: "string",
              enum: [
                "operator-movement",
                "escape",
                "cancel",
                "capability-loss",
                "invalid-target",
              ],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const context = await contextFor(request.params.sessionId);
      if (!context)
        return reply.code(404).send({ error: "World session is unavailable" });
      service.interrupt(request.params.sessionId, request.body.reason);
      return reply.send({
        actions: service.timeline(request.params.sessionId),
      });
    },
  );

  server.post<{
    Params: { sessionId: string; actionId: string };
    Body: {
      event: "moving" | "arrived" | "blocked" | "semantic-focus";
      actorPosition?: { x: number; z: number };
    };
  }>(
    "/world-actions/:sessionId/actions/:actionId/transition",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["sessionId", "actionId"],
          properties: {
            sessionId: { type: "string", format: "uuid" },
            actionId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["event"],
          properties: {
            event: {
              type: "string",
              enum: ["moving", "arrived", "blocked", "semantic-focus"],
            },
            actorPosition: {
              type: "object",
              additionalProperties: false,
              required: ["x", "z"],
              properties: {
                x: { type: "number", minimum: -1_000_000, maximum: 1_000_000 },
                z: { type: "number", minimum: -1_000_000, maximum: 1_000_000 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const context = await contextFor(request.params.sessionId);
      if (!context)
        return reply.code(404).send({ error: "World session is unavailable" });
      if (request.body.event === "arrived" && !request.body.actorPosition)
        return reply.code(400).send({ error: "Arrival position is required" });
      try {
        service.transition(
          request.params.sessionId,
          request.params.actionId,
          request.body.event,
          request.body.actorPosition
            ? { ...context, actorPosition: request.body.actorPosition }
            : context,
        );
        return reply.send({
          actions: service.timeline(request.params.sessionId),
        });
      } catch (error) {
        return reply.code(409).send({
          error:
            error instanceof Error ? error.message : "Transition was rejected",
        });
      }
    },
  );

  server.post<{
    Params: { sessionId: string; actionId: string };
    Body: Record<string, never>;
  }>(
    "/world-actions/:sessionId/actions/:actionId/cancel",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["sessionId", "actionId"],
          properties: {
            sessionId: { type: "string", format: "uuid" },
            actionId: { type: "string", format: "uuid" },
          },
        },
        body: { type: "object", additionalProperties: false },
      },
    },
    async (request, reply) => {
      const context = await contextFor(request.params.sessionId);
      if (!context)
        return reply.code(404).send({ error: "World session is unavailable" });
      const result = service.cancel(
        request.params.sessionId,
        request.params.actionId,
      );
      return reply.code(result.cancelled ? 200 : 409).send({
        ...result,
        actions: service.timeline(request.params.sessionId),
      });
    },
  );

  server.post<{
    Params: { sessionId: string; actionId: string };
    Body: Record<string, never>;
  }>(
    "/world-actions/:sessionId/actions/:actionId/replay",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["sessionId", "actionId"],
          properties: {
            sessionId: { type: "string", format: "uuid" },
            actionId: { type: "string", format: "uuid" },
          },
        },
        body: { type: "object", additionalProperties: false },
      },
    },
    async (request, reply) => {
      const context = await contextFor(request.params.sessionId);
      if (!context)
        return reply.code(404).send({ error: "World session is unavailable" });
      const result = await service.replay(
        request.params.sessionId,
        request.params.actionId,
        context,
      );
      return reply.code(result.accepted ? 202 : 409).send(result);
    },
  );

  server.post<{
    Params: { sessionId: string; actionId: string };
    Body: { pinned: boolean };
  }>(
    "/world-actions/:sessionId/actions/:actionId/pin",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["sessionId", "actionId"],
          properties: {
            sessionId: { type: "string", format: "uuid" },
            actionId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["pinned"],
          properties: { pinned: { type: "boolean" } },
        },
      },
    },
    async (request, reply) => {
      try {
        service.pin(
          request.params.sessionId,
          request.params.actionId,
          request.body.pinned,
        );
        return reply.send({
          actions: service.timeline(request.params.sessionId),
        });
      } catch (error) {
        return reply.code(409).send({
          error: error instanceof Error ? error.message : "Pin failed",
        });
      }
    },
  );

  server.delete<{ Params: { sessionId: string } }>(
    "/world-actions/:sessionId/clear",
    { schema: { params: paramsSchema } },
    async (request, reply) => {
      service.clear(request.params.sessionId);
      return reply.send({
        actions: service.timeline(request.params.sessionId),
      });
    },
  );
}

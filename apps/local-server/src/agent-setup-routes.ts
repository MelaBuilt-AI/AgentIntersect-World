import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import path from "node:path";
import {
  AgentSetupService,
  AttachAgentInputSchema,
} from "./agent-setup-service.js";

type Envelope = {
  success<T>(request: FastifyRequest, data: T): unknown;
  failure(
    request: FastifyRequest,
    code: "validation",
    message: string,
  ): unknown;
};
export function registerAgentSetupRoutes(
  server: FastifyInstance,
  service: AgentSetupService,
  envelope: Envelope,
): void {
  const failed = (
    error: unknown,
    request: FastifyRequest,
    reply: FastifyReply,
  ) =>
    reply
      .code(400)
      .send(
        envelope.failure(
          request,
          "validation",
          error instanceof z.ZodError
            ? "Check the required setup fields."
            : error instanceof Error && !("code" in error)
              ? error.message.slice(0, 240)
              : "Agent Setup could not be saved. Check the World data directory and try again.",
        ),
      );
  server.get("/agent-setup", async (request) =>
    envelope.success(request, await service.state()),
  );
  server.post("/agent-setup/discover", async (request, reply) => {
    try {
      const input = z
        .object({
          additionalDirectory: z
            .string()
            .max(4096)
            .refine(
              path.isAbsolute,
              "Use an absolute installation directory on the World server",
            )
            .refine(
              (value) =>
                ![...value].some(
                  (character) => (character.codePointAt(0) ?? 0) < 32,
                ),
            )
            .optional(),
        })
        .strict()
        .parse(request.body);
      service.lastDiscovery = await service.discover(input.additionalDirectory);
      return envelope.success(request, service.lastDiscovery);
    } catch (error) {
      return failed(error, request, reply);
    }
  });
  server.post("/agent-setup/attach", async (request, reply) => {
    try {
      return envelope.success(
        request,
        await service.attach(AttachAgentInputSchema.parse(request.body)),
      );
    } catch (error) {
      return failed(error, request, reply);
    }
  });
  server.post("/agent-setup/conversations", async (request, reply) => {
    try {
      return envelope.success(
        request,
        await service.conversations(AttachAgentInputSchema.parse(request.body)),
      );
    } catch (error) {
      return failed(error, request, reply);
    }
  });
  server.post("/agent-setup/prerequisites/preview", async (request, reply) => {
    try {
      return envelope.success(
        request,
        await service.prerequisites.preview(
          await service.candidate(AttachAgentInputSchema.parse(request.body)),
        ),
      );
    } catch (error) {
      return failed(error, request, reply);
    }
  });
  server.post("/agent-setup/prerequisites/cancel", async (request, reply) => {
    try {
      const input = z
        .object({ planId: z.string().uuid() })
        .strict()
        .parse(request.body);
      service.prerequisites.cancel(input.planId);
      return envelope.success(request, { cancelled: true });
    } catch (error) {
      return failed(error, request, reply);
    }
  });
  server.post("/agent-setup/prerequisites/apply", async (request, reply) => {
    try {
      const input = z
        .object({
          planId: z.string().uuid(),
          actionId: z.string().uuid(),
          confirmed: z.literal(true),
        })
        .strict()
        .parse(request.body);
      const registration = await service.prerequisites.apply(
        input.planId,
        input.actionId,
        input.confirmed,
      );
      return envelope.success(request, {
        applied: true,
        check: await service.checkConnection(registration),
      });
    } catch (error) {
      return failed(error, request, reply);
    }
  });
  server.post("/agent-setup/check", async (request, reply) => {
    try {
      return envelope.success(
        request,
        await service.checkConnection(
          await service.candidate(AttachAgentInputSchema.parse(request.body)),
        ),
      );
    } catch (error) {
      return failed(error, request, reply);
    }
  });
  server.post("/agent-setup/complete", async (request, reply) => {
    try {
      z.object({}).strict().parse(request.body);
      return envelope.success(request, await service.complete());
    } catch (error) {
      return failed(error, request, reply);
    }
  });
  server.post<{ Params: { connectionId: string } }>(
    "/agent-setup/connections/:connectionId/recheck",
    async (request, reply) => {
      try {
        const id = z.string().uuid().parse(request.params.connectionId);
        return envelope.success(request, await service.recheck(id));
      } catch (error) {
        return failed(error, request, reply);
      }
    },
  );
}

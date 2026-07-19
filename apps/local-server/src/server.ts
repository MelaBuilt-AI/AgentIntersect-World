import { APP_METADATA } from "@agentintersect-world/config";
import { createCorrelationId } from "@agentintersect-world/observability";
import {
  CorrelationIdSchema,
  HealthResponseSchema,
  type CorrelationId,
  type HealthResponse,
} from "@agentintersect-world/world-schema";
import Fastify, { type FastifyInstance } from "fastify";

export type LocalServerOptions = {
  readonly generateCorrelationId?: () => string;
};

export function createLocalServer(
  options: LocalServerOptions = {},
): FastifyInstance {
  const server = Fastify({ logger: false });
  const generateCorrelationId =
    options.generateCorrelationId ?? createCorrelationId;

  server.get<{ Reply: HealthResponse }>("/health", async (_request, reply) => {
    const correlationId: CorrelationId = CorrelationIdSchema.parse(
      generateCorrelationId(),
    );
    const health = HealthResponseSchema.parse({
      service: "agentintersect-world-local-server",
      status: "ok",
      version: APP_METADATA.version,
      runtime: { name: "node", version: process.version },
      correlationId,
    });

    return reply.header("x-correlation-id", correlationId).send(health);
  });

  return server;
}

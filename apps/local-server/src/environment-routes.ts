import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  ENVIRONMENT_CAPABILITIES,
  EnvironmentRecipeSchema,
} from "@agentintersect-world/world-schema/environment";
import type { AgentSessionGateway } from "./agent-sessions.js";
import {
  EnvironmentGenerationRequestSchema,
  parseEnvironmentProposal,
} from "./environment-generation.js";

/** Session-scoped discovery/proposals. MCP is a data boundary, not coding authority. */
export function registerEnvironmentRoutes(
  server: FastifyInstance,
  gateway: AgentSessionGateway,
  envelope: {
    success: (request: FastifyRequest, data: unknown) => unknown;
    error: (
      error: unknown,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => unknown;
  },
) {
  const params = {
    type: "object",
    required: ["sessionId"],
    properties: { sessionId: { type: "string", format: "uuid" } },
    additionalProperties: false,
  };
  server.get(
    "/agent-sessions/:sessionId/environment",
    { schema: { params } },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        return envelope.success(request, {
          ...gateway.environmentCapability(sessionId),
          capabilities: ENVIRONMENT_CAPABILITIES,
        });
      } catch (error) {
        return envelope.error(error, request, reply);
      }
    },
  );
  server.post(
    "/agent-sessions/:sessionId/environment",
    { bodyLimit: 32768, schema: { params } },
    async (request, reply) => {
      const controller = new AbortController();
      const disconnect = () => {
        if (!reply.raw.writableFinished) controller.abort();
      };
      reply.raw.on("close", disconnect);
      try {
        const { sessionId } = request.params as { sessionId: string };
        return envelope.success(
          request,
          await gateway.generateEnvironment(
            sessionId,
            request.body,
            controller.signal,
          ),
        );
      } catch (error) {
        return envelope.error(error, request, reply);
      } finally {
        reply.raw.removeListener("close", disconnect);
      }
    },
  );
  // Stateless MCP JSON-RPC over the same locally authenticated HTTP boundary.
  // External clients may discover and validate proposals, never execute application code.
  server.post(
    "/agent-sessions/:sessionId/environment/mcp",
    { bodyLimit: 32768, schema: { params } },
    async (request, reply) => {
      const parsed = z
        .strictObject({
          jsonrpc: z.literal("2.0"),
          id: z.union([z.string().max(128), z.number()]).optional(),
          method: z.string().max(80),
          params: z.record(z.string(), z.unknown()).optional(),
        })
        .safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Invalid request" },
        });
      const rpc = parsed.data;
      try {
        gateway.environmentCapability(
          (request.params as { sessionId: string }).sessionId,
        );
        let result: unknown;
        if (rpc.method === "notifications/initialized")
          return reply.code(202).send();
        if (rpc.method === "initialize")
          result = {
            protocolVersion: "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "aiw-environment", version: "1.0.0" },
            instructions:
              "Data-only environment discovery and proposal validation. This server grants no coding authority and does not apply a recipe without browser preview.",
          };
        else if (rpc.method === "tools/list")
          result = {
            tools: [
              {
                name: "describe_environment",
                description:
                  "Read allowed environment layers, asset IDs, limits and recipe schema",
                inputSchema: {
                  type: "object",
                  properties: {},
                  additionalProperties: false,
                },
              },
              {
                name: "propose_environment",
                description:
                  "Validate a cosmetic recipe for browser preview; never edit files or apply it directly",
                inputSchema: {
                  type: "object",
                  properties: {
                    recipe: z.toJSONSchema(EnvironmentRecipeSchema),
                  },
                  required: ["recipe"],
                  additionalProperties: false,
                },
              },
            ],
          };
        else if (rpc.method === "tools/call") {
          const name = rpc.params?.name;
          if (name === "describe_environment")
            result = {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    ...ENVIRONMENT_CAPABILITIES,
                    recipeJsonSchema: z.toJSONSchema(EnvironmentRecipeSchema),
                    generationInput: z.toJSONSchema(
                      EnvironmentGenerationRequestSchema,
                    ),
                  }),
                },
              ],
            };
          else if (name === "propose_environment") {
            const args = z
              .strictObject({ recipe: EnvironmentRecipeSchema })
              .parse(rpc.params?.arguments);
            const proposal = parseEnvironmentProposal(
              JSON.stringify(args.recipe),
            );
            result = {
              content: [{ type: "text", text: JSON.stringify(proposal) }],
              structuredContent: proposal,
            };
          } else
            return {
              jsonrpc: "2.0",
              id: rpc.id ?? null,
              error: { code: -32602, message: "Unknown environment tool" },
            };
        } else
          return {
            jsonrpc: "2.0",
            id: rpc.id ?? null,
            error: { code: -32601, message: "Method not found" },
          };
        return { jsonrpc: "2.0", id: rpc.id ?? null, result };
      } catch {
        return {
          jsonrpc: "2.0",
          id: rpc.id ?? null,
          error: {
            code: -32602,
            message: "Unavailable session or invalid environment proposal",
          },
        };
      }
    },
  );
}

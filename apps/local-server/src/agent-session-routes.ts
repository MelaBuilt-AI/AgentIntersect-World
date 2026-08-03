import type { AgentAvatarProposal } from "@agentintersect-world/agent-session-protocol";
import { once } from "node:events";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  AgentSessionGateway,
  GatewayError,
  discoverDesignPreviews,
} from "./agent-sessions.js";

type RouteEnvelope = {
  readonly success: <T>(request: FastifyRequest, data: T) => unknown;
  readonly failure: (
    request: FastifyRequest,
    code:
      | "validation"
      | "not_found"
      | "conflict"
      | "authority_unavailable"
      | "upstream",
    message: string,
  ) => unknown;
};

function routeFailure(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
  envelope: RouteEnvelope,
) {
  if (!(error instanceof GatewayError)) throw error;
  const status =
    error.code === "validation"
      ? 400
      : error.code === "not_found"
        ? 404
        : error.code === "conflict" || error.code === "unsupported"
          ? 409
          : error.code === "offline"
            ? 503
            : 502;
  const code =
    error.code === "offline" || error.code === "store_corrupt"
      ? "authority_unavailable"
      : error.code === "unsupported"
        ? "conflict"
        : error.code;
  return reply
    .code(status)
    .send(envelope.failure(request, code, error.message));
}

async function writeSse(
  reply: FastifyReply,
  event: string,
  data: unknown,
): Promise<void> {
  if (reply.raw.destroyed)
    throw new GatewayError("upstream", "World stream disconnected");
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  if (Buffer.byteLength(payload, "utf8") > 32_768)
    throw new GatewayError("upstream", "World stream event exceeds its limit");
  if (!reply.raw.write(payload, "utf8")) await once(reply.raw, "drain");
}

const sessionParams = {
  type: "object",
  additionalProperties: false,
  required: ["sessionId"],
  properties: { sessionId: { type: "string", format: "uuid" } },
} as const;

export function registerAgentSessionRoutes(
  server: FastifyInstance,
  gateway: AgentSessionGateway,
  options: {
    readonly designRepositoryRoot?: string;
    readonly avatarProposal?: (
      sessionId: string,
    ) => Promise<AgentAvatarProposal | null> | AgentAvatarProposal | null;
  },
  envelope: RouteEnvelope,
): void {
  const tags = ["phase12-agent-sessions"];
  server.get(
    "/agent-sessions/capabilities",
    { schema: { tags, summary: "Attest capability-declared agent adapters" } },
    async (request, reply) => {
      try {
        return envelope.success(request, await gateway.capabilities());
      } catch (error) {
        return routeFailure(error, request, reply, envelope);
      }
    },
  );
  server.get(
    "/agent-sessions/native",
    {
      schema: {
        tags,
        summary: "List bounded native sessions for explicit selection",
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["adapterId"],
          properties: {
            adapterId: { type: "string", pattern: "^[a-z][a-z0-9-]{0,63}$" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { adapterId } = request.query as { adapterId: string };
        return envelope.success(
          request,
          await gateway.listNativeSessions(adapterId),
        );
      } catch (error) {
        return routeFailure(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/agent-sessions/attach",
    {
      schema: {
        tags,
        summary: "Attach one exact existing adapter session",
        body: {
          type: "object",
          additionalProperties: false,
          required: [
            "adapterId",
            "adapterSessionRef",
            "profile",
            "workspaceId",
            "repositoryRef",
            "mode",
          ],
          properties: {
            adapterId: { type: "string", pattern: "^[a-z][a-z0-9-]{0,63}$" },
            adapterSessionRef: { type: "string", minLength: 1, maxLength: 256 },
            profile: { type: "string", minLength: 1, maxLength: 64 },
            workspaceId: { type: "string", minLength: 1, maxLength: 256 },
            repositoryRef: { type: "string", minLength: 1, maxLength: 256 },
            mode: {
              type: "string",
              enum: ["explore", "collaborate", "autonomous", "guided-build"],
            },
            modeConfirmed: { type: "boolean" },
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
              await gateway.attach(request.body as never),
            ),
          );
      } catch (error) {
        return routeFailure(error, request, reply, envelope);
      }
    },
  );
  server.get(
    "/agent-sessions/:sessionId/status",
    {
      schema: {
        tags,
        params: sessionParams,
        summary: "Get durable session status",
      },
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        return envelope.success(request, gateway.status(sessionId));
      } catch (error) {
        return routeFailure(error, request, reply, envelope);
      }
    },
  );
  server.get(
    "/agent-sessions/:sessionId/history",
    {
      schema: {
        tags,
        params: sessionParams,
        summary:
          "Get bounded World-owned display projection; Hermes transcript stays canonical",
      },
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        const session = gateway.status(sessionId);
        return envelope.success(request, {
          sessionId,
          profile: session.profile,
          continuity: session.continuity,
          messages: gateway.history(sessionId),
          events: gateway.events(sessionId),
          avatarConsent: gateway.store.avatarConsent(sessionId),
          transcriptAuthority: "hermes",
        });
      } catch (error) {
        return routeFailure(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/agent-sessions/:sessionId/messages",
    {
      schema: {
        tags,
        params: sessionParams,
        summary: "Send text into the exact bound persistent session",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["text", "binding"],
          properties: {
            text: { type: "string", minLength: 1, maxLength: 16_384 },
            binding: { type: "object", additionalProperties: true },
            context: {
              type: "object",
              additionalProperties: false,
              required: ["userDisplayName"],
              properties: {
                userDisplayName: {
                  type: "string",
                  minLength: 1,
                  maxLength: 80,
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        return envelope.success(
          request,
          await gateway.sendText(sessionId, request.body as never),
        );
      } catch (error) {
        return routeFailure(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/agent-sessions/:sessionId/stream",
    {
      schema: {
        tags,
        params: sessionParams,
        summary:
          "Return bounded ordered deltas and final text for one serialized turn",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["text", "binding"],
          properties: {
            text: { type: "string", minLength: 1, maxLength: 16_384 },
            binding: { type: "object", additionalProperties: true },
            context: {
              type: "object",
              additionalProperties: false,
              required: ["userDisplayName"],
              properties: {
                userDisplayName: {
                  type: "string",
                  minLength: 1,
                  maxLength: 80,
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      let ended = false;
      let detached = false;
      const turn = new AbortController();
      const disconnect = () => {
        if (!ended) {
          detached = true;
          turn.abort();
        }
      };
      const writeIfAttached = async (event: string, data: unknown) => {
        if (detached || reply.raw.destroyed || reply.raw.writableEnded) return;
        try {
          await writeSse(reply, event, data);
        } catch (error) {
          if (detached || reply.raw.destroyed || reply.raw.writableEnded)
            return;
          throw error;
        }
      };
      request.raw.once("aborted", disconnect);
      reply.raw.once("close", disconnect);
      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      reply.raw.flushHeaders();
      try {
        const result = await gateway.sendText(
          sessionId,
          request.body as never,
          {
            onEvent: (event) => writeIfAttached("world.event", event),
            signal: turn.signal,
          },
        );
        await writeIfAttached("world.final", {
          schema: "aiw.agent-stream-terminal/0.12",
          sessionId,
          status: "completed",
          finalText: result.finalText,
        });
        await writeIfAttached("world.done", {
          schema: "aiw.agent-stream-terminal/0.12",
          sessionId,
          status: "completed",
        });
      } catch (error) {
        if (detached || reply.raw.destroyed || reply.raw.writableEnded) return;
        const message =
          error instanceof GatewayError
            ? error.message.slice(0, 240)
            : "World session stream failed";
        await writeIfAttached("world.error", {
          schema: "aiw.agent-stream-terminal/0.12",
          sessionId,
          status: "error",
          message,
        });
        await writeIfAttached("world.done", {
          schema: "aiw.agent-stream-terminal/0.12",
          sessionId,
          status: "error",
        });
      } finally {
        ended = true;
        request.raw.off("aborted", disconnect);
        reply.raw.off("close", disconnect);
        if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end();
      }
    },
  );
  server.post(
    "/agent-sessions/:sessionId/interrupt",
    {
      schema: {
        tags,
        params: sessionParams,
        summary: "Stop only the exact World-owned active run",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["runId"],
          properties: {
            runId: { type: "string", minLength: 1, maxLength: 256 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        const { runId } = request.body as { runId: string };
        await gateway.interrupt(sessionId, runId);
        return envelope.success(request, {
          sessionId,
          runId,
          status: "interrupt-requested",
        });
      } catch (error) {
        return routeFailure(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/agent-sessions/:sessionId/approvals/:approvalId",
    {
      schema: {
        tags,
        summary:
          "Forward a native approval only when the selected transport proves it",
        params: {
          type: "object",
          additionalProperties: false,
          required: ["sessionId", "approvalId"],
          properties: {
            sessionId: { type: "string", format: "uuid" },
            approvalId: { type: "string", minLength: 1, maxLength: 256 },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["runId", "decision"],
          properties: {
            runId: { type: "string", minLength: 1, maxLength: 256 },
            decision: { type: "string", enum: ["approve", "deny"] },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { sessionId, approvalId } = request.params as {
          sessionId: string;
          approvalId: string;
        };
        const { runId, decision } = request.body as {
          runId: string;
          decision: "approve" | "deny";
        };
        await gateway.resolveApproval(sessionId, runId, approvalId, decision);
        return envelope.success(request, {
          sessionId,
          runId,
          approvalId,
          decision,
          status: "forwarded-unchanged",
        });
      } catch (error) {
        return routeFailure(error, request, reply, envelope);
      }
    },
  );
  server.get(
    "/agent-sessions/:sessionId/avatar-proposal",
    {
      schema: {
        tags,
        params: sessionParams,
        summary: "Get bounded plugin-owned avatar proposal",
      },
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        gateway.status(sessionId);
        return envelope.success(
          request,
          options.avatarProposal
            ? await options.avatarProposal(sessionId)
            : null,
        );
      } catch (error) {
        return routeFailure(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/agent-sessions/:sessionId/avatar-consent",
    {
      schema: {
        tags,
        params: sessionParams,
        summary: "Accept, edit, or decline a bounded avatar proposal",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["decision", "proposal"],
          properties: {
            decision: { type: "string", enum: ["accepted", "declined"] },
            proposal: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        const body = request.body as {
          decision: "accepted" | "declined";
          proposal: unknown;
        };
        return envelope.success(
          request,
          gateway.store.saveAvatarConsent(
            sessionId,
            body.proposal,
            body.decision,
          ),
        );
      } catch (error) {
        return routeFailure(error, request, reply, envelope);
      }
    },
  );
  server.delete(
    "/agent-sessions/:sessionId/avatar-consent",
    {
      schema: {
        tags,
        params: sessionParams,
        summary: "Revoke approved avatar display consent",
      },
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        return envelope.success(
          request,
          gateway.store.revokeAvatarConsent(sessionId),
        );
      } catch (error) {
        return routeFailure(error, request, reply, envelope);
      }
    },
  );
  server.get(
    "/guided-build/designs",
    {
      schema: {
        tags: ["phase12-guided-build-preview"],
        summary:
          "Discover and validate bounded local design metadata without mutation",
      },
    },
    async (request) =>
      envelope.success(
        request,
        options.designRepositoryRoot
          ? discoverDesignPreviews(options.designRepositoryRoot)
          : [],
      ),
  );
}

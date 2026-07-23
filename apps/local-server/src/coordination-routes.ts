import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { projectCoordinationForPresentation } from "@agentintersect-world/multi-agent-coordination";

import {
  CoordinationService,
  CoordinationServiceError,
} from "./coordination-service.js";

type RouteEnvelope = {
  readonly success: <T>(request: FastifyRequest, data: T) => unknown;
  readonly failure: (
    request: FastifyRequest,
    code:
      | "validation"
      | "invalid"
      | "not_found"
      | "conflict"
      | "revision_conflict"
      | "correlation_conflict"
      | "binding_mismatch"
      | "git_refused"
      | "git_failed"
      | "cancelled"
      | "resource_limit"
      | "unavailable"
      | "authority_unavailable"
      | "upstream",
    message: string,
  ) => unknown;
};

function publicMessage(error: CoordinationServiceError): string {
  if (
    error.code === "git-failed" ||
    /(?:^|\s)(?:\/(?:home|tmp|var|etc)\/|[A-Za-z]:[\\/])/.test(error.message) ||
    /(?:PATH|HOME|TOKEN|SECRET|PASSWORD)=/i.test(error.message)
  )
    return "Git operation failed without changing coordination truth";
  return error.message.slice(0, 512);
}

function fail(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
  envelope: RouteEnvelope,
) {
  const serviceError =
    error instanceof CoordinationServiceError
      ? error
      : new CoordinationServiceError(
          "git-failed",
          error instanceof Error
            ? error.message.slice(0, 240)
            : "Coordination operation failed",
        );
  const status =
    serviceError.code === "validation" || serviceError.code === "invalid"
      ? 400
      : serviceError.code === "authority"
        ? 403
        : serviceError.code === "not-found"
          ? 404
          : serviceError.code === "conflict" ||
              serviceError.code === "revision_conflict" ||
              serviceError.code === "correlation_conflict"
            ? 409
            : serviceError.code === "resource-limit"
              ? 413
              : serviceError.code === "unavailable"
                ? 503
                : 422;
  const apiCode =
    serviceError.code === "not-found"
      ? "not_found"
      : serviceError.code === "resource-limit"
        ? "resource_limit"
        : serviceError.code === "git-refused"
          ? "git_refused"
          : serviceError.code === "git-failed"
            ? "git_failed"
            : serviceError.code === "authority"
              ? "authority_unavailable"
              : serviceError.code;
  return reply
    .code(status)
    .send(envelope.failure(request, apiCode, publicMessage(serviceError)));
}

export function registerCoordinationRoutes(
  server: FastifyInstance,
  service: CoordinationService,
  envelope: RouteEnvelope,
): void {
  const tags = ["phase16-coordination"];
  server.get(
    "/coordination/snapshot",
    { schema: { tags, summary: "Get bounded coordination truth" } },
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          projectCoordinationForPresentation(await service.snapshot()),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/coordination/actions",
    {
      bodyLimit: 160 * 1024,
      schema: {
        tags,
        summary: "Apply one explicit operator-approved coordination action",
        body: { type: "object", additionalProperties: true },
      },
    },
    async (request, reply) => {
      try {
        const result = await service.action(request.body);
        return envelope.success(
          request,
          projectCoordinationForPresentation({
            schema: "aiw.coordination-projection/0.16",
            truth: "current",
            snapshot: result.snapshot,
            unavailableReason: null,
          }),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/coordination/reconcile",
    {
      bodyLimit: 8 * 1024,
      schema: {
        tags,
        summary: "Read-only reconcile registered Git worktrees",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["coordinationSessionId", "actor", "operatorApproval"],
          properties: {
            coordinationSessionId: { type: "string", maxLength: 128 },
            actor: { const: "operator" },
            operatorApproval: { const: "approved" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          projectCoordinationForPresentation(
            await service.reconcile(request.body),
          ),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
}

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { Phase17Service, Phase17ServiceError } from "./phase17-service.js";

type RouteEnvelope = {
  readonly success: <T>(request: FastifyRequest, data: T) => unknown;
  readonly failure: (
    request: FastifyRequest,
    code:
      | "validation"
      | "not_found"
      | "conflict"
      | "resource_limit"
      | "authority_unavailable"
      | "unavailable",
    message: string,
  ) => unknown;
};

function fail(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
  envelope: RouteEnvelope,
) {
  const serviceError =
    error instanceof Phase17ServiceError
      ? error
      : new Phase17ServiceError(
          "unavailable",
          "Phase 17 diagnostics operation failed",
        );
  const status =
    serviceError.code === "validation"
      ? 400
      : serviceError.code === "authority"
        ? 403
        : serviceError.code === "not-found"
          ? 404
          : serviceError.code === "conflict"
            ? 409
            : serviceError.code === "resource-limit"
              ? 413
              : 503;
  const code =
    serviceError.code === "not-found"
      ? "not_found"
      : serviceError.code === "resource-limit"
        ? "resource_limit"
        : serviceError.code === "authority"
          ? "authority_unavailable"
          : serviceError.code === "conflict"
            ? "conflict"
            : serviceError.code === "validation"
              ? "validation"
              : "unavailable";
  return reply
    .code(status)
    .send(envelope.failure(request, code, serviceError.message.slice(0, 512)));
}

export function registerPhase17Routes(
  server: FastifyInstance,
  service: Phase17Service,
  envelope: RouteEnvelope,
): void {
  const tags = ["phase17-diagnostics-recovery"];
  const route = (summary: string) => ({
    bodyLimit: 32 * 1024,
    schema: {
      tags,
      summary,
      body: { type: "object", additionalProperties: true },
    },
  });
  server.get(
    "/diagnostics/snapshot",
    {
      schema: {
        tags,
        summary: "Inspect authoritative Phase 17 readiness and recovery truth",
      },
    },
    async (request, reply) => {
      try {
        return envelope.success(request, await service.inspect(request.query));
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/diagnostics/drill/initialize",
    route("Initialize the exact bounded Phase 17 drill state"),
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.initialize(request.body),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/diagnostics/drill/operations",
    route("Start one World-owned bounded drill operation"),
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.startOperation(request.body),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/diagnostics/drill/operations/:operationId/terminate",
    route("Terminate one exact World-owned drill child without completion"),
    async (request, reply) => {
      try {
        const { operationId } = request.params as { operationId: string };
        const body = request.body as { operationId?: unknown };
        if (body.operationId !== operationId)
          throw new Phase17ServiceError(
            "conflict",
            "Path and body operation identity must match exactly",
          );
        return envelope.success(
          request,
          await service.terminateOwnedOperation(request.body),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/diagnostics/recovery/preview",
    route("Preview a no-mutation recovery plan"),
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.previewRecovery(request.body),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/diagnostics/recovery/apply",
    route("Apply explicit safe derived-state recovery"),
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.applyRecovery(request.body),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/diagnostics/preview",
    route("Preview a privacy-safe local diagnostic bundle"),
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.previewDiagnostics(request.body),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/diagnostics/exports",
    route("Export a previously previewed diagnostic bundle locally"),
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.exportDiagnostics(request.body),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.delete(
    "/diagnostics/exports/:exportId",
    route("Delete one exact managed local diagnostic export"),
    async (request, reply) => {
      try {
        const { exportId } = request.params as { exportId: string };
        const body = request.body as { exportId?: unknown };
        if (body.exportId !== exportId)
          throw new Phase17ServiceError(
            "conflict",
            "Path and body export identity must match exactly",
          );
        return envelope.success(
          request,
          await service.deleteExport(request.body),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
}

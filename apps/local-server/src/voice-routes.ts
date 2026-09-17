import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { MAX_ENCODED_AUDIO_BYTES } from "@agentintersect-world/voice";

import type { LocalVoiceInstaller } from "@agentintersect-world/voice/node";
import { VoiceService, VoiceServiceError } from "./voice-service.js";

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

export function registerLocalVoiceSetupRoutes(
  server: FastifyInstance,
  installer: LocalVoiceInstaller,
  envelope: RouteEnvelope,
) {
  server.get("/voice/setup", async (request) =>
    envelope.success(request, await installer.status()),
  );
  server.post(
    "/voice/setup",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["consent"],
          properties: { consent: { const: true } },
        },
      },
    },
    async (request, reply) => {
      try {
        return envelope.success(request, await installer.install(true));
      } catch {
        return reply
          .code(503)
          .send(
            envelope.failure(
              request,
              "authority_unavailable",
              (await installer.status()).message,
            ),
          );
      }
    },
  );
}

function fail(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
  envelope: RouteEnvelope,
) {
  if (!(error instanceof VoiceServiceError)) {
    const providerCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    const status =
      providerCode === "queue-full"
        ? 409
        : providerCode === "unavailable"
          ? 503
          : 502;
    return reply
      .code(status)
      .send(
        envelope.failure(
          request,
          status === 409
            ? "conflict"
            : status === 503
              ? "authority_unavailable"
              : "upstream",
          error instanceof Error
            ? error.message.slice(0, 240)
            : "Local speech provider failed.",
        ),
      );
  }
  const status =
    error.code === "validation"
      ? 400
      : error.code === "not-found"
        ? 404
        : error.code === "stale-binding"
          ? 409
          : error.code === "unavailable"
            ? 503
            : 502;
  return reply
    .code(status)
    .send(
      envelope.failure(
        request,
        status === 400
          ? "validation"
          : status === 404
            ? "not_found"
            : status === 409
              ? "conflict"
              : status === 503
                ? "authority_unavailable"
                : "upstream",
        error.message,
      ),
    );
}

const sessionParams = {
  type: "object",
  additionalProperties: false,
  required: ["sessionId"],
  properties: { sessionId: { type: "string", format: "uuid" } },
} as const;

export function registerVoiceRoutes(
  server: FastifyInstance,
  service: VoiceService,
  envelope: RouteEnvelope,
): void {
  const tags = ["phase15-voice"];
  server.get(
    "/voice/disclosure",
    {
      schema: {
        tags,
        summary: "Disclose exact local voice provider capability",
      },
    },
    async (request, reply) => {
      try {
        return envelope.success(request, await service.disclosure());
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.get(
    "/voice/state",
    {
      schema: {
        tags,
        summary: "Get bounded redacted voice settings and history",
      },
    },
    async (request) => envelope.success(request, service.history()),
  );
  server.put(
    "/voice/sessions/:sessionId/activity",
    {
      schema: {
        tags,
        params: sessionParams,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["activity"],
          properties: {
            activity: {
              type: ["string", "null"],
              enum: ["capture", "playback", null],
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        const { activity } = request.body as {
          activity: "capture" | "playback" | null;
        };
        return envelope.success(
          request,
          service.markActivity(sessionId, activity),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.get(
    "/voice/sessions/:sessionId/preference",
    { schema: { tags, params: sessionParams } },
    async (request) => {
      const { sessionId } = request.params as { sessionId: string };
      return envelope.success(request, service.preference(sessionId));
    },
  );
  server.put(
    "/voice/sessions/:sessionId/preference",
    { schema: { tags, params: sessionParams } },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        const body = request.body as Record<string, unknown>;
        if (body.sessionId !== sessionId)
          throw new VoiceServiceError(
            "validation",
            "Voice preference session mismatch.",
          );
        return envelope.success(request, service.savePreference(body));
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.delete(
    "/voice/sessions/:sessionId/voice-consent",
    { schema: { tags, params: sessionParams } },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        return envelope.success(request, service.revokeVoice(sessionId));
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.post(
    "/voice/sessions/:sessionId/transcriptions",
    {
      bodyLimit: Math.ceil((MAX_ENCODED_AUDIO_BYTES * 4) / 3) + 4_096,
      schema: {
        tags,
        params: sessionParams,
        body: { type: "object", additionalProperties: true },
      },
    },
    async (request, reply) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      request.raw.once("aborted", abort);
      try {
        const { sessionId } = request.params as { sessionId: string };
        return envelope.success(
          request,
          await service.transcribe(sessionId, request.body, controller.signal),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      } finally {
        request.raw.off("aborted", abort);
      }
    },
  );
  server.post(
    "/voice/sessions/:sessionId/send",
    {
      schema: {
        tags,
        params: sessionParams,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["binding", "sessionBinding", "text"],
          properties: {
            binding: { type: "object", additionalProperties: true },
            sessionBinding: { type: "object", additionalProperties: true },
            text: { type: "string", minLength: 1, maxLength: 16_384 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        return envelope.success(
          request,
          await service.sendAccepted(sessionId, request.body as never),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
}

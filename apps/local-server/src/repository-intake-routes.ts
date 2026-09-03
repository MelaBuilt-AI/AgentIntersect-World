import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  RepositoryIntakeError,
  type RepositoryIntakeService,
} from "./repository-intake.js";

type RouteEnvelope = {
  readonly success: <T>(request: FastifyRequest, data: T) => unknown;
  readonly failure: (
    request: FastifyRequest,
    code: "validation" | "not_found" | "conflict" | "unavailable",
    message: string,
  ) => unknown;
};

function fail(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
  envelope: RouteEnvelope,
) {
  if (!(error instanceof RepositoryIntakeError)) throw error;
  const status =
    error.code === "validation"
      ? 400
      : error.code === "not-found"
        ? 404
        : error.code === "conflict"
          ? 409
          : 503;
  return reply
    .code(status)
    .send(
      envelope.failure(
        request,
        error.code === "not-found" ? "not_found" : error.code,
        error.message,
      ),
    );
}

const projectBody = {
  type: "object",
  additionalProperties: false,
  required: ["rootPath"],
  properties: {
    rootPath: { type: "string", minLength: 1, maxLength: 4096 },
    name: { type: "string", minLength: 1, maxLength: 120 },
  },
} as const;

export function registerRepositoryIntakeRoutes(
  server: FastifyInstance,
  service: RepositoryIntakeService,
  envelope: RouteEnvelope,
): void {
  const tags = ["repository-intake"];

  server.get(
    "/repository-intake/projects",
    { schema: { tags, summary: "List recent local projects" } },
    async (request) =>
      envelope.success(request, { projects: await service.list() }),
  );

  server.post(
    "/repository-intake/open",
    {
      schema: {
        tags,
        summary: "Open one existing local repository",
        body: projectBody,
      },
    },
    async (request, reply) => {
      try {
        const input = request.body as { rootPath: string; name?: string };
        return reply.code(201).send(
          envelope.success(request, {
            project: await service.openLocal(input),
          }),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.post(
    "/repository-intake/create",
    {
      schema: {
        tags,
        summary: "Create one new local Git repository",
        body: { ...projectBody, required: ["rootPath", "name"] },
      },
    },
    async (request, reply) => {
      try {
        const input = request.body as { rootPath: string; name: string };
        return reply.code(201).send(
          envelope.success(request, {
            project: await service.create(input),
          }),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.post(
    "/repository-intake/clone",
    {
      schema: {
        tags,
        summary: "Clone one GitHub repository",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["repository", "destination"],
          properties: {
            repository: { type: "string", minLength: 1, maxLength: 512 },
            destination: { type: "string", minLength: 1, maxLength: 4096 },
            name: { type: "string", minLength: 1, maxLength: 120 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const input = request.body as {
          repository: string;
          destination: string;
          name?: string;
        };
        return reply.code(201).send(
          envelope.success(request, {
            project: await service.cloneGitHub(input),
          }),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );

  server.post(
    "/repository-intake/projects/:projectId/pin",
    {
      schema: {
        tags,
        summary: "Pin or unpin one saved project",
        params: {
          type: "object",
          additionalProperties: false,
          required: ["projectId"],
          properties: {
            projectId: { type: "string", minLength: 1, maxLength: 128 },
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
        const { projectId } = request.params as { projectId: string };
        const { pinned } = request.body as { pinned: boolean };
        return envelope.success(request, {
          project: await service.pin(projectId, pinned),
        });
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
}

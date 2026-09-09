import type { FastifyInstance } from "fastify";
import type { RepositoryGitService } from "./repository-git.js";
import { fail, type RouteEnvelope } from "./repository-intake-routes.js";

export function registerRepositoryGitRoutes(
  server: FastifyInstance,
  service: RepositoryGitService,
  envelope: RouteEnvelope,
): void {
  server.get<{
    Params: { projectId: string };
    Querystring: { workstreamId?: string; remote: string };
  }>(
    "/repository-intake/projects/:projectId/github",
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.github(
            request.params.projectId,
            request.query.remote,
            request.query.workstreamId,
          ),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
  server.get<{
    Params: { projectId: string };
    Querystring: { workstreamId?: string };
  }>("/repository-intake/projects/:projectId/git", async (request, reply) => {
    try {
      return envelope.success(
        request,
        await service.status(
          request.params.projectId,
          request.query.workstreamId,
        ),
      );
    } catch (error) {
      return fail(error, request, reply, envelope);
    }
  });
  server.post<{ Params: { projectId: string } }>(
    "/repository-intake/projects/:projectId/git",
    { bodyLimit: 32 * 1024 },
    async (request, reply) => {
      try {
        return envelope.success(
          request,
          await service.mutate(request.params.projectId, request.body),
        );
      } catch (error) {
        return fail(error, request, reply, envelope);
      }
    },
  );
}

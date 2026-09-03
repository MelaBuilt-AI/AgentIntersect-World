import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PreviewManagerService } from "../src/preview-manager-service.js";
import { createLocalServer } from "../src/server.js";

const roots: string[] = [];
const servers: ReturnType<typeof createLocalServer>[] = [];

const repository = {
  repositoryId: "repo-current",
  revision: "repository-revision-1",
} as const;
const agent = {
  agentId: "codex-one",
  nativeSessionId: "codex-effective-one",
  rootNativeSessionId: "codex-root-one",
  revision: "8",
} as const;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "aiw-preview-api-"));
  roots.push(root);
  const worktree = join(root, "worktree");
  await mkdir(worktree);
  await writeFile(
    join(worktree, "preview.mjs"),
    `import http from "node:http";
const server = http.createServer((request, response) => {
  response.statusCode = 200;
  response.setHeader("content-type", request.url === "/health" ? "application/json" : "text/html");
  response.end(request.url === "/health" ? JSON.stringify({ ok: true }) : "<!doctype html><title>API preview</title><main>ready</main>");
});
server.listen(Number(process.env.PORT), process.env.HOST);
`,
  );
  const service = new PreviewManagerService({
    directory: join(root, "store"),
    resolveWorkstream: async () => ({
      workstreamId: "workstream-one",
      workstreamRevision: 4,
      repository,
      agent,
      worktreeId: "worktree-one",
      worktreeState: "current",
      worktreePath: worktree,
    }),
    startupTimeoutMs: 1_000,
    healthPollMs: 20,
  });
  const server = createLocalServer({ previewManagerService: service });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Preview Manager API", () => {
  it("approves, lists, starts, reads, and stops an exact Workstream preview", async () => {
    const server = await fixture();
    const approved = await server.inject({
      method: "POST",
      url: "/preview-recipes",
      payload: {
        requestId: "approve-one",
        correlationId: "approve-correlation-one",
        recipeId: "preview-web",
        expectedRevision: null,
        repositoryId: repository.repositoryId,
        label: "Web preview",
        executable: process.execPath,
        args: ["preview.mjs"],
        readinessPath: "/health",
        browserPath: "/",
      },
    });
    expect(approved.statusCode).toBe(201);
    expect(approved.json()).toMatchObject({
      ok: true,
      data: { recipe: { recipeId: "preview-web", revision: 1 } },
      meta: { schema: "aiw.api/0.3" },
    });

    const recipes = await server.inject({
      method: "GET",
      url: `/preview-recipes?repositoryId=${repository.repositoryId}`,
    });
    expect(recipes.statusCode).toBe(200);
    expect(recipes.json().data).toHaveLength(1);

    const started = await server.inject({
      method: "POST",
      url: "/workstreams/workstream-one/previews",
      payload: {
        requestId: "start-one",
        correlationId: "start-correlation-one",
        expectedWorkstreamRevision: 4,
        repository,
        agent,
        recipeId: "preview-web",
        expectedRecipeRevision: 1,
      },
    });
    expect(started.statusCode).toBe(201);
    expect(started.json()).toMatchObject({
      ok: true,
      data: { preview: { state: "ready", workstreamId: "workstream-one" } },
    });
    const previewRevision = started.json().data.preview.revision as number;

    const current = await server.inject({
      method: "GET",
      url: "/workstreams/workstream-one/previews/current",
    });
    expect(current.statusCode).toBe(200);
    expect(current.json().data).toMatchObject({
      display: { truth: "current", preview: { state: "ready" } },
    });

    const stopped = await server.inject({
      method: "POST",
      url: "/workstreams/workstream-one/previews/current/stop",
      payload: {
        requestId: "stop-one",
        correlationId: "stop-correlation-one",
        expectedPreviewRevision: previewRevision,
      },
    });
    expect(stopped.statusCode).toBe(200);
    expect(stopped.json().data.preview).toMatchObject({
      state: "stopped",
      portClosed: true,
    });
  });

  it("rejects command, cwd, and environment fields at the start boundary", async () => {
    const server = await fixture();
    for (const field of ["command", "args", "cwd", "environment"]) {
      const rejected = await server.inject({
        method: "POST",
        url: "/workstreams/workstream-one/previews",
        payload: {
          requestId: `start-${field}`,
          correlationId: `start-correlation-${field}`,
          expectedWorkstreamRevision: 4,
          repository,
          agent,
          recipeId: "preview-web",
          expectedRecipeRevision: 1,
          [field]: field === "environment" ? { TOKEN: "no" } : "not-allowed",
        },
      });
      expect(rejected.statusCode).toBe(400);
      expect(rejected.json().error.code).toBe("validation");
    }
  });
});

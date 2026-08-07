import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { createLocalServer } from "../src/server.js";
import { WorkstreamService } from "../src/workstream-service.js";
import { WorktreeAuthority } from "../src/worktree-authority.js";

const executeFile = promisify(execFile);
const roots: string[] = [];

const repository = {
  repositoryId: "repo-current",
  revision: "repository-revision-1",
} as const;
const agent = {
  agentId: "mr-fluff",
  nativeSessionId: "hermes-session-current",
  revision: "agent-revision-1",
} as const;

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await executeFile("git", [...args], {
    cwd,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_AUTHOR_NAME: "Workstream API Test",
      GIT_AUTHOR_EMAIL: "workstream-api@example.invalid",
      GIT_COMMITTER_NAME: "Workstream API Test",
      GIT_COMMITTER_EMAIL: "workstream-api@example.invalid",
      LC_ALL: "C",
    },
  });
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "aiw-workstream-api-"));
  roots.push(root);
  const repositoryRoot = join(root, "repository");
  const worktreeParent = join(root, "worktrees");
  await mkdir(repositoryRoot);
  await mkdir(worktreeParent);
  await git(root, ["init", "--initial-branch=main", repositoryRoot]);
  await writeFile(join(repositoryRoot, "README.md"), "# API fixture\n");
  await git(repositoryRoot, ["add", "README.md"]);
  await git(repositoryRoot, ["commit", "-m", "fixture: initial"]);
  const authority = new WorktreeAuthority({
    approvedRepositoryRoot: repositoryRoot,
    allowedWorktreeParent: worktreeParent,
  });
  const service = new WorkstreamService({
    directory: join(root, "store"),
    worktreeAuthority: authority,
    currentRepository: () => repository,
    connectedAgent: (agentId) => (agentId === agent.agentId ? agent : null),
    evidenceReader: { read: async () => [] },
    id: () => "workstream-api-one",
    now: () => Date.parse("2026-08-07T00:00:00.000Z"),
  });
  return createLocalServer({ workstreamService: service });
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Workstream API", () => {
  it("creates, reads, and idempotently cancels one owned workstream", async () => {
    const server = await fixture();
    const createBody = {
      requestId: "request-create-one",
      correlationId: "correlation-create-one",
      title: "Implement one bounded workstream",
      repository,
      agent,
    };
    const created = await server.inject({
      method: "POST",
      url: "/workstreams",
      payload: createBody,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      ok: true,
      data: {
        replayed: false,
        workstream: { workstreamId: "workstream-api-one", status: "working" },
      },
      meta: { schema: "aiw.api/0.3" },
    });

    const current = await server.inject({
      method: "GET",
      url: "/workstreams/current",
    });
    expect(current.statusCode).toBe(200);
    expect(current.json().data.workstreamId).toBe("workstream-api-one");
    const read = await server.inject({
      method: "GET",
      url: "/workstreams/workstream-api-one",
    });
    expect(read.statusCode).toBe(200);

    const cancelBody = {
      requestId: "request-cancel-one",
      correlationId: "correlation-cancel-one",
      expectedRevision: 1,
      repository,
      agent,
    };
    const cancelled = await server.inject({
      method: "POST",
      url: "/workstreams/workstream-api-one/cancel",
      payload: cancelBody,
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().data).toMatchObject({
      replayed: false,
      workstream: { status: "cancelled", worktreeState: "removed" },
    });
    const replay = await server.inject({
      method: "POST",
      url: "/workstreams/workstream-api-one/cancel",
      payload: cancelBody,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().data.replayed).toBe(true);
    await server.close();
  });

  it("returns an explicit absent current state and correlated errors", async () => {
    const server = await fixture();
    const absent = await server.inject({
      method: "GET",
      url: "/workstreams/current",
      headers: {
        "x-correlation-id": "00000000-0000-4000-8000-000000000014",
      },
    });
    expect(absent.statusCode).toBe(404);
    expect(absent.json()).toMatchObject({
      ok: false,
      error: { code: "not_found", retryable: false },
      meta: {
        correlationId: "00000000-0000-4000-8000-000000000014",
        schema: "aiw.api/0.3",
      },
    });
    await server.close();
  });

  it("rejects unknown and executor-shaped fields at the HTTP boundary", async () => {
    const server = await fixture();
    for (const field of ["repositoryRoot", "worktreePath", "command", "argv"]) {
      const response = await server.inject({
        method: "POST",
        url: "/workstreams",
        payload: {
          requestId: `request-${field}`,
          correlationId: `correlation-${field}`,
          title: "Rejected authority input",
          repository,
          agent,
          [field]: field === "argv" ? ["git", "status"] : "/tmp/not-allowed",
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("validation");
    }
    await server.close();
  });
});

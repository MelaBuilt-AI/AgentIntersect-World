import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { repositoryReferenceForPath } from "@agentintersect-world/spatial-code-graph";
import { RepositoryIntakeService } from "../src/repository-intake.js";
import { WorktreeAuthority } from "../src/worktree-authority.js";
import { createLocalServer } from "../src/server.js";
import {
  WorkstreamService,
  WorkstreamServiceError,
  type WorkstreamAgentReference,
  type WorkstreamCreateRequest,
  type WorkstreamRepositoryReference,
} from "../src/workstream-service.js";

const executeFile = promisify(execFile);
const roots: string[] = [];
const services: WorkstreamService[] = [];
const authorities: WorktreeAuthority[] = [];

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const { stdout } = await executeFile("git", [...args], {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_AUTHOR_NAME: "Workstream Service Test",
      GIT_AUTHOR_EMAIL: "workstream-service@example.invalid",
      GIT_COMMITTER_NAME: "Workstream Service Test",
      GIT_COMMITTER_EMAIL: "workstream-service@example.invalid",
      LC_ALL: "C",
    },
  });
  return stdout;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const repositoryReference: WorkstreamRepositoryReference = {
  repositoryId: "repo-current",
  revision: "repository-revision-1",
};

const agentReference: WorkstreamAgentReference = {
  agentId: "mr-fluff",
  nativeSessionId: "hermes-session-current",
  revision: "agent-revision-1",
};

type Fixture = {
  readonly root: string;
  readonly repository: string;
  readonly worktrees: string;
  readonly store: string;
  readonly authority: WorktreeAuthority;
  readonly service: WorkstreamService;
  currentRepository: WorkstreamRepositoryReference | null;
  currentAgent: WorkstreamAgentReference | null;
};

async function fixture(
  options: {
    readonly previewStop?: (workstreamId: string) => Promise<void> | void;
    readonly id?: () => string;
  } = {},
): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "aiw-workstream-service-"));
  roots.push(root);
  const repository = join(root, "repository");
  const worktrees = join(root, "worktrees");
  const store = join(root, "store");
  await mkdir(repository);
  await mkdir(worktrees);
  await git(root, ["init", "--initial-branch=main", repository]);
  await writeFile(join(repository, "README.md"), "# workstream fixture\n");
  await git(repository, ["add", "README.md"]);
  await git(repository, ["commit", "-m", "fixture: initial"]);
  const authority = new WorktreeAuthority({
    approvedRepositoryRoot: repository,
    allowedWorktreeParent: worktrees,
  });
  authorities.push(authority);
  const state: {
    currentRepository: WorkstreamRepositoryReference | null;
    currentAgent: WorkstreamAgentReference | null;
  } = {
    currentRepository: repositoryReference,
    currentAgent: agentReference,
  };
  const service = new WorkstreamService({
    directory: store,
    worktreeAuthority: authority,
    worktreeParent: worktrees,
    currentRepository: () => state.currentRepository,
    connectedAgent: (agentId) =>
      state.currentAgent?.agentId === agentId ? state.currentAgent : null,
    evidenceReader: { read: vi.fn(async () => []) },
    ...(options.previewStop ? { previewStop: options.previewStop } : {}),
    id: options.id ?? (() => "workstream-one"),
    now: () => Date.parse("2026-08-07T00:00:00.000Z"),
  });
  services.push(service);
  return {
    root,
    repository,
    worktrees,
    store,
    authority,
    service,
    get currentRepository() {
      return state.currentRepository;
    },
    set currentRepository(value) {
      state.currentRepository = value;
    },
    get currentAgent() {
      return state.currentAgent;
    },
    set currentAgent(value) {
      state.currentAgent = value;
    },
  };
}

function createRequest(
  values: Partial<WorkstreamCreateRequest> = {},
): WorkstreamCreateRequest {
  return {
    requestId: "request-create-one",
    correlationId: "correlation-create-one",
    title: "Implement one bounded workstream",
    repository: repositoryReference,
    agent: agentReference,
    ...values,
  };
}

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.dispose()));
  await Promise.all(
    authorities.splice(0).map((authority) => authority.dispose()),
  );
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("WorkstreamService", () => {
  it("lists saved dirty work in the project library without loading or dispatching work", async () => {
    const value = await fixture();
    const repository = {
      ...repositoryReference,
      repositoryId: repositoryReferenceForPath(value.repository),
    };
    value.currentRepository = repository;
    const work = (await value.service.create(createRequest({ repository })))
      .workstream;
    const dirtyFile = join(
      value.worktrees,
      work.authority.relativePath,
      "unfinished.txt",
    );
    await writeFile(dirtyFile, "keep my unfinished work");
    await value.service.recordAgentTurnOutcome(agentReference.agentId);
    const intake = new RepositoryIntakeService(
      join(value.root, "library.json"),
    );
    await intake.openLocal({ rootPath: value.repository });
    const server = createLocalServer({
      workstreamService: value.service,
      repositoryIntakeService: intake,
    });
    try {
      const response = await server.inject({
        method: "GET",
        url: "/repository-intake/projects",
      });
      expect(response.statusCode).toBe(200);
      const project = response.json().data.projects[0];
      expect(project.workstreams[0]).toMatchObject({
        workstreamId: work.workstreamId,
        nativeSessionId: agentReference.nativeSessionId,
        worktreeState: "dirty",
      });
      expect(project.milestones).not.toHaveLength(0);
      expect(server.currentRepositorySelection()).toBeNull();
      expect(await readFile(dirtyFile, "utf8")).toBe("keep my unfinished work");
    } finally {
      await server.close();
    }
  });
  it("records a readable completion without clipped native narration", async () => {
    const value = await fixture();
    await value.service.create(createRequest());
    await value.service.recordAgentTurnOutcome(agentReference.agentId);
    const current = await value.service.current();
    const report = current!.events.at(-1)!.summary;
    expect(report).toContain("**Changed files:**");
    expect(report).toContain("\n\n**Checks:**\n");
    expect(report).toContain("No validation evidence reported.");
    expect(report).toMatch(/Full details: Workstream Inspector\.$/u);
    expect(report.length).toBeLessThanOrEqual(512);
  });
  it("summarizes long commands while retaining exact validation evidence", async () => {
    const value = await fixture();
    const created = (await value.service.create(createRequest())).workstream;
    const command = `node -e '${"assert.equal(heading, expected);".repeat(30)}'`;
    const checks = [
      { command, exitCode: 0, summary: "Fixture check passed" },
      {
        command: "node --test tests/homepage.test.mjs",
        exitCode: 0,
        summary: "Fixture test passed",
      },
      {
        command: "git diff --check",
        exitCode: 1,
        summary: "Fixture whitespace failure",
      },
    ];
    await mkdir(join(value.store, "reports"), { recursive: true });
    await writeFile(
      join(value.store, "reports", `${created.workstreamId}.json`),
      JSON.stringify({
        schema: "aiw.workstream-report/1",
        workstreamId: created.workstreamId,
        activity:
          "Updated the requested heading; full native reply stays separate.",
        validation: checks,
        evidenceRefs: [],
      }),
    );
    await value.service.recordAgentTurnOutcome(agentReference.agentId);
    const current = (await value.service.current())!;
    const report = current.events.at(-1)!.summary;
    expect(report).toContain("Inline Node.js check: **passed**");
    expect(report).toContain("Whitespace check: **failed**");
    expect(report).toContain("2 passed, 1 failed.");
    expect(report).not.toContain("assert.equal");
    expect(report).not.toContain("Updated the requested heading");
    expect(report).toMatch(/Full details: Workstream Inspector\.$/u);
    expect(report.length).toBeLessThanOrEqual(512);
    expect(current.projection.validation).toEqual(checks);
  });

  it("starts a PR-intent branch at an exact commit and retains prior work across restart", async () => {
    let nextId = 0;
    const value = await fixture({ id: () => `workstream-${++nextId}` });
    const first = (await value.service.create(createRequest())).workstream;
    await value.service.recordAgentTurnOutcome(agentReference.agentId);
    await writeFile(join(value.repository, "later.txt"), "later");
    await git(value.repository, ["add", "later.txt"]);
    await git(value.repository, ["commit", "-m", "later"]);
    const second = (
      await value.service.create(
        createRequest({
          requestId: "second",
          correlationId: "second",
          branch: "feature/new-page",
          startPoint: first.authority.head,
          prIntent: "draft",
        }),
      )
    ).workstream;
    expect(second.authority.branch).toBe("feature/new-page");
    expect(second.authority.head).toBe(first.authority.head);
    expect(second.prIntent).toBe("draft");
    expect(
      await exists(join(value.worktrees, first.authority.relativePath)),
    ).toBe(true);
    await value.service.recordAgentTurnOutcome(agentReference.agentId);
    await value.service.dispose();
    const restarted = new WorkstreamService({
      directory: value.store,
      worktreeAuthority: value.authority,
      worktreeParent: value.worktrees,
      currentRepository: () => repositoryReference,
      connectedAgent: () => agentReference,
      evidenceReader: { read: () => [] },
    });
    services.push(restarted);
    expect(
      (await restarted.history(repositoryReference.repositoryId))
        .map((work) => work.workstreamId)
        .sort(),
    ).toEqual([first.workstreamId, second.workstreamId].sort());
    expect(await restarted.history("unrelated-repository")).toEqual([]);
    const restored = await restarted.continueSaved({
      workstreamId: first.workstreamId,
      expectedRevision: first.revision + 1,
      repository: repositoryReference,
      agent: agentReference,
      confirm: true,
    });
    expect(restored.workstream.authority.relativePath).toBe(
      first.authority.relativePath,
    );
  });
  it("discovers saved work after a new session and explicitly continues the same dirty worktree", async () => {
    const value = await fixture();
    const created = (await value.service.create(createRequest())).workstream;
    const worktree = join(value.worktrees, created.authority.relativePath);
    await writeFile(join(worktree, "index.html"), "saved website");
    value.currentAgent = {
      ...agentReference,
      agentId: "new-agent",
      nativeSessionId: "new-native",
    };
    value.currentRepository = {
      ...repositoryReference,
      revision: "reloaded-revision",
    };
    const server = createLocalServer({ workstreamService: value.service });
    try {
      const history = await server.inject({
        method: "GET",
        url: `/workstreams/history?repositoryId=${repositoryReference.repositoryId}`,
      });
      expect(history.statusCode).toBe(200);
      expect(history.json().data.workstreams[0].workstreamId).toBe(
        created.workstreamId,
      );
      const continued = await server.inject({
        method: "POST",
        url: `/workstreams/${created.workstreamId}/continue`,
        payload: {
          expectedRevision: created.revision,
          repository: value.currentRepository,
          agent: value.currentAgent,
          confirm: true,
        },
      });
      expect(continued.statusCode).toBe(200);
      expect(continued.json().data.workstream).toMatchObject({
        workstreamId: created.workstreamId,
        agent: value.currentAgent,
        repository: value.currentRepository,
        status: "ready-for-review",
        worktreeState: "dirty",
        authority: { relativePath: created.authority.relativePath },
      });
      expect(await readFile(join(worktree, "index.html"), "utf8")).toBe(
        "saved website",
      );
      const stale = await server.inject({
        method: "POST",
        url: `/workstreams/${created.workstreamId}/continue`,
        payload: {
          expectedRevision: created.revision,
          repository: value.currentRepository,
          agent: value.currentAgent,
          confirm: true,
        },
      });
      expect(stale.statusCode).toBe(409);
    } finally {
      await server.close();
    }
  });
  it("requires the approved current repository and exact connected session before mutation", async () => {
    const value = await fixture();
    value.currentRepository = null;
    await expect(value.service.create(createRequest())).rejects.toMatchObject({
      code: "repository-mismatch",
    });
    value.currentRepository = repositoryReference;
    value.currentAgent = null;
    await expect(value.service.create(createRequest())).rejects.toMatchObject({
      code: "agent-mismatch",
    });
    expect(
      await git(value.repository, ["worktree", "list", "--porcelain"]),
    ).not.toContain(value.worktrees);
  });

  it("allocates exactly one real authority worktree without a Phase 14 executor", async () => {
    const value = await fixture();
    const createGenerated = vi.spyOn(value.authority, "createGenerated");
    const result = await value.service.create(createRequest());

    expect(createGenerated).toHaveBeenCalledTimes(1);
    expect(result.replayed).toBe(false);
    expect(result.workstream).toMatchObject({
      workstreamId: "workstream-one",
      status: "working",
      repository: repositoryReference,
      agent: agentReference,
      evidenceOperationRefs: [],
      authority: { state: "current", statusSummary: "clean" },
    });
    expect(result.workstream.events.map((event) => event.status)).toEqual([
      "planning",
      "working",
    ]);
  });

  it("resolves an exact attested Workstream worktree for an approved preview", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    const worktreePath = join(
      value.worktrees,
      created.workstream.authority.relativePath,
    );
    await writeFile(join(worktreePath, "preview-change.txt"), "preview this\n");

    await expect(
      value.service.previewBinding({
        workstreamId: created.workstream.workstreamId,
        expectedWorkstreamRevision: created.workstream.revision,
        repository: created.workstream.repository,
        agent: created.workstream.agent,
      }),
    ).resolves.toEqual({
      workstreamId: created.workstream.workstreamId,
      workstreamRevision: created.workstream.revision,
      repository: created.workstream.repository,
      agent: created.workstream.agent,
      worktreeId: created.workstream.authority.worktreeId,
      worktreeState: "dirty",
      worktreePath,
    });
    await expect(
      value.service.previewBinding({
        workstreamId: created.workstream.workstreamId,
        expectedWorkstreamRevision: created.workstream.revision + 1,
        repository: created.workstream.repository,
        agent: created.workstream.agent,
      }),
    ).rejects.toMatchObject({ code: "revision-conflict" });
  });

  it("records a revision-bound iteration on the same owned Workstream", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    const beforeWorktrees = await git(value.repository, [
      "worktree",
      "list",
      "--porcelain",
    ]);

    const iterated = await value.service.iterate({
      requestId: "request-iterate-one",
      correlationId: "correlation-iterate-one",
      workstreamId: created.workstream.workstreamId,
      expectedRevision: created.workstream.revision,
      feedback: "Change the active state to blue.",
      repository: repositoryReference,
      agent: agentReference,
    });

    expect(iterated.replayed).toBe(false);
    expect(iterated.workstream).toMatchObject({
      workstreamId: created.workstream.workstreamId,
      revision: created.workstream.revision + 1,
      status: "working",
      repository: repositoryReference,
      agent: agentReference,
      authority: { worktreeId: created.workstream.authority.worktreeId },
    });
    expect(iterated.workstream.events.at(-1)).toMatchObject({
      status: "working",
      summary: "Iteration requested · Change the active state to blue.",
    });
    expect(
      await git(value.repository, ["worktree", "list", "--porcelain"]),
    ).toBe(beforeWorktrees);

    await expect(
      value.service.iterate({
        requestId: "request-iterate-stale",
        correlationId: "correlation-iterate-stale",
        workstreamId: created.workstream.workstreamId,
        expectedRevision: created.workstream.revision,
        feedback: "Try another stale change.",
        repository: repositoryReference,
        agent: agentReference,
      }),
    ).rejects.toMatchObject({ code: "revision-conflict" });
  });

  it("replays duplicate request and correlation ids deterministically", async () => {
    const value = await fixture();
    const request = createRequest();
    const first = await value.service.create(request);
    const replay = await value.service.create(request);

    expect(replay).toEqual({ ...first, replayed: true });
    await expect(
      value.service.create({ ...request, title: "Conflicting title" }),
    ).rejects.toBeInstanceOf(WorkstreamServiceError);
    await expect(
      value.service.create({
        ...request,
        requestId: "request-create-two",
        title: "Conflicting correlation",
      }),
    ).rejects.toMatchObject({ code: "correlation-conflict" });
    expect(
      (await git(value.repository, ["worktree", "list", "--porcelain"]))
        .split("\n")
        .filter((line) => line.startsWith("worktree ")),
    ).toHaveLength(2);
  });

  it("persists only bounded lifecycle and authority/evidence references", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    const paths = value.service.pathsForTest();
    const persisted = await readFile(paths.current, "utf8");

    expect(persisted).toContain('"schema": "aiw.workstream-store/1"');
    expect(persisted).toContain(created.workstream.authority.attestation);
    expect(persisted).not.toContain(value.repository);
    expect(persisted).not.toContain(value.worktrees);
    expect(persisted).not.toMatch(/rawSource|fullDiff|credential|commandLine/);
  });

  it("recovers the same dirty workstream as cleanup-required after restart", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    const worktreePath = join(
      value.worktrees,
      created.workstream.authority.relativePath,
    );
    await writeFile(join(worktreePath, "dirty.txt"), "preserve on restart\n");
    await value.service.dispose();
    const authority = new WorktreeAuthority({
      approvedRepositoryRoot: value.repository,
      allowedWorktreeParent: value.worktrees,
    });
    authorities.push(authority);
    const restarted = new WorkstreamService({
      directory: value.store,
      worktreeAuthority: authority,
      currentRepository: () => repositoryReference,
      connectedAgent: () => agentReference,
      evidenceReader: { read: async () => [] },
    });
    services.push(restarted);

    expect(await restarted.current()).toMatchObject({
      workstreamId: created.workstream.workstreamId,
      status: "cleanup-required",
      authority: { state: "dirty" },
    });
    expect(await exists(worktreePath)).toBe(true);
  });

  it("recovers a missing owned worktree as blocked without replacement", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    const worktreePath = join(
      value.worktrees,
      created.workstream.authority.relativePath,
    );
    await git(value.repository, ["worktree", "remove", worktreePath]);
    await value.service.dispose();
    const authority = new WorktreeAuthority({
      approvedRepositoryRoot: value.repository,
      allowedWorktreeParent: value.worktrees,
    });
    authorities.push(authority);
    const restarted = new WorkstreamService({
      directory: value.store,
      worktreeAuthority: authority,
      currentRepository: () => repositoryReference,
      connectedAgent: () => agentReference,
      evidenceReader: { read: async () => [] },
    });
    services.push(restarted);

    expect(await restarted.current()).toMatchObject({
      workstreamId: created.workstream.workstreamId,
      status: "blocked",
      worktreeState: "missing",
    });
    expect(await exists(worktreePath)).toBe(false);
  });

  it("recovers the checksummed previous generation when current storage is corrupt", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    await value.service.cancel({
      requestId: "request-cancel-before-corruption",
      correlationId: "correlation-cancel-before-corruption",
      workstreamId: created.workstream.workstreamId,
      expectedRevision: created.workstream.revision,
      repository: repositoryReference,
      agent: agentReference,
    });
    const paths = value.service.pathsForTest();
    await writeFile(paths.current, '{"corrupt":true}\n');
    await value.service.dispose();
    const authority = new WorktreeAuthority({
      approvedRepositoryRoot: value.repository,
      allowedWorktreeParent: value.worktrees,
    });
    authorities.push(authority);
    const restarted = new WorkstreamService({
      directory: value.store,
      worktreeAuthority: authority,
      currentRepository: () => repositoryReference,
      connectedAgent: () => agentReference,
      evidenceReader: { read: async () => [] },
    });
    services.push(restarted);

    expect(await restarted.current()).toMatchObject({
      workstreamId: created.workstream.workstreamId,
      status: "blocked",
      worktreeState: "missing",
    });
    expect(await readFile(paths.current, "utf8")).toContain(
      '"schema": "aiw.workstream-store/1"',
    );
  });

  it("cancels and removes only an attested clean owned worktree", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    const worktreePath = join(
      value.worktrees,
      created.workstream.authority.relativePath,
    );
    const cancelled = await value.service.cancel({
      requestId: "request-cancel-one",
      correlationId: "correlation-cancel-one",
      workstreamId: created.workstream.workstreamId,
      expectedRevision: created.workstream.revision,
      repository: repositoryReference,
      agent: agentReference,
    });

    expect(cancelled.workstream.status).toBe("cancelled");
    expect(cancelled.replayed).toBe(false);
    expect(await exists(worktreePath)).toBe(false);
  });

  it("stops an owned preview before cancelling its Workstream worktree", async () => {
    let worktreePath = "";
    const previewStop = vi.fn(async () => {
      expect(await exists(worktreePath)).toBe(true);
    });
    const value = await fixture({ previewStop });
    const created = await value.service.create(createRequest());
    worktreePath = join(
      value.worktrees,
      created.workstream.authority.relativePath,
    );

    await value.service.cancel({
      requestId: "request-cancel-with-preview",
      correlationId: "correlation-cancel-with-preview",
      workstreamId: created.workstream.workstreamId,
      expectedRevision: created.workstream.revision,
      repository: repositoryReference,
      agent: agentReference,
    });

    expect(previewStop).toHaveBeenCalledOnce();
    expect(previewStop).toHaveBeenCalledWith(created.workstream.workstreamId);
    expect(await exists(worktreePath)).toBe(false);
  });

  it("retains a dirty worktree and changes cancellation to cleanup-required", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    const worktreePath = join(
      value.worktrees,
      created.workstream.authority.relativePath,
    );
    await writeFile(join(worktreePath, "dirty.txt"), "preserve me\n");
    const cancelled = await value.service.cancel({
      requestId: "request-cancel-dirty",
      correlationId: "correlation-cancel-dirty",
      workstreamId: created.workstream.workstreamId,
      expectedRevision: created.workstream.revision,
      repository: repositoryReference,
      agent: agentReference,
    });

    expect(cancelled.workstream).toMatchObject({
      status: "cleanup-required",
      authority: { state: "dirty" },
    });
    expect(await exists(worktreePath)).toBe(true);
  });

  it("refuses stale repository, agent, owner, and revision references before cancellation", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    const worktreePath = join(
      value.worktrees,
      created.workstream.authority.relativePath,
    );
    const base = {
      requestId: "request-cancel-stale",
      correlationId: "correlation-cancel-stale",
      workstreamId: created.workstream.workstreamId,
      expectedRevision: created.workstream.revision,
      repository: repositoryReference,
      agent: agentReference,
    } as const;
    await expect(
      value.service.cancel({
        ...base,
        repository: { ...repositoryReference, revision: "stale" },
      }),
    ).rejects.toMatchObject({ code: "repository-mismatch" });
    await expect(
      value.service.cancel({
        ...base,
        requestId: "request-cancel-stale-agent",
        correlationId: "correlation-cancel-stale-agent",
        agent: { ...agentReference, nativeSessionId: "wrong-session" },
      }),
    ).rejects.toMatchObject({ code: "agent-mismatch" });
    await expect(
      value.service.cancel({
        ...base,
        requestId: "request-cancel-stale-revision",
        correlationId: "correlation-cancel-stale-revision",
        expectedRevision: created.workstream.revision + 1,
      }),
    ).rejects.toMatchObject({ code: "revision-conflict" });
    expect(await exists(worktreePath)).toBe(true);
  });

  it("allows only one active workstream", async () => {
    const value = await fixture();
    await value.service.create(createRequest());

    await expect(
      value.service.create(
        createRequest({
          requestId: "request-create-two",
          correlationId: "correlation-create-two",
          title: "Second active workstream",
        }),
      ),
    ).rejects.toMatchObject({ code: "active-workstream" });
  });
});

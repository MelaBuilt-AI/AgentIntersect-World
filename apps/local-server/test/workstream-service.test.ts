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

import { WorktreeAuthority } from "../src/worktree-authority.js";
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

async function fixture(): Promise<Fixture> {
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
    currentRepository: () => state.currentRepository,
    connectedAgent: (agentId) =>
      state.currentAgent?.agentId === agentId ? state.currentAgent : null,
    evidenceReader: { read: vi.fn(async () => []) },
    id: () => "workstream-one",
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

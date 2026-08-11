import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { WorktreeAuthority } from "../src/worktree-authority.js";
import {
  WorkstreamService,
  type WorkstreamAgentPort,
  type WorkstreamAgentReference,
} from "../src/workstream-service.js";

const executeFile = promisify(execFile);
const roots: string[] = [];

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const { stdout } = await executeFile("git", [...args], {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_AUTHOR_NAME: "Workstream Feature Test",
      GIT_AUTHOR_EMAIL: "workstream-feature@example.invalid",
      GIT_COMMITTER_NAME: "Workstream Feature Test",
      GIT_COMMITTER_EMAIL: "workstream-feature@example.invalid",
      LC_ALL: "C",
    },
  });
  return stdout;
}

const repository = {
  repositoryId: "repo-current",
  revision: "repository-revision-1",
} as const;
const selectedAgent: WorkstreamAgentReference = {
  agentId: "11111111-1111-4111-8111-111111111111",
  nativeSessionId: "hermes-effective-one",
  rootNativeSessionId: "hermes-root-one",
  revision: "7",
};

type Fixture = {
  readonly service: WorkstreamService;
  readonly store: string;
  readonly worktrees: string;
  readonly port: WorkstreamAgentPort;
  readonly dispatches: Array<{
    task: string;
    systemContext: string;
  }>;
  setCurrentAgent(agent: WorkstreamAgentReference): void;
};

async function fixture(
  options: { readonly busy?: boolean } = {},
): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "aiw-workstream-loop-"));
  roots.push(root);
  const repositoryRoot = join(root, "repository");
  const store = join(root, "store");
  const worktrees = join(root, "worktrees");
  await mkdir(repositoryRoot);
  await mkdir(worktrees);
  await mkdir(join(repositoryRoot, "src"));
  await git(root, ["init", "--initial-branch=main", repositoryRoot]);
  await writeFile(
    join(repositoryRoot, "src", "collision.ts"),
    "export const collides = true;\n",
  );
  await git(repositoryRoot, ["add", "src/collision.ts"]);
  await git(repositoryRoot, ["commit", "-m", "fixture: initial"]);

  let currentAgent = selectedAgent;
  let worktreeRef: string | null = null;
  let currentTaskRef: string | null = null;
  let mode: "explore" | "collaborate" = "explore";
  const dispatches: Array<{ task: string; systemContext: string }> = [];
  const port: WorkstreamAgentPort = {
    current: () => ({
      ...currentAgent,
      worktreeRef,
      currentTaskRef,
      mode,
      eventSequence: 4,
    }),
    busy: () => options.busy === true,
    bind: vi.fn(async ({ worktreeRef: nextWorktree, taskRef }) => {
      worktreeRef = nextWorktree;
      currentTaskRef = taskRef;
      mode = "collaborate";
      currentAgent = { ...currentAgent, revision: "8" };
      return {
        ...currentAgent,
        worktreeRef,
        currentTaskRef,
        mode,
        eventSequence: 4,
      };
    }),
    dispatch: vi.fn(async ({ task, systemContext }) => {
      dispatches.push({ task, systemContext });
    }),
    evidence: () => [
      {
        ref: "agent-event:tool-one",
        summary: "Hermes completed terminal tool activity for this Workstream.",
      },
    ],
    unbind: vi.fn(async () => {
      worktreeRef = null;
      currentTaskRef = null;
      mode = "explore";
    }),
  };
  const authority = new WorktreeAuthority({
    approvedRepositoryRoot: repositoryRoot,
    allowedWorktreeParent: worktrees,
  });
  const service = new WorkstreamService({
    directory: store,
    worktreeAuthority: authority,
    worktreeParent: worktrees,
    currentRepository: () => repository,
    agentPort: port,
    evidenceReader: { read: async (refs) => refs },
    id: () => "workstream-collision-loop",
    now: () => Date.parse("2026-08-11T15:00:00.000Z"),
  });
  return {
    service,
    store,
    worktrees,
    port,
    dispatches,
    setCurrentAgent(agent) {
      currentAgent = agent;
    },
  };
}

function createRequest() {
  return {
    requestId: "request-create-collision",
    correlationId: "correlation-create-collision",
    title: "Stop avatar collisions with repository objects",
    task: "Make the agent avatar no longer collide with repository-city objects because it gets stuck on them while moving.",
    repository,
    agent: selectedAgent,
  } as const;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Workstream feature loop", () => {
  it("rejects an empty task or busy Explore turn before allocating a worktree", async () => {
    const value = await fixture({ busy: true });
    await expect(value.service.create(createRequest())).rejects.toMatchObject({
      code: "agent-mismatch",
      message: "Wait for the selected World agent turn to finish",
    });
    expect(await readdir(value.worktrees)).toEqual([]);
    await expect(
      value.service.create({ ...createRequest(), task: "" }),
    ).rejects.toMatchObject({ code: "validation" });
    expect(await readdir(value.worktrees)).toEqual([]);
  });

  it("binds collaborate plus exact worktree/task and dispatches the captured task with bounded context", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    await vi.waitFor(() => expect(value.dispatches).toHaveLength(1));

    expect(value.port.bind).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: selectedAgent,
        worktreeRef: created.workstream.authority.worktreeId,
        taskRef: created.workstream.workstreamId,
      }),
    );
    expect(created.workstream).toMatchObject({
      task: createRequest().task,
      agent: { revision: "8" },
    });
    expect(value.dispatches[0]).toMatchObject({ task: createRequest().task });
    const context = value.dispatches[0]!.systemContext;
    expect(context).toContain("workstream-collision-loop");
    expect(context).toContain(
      join(value.worktrees, created.workstream.authority.relativePath),
    );
    expect(context).toContain("mutate only that owned worktree");
    expect(context).toContain("TDD");
    expect(context).toContain("Stop before staging, committing, pushing");
  });

  it("projects real changed files, bounded diff, validation exits, and correlated evidence", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    const worktree = join(
      value.worktrees,
      created.workstream.authority.relativePath,
    );
    await writeFile(
      join(worktree, "src", "collision.ts"),
      "export const collides = false;\n",
    );
    await mkdir(join(value.store, "reports"), { recursive: true });
    await writeFile(
      join(value.store, "reports", `${created.workstream.workstreamId}.json`),
      `${JSON.stringify({
        schema: "aiw.workstream-report/1",
        workstreamId: created.workstream.workstreamId,
        activity: "Collision regression and impacted renderer tests are green.",
        validation: [
          {
            command: "pnpm vitest run collision.test.ts --maxWorkers=1",
            exitCode: 0,
            summary: "1 test passed",
          },
        ],
        evidenceRefs: ["validation-1"],
      })}\n`,
    );

    const current = await value.service.current();
    expect(current?.evidenceOperationRefs).toContain("agent-event:tool-one");
    expect(current?.projection.changedFiles).toEqual([
      expect.objectContaining({
        path: "src/collision.ts",
        change: "modified",
      }),
    ]);
    expect(current?.projection).toMatchObject({
      currentActivity:
        "Collision regression and impacted renderer tests are green.",
      validation: [
        {
          command: "pnpm vitest run collision.test.ts --maxWorkers=1",
          exitCode: 0,
          summary: "1 test passed",
        },
      ],
      evidenceRefs: expect.arrayContaining([
        "agent-event:tool-one",
        "report:validation-1",
      ]),
    });
    expect(current?.projection.diff.patch).toContain(
      "-export const collides = true;",
    );
    expect(current?.projection.diff.patch).toContain(
      "+export const collides = false;",
    );
  });

  it("cancels across effective-session rollover on the same root and rejects another root", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    value.setCurrentAgent({
      ...created.workstream.agent,
      nativeSessionId: "hermes-effective-two",
    });
    const cancelled = await value.service.cancel({
      requestId: "request-cancel-rollover",
      correlationId: "correlation-cancel-rollover",
      workstreamId: created.workstream.workstreamId,
      expectedRevision: created.workstream.revision,
      repository,
      agent: created.workstream.agent,
    });
    expect(cancelled.workstream).toMatchObject({
      status: "cancelled",
      worktreeState: "removed",
    });
    expect(value.port.unbind).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: selectedAgent.agentId,
        worktreeRef: created.workstream.authority.worktreeId,
        taskRef: created.workstream.workstreamId,
      }),
    );

    const mismatch = await fixture();
    const other = await mismatch.service.create(createRequest());
    mismatch.setCurrentAgent({
      ...other.workstream.agent,
      nativeSessionId: "hermes-effective-other",
      rootNativeSessionId: "hermes-root-other",
    });
    await expect(
      mismatch.service.cancel({
        requestId: "request-cancel-other-root",
        correlationId: "correlation-cancel-other-root",
        workstreamId: other.workstream.workstreamId,
        expectedRevision: other.workstream.revision,
        repository,
        agent: other.workstream.agent,
      }),
    ).rejects.toMatchObject({ code: "agent-mismatch" });
  });
});

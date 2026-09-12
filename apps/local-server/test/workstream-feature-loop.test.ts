import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
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
  type WorkstreamAgentPort,
  type WorkstreamAgentReference,
} from "../src/workstream-service.js";

const executeFile = promisify(execFile);
const roots: string[] = [];
const services: WorkstreamService[] = [];

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
  readonly authority: WorktreeAuthority;
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
  let nextId = 0;
  const service = new WorkstreamService({
    directory: store,
    worktreeAuthority: authority,
    worktreeParent: worktrees,
    currentRepository: () => repository,
    agentPort: port,
    evidenceReader: { read: async (refs) => refs },
    id: () =>
      nextId++ === 0
        ? "workstream-collision-loop"
        : `workstream-collision-loop-${nextId}`,
    now: () => Date.parse("2026-08-11T15:00:00.000Z"),
  });
  services.push(service);
  return {
    service,
    authority,
    store,
    worktrees,
    port,
    dispatches,
    setCurrentAgent(agent) {
      if (agent.agentId !== currentAgent.agentId) {
        worktreeRef = null;
        currentTaskRef = null;
        mode = "explore";
      }
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
  await Promise.all(services.splice(0).map((service) => service.dispose()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Workstream feature loop", () => {
  it("restores saved files, branch and task after service restart without dispatching replacement work", async () => {
    const value = await fixture();
    await value.service.create(createRequest());
    await vi.waitFor(async () =>
      expect((await value.service.current())?.status).toBe("ready-for-review"),
    );
    const saved = (await value.service.current())!;
    const worktree = join(value.worktrees, saved.authority.relativePath);
    await writeFile(
      join(worktree, "src", "collision.ts"),
      "export const collides = false;\n",
    );
    await writeFile(
      join(worktree, "untracked.txt"),
      "keep this unsaved file\n",
    );
    const before = await git(worktree, ["status", "--porcelain=v1"]);
    const head = await git(worktree, ["rev-parse", "HEAD"]);
    const branch = await git(worktree, ["branch", "--show-current"]);
    await value.service.dispose();
    const nextAgent = {
      ...selectedAgent,
      agentId: "new-agent",
      nativeSessionId: "new-native",
      rootNativeSessionId: "new-native",
    };
    value.setCurrentAgent(nextAgent);
    const restarted = new WorkstreamService({
      directory: value.store,
      worktreeAuthority: value.authority,
      worktreeParent: value.worktrees,
      currentRepository: () => repository,
      agentPort: value.port,
      evidenceReader: { read: async (refs) => refs },
    });
    services.push(restarted);
    const history = await restarted.history(repository.repositoryId);
    expect(history).toHaveLength(1);
    expect(history[0]!.workstreamId).toBe(saved.workstreamId);
    const resumed = (
      await restarted.continueSaved({
        workstreamId: saved.workstreamId,
        expectedRevision: saved.revision,
        repository,
        agent: nextAgent,
        confirm: true,
      })
    ).workstream;
    expect(resumed).toMatchObject({
      workstreamId: saved.workstreamId,
      task: saved.task,
      title: saved.title,
      worktreeState: "dirty",
      authority: {
        worktreeId: saved.authority.worktreeId,
        relativePath: saved.authority.relativePath,
      },
      agent: {
        agentId: nextAgent.agentId,
        nativeSessionId: nextAgent.nativeSessionId,
      },
    });
    expect(value.port.current(nextAgent.agentId)).toMatchObject({
      worktreeRef: saved.authority.worktreeId,
      currentTaskRef: saved.workstreamId,
      mode: "collaborate",
    });
    expect(await readFile(join(worktree, "src", "collision.ts"), "utf8")).toBe(
      "export const collides = false;\n",
    );
    expect(await readFile(join(worktree, "untracked.txt"), "utf8")).toBe(
      "keep this unsaved file\n",
    );
    expect(await git(worktree, ["status", "--porcelain=v1"])).toBe(before);
    expect(await git(worktree, ["rev-parse", "HEAD"])).toBe(head);
    expect(await git(worktree, ["branch", "--show-current"])).toBe(branch);
    expect(value.port.dispatch).toHaveBeenCalledTimes(1);
    expect(resumed.events.slice(0, -1)).toEqual(saved.events);
    expect(resumed.events.at(-1)?.summary).toContain("No coding turn sent.");
    expect(await readdir(value.worktrees)).toEqual([
      saved.authority.relativePath,
    ]);
  });
  it("offers discussion context without changing task, reports, revision or worktree", async () => {
    const value = await fixture();
    await value.service.create(createRequest());
    await vi.waitFor(async () =>
      expect((await value.service.current())?.status).toBe("ready-for-review"),
    );
    const before = (await value.service.current())!;
    const context = await value.service.contextForAgent({
      agentId: before.agent.agentId,
      worktreeRef: before.authority.worktreeId,
      currentTaskRef: before.workstreamId,
      intent: "discussion",
    });
    expect(context).toContain("Answer naturally as yourself");
    expect(context).toContain(before.task);
    expect(context).toContain("/work");
    expect(context).not.toContain("aiw.workstream-report/1");
    const after = (await value.service.current())!;
    expect(after.revision).toBe(before.revision);
    expect(after.events).toEqual(before.events);
    expect(after.authority).toEqual(before.authority);
    expect(value.dispatches).toHaveLength(1);
  });
  it("starts every bound chat turn independently of wording and does not reuse old validation", async () => {
    const value = await fixture();
    await value.service.create(createRequest());
    await vi.waitFor(async () =>
      expect((await value.service.current())?.status).toBe("ready-for-review"),
    );
    const current = (await value.service.current())!;
    const receipt = join(
      value.store,
      "reports",
      current.workstreamId,
      `${current.workstreamId}.json`,
    );
    await mkdir(join(value.store, "reports", current.workstreamId), {
      recursive: true,
    });
    await writeFile(
      receipt,
      JSON.stringify({
        schema: "aiw.workstream-report/1",
        workstreamId: current.workstreamId,
        activity: "Old success",
        validation: [{ command: "old test", exitCode: 0, summary: "Old pass" }],
        evidenceRefs: [],
      }),
    );
    await value.service.recordAgentTurnStart(
      current.agent.agentId,
      "In this existing website, change only the heading",
    );
    const started = (await value.service.current())!;
    expect(started.status).toBe("working");
    expect(started.events.at(-1)?.summary).toContain(
      "In this existing website",
    );
    expect(started.projection.validation).toEqual([]);
    await value.service.recordAgentTurnOutcome(current.agent.agentId);
    expect((await value.service.current())?.status).toBe("ready-for-review");
    expect(value.port.dispatch).toHaveBeenCalledTimes(1);
  });
  it("reads real untracked and committed website source from the owned worktree without staging it", async () => {
    const value = await fixture();
    const { workstream } = await value.service.create(createRequest());
    const tree = join(value.worktrees, workstream.authority.relativePath);
    await writeFile(
      join(tree, "index.html"),
      "<h1>Fresh Food, Happy People</h1>",
    );
    const listing = await value.service.source(workstream.workstreamId);
    expect(listing.files.map((file) => file.path)).toContain("index.html");
    const source = await value.service.source(
      workstream.workstreamId,
      "index.html",
    );
    expect(source.content).toBe("<h1>Fresh Food, Happy People</h1>");
    expect(await git(tree, ["diff", "--cached", "--name-only"])).toBe("");
    await expect(
      value.service.source(workstream.workstreamId, "../outside"),
    ).rejects.toThrow();
    expect(
      (await value.service.source(workstream.workstreamId, "src/collision.ts"))
        .content,
    ).toContain("export const collides");
  });
  it("preserves an inactive old session's dirty work before a new agent starts", async () => {
    const value = await fixture();
    const first = await value.service.create(createRequest());
    await vi.waitFor(async () =>
      expect((await value.service.current())?.status).toBe("ready-for-review"),
    );
    const oldFile = join(
      value.worktrees,
      first.workstream.authority.relativePath,
      "index.html",
    );
    await writeFile(oldFile, "retained old homepage");
    await value.service.recordAgentTurnOutcome(
      first.workstream.agent.agentId,
      "timed out",
    );
    const agent = {
      ...selectedAgent,
      agentId: "new-agent",
      nativeSessionId: "new-root",
      rootNativeSessionId: "new-root",
    };
    value.setCurrentAgent(agent);
    const next = await value.service.create({
      ...createRequest(),
      agent,
      requestId: "new-request",
      correlationId: "new-correlation",
    });
    expect(next.workstream.agent.agentId).toBe("new-agent");
    expect(next.workstream.workstreamId).not.toBe(
      first.workstream.workstreamId,
    );
    expect(await readFile(oldFile, "utf8")).toBe("retained old homepage");
    const archives = await readdir(join(value.store, "archive"));
    expect(archives).toHaveLength(1);
    const archived = JSON.parse(
      await readFile(join(value.store, "archive", archives[0]!), "utf8"),
    );
    expect(archived.payload.workstream.agent.agentId).toBe(
      first.workstream.agent.agentId,
    );
    expect(archived.payload.workstream.status).toBe("blocked");
    expect(value.port.unbind).not.toHaveBeenCalled();
  });
  it("finishes a successful turn as ready for review and persists a later conversational failure", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    await vi.waitFor(async () =>
      expect((await value.service.current())?.status).toBe("ready-for-review"),
    );
    await value.service.recordAgentTurnOutcome(
      created.workstream.agent.agentId,
      "Native turn timed out",
    );
    const failed = await value.service.current();
    expect(failed?.status).toBe("blocked");
    expect(failed?.events.at(-1)?.summary).toContain("timed out");
  });
  it("does not replace a previous session while its dispatched turn is still running", async () => {
    const value = await fixture();
    let finish!: () => void;
    vi.mocked(value.port.dispatch).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const first = await value.service.create(createRequest());
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    try {
      const agent = {
        ...selectedAgent,
        agentId: "new-agent",
        nativeSessionId: "new-root",
        rootNativeSessionId: "new-root",
      };
      value.setCurrentAgent(agent);
      await expect(
        value.service.create({
          ...createRequest(),
          agent,
          requestId: "new-request",
          correlationId: "new-correlation",
        }),
      ).rejects.toMatchObject({ code: "active-workstream" });
      expect((await value.service.current())?.workstreamId).toBe(
        first.workstream.workstreamId,
      );
    } finally {
      finish();
    }
  });

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
    expect(context).toContain('"schema":"aiw.workstream-report/1"');
    expect(context).toContain('"workstreamId":"workstream-collision-loop"');
    expect(context).toContain('"activity":');
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

  it("shows rejected receipt feedback without losing the source diff", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    await vi.waitFor(async () =>
      expect((await value.service.current())?.status).toBe("ready-for-review"),
    );
    await writeFile(
      join(
        value.worktrees,
        created.workstream.authority.relativePath,
        "index.html",
      ),
      "<h1>Actual change</h1>",
    );
    const reportDirectory = join(
      value.store,
      "reports",
      created.workstream.workstreamId,
    );
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(
      join(reportDirectory, `${created.workstream.workstreamId}.json`),
      JSON.stringify({
        schema: "aiw.workstream-report/1",
        workstreamId: created.workstream.workstreamId,
        activity: "Expected RED is described here.",
        validation: [
          { command: "node check.mjs", exitCode: 0, summary: "Passed" },
        ],
        evidenceRefs: ["Expected RED: this prose is not a reference"],
      }),
    );
    const current = await value.service.current();
    expect(current?.projection.currentActivity).toContain(
      "Workstream receipt invalid",
    );
    expect(current?.projection.validation).toEqual([]);
    expect(current?.projection.changedFiles).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "index.html" })]),
    );
    expect(value.dispatches[0]!.systemContext).toContain(
      "evidenceRefs must match",
    );
    expect(value.dispatches[0]!.systemContext).not.toContain(
      "activity/evidenceRefs",
    );
  });

  it("cancels across effective-session rollover on the same root and rejects another root", async () => {
    const value = await fixture();
    const created = await value.service.create(createRequest());
    value.setCurrentAgent({
      ...created.workstream.agent,
      nativeSessionId: "hermes-effective-two",
    });
    await vi.waitFor(async () =>
      expect((await value.service.current())?.status).toBe("ready-for-review"),
    );
    const latest = (await value.service.current())!;
    const cancelled = await value.service.cancel({
      requestId: "request-cancel-rollover",
      correlationId: "correlation-cancel-rollover",
      workstreamId: created.workstream.workstreamId,
      expectedRevision: latest.revision,
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
    await vi.waitFor(async () =>
      expect((await mismatch.service.current())?.status).toBe(
        "ready-for-review",
      ),
    );
    const otherLatest = (await mismatch.service.current())!;
    await expect(
      mismatch.service.cancel({
        requestId: "request-cancel-other-root",
        correlationId: "correlation-cancel-other-root",
        workstreamId: other.workstream.workstreamId,
        expectedRevision: otherLatest.revision,
        repository,
        agent: other.workstream.agent,
      }),
    ).rejects.toMatchObject({ code: "agent-mismatch" });
  });
});

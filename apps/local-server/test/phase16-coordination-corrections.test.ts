import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type {
  CoordinationAction,
  CoordinationSnapshot,
  CoordinationTestEvidence,
} from "@agentintersect-world/multi-agent-coordination";
import { createEmptyCoordinationSnapshot } from "@agentintersect-world/multi-agent-coordination";
import { afterEach, describe, expect, it } from "vitest";

import { CoordinationService } from "../src/coordination-service.js";

const executeFile = promisify(execFile);
const roots: string[] = [];

type Fixture = {
  readonly root: string;
  readonly repository: string;
  readonly worktreeRoot: string;
  readonly service: CoordinationService;
  snapshot: CoordinationSnapshot;
};

async function git(
  cwd: string,
  args: readonly string[],
): Promise<{ readonly stdout: string; readonly exitCode: number }> {
  try {
    const { stdout } = await executeFile("git", [...args], {
      cwd,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_TERMINAL_PROMPT: "0",
        GIT_AUTHOR_NAME: "Phase 16 Correction",
        GIT_AUTHOR_EMAIL: "phase16-correction@example.invalid",
        GIT_COMMITTER_NAME: "Phase 16 Correction",
        GIT_COMMITTER_EMAIL: "phase16-correction@example.invalid",
        LC_ALL: "C",
      },
    });
    return { stdout, exitCode: 0 };
  } catch (error) {
    const failure = error as { stdout?: string; code?: number };
    return {
      stdout: failure.stdout ?? "",
      exitCode: typeof failure.code === "number" ? failure.code : 1,
    };
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function request(
  fixture: Fixture,
  correlationId: string,
  action: CoordinationAction["action"],
  coordinationSessionId = "phase16-correction",
): CoordinationAction {
  return {
    schema: "aiw.coordination-action/0.16",
    coordinationSessionId,
    actor: "operator",
    operatorApproval: "approved",
    expectedRevision: fixture.snapshot.revision,
    correlationId,
    action,
  };
}

async function apply(
  fixture: Fixture,
  correlationId: string,
  action: CoordinationAction["action"],
): Promise<void> {
  fixture.snapshot = (
    await fixture.service.action(request(fixture, correlationId, action))
  ).snapshot;
}

async function createFixture(worktrees = 0): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "aiw-phase16-correction-"));
  roots.push(root);
  const repository = join(root, "repository");
  const worktreeRoot = join(root, "worktrees");
  await mkdir(repository, { recursive: true });
  await mkdir(worktreeRoot, { recursive: true });
  await git(root, ["init", "--initial-branch=main", repository]);
  await writeFile(join(repository, "README.md"), "# correction fixture\n");
  await git(repository, ["add", "README.md"]);
  await git(repository, ["commit", "-m", "fixture: initial"]);
  const service = new CoordinationService({
    directory: join(root, "store"),
    allowedWorktreeParent: root,
  });
  const fixture: Fixture = {
    root,
    repository,
    worktreeRoot,
    service,
    snapshot: createEmptyCoordinationSnapshot(),
  };
  await apply(fixture, "initialize", {
    kind: "session.initialize",
    repositoryId: "repo-correction",
    repositoryDisplayName: "Correction fixture",
    operatorId: "operator-local",
  });
  for (const agent of [
    {
      agentId: "mr-fluff",
      adapter: "hermes",
      displayName: "Mr Fluff",
      avatarId: "mr-fluff",
      nativeSessionId: "hermes-correction",
      toolStreamId: "tools-fluff",
      evidenceStreamId: "evidence-fluff",
      taskId: "task-fluff",
    },
    {
      agentId: "beans",
      adapter: "openclaw",
      displayName: "Beans",
      avatarId: "beans",
      nativeSessionId: "openclaw-correction",
      toolStreamId: "tools-beans",
      evidenceStreamId: "evidence-beans",
      taskId: "task-beans",
    },
  ] as const) {
    await apply(fixture, `bind-${agent.agentId}`, {
      kind: "agent.bind",
      binding: {
        agentId: agent.agentId,
        adapter: agent.adapter,
        displayName: agent.displayName,
        avatarId: agent.avatarId,
        nativeSessionId: agent.nativeSessionId,
        model: "gpt-5.6-sol",
        toolStreamId: agent.toolStreamId,
        evidenceStreamId: agent.evidenceStreamId,
        status: "ready",
      },
    });
    await apply(fixture, `task-${agent.agentId}`, {
      kind: "task.upsert",
      task: {
        taskId: agent.taskId,
        title: `${agent.displayName} correction task`,
        status: "ready",
        dependencyTaskIds: [],
        ownerAgentId: null,
      },
    });
    await apply(fixture, `assign-${agent.agentId}`, {
      kind: "task.assign",
      taskId: agent.taskId,
      agentId: agent.agentId,
      nativeSessionId: agent.nativeSessionId,
    });
  }
  if (worktrees > 0) await createWorktree(fixture, "mr-fluff");
  if (worktrees > 1) await createWorktree(fixture, "beans");
  return fixture;
}

async function createWorktree(
  fixture: Fixture,
  agentId: "mr-fluff" | "beans",
): Promise<void> {
  const fluff = agentId === "mr-fluff";
  await apply(fixture, `worktree-${agentId}`, {
    kind: "worktree.create",
    worktreeId: `worktree-${agentId}`,
    agentId,
    nativeSessionId: fluff ? "hermes-correction" : "openclaw-correction",
    taskId: fluff ? "task-fluff" : "task-beans",
    repositoryRoot: fixture.repository,
    worktreePath: join(fixture.worktreeRoot, agentId),
    branch: `phase16/correction-${agentId}`,
    displayPath: `worktrees/${agentId}`,
    startPoint: "main",
  });
}

function worktreeCreate(
  fixture: Fixture,
  values: {
    readonly worktreeId: string;
    readonly agentId: "mr-fluff" | "beans";
    readonly nativeSessionId: string;
    readonly taskId: string;
    readonly suffix: string;
  },
): CoordinationAction["action"] {
  return {
    kind: "worktree.create",
    worktreeId: values.worktreeId,
    agentId: values.agentId,
    nativeSessionId: values.nativeSessionId,
    taskId: values.taskId,
    repositoryRoot: fixture.repository,
    worktreePath: join(fixture.worktreeRoot, values.suffix),
    branch: `phase16/${values.suffix}`,
    displayPath: `worktrees/${values.suffix}`,
    startPoint: "main",
  };
}

async function expectNoGitMutation(
  fixture: Fixture,
  action: CoordinationAction["action"] & {
    readonly worktreePath: string;
    readonly branch: string;
  },
  expectedCode: string,
): Promise<void> {
  const revision = fixture.snapshot.revision;
  await expect(
    fixture.service.action(request(fixture, `refuse-${action.branch}`, action)),
  ).rejects.toMatchObject({ code: expectedCode });
  expect((await fixture.service.snapshot()).snapshot?.revision).toBe(revision);
  expect(await exists(action.worktreePath)).toBe(false);
  expect(
    (await git(fixture.repository, ["worktree", "list", "--porcelain"])).stdout,
  ).not.toContain(action.worktreePath);
  expect(
    (
      await git(fixture.repository, [
        "show-ref",
        "--verify",
        `refs/heads/${action.branch}`,
      ])
    ).exitCode,
  ).not.toBe(0);
}

function evidence(
  fixture: Fixture,
  agentId: "mr-fluff" | "beans",
  testId: string,
): CoordinationTestEvidence {
  const worktree = fixture.snapshot.worktrees.find(
    (value) => value.agentId === agentId,
  );
  if (!worktree) throw new Error("Missing fixture worktree");
  const summary = `PASS ${agentId} bounded test`;
  return {
    testId,
    agentId,
    nativeSessionId:
      agentId === "mr-fluff" ? "hermes-correction" : "openclaw-correction",
    taskId: agentId === "mr-fluff" ? "task-fluff" : "task-beans",
    worktreeId: worktree.worktreeId,
    branch: worktree.branch,
    head: worktree.head,
    command: "corepack pnpm test --filter bounded",
    exitCode: 0,
    summary,
    digest: createHash("sha256").update(summary).digest("hex"),
    recordedAt: "2026-07-23T00:00:00.000Z",
  };
}

function candidate(
  fixture: Fixture,
  candidateId: string,
  testEvidence: readonly CoordinationTestEvidence[],
): CoordinationAction["action"] {
  return {
    kind: "merge-candidate.prepare",
    candidateId,
    sourceAgentId: "beans",
    targetAgentId: "mr-fluff",
    sourceTaskId: "task-beans",
    targetTaskId: "task-fluff",
    sourceWorktreeId: "worktree-beans",
    targetWorktreeId: "worktree-mr-fluff",
    testEvidence: [...testEvidence],
    uncertainties: [],
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Phase 16 worktree mutation preflight", () => {
  it("refuses a wrong native session before Git creates a path or branch", async () => {
    const fixture = await createFixture();
    const action = worktreeCreate(fixture, {
      worktreeId: "worktree-wrong-session",
      agentId: "mr-fluff",
      nativeSessionId: "wrong-session",
      taskId: "task-fluff",
      suffix: "wrong-session",
    });
    await expectNoGitMutation(fixture, action, "git-refused");
  });

  it("refuses a duplicate worktree identity before Git creates a path or branch", async () => {
    const fixture = await createFixture(1);
    const action = worktreeCreate(fixture, {
      worktreeId: "worktree-mr-fluff",
      agentId: "mr-fluff",
      nativeSessionId: "hermes-correction",
      taskId: "task-fluff",
      suffix: "duplicate-id",
    });
    await expectNoGitMutation(fixture, action, "git-refused");
  });

  it("refuses the two-worktree ceiling before Git creates a path or branch", async () => {
    const fixture = await createFixture(2);
    const action = worktreeCreate(fixture, {
      worktreeId: "worktree-third",
      agentId: "mr-fluff",
      nativeSessionId: "hermes-correction",
      taskId: "task-fluff",
      suffix: "third-worktree",
    });
    await expectNoGitMutation(fixture, action, "resource-limit");
  });
});

describe("Phase 16 exact worktree bindings", () => {
  it("refuses two agents from attaching worktrees in different repositories", async () => {
    const fixture = await createFixture(1);
    const otherRepository = join(fixture.root, "other-repository");
    const otherWorktree = join(fixture.worktreeRoot, "other-beans");
    await git(fixture.root, ["init", "--initial-branch=main", otherRepository]);
    await writeFile(join(otherRepository, "README.md"), "# other fixture\n");
    await git(otherRepository, ["add", "README.md"]);
    await git(otherRepository, ["commit", "-m", "fixture: other initial"]);
    await git(otherRepository, [
      "worktree",
      "add",
      "-b",
      "phase16/other-beans",
      otherWorktree,
      "main",
    ]);
    const revision = fixture.snapshot.revision;

    await expect(
      fixture.service.action(
        request(fixture, "attach-other-repository", {
          kind: "worktree.attach",
          worktreeId: "worktree-beans",
          agentId: "beans",
          nativeSessionId: "openclaw-correction",
          taskId: "task-beans",
          repositoryRoot: otherRepository,
          worktreePath: otherWorktree,
          branch: "phase16/other-beans",
          displayPath: "worktrees/beans",
        }),
      ),
    ).rejects.toMatchObject({ code: "git-refused" });
    expect((await fixture.service.snapshot()).snapshot?.revision).toBe(
      revision,
    );
    expect((await fixture.service.snapshot()).snapshot?.worktrees).toHaveLength(
      1,
    );
  });

  it("refuses a different repository taking over a persisted worktree after restart", async () => {
    const fixture = await createFixture(1);
    const otherRepository = join(fixture.root, "restart-other-repository");
    const otherWorktree = join(fixture.worktreeRoot, "restart-other-fluff");
    await git(fixture.root, ["init", "--initial-branch=main", otherRepository]);
    await writeFile(join(otherRepository, "README.md"), "# restart other\n");
    await git(otherRepository, ["add", "README.md"]);
    await git(otherRepository, ["commit", "-m", "fixture: restart other"]);
    await git(otherRepository, [
      "worktree",
      "add",
      "-b",
      "phase16/correction-mr-fluff",
      otherWorktree,
      "main",
    ]);
    const restarted = new CoordinationService({
      directory: join(fixture.root, "store"),
      allowedWorktreeParent: fixture.root,
    });
    const snapshot = (await restarted.snapshot()).snapshot;
    expect(snapshot).not.toBeNull();
    if (!snapshot) throw new Error("Missing restarted snapshot");
    const restartedFixture = { ...fixture, service: restarted, snapshot };
    const revision = snapshot.revision;

    await expect(
      restarted.action(
        request(restartedFixture, "attach-restart-other-repository", {
          kind: "worktree.attach",
          worktreeId: "worktree-mr-fluff",
          agentId: "mr-fluff",
          nativeSessionId: "hermes-correction",
          taskId: "task-fluff",
          repositoryRoot: otherRepository,
          worktreePath: otherWorktree,
          branch: "phase16/correction-mr-fluff",
          displayPath: "worktrees/mr-fluff",
        }),
      ),
    ).rejects.toMatchObject({ code: "git-refused" });
    expect((await restarted.snapshot()).snapshot?.revision).toBe(revision);
    expect(
      (await restarted.snapshot()).snapshot?.worktrees[0]?.commonRepositoryId,
    ).toBe(snapshot.worktrees[0]?.commonRepositoryId);
  });

  it("refuses the repository root as an editing worktree", async () => {
    const fixture = await createFixture();
    await expect(
      fixture.service.action(
        request(fixture, "attach-repository-root", {
          kind: "worktree.attach",
          worktreeId: "worktree-root",
          agentId: "mr-fluff",
          nativeSessionId: "hermes-correction",
          taskId: "task-fluff",
          repositoryRoot: fixture.repository,
          worktreePath: fixture.repository,
          branch: "main",
          displayPath: "worktrees/root",
        }),
      ),
    ).rejects.toMatchObject({ code: "git-refused" });
    expect((await fixture.service.snapshot()).snapshot?.worktrees).toEqual([]);
  });

  it("refuses two worktree identities bound to one real path", async () => {
    const fixture = await createFixture(1);
    await expect(
      fixture.service.action(
        request(fixture, "attach-duplicate-path", {
          kind: "worktree.attach",
          worktreeId: "worktree-beans",
          agentId: "beans",
          nativeSessionId: "openclaw-correction",
          taskId: "task-beans",
          repositoryRoot: fixture.repository,
          worktreePath: join(fixture.worktreeRoot, "mr-fluff"),
          branch: "phase16/correction-mr-fluff",
          displayPath: "worktrees/beans",
        }),
      ),
    ).rejects.toMatchObject({ code: "git-refused" });
    expect((await fixture.service.snapshot()).snapshot?.worktrees).toHaveLength(
      1,
    );
  });

  it("refuses validation that changes an attached worktree path", async () => {
    const fixture = await createFixture(2);
    const revision = fixture.snapshot.revision;
    await expect(
      fixture.service.action(
        request(fixture, "validate-rebind", {
          kind: "worktree.validate",
          worktreeId: "worktree-mr-fluff",
          agentId: "mr-fluff",
          nativeSessionId: "hermes-correction",
          repositoryRoot: fixture.repository,
          worktreePath: join(fixture.worktreeRoot, "beans"),
        }),
      ),
    ).rejects.toMatchObject({ code: "git-refused" });
    expect((await fixture.service.snapshot()).snapshot?.revision).toBe(
      revision,
    );
  });

  it("requires explicit attach after restart before validation can measure a path", async () => {
    const fixture = await createFixture(1);
    const restarted = new CoordinationService({
      directory: join(fixture.root, "store"),
      allowedWorktreeParent: fixture.root,
    });
    const snapshot = (await restarted.snapshot()).snapshot;
    expect(snapshot).not.toBeNull();
    if (!snapshot) throw new Error("Missing restarted snapshot");
    const restartedFixture = { ...fixture, service: restarted, snapshot };
    await expect(
      restarted.action(
        request(restartedFixture, "validate-after-restart", {
          kind: "worktree.validate",
          worktreeId: "worktree-mr-fluff",
          agentId: "mr-fluff",
          nativeSessionId: "hermes-correction",
          repositoryRoot: fixture.repository,
          worktreePath: join(fixture.worktreeRoot, "mr-fluff"),
        }),
      ),
    ).rejects.toMatchObject({ code: "git-refused" });
    const attached = await restarted.action(
      request(restartedFixture, "attach-after-restart", {
        kind: "worktree.attach",
        worktreeId: "worktree-mr-fluff",
        agentId: "mr-fluff",
        nativeSessionId: "hermes-correction",
        taskId: "task-fluff",
        repositoryRoot: fixture.repository,
        worktreePath: join(fixture.worktreeRoot, "mr-fluff"),
        branch: "phase16/correction-mr-fluff",
        displayPath: "worktrees/mr-fluff",
      }),
    );
    expect(attached.snapshot.worktrees[0]?.state).toBe("current");
  });
});

describe("Phase 16 reconciliation authority", () => {
  it("refuses wrong-session and malformed reconciliation without changing truth", async () => {
    const fixture = await createFixture(1);
    const before = await fixture.service.snapshot();
    await expect(
      fixture.service.reconcile({
        coordinationSessionId: "wrong-session",
        actor: "operator",
        operatorApproval: "approved",
      }),
    ).rejects.toMatchObject({ code: "git-refused" });
    await expect(
      fixture.service.reconcile({
        coordinationSessionId: "phase16-correction",
        actor: "operator",
        operatorApproval: "approved",
        surprise: true,
      }),
    ).rejects.toMatchObject({ code: "validation" });
    expect(await fixture.service.snapshot()).toEqual(before);
  });

  it("refuses reconciliation when persisted truth is unavailable", async () => {
    const fixture = await createFixture();
    await apply(fixture, "extra-generation", {
      kind: "task.upsert",
      task: {
        taskId: "task-extra",
        title: "Extra generation",
        status: "ready",
        dependencyTaskIds: [],
        ownerAgentId: null,
      },
    });
    const paths = fixture.service.pathsForTest();
    await writeFile(paths.current, "corrupt-current");
    await writeFile(paths.previous, "corrupt-previous");
    const unavailable = new CoordinationService({
      directory: join(fixture.root, "store"),
      allowedWorktreeParent: fixture.root,
    });
    const before = await unavailable.snapshot();
    expect(before.truth).toBe("unavailable");
    await expect(
      unavailable.reconcile({
        coordinationSessionId: "phase16-correction",
        actor: "operator",
        operatorApproval: "approved",
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(await unavailable.snapshot()).toEqual(before);
  });
});

describe("Phase 16 merge candidate evidence", () => {
  it("rejects identical source/target identities before candidate truth changes", async () => {
    const fixture = await createFixture(2);
    const invalid = {
      ...candidate(fixture, "candidate-same", [
        evidence(fixture, "beans", "test-same"),
      ]),
      sourceAgentId: "beans" as const,
      targetAgentId: "beans" as const,
      sourceTaskId: "task-beans",
      targetTaskId: "task-beans",
      sourceWorktreeId: "worktree-beans",
      targetWorktreeId: "worktree-beans",
    };
    await expect(
      fixture.service.action(request(fixture, "candidate-same", invalid)),
    ).rejects.toMatchObject({ code: "git-refused" });
    expect(
      (await fixture.service.snapshot()).snapshot?.mergeCandidates,
    ).toEqual([]);
  });

  it("rejects mismatched bindings and invalid summary digests", async () => {
    const fixture = await createFixture(2);
    const mismatch = {
      ...evidence(fixture, "beans", "test-mismatch"),
      nativeSessionId: "fabricated-session",
    };
    const badDigest = {
      ...evidence(fixture, "beans", "test-digest"),
      digest: "0".repeat(64),
    };
    for (const [id, record] of [
      ["candidate-mismatch", mismatch],
      ["candidate-digest", badDigest],
    ] as const)
      await expect(
        fixture.service.action(
          request(fixture, id, candidate(fixture, id, [record])),
        ),
      ).rejects.toMatchObject({ code: "git-refused" });
    expect(
      (await fixture.service.snapshot()).snapshot?.mergeCandidates,
    ).toEqual([]);
  });

  it("rejects duplicate sibling and previously recorded test identities", async () => {
    const fixture = await createFixture(2);
    const duplicate = evidence(fixture, "beans", "test-duplicate");
    await expect(
      fixture.service.action(
        request(
          fixture,
          "candidate-sibling-duplicate",
          candidate(fixture, "candidate-sibling-duplicate", [
            duplicate,
            duplicate,
          ]),
        ),
      ),
    ).rejects.toMatchObject({ code: "git-refused" });
    await apply(
      fixture,
      "candidate-valid",
      candidate(fixture, "candidate-valid", [duplicate]),
    );
    const revision = fixture.snapshot.revision;
    await expect(
      fixture.service.action(
        request(
          fixture,
          "candidate-existing-duplicate",
          candidate(fixture, "candidate-existing-duplicate", [duplicate]),
        ),
      ),
    ).rejects.toMatchObject({ code: "git-refused" });
    expect((await fixture.service.snapshot()).snapshot?.revision).toBe(
      revision,
    );
  });
});

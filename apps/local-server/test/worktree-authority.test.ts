import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  WorktreeAuthority,
  WorktreeAuthorityError,
  type WorktreeCreateRequest,
} from "../src/worktree-authority.js";

const executeFile = promisify(execFile);
const roots: string[] = [];
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
      GIT_AUTHOR_NAME: "Worktree Authority Test",
      GIT_AUTHOR_EMAIL: "worktree-authority@example.invalid",
      GIT_COMMITTER_NAME: "Worktree Authority Test",
      GIT_COMMITTER_EMAIL: "worktree-authority@example.invalid",
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

async function fixture(): Promise<{
  readonly root: string;
  readonly repository: string;
  readonly worktrees: string;
  readonly authority: WorktreeAuthority;
}> {
  const root = await mkdtemp(join(tmpdir(), "aiw-worktree-authority-"));
  roots.push(root);
  const repository = join(root, "repository");
  const worktrees = join(root, "worktrees");
  await mkdir(repository);
  await mkdir(worktrees);
  await git(root, ["init", "--initial-branch=main", repository]);
  await writeFile(join(repository, "README.md"), "# authority fixture\n");
  await git(repository, ["add", "README.md"]);
  await git(repository, ["commit", "-m", "fixture: initial"]);
  const authority = new WorktreeAuthority({
    approvedRepositoryRoot: repository,
    allowedWorktreeParent: worktrees,
  });
  authorities.push(authority);
  return { root, repository, worktrees, authority };
}

function createRequest(
  repository: string,
  worktrees: string,
  values: Partial<WorktreeCreateRequest> = {},
): WorktreeCreateRequest {
  return {
    ownerId: "owner-one",
    requestId: "request-create-one",
    worktreeId: "worktree-one",
    repositoryRoot: repository,
    worktreePath: join(worktrees, "worktree-one"),
    branch: "workstream/owner-one-worktree-one",
    startPoint: "main",
    ...values,
  };
}

afterEach(async () => {
  await Promise.all(
    authorities.splice(0).map((authority) => authority.dispose()),
  );
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("WorktreeAuthority", () => {
  it("remeasures saved authority after a commit or branch change rather than replaying stale readiness", async () => {
    const f = await fixture();
    const request = createRequest(f.repository, f.worktrees);
    const created = await f.authority.create(request);
    await f.authority.restore(created.receipt);
    await writeFile(join(request.worktreePath, "new.txt"), "saved work");
    await git(request.worktreePath, ["add", "new.txt"]);
    await git(request.worktreePath, ["commit", "-m", "new checkpoint"]);
    const restored = await f.authority.restore(created.receipt);
    expect(restored.head).toBe(
      (await git(request.worktreePath, ["rev-parse", "HEAD"])).trim(),
    );
    await git(request.worktreePath, ["switch", "-c", "another-branch"]);
    expect((await f.authority.restore(created.receipt)).state).toBe(
      "wrong-branch",
    );
  });
  it("allocates from the current selected root rather than the launcher default", async () => {
    const { repository, root, worktrees } = await fixture();
    const selected = join(root, "selected");
    await mkdir(selected);
    await git(selected, ["init", "--initial-branch=main"]);
    await writeFile(join(selected, "selected.txt"), "selected repository\n");
    await git(selected, ["add", "."]);
    await git(selected, ["commit", "-m", "selected initial"]);
    const options = {
      approvedRepositoryRoot: repository,
      allowedWorktreeParent: worktrees,
      currentRepositoryRoot: () => selected,
    };
    const authority = new WorktreeAuthority(options);
    authorities.push(authority);
    const result = await authority.createGenerated({
      ownerId: "selected-owner",
      requestId: "selected-request",
      worktreeId: "selected-worktree",
    });
    expect(
      await exists(
        join(worktrees, result.receipt.relativePath, "selected.txt"),
      ),
    ).toBe(true);
    expect(
      await exists(join(worktrees, result.receipt.relativePath, "README.md")),
    ).toBe(false);
  });

  it("refuses an unborn selected repository before allocation with an actionable message", async () => {
    const { root, worktrees } = await fixture();
    const selected = join(root, "empty");
    await mkdir(selected);
    await git(selected, ["init", "--initial-branch=main"]);
    const authority = new WorktreeAuthority({
      approvedRepositoryRoot: selected,
      allowedWorktreeParent: worktrees,
    });
    authorities.push(authority);
    await expect(
      authority.createGenerated({
        ownerId: "empty-owner",
        requestId: "empty-request",
        worktreeId: "empty-worktree",
      }),
    ).rejects.toThrow(/initial commit/i);
    expect(await git(selected, ["status", "--porcelain"])).toBe("");
  });
  it("creates one isolated worktree on a bounded branch", async () => {
    const { authority, repository, worktrees } = await fixture();
    const request = createRequest(repository, worktrees);
    const result = await authority.create(request);

    expect(result.replayed).toBe(false);
    expect(result.receipt).toMatchObject({
      ownerId: "owner-one",
      worktreeId: "worktree-one",
      branch: "workstream/owner-one-worktree-one",
      relativePath: "worktree-one",
      state: "current",
      statusSummary: "clean",
    });
    expect(
      await git(request.worktreePath, ["rev-parse", "--abbrev-ref", "HEAD"]),
    ).toBe("workstream/owner-one-worktree-one\n");
  });

  it("refuses a repository outside the approved root before Git mutation", async () => {
    const { authority, root, repository, worktrees } = await fixture();
    const otherRepository = join(root, "other-repository");
    await mkdir(otherRepository);
    await git(root, ["init", "--initial-branch=main", otherRepository]);
    const request = createRequest(repository, worktrees, {
      repositoryRoot: otherRepository,
      worktreePath: join(worktrees, "outside-repository"),
      branch: "workstream/outside-repository",
    });

    await expect(authority.create(request)).rejects.toMatchObject({
      code: "git-refused",
    });
    expect(await exists(request.worktreePath)).toBe(false);
    expect(await git(repository, ["show-ref", "--heads"])).not.toContain(
      request.branch,
    );
  });

  it("refuses a worktree outside the allowed parent before Git mutation", async () => {
    const { authority, root, repository, worktrees } = await fixture();
    const request = createRequest(repository, worktrees, {
      worktreePath: join(root, "escaped-worktree"),
      branch: "workstream/escaped-worktree",
    });

    await expect(authority.create(request)).rejects.toMatchObject({
      code: "git-refused",
    });
    expect(await exists(request.worktreePath)).toBe(false);
  });

  it("refuses a symlink containment escape", async () => {
    const { authority, root, repository, worktrees } = await fixture();
    const outside = join(root, "outside");
    await mkdir(outside);
    await symlink(outside, join(worktrees, "escape"), "dir");
    const request = createRequest(repository, worktrees, {
      worktreePath: join(worktrees, "escape", "child"),
      branch: "workstream/symlink-escape",
    });

    await expect(authority.create(request)).rejects.toMatchObject({
      code: "git-refused",
    });
    expect(await exists(request.worktreePath)).toBe(false);
  });

  it("replays the same owner and request without a second worktree", async () => {
    const { authority, repository, worktrees } = await fixture();
    const request = createRequest(repository, worktrees);
    const first = await authority.create(request);
    const replay = await authority.create(request);

    expect(replay).toEqual({ ...first, replayed: true });
    expect(
      (await git(repository, ["worktree", "list", "--porcelain"]))
        .split("\n")
        .filter((line) => line === `worktree ${request.worktreePath}`),
    ).toHaveLength(1);
  });

  it("refuses another owner from attaching or cancelling an owned worktree", async () => {
    const { authority, repository, worktrees } = await fixture();
    const request = createRequest(repository, worktrees);
    const created = await authority.create(request);

    await expect(
      authority.attach({
        ...request,
        ownerId: "owner-two",
        requestId: "request-attach-other",
      }),
    ).rejects.toBeInstanceOf(WorktreeAuthorityError);
    await expect(
      authority.cancel({
        ownerId: "owner-two",
        requestId: "request-cancel-other",
        worktreeId: request.worktreeId,
      }),
    ).rejects.toMatchObject({ code: "ownership-mismatch" });
    expect(created.receipt.state).toBe("current");
    expect(await exists(request.worktreePath)).toBe(true);
  });

  it("removes only an attested clean owned worktree", async () => {
    const { authority, repository, worktrees } = await fixture();
    const request = createRequest(repository, worktrees);
    await authority.create(request);
    const cancelled = await authority.cancel({
      ownerId: "owner-one",
      requestId: "request-cancel-clean",
      worktreeId: "worktree-one",
    });

    expect(cancelled).toMatchObject({
      state: "cancelled",
      removed: true,
      replayed: false,
    });
    expect(await exists(request.worktreePath)).toBe(false);
  });

  it("preserves a dirty worktree and reports cleanup-required", async () => {
    const { authority, repository, worktrees } = await fixture();
    const request = createRequest(repository, worktrees);
    await authority.create(request);
    await writeFile(join(request.worktreePath, "dirty.txt"), "preserve me\n");
    const cancelled = await authority.cancel({
      ownerId: "owner-one",
      requestId: "request-cancel-dirty",
      worktreeId: "worktree-one",
    });

    expect(cancelled).toMatchObject({
      state: "cleanup-required",
      removed: false,
      receipt: { state: "dirty" },
    });
    expect(await exists(request.worktreePath)).toBe(true);
  });

  it("disposes with zero owned child processes", async () => {
    const { authority, repository, worktrees } = await fixture();
    await authority.create(createRequest(repository, worktrees));
    await authority.dispose();

    expect(authority.ownedProcessCount()).toBe(0);
  });
});

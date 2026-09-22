import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";
import { WorktreeAuthority } from "../src/worktree-authority.js";
import { WorkstreamService } from "../src/workstream-service.js";
const exec = promisify(execFile);
const roots: string[] = [];
const services: WorkstreamService[] = [];
const repoRef = { repositoryId: "repo-saved", revision: "generation-one" };
const agent = {
  agentId: "beans",
  nativeSessionId: "beans-session",
  revision: "1",
};
async function git(root: string, ...args: string[]) {
  return (
    await exec("git", ["--no-optional-locks", "-C", root, ...args], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@localhost",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@localhost",
      },
    })
  ).stdout.trim();
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "aiw-project-continuity-"));
  roots.push(root);
  const repository = join(root, "repository");
  await mkdir(repository);
  await git(repository, "init", "-q", "-b", "main");
  await git(repository, "commit", "--allow-empty", "-qm", "Initial checkpoint");
  async function world(name: string, currentRepositoryRoot = () => repository) {
    const parent = join(root, name, "worktrees");
    await mkdir(parent, { recursive: true });
    const authority = new WorktreeAuthority({
      approvedRepositoryRoot: repository,
      currentRepositoryRoot,
      allowedWorktreeParent: parent,
    });
    const service = new WorkstreamService({
      directory: join(root, name, "workstreams"),
      worktreeParent: parent,
      worktreeAuthority: authority,
      currentRepository: () => repoRef,
      connectedAgent: () => agent,
      evidenceReader: { read: async () => [] },
      id: () => "saved-work",
    });
    services.push(service);
    return { service, authority, parent };
  }
  const a = await world("old-world");
  const { workstream } = await a.service.create({
    requestId: "create",
    correlationId: "create",
    title: "Saved website",
    task: "Create website",
    repository: repoRef,
    agent,
  });
  const path = join(a.parent, workstream.authority.relativePath);
  await writeFile(
    join(path, "index.html"),
    "<body>Previous website, not a recreation</body>\n",
  );
  return { root, repository, a, workstream, path, world };
}
afterEach(async () => {
  await Promise.all(services.splice(0).map((s) => s.dispose()));
  await Promise.all(
    roots.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
it("discovers and reads preserved work from another World state root without activating or changing it", async () => {
  const f = await fixture();
  const before = {
    head: await git(f.path, "rev-parse", "HEAD"),
    status: await git(f.path, "status", "--porcelain"),
    bytes: await readFile(join(f.path, "index.html"), "utf8"),
  };
  const b = await f.world("new-world");
  const saved = await b.service.history(repoRef.repositoryId);
  expect(saved.map((w) => w.workstreamId)).toEqual([f.workstream.workstreamId]);
  expect(await b.service.current()).toBeNull();
  expect(
    (await b.service.source(f.workstream.workstreamId, "index.html")).content,
  ).toBe(before.bytes);
  expect(
    await b.service.gitDirectory(
      f.workstream.workstreamId,
      repoRef.repositoryId,
    ),
  ).toBe(f.path);
  expect(await git(f.path, "rev-parse", "HEAD")).toBe(before.head);
  expect(await git(f.path, "status", "--porcelain")).toBe(before.status);
  expect(await git(f.repository, "ls-tree", "--name-only", "HEAD")).toBe("");
});
it("discovers legacy sibling stores and carries continuation into a third World without moving the worktree", async () => {
  const f = await fixture();
  const gitDir = await git(f.path, "rev-parse", "--absolute-git-dir");
  await rm(join(gitDir, "agentintersect-world-store.json"));
  const reportDir = join(
    f.root,
    "old-world",
    "workstreams",
    "reports",
    f.workstream.workstreamId,
  );
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    join(reportDir, `${f.workstream.workstreamId}.json`),
    JSON.stringify({
      schema: "aiw.workstream-report/1",
      workstreamId: f.workstream.workstreamId,
      activity: "Saved website verified",
      validation: [
        { command: "original-check", exitCode: 0, summary: "Original receipt" },
      ],
      evidenceRefs: [],
    }),
  );
  const oldRecord = await readFile(f.a.service.pathsForTest().current, "utf8");
  const b = await f.world("second-world");
  const [saved] = await b.service.history(repoRef.repositoryId);
  expect(saved?.projection.validation[0]?.command).toBe("original-check");
  const result = await b.service.continueSaved({
    workstreamId: saved!.workstreamId,
    expectedRevision: saved!.revision,
    repository: repoRef,
    agent,
    confirm: true,
  });
  expect(result.workstream.authority.branch).toBe(
    f.workstream.authority.branch,
  );
  expect(
    await b.service.gitDirectory(saved!.workstreamId, repoRef.repositoryId),
  ).toBe(f.path);
  expect(await readFile(f.a.service.pathsForTest().current, "utf8")).toBe(
    oldRecord,
  );
  const c = await f.world("third-world");
  const [latest] = await c.service.history(repoRef.repositoryId);
  expect(latest?.revision).toBe(result.workstream.revision);
  expect(latest?.projection.validation[0]?.command).toBe("original-check");
  expect(
    (await c.service.source(saved!.workstreamId, "index.html")).content,
  ).toContain("Previous website, not a recreation");
  expect(await c.service.current()).toBeNull();
  await b.service.dispose();
  const restarted = await f.world("second-world");
  const restartedHistory = await restarted.service.history(
    repoRef.repositoryId,
  );
  expect(restartedHistory[0]?.revision).toBe(result.workstream.revision);
  expect(
    restartedHistory[0]?.projection.changedFiles.map((file) => file.path),
  ).toContain("index.html");
  expect(
    (await restarted.service.source(saved!.workstreamId, "index.html")).content,
  ).toContain("Previous website, not a recreation");
});
it("refuses a foreign repository receipt and keeps arbitrary external attach forbidden", async () => {
  const f = await fixture();
  const b = await f.world("new-world");
  const other = join(f.root, "other");
  await mkdir(other);
  await git(other, "init", "-q");
  await git(other, "commit", "--allow-empty", "-qm", "Other repo");
  const foreign = new WorktreeAuthority({
    approvedRepositoryRoot: other,
    allowedWorktreeParent: b.parent,
  });
  await expect(foreign.restore(f.workstream.authority)).rejects.toThrow(
    /another repository/,
  );
  await expect(
    b.authority.attach({
      ownerId: f.workstream.authority.ownerId,
      requestId: "external",
      worktreeId: f.workstream.authority.worktreeId,
      repositoryRoot: f.repository,
      worktreePath: f.path,
      branch: f.workstream.authority.branch,
      startPoint: f.workstream.authority.head,
    }),
  ).rejects.toThrow(/outside the allowed/);
  await foreign.dispose();
});

it("retains a continued older-root worktree for discussion after selecting another repository", async () => {
  const f = await fixture();
  const other = join(f.root, "other-repository");
  await mkdir(other);
  await git(other, "init", "-q", "-b", "main");
  await git(other, "commit", "--allow-empty", "-qm", "Other checkpoint");
  let selected = f.repository;
  const next = await f.world("continued-world", () => selected);
  const [saved] = await next.service.history(repoRef.repositoryId);
  const continued = await next.service.continueSaved({
    workstreamId: saved!.workstreamId,
    expectedRevision: saved!.revision,
    repository: repoRef,
    agent,
    confirm: true,
  });
  const recordBefore = await readFile(
    next.service.pathsForTest().current,
    "utf8",
  );
  selected = other;
  const context = {
    agentId: agent.agentId,
    worktreeRef: continued.workstream.authority.worktreeId,
    currentTaskRef: continued.workstream.workstreamId,
  };
  await expect(
    next.service.directoryForAgent({ ...context, intent: "discussion" }),
  ).resolves.toMatchObject({ workingDirectory: f.path });
  await expect(
    next.service.directoryForAgent({ ...context, intent: "work" }),
  ).rejects.toThrow("another repository");
  expect(await readFile(next.service.pathsForTest().current, "utf8")).toBe(
    recordBefore,
  );
  expect(await readFile(join(f.path, "index.html"), "utf8")).toContain(
    "Previous website, not a recreation",
  );
  expect(await git(other, "status", "--porcelain")).toBe("");
});

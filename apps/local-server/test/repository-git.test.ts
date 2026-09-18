import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";
import { RepositoryIntakeService } from "../src/repository-intake.js";
import { createLocalServer } from "../src/server.js";
import {
  RepositoryGitService,
  workspaceCommand,
} from "../src/repository-git.js";
const exec = promisify(execFile);
const roots: string[] = [];
const servers: ReturnType<typeof createLocalServer>[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "aiw-repo-git-"));
  roots.push(root);
  const repo = join(root, "repo");
  await mkdir(repo);
  await exec("git", ["init", "--initial-branch=main", repo]);
  for (const [key, value] of [
    ["user.name", "World Test"],
    ["user.email", "world@example.invalid"],
  ])
    await exec("git", ["-C", repo, "config", key!, value!]);
  const server = createLocalServer({
    config: {
      instanceName: "Repository Git Test",
      networkScope: "loopback",
      host: "127.0.0.1",
      port: 3770,
      demoOperationMaxMs: 500,
      repositoryMaxFiles: 2500,
      presentationSync: {
        dataDir: join(root, "state"),
        allowedOrigin: "http://127.0.0.1:5173",
        allowedHost: "127.0.0.1:5173",
      },
    },
  });
  servers.push(server);
  const project = await server.repositoryIntakeService.openLocal({
    rootPath: repo,
  });
  return {
    root,
    repo,
    server,
    url: `/repository-intake/projects/${project.id}/git`,
  };
}
it("persists explicit checkpoints and commits as project milestones without auto-committing dirty work", async () => {
  const f = await fixture();
  const checkpoint = await f.server.inject({
    method: "POST",
    url: f.url,
    payload: {
      action: "checkpoint",
      expectedHead: null,
      expectedBranch: "main",
      confirm: true,
    },
  });
  expect(checkpoint.statusCode).toBe(200);
  await writeFile(join(f.repo, "draft.txt"), "unfinished");
  const before = await f.server.repositoryIntakeService.list();
  expect(before[0]?.milestones).toHaveLength(1);
  const commit = await f.server.inject({
    method: "POST",
    url: f.url,
    payload: {
      action: "commit",
      expectedHead: checkpoint.json().data.status.head,
      expectedBranch: "main",
      confirm: true,
      message: "Save draft",
      files: ["draft.txt"],
    },
  });
  expect(commit.statusCode).toBe(200);
  const saved = await new RepositoryIntakeService(
    join(f.root, "repository-intake", "projects.json"),
  ).list();
  expect(saved[0]?.milestones?.map((item) => item.kind)).toEqual([
    "checkpoint",
    "commit",
  ]);
  expect(saved[0]?.milestones?.[1]?.head).toBe(commit.json().data.status.head);
});
it("performs verified non-force push, fetch and fast-forward pull against a real local remote", async () => {
  const f = await fixture();
  let result = await f.server.inject({
    method: "POST",
    url: f.url,
    payload: {
      action: "checkpoint",
      expectedHead: null,
      expectedBranch: "main",
      confirm: true,
    },
  });
  expect(result.statusCode).toBe(200);
  const head = result.json().data.status.head;
  const remote = join(f.root, "remote.git");
  await exec("git", ["init", "--bare", "--initial-branch=main", remote]);
  await exec("git", ["-C", f.repo, "remote", "add", "origin", remote]);
  result = await f.server.inject({
    method: "POST",
    url: f.url,
    payload: {
      action: "push",
      expectedHead: head,
      expectedBranch: "main",
      remote: "origin",
      confirm: true,
    },
  });
  expect(result.statusCode).toBe(200);
  expect(
    (
      await exec("git", ["--git-dir", remote, "rev-parse", "refs/heads/main"])
    ).stdout.trim(),
  ).toBe(head);
  const other = join(f.root, "other");
  await exec("git", ["clone", remote, other]);
  await writeFile(join(other, "remote.txt"), "remote change");
  await exec("git", ["-C", other, "add", "remote.txt"]);
  await exec("git", [
    "-C",
    other,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-m",
    "remote change",
  ]);
  await exec("git", ["-C", other, "push", "origin", "main"]);
  const fetched = await f.server.inject({
    method: "POST",
    url: f.url,
    payload: {
      action: "fetch",
      expectedHead: head,
      expectedBranch: "main",
      remote: "origin",
      confirm: true,
    },
  });
  expect(fetched.statusCode).toBe(200);
  expect(fetched.json().data.status.head).toBe(head);
  const pulled = await f.server.inject({
    method: "POST",
    url: f.url,
    payload: {
      action: "pull",
      expectedHead: head,
      expectedBranch: "main",
      remote: "origin",
      confirm: true,
    },
  });
  expect(pulled.statusCode).toBe(200);
  expect(await readFile(join(f.repo, "remote.txt"), "utf8")).toBe(
    "remote change",
  );
  const currentHead = pulled.json().data.status.head;
  await writeFile(join(f.repo, "remote.txt"), "uncommitted");
  const dirty = await f.server.inject({
    method: "POST",
    url: f.url,
    payload: {
      action: "pull",
      expectedHead: currentHead,
      expectedBranch: "main",
      remote: "origin",
      confirm: true,
    },
  });
  expect(dirty.statusCode).toBe(409);
  expect(await readFile(join(f.repo, "remote.txt"), "utf8")).toBe(
    "uncommitted",
  );
});

it("shows unborn Git, creates an explicit initial checkpoint and commits only selected files", async () => {
  const f = await fixture();
  let result = await f.server.inject({ method: "GET", url: f.url });
  expect(result.statusCode).toBe(200);
  expect(result.json().data).toMatchObject({
    head: null,
    branch: "main",
    changes: [],
    commits: [],
  });
  await writeFile(join(f.repo, "a.txt"), "one");
  await writeFile(join(f.repo, "keep.txt"), "keep");
  result = await f.server.inject({
    method: "POST",
    url: f.url,
    payload: {
      action: "commit",
      expectedHead: null,
      expectedBranch: "main",
      confirm: true,
      message: "First checkpoint",
      files: ["a.txt"],
    },
  });
  expect(result.statusCode).toBe(200);
  expect(result.json().data.status.head).toMatch(/^[a-f0-9]{40}$/);
  expect(result.json().data.status.changes).toEqual([
    expect.objectContaining({ path: "keep.txt" }),
  ]);
  expect((await exec("git", ["-C", f.repo, "show", "HEAD:a.txt"])).stdout).toBe(
    "one",
  );
  const stale = await f.server.inject({
    method: "POST",
    url: f.url,
    payload: {
      action: "commit",
      expectedHead: null,
      expectedBranch: "main",
      confirm: true,
      message: "Stale",
      files: ["keep.txt"],
    },
  });
  expect(stale.statusCode).toBe(409);
  expect(await readFile(join(f.repo, "keep.txt"), "utf8")).toBe("keep");
});

it("creates a draft PR only after verified push and reads back the exact PR (transport fixture)", async () => {
  const f = await fixture();
  await exec("git", ["-C", f.repo, "commit", "--allow-empty", "-m", "initial"]);
  await exec("git", ["-C", f.repo, "switch", "-c", "feature/site"]);
  await exec("git", [
    "-C",
    f.repo,
    "remote",
    "add",
    "origin",
    "https://github.com/example/site.git",
  ]);
  const head = (
    await exec("git", ["-C", f.repo, "rev-parse", "HEAD"])
  ).stdout.trim();
  const calls: string[][] = [];
  let published = false;
  const pr = {
    number: 7,
    url: "https://github.com/example/site/pull/7",
    state: "OPEN",
    isDraft: true,
    headRefName: "feature/site",
    headRefOid: head,
    baseRefName: "main",
    title: "Site",
    statusCheckRollup: [],
  };
  const service = new RepositoryGitService(
    async () => f.repo,
    async (cwd, executable, args) => {
      calls.push([executable, ...args]);
      if (executable === "git" && args.includes("ls-remote"))
        return `${head}\trefs/heads/feature/site\n`;
      if (executable === "gh") {
        if (args.includes("create")) {
          published = true;
          return pr.url + "\n";
        }
        if (args.includes("list")) return JSON.stringify(published ? [pr] : []);
        if (args.includes("view")) return JSON.stringify(pr);
        return "";
      }
      return workspaceCommand(cwd, executable, args);
    },
  );
  const result = await service.mutate("fixture-project", {
    action: "create-pr",
    expectedHead: head,
    expectedBranch: "feature/site",
    confirm: true,
    remote: "origin",
    base: "main",
    title: "Site",
    body: "Review the site",
    draft: true,
  });
  expect(result.pr).toEqual(pr);
  const create = calls.find(
    (call) => call[0] === "gh" && call.includes("create"),
  );
  expect(create).toEqual([
    "gh",
    "pr",
    "create",
    "--repo",
    "example/site",
    "--head",
    "feature/site",
    "--base",
    "main",
    "--title",
    "Site",
    "--body",
    "Review the site",
    "--no-maintainer-edit",
    "--draft",
  ]);
  expect(calls.some((call) => call[0] === "git" && call.includes("push"))).toBe(
    false,
  );
  expect(
    calls.at(-1)?.includes("view") ||
      calls.some((call) => call.includes("view")),
  ).toBe(true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const load = (name) =>
  import(pathToFileURL(resolve(`apps/local-server/dist/${name}.js`)).href);

test(
  "packaged Workstream API creates, restores and cancels a registered worktree",
  { timeout: 60000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-workstream-package-"));
    const repositoryRoot = join(root, "sample repo");
    const worktreeParent = join(root, "worktrees");
    const previousPath = process.env.PATH;
    if (process.platform === "win32")
      process.env.PATH = `${resolve("runtime/git/cmd")};${previousPath}`;
    const git = (...args) =>
      execFileSync("git", ["-C", repositoryRoot, ...args], {
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: join(root, "empty.gitconfig"),
        },
      });
    let server;
    let service;
    let authority;
    try {
      await mkdir(repositoryRoot);
      await mkdir(worktreeParent);
      await writeFile(join(root, "empty.gitconfig"), "");
      git("init", "--initial-branch=master");
      git("config", "user.name", "Disposable Workstream Test");
      git("config", "user.email", "test@example.invalid");
      await writeFile(
        join(repositoryRoot, "README.md"),
        "Native package fixture\n",
      );
      git("add", "README.md");
      git("commit", "-m", "fixture");
      const { WorktreeAuthority } = await load("worktree-authority");
      const { WorkstreamService } = await load("workstream-service");
      const { createLocalServer } = await load("server");
      const repository = {
        repositoryId: "repo-package",
        revision: "repo-rev-1",
      };
      const agent = {
        agentId: "fixture-agent",
        nativeSessionId: "fixture-session",
        rootNativeSessionId: "fixture-session",
        revision: "agent-rev-1",
      };
      authority = new WorktreeAuthority({
        approvedRepositoryRoot: repositoryRoot,
        allowedWorktreeParent: worktreeParent,
      });
      service = new WorkstreamService({
        directory: join(root, "store"),
        worktreeAuthority: authority,
        currentRepository: () => repository,
        connectedAgent: () => agent,
        evidenceReader: { read: async () => [] },
        id: () => "workstream-package",
      });
      server = createLocalServer({ workstreamService: service });
      const response = await server.inject({
        method: "POST",
        url: "/workstreams",
        payload: {
          requestId: "create-package",
          correlationId: "create-package",
          title: "Create native workstream",
          task: "Create native workstream",
          startPoint: "HEAD",
          prIntent: "local",
          repository,
          agent,
        },
      });
      assert.equal(response.statusCode, 201, response.body);
      const workstream = response.json().data.workstream;
      assert.equal(workstream.status, "working");
      assert.equal(
        (await authority.restore(workstream.authority)).state,
        "current",
      );
      const cancelled = await server.inject({
        method: "POST",
        url: "/workstreams/workstream-package/cancel",
        payload: {
          requestId: "cancel-package",
          correlationId: "cancel-package",
          expectedRevision: workstream.revision,
          repository,
          agent,
        },
      });
      assert.equal(cancelled.statusCode, 200, cancelled.body);
      assert.equal(cancelled.json().data.workstream.worktreeState, "removed");
      assert.equal(
        git("worktree", "list", "--porcelain")
          .split(/\r?\n/)
          .filter((line) => line.startsWith("worktree ")).length,
        1,
      );
    } finally {
      await server?.close();
      await service?.dispose();
      await authority?.dispose();
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      await rm(root, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      });
    }
  },
);

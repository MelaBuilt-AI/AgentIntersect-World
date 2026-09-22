import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, it, vi } from "vitest";
import {
  AdapterRegistry,
  AgentSessionGateway,
  AgentSessionStore,
  type AgentAdapter,
} from "../src/agent-sessions.js";
import { WorkstreamService } from "../src/workstream-service.js";
import { WorktreeAuthority } from "../src/worktree-authority.js";
import { createLocalServer } from "../src/server.js";

const exec = promisify(execFile);
const roots: string[] = [];
const services: WorkstreamService[] = [];
const servers: ReturnType<typeof createLocalServer>[] = [];
const harnesses = ["hermes", "openclaw", "codex", "claude-code"] as const;
async function git(cwd: string, ...args: string[]) {
  return (
    await exec("git", ["--no-optional-locks", "-C", cwd, ...args], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.invalid",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.invalid",
      },
    })
  ).stdout.trim();
}
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
  for (const service of services.splice(0)) await service.dispose();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture(
  adapterId: string,
  workspace?: AgentAdapter["workspace"],
) {
  const root = await mkdtemp(join(tmpdir(), "aiw-chat-repository-"));
  roots.push(root);
  const a = join(root, "project-a");
  const b = join(root, "project-b");
  const parent = join(root, "worktrees");
  await mkdir(parent);
  for (const directory of [a, b]) {
    await mkdir(directory);
    await git(directory, "init", "-q", "-b", "main");
    await git(
      directory,
      "commit",
      "--allow-empty",
      "-qm",
      "Initial checkpoint",
    );
  }
  let selected: string | null = a;
  const refA = { repositoryId: "repo-a", revision: "generation-a" };
  const send = vi
    .fn<AgentAdapter["sendText"]>()
    .mockResolvedValue({ finalText: "Discussion reply", deltas: [] });
  // Native transports are doubles; the gateway, Workstream, store and Git authority are real.
  const adapter: AgentAdapter = {
    id: adapterId,
    ...(workspace ? { workspace } : {}),
    attest: async () => ({
      schema: "aiw.agent-capabilities/0.12",
      adapterId,
      adapterVersion: "fixture",
      transport: "loopback-http-sse",
      origin: "local",
      auth: "server-bearer",
      supportedModes: ["explore", "collaborate"],
      ordering: "per-session-strict",
      resume: "session-api",
      shutdownOwner: "external",
      maxInputBytes: 16384,
      maxEventBytes: 32768,
      capabilities: {
        attach: true,
        sendText: true,
        streamDeltas: true,
        toolStatus: false,
        approvals: false,
        interrupt: false,
        avatarProposal: false,
        skillsDisclosure: false,
      },
      unavailable: {
        toolStatus: "fixture",
        approvals: "fixture",
        interrupt: "fixture",
        avatarProposal: "fixture",
        skillsDisclosure: "fixture",
      },
    }),
    listSessions: async () => [],
    attach: async (id) => ({
      id,
      rootId: id,
      source: "fixture",
      title: adapterId,
    }),
    sendText: send,
  };
  const store = new AgentSessionStore(join(root, "sessions"));
  const registry = new AdapterRegistry([adapter], [adapterId]);
  const gateway = new AgentSessionGateway({ registry, store });
  const attached = await gateway.attach({
    adapterId,
    adapterSessionRef: `${adapterId}-root`,
    mode: "explore",
    profile: "default",
    workspaceId: "workspace",
    repositoryRef: "current",
  });
  const agent = {
    agentId: attached.sessionId,
    nativeSessionId: attached.adapterSessionRef,
    rootNativeSessionId: attached.adapterRootSessionRef!,
    revision: "1",
  };
  const authority = new WorktreeAuthority({
    approvedRepositoryRoot: a,
    currentRepositoryRoot: () => selected,
    allowedWorktreeParent: parent,
  });
  const service = new WorkstreamService({
    directory: join(root, "workstreams"),
    worktreeParent: parent,
    worktreeAuthority: authority,
    currentRepository: () =>
      selected === a
        ? refA
        : selected === b
          ? { repositoryId: "repo-b", revision: "generation-b" }
          : null,
    connectedAgent: () => agent,
    evidenceReader: { read: async () => [] },
    id: () => "saved-work",
  });
  services.push(service);
  const created = await service.create({
    requestId: "create",
    correlationId: "create",
    title: "Saved work",
    task: "Original project task",
    repository: refA,
    agent,
  });
  const work = created.workstream;
  const ownedPath = authority.pathFor(work.authority);
  await writeFile(
    join(ownedPath, "draft.txt"),
    "Preserve original uncommitted work\n",
  );
  gateway.bindWorkstream(attached.sessionId, {
    worktreeRef: work.authority.worktreeId,
    taskRef: work.workstreamId,
  });
  const started = vi.fn(async () => {});
  const finished = vi.fn(async () => {});
  const wire = (target: AgentSessionGateway) => {
    target.setWorkstreamDirectoryResolver((session, intent) =>
      service.directoryForAgent({
        agentId: session.sessionId,
        worktreeRef: session.worktreeRef,
        currentTaskRef: session.currentTaskRef,
        intent,
      }),
    );
    target.setWorkstreamContextResolver((session, intent, mapPath) =>
      service.contextForAgent(
        {
          agentId: session.sessionId,
          worktreeRef: session.worktreeRef,
          currentTaskRef: session.currentTaskRef,
          intent,
        },
        mapPath,
      ),
    );
    target.setWorkstreamTurnStartObserver(started);
    target.setWorkstreamTurnObserver(finished);
  };
  wire(gateway);
  return {
    a,
    b,
    ownedPath,
    gateway,
    registry,
    store,
    wire,
    service,
    authority,
    work,
    attached,
    send,
    started,
    finished,
    select: (next: string | null) => {
      selected = next;
    },
  };
}

it.each(harnesses)(
  "%s keeps discussion in its owned worktree while viewing another project or no project",
  async (adapterId) => {
    const f = await fixture(adapterId);
    const original = await readFile(f.service.pathsForTest().current, "utf8");
    const before = f.gateway.status(f.attached.sessionId);
    for (const selection of [f.b, null, f.a]) {
      f.select(selection);
      // Browser restoration retains the same server-owned Workstream and native identity.
      const restored = new AgentSessionGateway({
        registry: f.registry,
        store: f.store,
      });
      f.wire(restored);
      await expect(
        restored.sendText(before.sessionId, {
          binding: restored.status(before.sessionId),
          text: "Discuss the existing work",
          intent: "discussion",
        }),
      ).resolves.toMatchObject({ finalText: "Discussion reply" });
      expect(restored.status(before.sessionId)).toMatchObject({
        status: "ready",
        adapterId,
        adapterSessionRef: before.adapterSessionRef,
        currentTaskRef: before.currentTaskRef,
        worktreeRef: before.worktreeRef,
      });
      const context = f.send.mock.calls.at(-1)![2]!;
      expect(context.workingDirectory).toBe(f.ownedPath);
      expect(context.systemMessage).toContain(
        "conversation, not a coding task",
      );
      expect(context.systemMessage).toContain(f.ownedPath);
      expect(context.systemMessage).not.toContain(f.b);
    }
    expect(f.send).toHaveBeenCalledTimes(3);
    expect(f.started).not.toHaveBeenCalled();
    expect(f.finished).not.toHaveBeenCalled();
    expect(await readFile(f.service.pathsForTest().current, "utf8")).toBe(
      original,
    );
    expect(await readFile(join(f.ownedPath, "draft.txt"), "utf8")).toBe(
      "Preserve original uncommitted work\n",
    );
    expect(await git(f.b, "status", "--porcelain")).toBe("");
    expect(
      f.gateway.history(before.sessionId).filter((m) => m.role === "assistant"),
    ).toHaveLength(3);
  },
);

it.each(harnesses)(
  "%s refuses cross-project work before dispatch without breaking subsequent discussion",
  async (adapterId) => {
    const f = await fixture(adapterId);
    f.select(f.b);
    const before = f.gateway.status(f.attached.sessionId);
    await expect(
      f.gateway.sendText(before.sessionId, {
        binding: before,
        text: "Change the project",
        intent: "work",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(f.gateway.status(before.sessionId)).toEqual(before);
    expect(f.gateway.events(before.sessionId)).toHaveLength(0);
    expect(f.send).not.toHaveBeenCalled();
    expect(f.started).not.toHaveBeenCalled();
    expect(f.finished).not.toHaveBeenCalled();
    await expect(
      f.gateway.sendText(before.sessionId, {
        binding: before,
        text: "Just discuss",
        intent: "discussion",
      }),
    ).resolves.toMatchObject({ finalText: "Discussion reply" });
  },
);

it.each(harnesses)(
  "%s still refuses a changed owned branch without marking the native session failed",
  async (adapterId) => {
    const f = await fixture(adapterId);
    f.select(f.b);
    await git(f.ownedPath, "switch", "-c", "unexpected-branch");
    const before = f.gateway.status(f.attached.sessionId);
    await expect(
      f.gateway.sendText(before.sessionId, {
        binding: before,
        text: "Discuss",
        intent: "discussion",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(f.send).not.toHaveBeenCalled();
    expect(f.gateway.status(before.sessionId)).toEqual(before);
    expect(f.gateway.events(before.sessionId)).toHaveLength(0);
    await git(f.ownedPath, "switch", f.work.authority.branch);
    await expect(
      f.gateway.sendText(before.sessionId, {
        binding: before,
        text: "Discuss",
        intent: "discussion",
      }),
    ).resolves.toMatchObject({ finalText: "Discussion reply" });
  },
);

it.each(harnesses)(
  "%s carries discussion intent through the real HTTP routes after a repository switch",
  async (adapterId) => {
    const f = await fixture(adapterId);
    const root = await mkdtemp(join(tmpdir(), "aiw-chat-http-"));
    roots.push(root);
    const server = createLocalServer({
      config: {
        instanceName: "Repository chat regression",
        networkScope: "loopback",
        host: "127.0.0.1",
        port: 3770,
        demoOperationMaxMs: 500,
        repositoryMaxFiles: 2500,
        presentationSync: {
          dataDir: join(root, "presentation"),
          allowedOrigin: "http://127.0.0.1:5173",
          allowedHost: "127.0.0.1:5173",
        },
      },
      agentSessionGateway: f.gateway,
    });
    servers.push(server);
    const origin = await server.listen({ host: "127.0.0.1", port: 0 });
    f.select(f.b);
    const binding = f.gateway.status(f.attached.sessionId);
    const send = (intent: "discussion" | "work") =>
      fetch(`${origin}/agent-sessions/${binding.sessionId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          binding,
          text: "Check the existing work",
          intent,
        }),
      });
    const work = await send("work");
    expect(work.status).toBe(409);
    expect((await work.json()).error.message).toContain(
      "Saved Workstream context",
    );
    expect(f.gateway.status(binding.sessionId)).toEqual(binding);
    const chat = await send("discussion");
    expect(chat.status).toBe(200);
    expect((await chat.json()).data.finalText).toBe("Discussion reply");
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(f.send.mock.calls[0]![2]?.workingDirectory).toBe(f.ownedPath);
  },
);

it.each(harnesses)(
  "%s maps owned work and report context before dispatch without rewriting task text",
  async (id) => {
    const mapPath = (p: string) => `C:\\Native Work${p.replaceAll("/", "\\")}`;
    const verifyWorkspace = vi.fn(async () => {});
    const nativeGit = {
      GIT_DIR: "C:/native/.git/worktrees/owned",
      GIT_COMMON_DIR: "C:/native/.git",
      GIT_WORK_TREE: "C:/native/owned",
    };
    const f = await fixture(id, {
      mapPath,
      verifyWorkspace,
      gitEnvironment: async () => nativeGit,
    });
    const binding = f.gateway.status(f.attached.sessionId);
    const text = "Explain the literal /mnt/c/example token; do not rewrite it";
    await f.gateway.sendText(binding.sessionId, {
      binding,
      text,
      intent: "work",
      context: { systemMessage: "stale host-only context" },
    });
    const context = f.send.mock.calls[0]![2]!;
    expect(context.workingDirectory).toBe(f.ownedPath);
    expect(context.nativeWorkingDirectory).toBe(mapPath(f.ownedPath));
    expect(context.systemMessage).toContain(
      JSON.stringify(mapPath(f.ownedPath)),
    );
    expect(context.systemMessage).toContain(
      JSON.stringify(
        mapPath(join(context.evidenceDirectory!, "saved-work.json")),
      ),
    );
    expect(context.systemMessage).not.toContain("stale host-only context");
    expect(context.systemMessage).toContain("native file-writing tool");
    expect(context.systemMessage).toContain(JSON.stringify(nativeGit));
    expect(f.send.mock.calls[0]![1]).toBe(text);
    expect(verifyWorkspace).toHaveBeenCalledWith(f.ownedPath, true);
    expect(verifyWorkspace).toHaveBeenCalledWith(
      context.evidenceDirectory,
      true,
    );
    await f.gateway.sendText(binding.sessionId, {
      binding: f.gateway.status(binding.sessionId),
      text: "discuss",
      intent: "discussion",
    });
    expect(f.send.mock.calls[1]![2]?.systemMessage).toContain(
      JSON.stringify(mapPath(f.ownedPath)),
    );
  },
);
it.each(harnesses)(
  "%s refuses inaccessible native report storage before accepting or dispatching a turn",
  async (id) => {
    const { AgentEnvironmentError } =
      await import("../src/agent-environment.js");
    const verifyWorkspace = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new AgentEnvironmentError(
          "Native report directory is unavailable; choose shared storage.",
        ),
      );
    const f = await fixture(id, { mapPath: (p) => p, verifyWorkspace });
    const binding = f.gateway.status(f.attached.sessionId);
    await expect(
      f.gateway.sendText(binding.sessionId, {
        binding,
        text: "work",
        intent: "work",
      }),
    ).rejects.toThrow("Native report directory is unavailable");
    expect(f.send).not.toHaveBeenCalled();
    expect(f.started).not.toHaveBeenCalled();
    expect(f.gateway.status(binding.sessionId)).toEqual(binding);
    expect(f.gateway.isBusy(binding.sessionId)).toBe(false);
  },
);

it.each(harnesses)(
  "%s projects native Windows file activity relative to its owned worktree",
  async (id) => {
    const nativeRoot = "C:\\Native Work\\repo";
    const f = await fixture(id, {
      mapPath: () => nativeRoot,
      verifyWorkspace: async () => {},
    });
    f.send.mockImplementation(async (_session, _text, context) => {
      for (const file of [
        "C:\\Native Work\\repo\\index.html",
        "/c/Native Work/repo/index.html",
        "C:\\Private\\outside.txt",
      ]) {
        await context?.onEvent?.({
          type: "tool.started",
          toolName: "Read",
          activityId: "native-file",
          repositoryLocator: { operation: "read", paths: [file] },
          redaction: { applied: true, count: 1 },
        });
      }
      return { finalText: "Done", deltas: [] };
    });
    const binding = f.gateway.status(f.attached.sessionId);
    await f.gateway.sendText(binding.sessionId, {
      binding,
      text: "Inspect",
      intent: "discussion",
    });
    const events = f.gateway
      .events(binding.sessionId)
      .filter((e) => e.type === "tool.started");
    expect(events.map((e) => e.payload.repositoryPath)).toEqual([
      "index.html",
      "index.html",
      undefined,
    ]);
    expect(JSON.stringify(events)).not.toContain("Private");
  },
);

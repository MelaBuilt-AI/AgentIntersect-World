import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CODEX_CLI_VERSION,
  CodexSessionAdapter,
} from "../src/codex-session-adapter.js";

type FixtureControl = {
  readonly version?: string;
  readonly invalidHelp?: boolean;
  readonly attestHang?: boolean;
  readonly failure?:
    | "malformed"
    | "output-flood"
    | "event-flood"
    | "unexpected-exit"
    | "resume-failure"
    | "stderr-canary"
    | "hang"
    | "delay"
    | "thread-mismatch"
    | "leader-exit-descendant";
};

type Fixture = {
  readonly executablePath: string;
  readonly nativeSessionRoot: string;
  invocations(): Promise<
    readonly {
      readonly args: readonly string[];
      readonly cwd: string;
      readonly envKeys: readonly string[];
      readonly codexHome?: string;
      readonly stdinBytes: number;
    }[]
  >;
  pid(): Promise<number>;
  descendantPid(): Promise<number>;
};

const temporaryRoots: string[] = [];

afterEach(async () => {
  delete process.env.CODEX_ADAPTER_SECRET_CANARY;
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

async function fixtureExecutable(
  control: FixtureControl = {},
): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-codex-adapter-"));
  temporaryRoots.push(root);
  const executablePath = path.join(root, "codex-fixture.mjs");
  await writeFile(
    path.join(root, "fixture-control.json"),
    JSON.stringify(control),
    { mode: 0o600 },
  );
  await writeFile(path.join(root, "fixture-auth.json"), "{}\n", {
    mode: 0o600,
  });
  await writeFile(
    executablePath,
    `#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const args = process.argv.slice(2);
const control = JSON.parse(fs.readFileSync(path.join(cwd, "fixture-control.json"), "utf8"));
let stdin = "";
for await (const chunk of process.stdin) stdin += chunk;
fs.appendFileSync(
  path.join(cwd, "fixture-invocations.jsonl"),
  JSON.stringify({ args, cwd, envKeys: Object.keys(process.env).sort(), codexHome: process.env.CODEX_HOME, stdinBytes: Buffer.byteLength(stdin) }) + "\\n",
);

if (control.attestHang && (args.includes("--help") || args.includes("--version"))) {
  process.on("SIGTERM", () => {});
  fs.writeFileSync(path.join(cwd, "fixture-pid"), String(process.pid));
  setInterval(() => {}, 1000);
  await new Promise(() => {});
}

if (args.length === 1 && args[0] === "--version") {
  process.stdout.write("codex-cli " + (control.version || "0.149.1") + "\\n");
  process.exit(0);
}

if (args.join(" ") === "exec --help") {
  process.stdout.write(control.invalidHelp
    ? "not codex help\\n"
    : "Usage: codex exec [OPTIONS] [PROMPT]\\n--model <MODEL>\\n--sandbox <SANDBOX_MODE>\\n--json\\nresume\\n");
  process.exit(0);
}

if (args.join(" ") === "exec resume --help") {
  process.stdout.write(control.invalidHelp
    ? "not resume help\\n"
    : "Usage: codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]\\n--json\\n--last\\n");
  process.exit(0);
}

const resumeIndex = args.indexOf("resume");
const isResume = resumeIndex >= 0;
let threadId;
if (isResume) {
  threadId = args[resumeIndex + 1];
} else {
  const counterPath = path.join(cwd, "fixture-counter");
  const counter = fs.existsSync(counterPath)
    ? Number(fs.readFileSync(counterPath, "utf8")) + 1
    : 1;
  fs.writeFileSync(counterPath, String(counter));
  threadId = "11111111-1111-4111-8111-" + String(counter).padStart(12, "0");
}

const emit = (event) => process.stdout.write(JSON.stringify(event) + "\\n");
emit({
  type: "thread.started",
  thread_id:
    isResume && control.failure === "thread-mismatch"
      ? "99999999-9999-4999-8999-999999999999"
      : threadId,
});
emit({ type: "turn.started" });

if (isResume && control.failure === "malformed") {
  process.stdout.write("{not-json\\n");
  process.exit(0);
}
if (isResume && control.failure === "output-flood") {
  process.stdout.write("x".repeat(300000));
  process.exit(0);
}
if (isResume && control.failure === "event-flood") {
  for (let index = 0; index < 1100; index += 1) emit({ type: "turn.started" });
  process.exit(0);
}
if (isResume && control.failure === "unexpected-exit") process.exit(7);
if (isResume && control.failure === "resume-failure") {
  emit({ type: "turn.failed", error: { message: "RAW_FAILURE_CANARY" } });
  process.exit(1);
}
if (isResume && control.failure === "stderr-canary") {
  process.stderr.write("TOKEN_CANARY RAW_PROMPT /home/private/.codex/config.toml\\n");
  process.exit(9);
}
if (isResume && control.failure === "hang") {
  process.on("SIGTERM", () => {});
  fs.writeFileSync(path.join(cwd, "fixture-pid"), String(process.pid));
  setInterval(() => {}, 1000);
  await new Promise(() => {});
}
if (isResume && control.failure === "leader-exit-descendant") {
  const descendant = spawn(
    process.execPath,
    ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
    { stdio: "ignore" },
  );
  fs.writeFileSync(path.join(cwd, "fixture-pid"), String(process.pid));
  fs.writeFileSync(path.join(cwd, "fixture-descendant-pid"), String(descendant.pid));
  process.on("SIGTERM", () => process.exit(0));
  setInterval(() => {}, 1000);
  await new Promise(() => {});
}
if (isResume && control.failure === "delay") {
  fs.writeFileSync(path.join(cwd, "fixture-pid"), String(process.pid));
  await new Promise((resolve) => setTimeout(resolve, 150));
}

if (isResume) {
  emit({
    type: "item.updated",
    item: { id: "item-1", type: "agent_message" },
    delta: "fixture ",
  });
  emit({
    type: "item.started",
    item: {
      id: "item-2",
      type: "command_execution",
      command: "cat codex/Task15Codex.md",
      status: "in_progress",
    },
  });
  emit({
    type: "item.completed",
    item: {
      id: "item-2",
      type: "command_execution",
      command: "cat codex/Task15Codex.md",
      aggregated_output: "RAW_RESULT_CANARY",
      exit_code: 0,
      status: "completed",
    },
  });
  emit({
    type: "item.started",
    item: {
      id: "item-file-change",
      type: "file_change",
      changes: [{ path: path.join(cwd, "src/DigAcceptance.ts"), kind: "update" }],
      status: "in_progress",
    },
  });
  emit({
    type: "item.completed",
    item: {
      id: "item-file-change",
      type: "file_change",
      changes: [{ path: path.join(cwd, "src/DigAcceptance.ts"), kind: "update" }],
      status: "completed",
    },
  });
  emit({
    type: "item.started",
    item: {
      id: "item-compound",
      type: "command_execution",
      command: "/bin/bash -lc 'cat codex/Task15Codex.md; touch changed'",
      status: "in_progress",
    },
  });
  emit({
    type: "item.completed",
    item: {
      id: "item-compound",
      type: "command_execution",
      command: "/bin/bash -lc 'cat codex/Task15Codex.md; touch changed'",
      exit_code: 0,
      status: "completed",
    },
  });
  emit({
    type: "item.started",
    item: {
      id: "item-3",
      type: "mcp_tool_call",
      server: "private-server",
      tool: "edit_file",
      arguments: { path: "/home/private/file" },
      status: "in_progress",
    },
  });
  emit({
    type: "item.completed",
    item: {
      id: "item-3",
      type: "mcp_tool_call",
      server: "private-server",
      tool: "edit_file",
      result: "RAW_RESULT_CANARY",
      error: { message: "RAW_TOOL_ERROR_CANARY" },
      status: "failed",
    },
  });
  emit({
    type: "item.completed",
    item: {
      id: "item-1",
      type: "agent_message",
      text: "fixture complete",
    },
  });
} else {
  emit({
    type: "item.completed",
    item: { id: "item-ready", type: "agent_message", text: "ready" },
  });
}
emit({
  type: "turn.completed",
  usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
});
`,
    { mode: 0o700 },
  );
  await chmod(executablePath, 0o700);
  return {
    executablePath,
    nativeSessionRoot: root,
    async invocations() {
      const raw = await readFile(
        path.join(root, "fixture-invocations.jsonl"),
        "utf8",
      );
      return raw
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
    async pid() {
      return Number(await readFile(path.join(root, "fixture-pid"), "utf8"));
    },
    async descendantPid() {
      return Number(
        await readFile(path.join(root, "fixture-descendant-pid"), "utf8"),
      );
    },
  };
}

function adapter(fixture: Fixture, overrides: Record<string, unknown> = {}) {
  return new CodexSessionAdapter({
    executablePath: fixture.executablePath,
    nativeSessionRoot: fixture.nativeSessionRoot,
    authPath: path.join(fixture.nativeSessionRoot, "fixture-auth.json"),
    terminateGraceMs: 20,
    ...overrides,
  });
}

async function waitForInvocationCount(
  fixture: Fixture,
  expected: number,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const count = await fixture.invocations().then(
      (calls) => calls.length,
      () => 0,
    );
    if (count >= expected) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 2));
  }
  throw new Error(`fixture did not receive ${expected} invocations`);
}

async function waitForPid(fixture: Fixture): Promise<number> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const pid = await fixture.pid().catch(() => 0);
    if (pid > 0) return pid;
    await new Promise<void>((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("fixture did not publish its process identity");
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForProcessExit(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (!processIsAlive(pid)) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("fixture process remained alive");
}

describe("CodexSessionAdapter", () => {
  it.each(["0.146.0", "0.153.4", "99.0.0-next.1"])(
    "accepts compatible Codex version %s without a release allowlist",
    async (version) => {
      const fixture = await fixtureExecutable({ version });
      await expect(adapter(fixture).attest()).resolves.toMatchObject({
        adapterVersion: `0.19.0-codex-${version}`,
      });
    },
  );
  it("attests the exact bounded Codex CLI contract with an allowlisted environment", async () => {
    const fixture = await fixtureExecutable();
    process.env.CODEX_ADAPTER_SECRET_CANARY = "must-not-pass";
    const manifest = await adapter(fixture).attest();

    expect(manifest).toMatchObject({
      adapterId: "codex",
      adapterVersion: `0.19.0-codex-${CODEX_CLI_VERSION}`,
      capabilities: {
        attach: true,
        sendText: true,
        streamDeltas: true,
        toolStatus: true,
        interrupt: false,
      },
    });
    const calls = await fixture.invocations();
    expect(calls.map(({ args }) => args)).toEqual([
      ["--version"],
      ["exec", "--help"],
      ["exec", "resume", "--help"],
    ]);
    expect(calls.every(({ cwd }) => cwd === fixture.nativeSessionRoot)).toBe(
      true,
    );
    expect(
      calls.every(
        ({ envKeys }) => !envKeys.includes("CODEX_ADAPTER_SECRET_CANARY"),
      ),
    ).toBe(true);
  });

  it.each([
    [{ version: "bad version metadata" }, /identity/i],
    [{ invalidHelp: true }, /contract/i],
  ] as const)(
    "fails closed on a CLI contract mismatch: %o",
    async (control, reason) => {
      const fixture = await fixtureExecutable(control);
      await expect(adapter(fixture).attest()).rejects.toThrow(reason);
    },
  );

  it("bounds and sanitizes an unresponsive attestation", async () => {
    const fixture = await fixtureExecutable({ attestHang: true });
    const startedAt = Date.now();
    const error = await adapter(fixture, { attestTimeoutMs: 500 })
      .attest()
      .catch((reason: unknown) => reason as Error);
    const pid = await waitForPid(fixture);

    expect(Date.now() - startedAt).toBeLessThan(1_500);
    expect(error.message).toMatch(/Codex CLI attestation timed out/i);
    expect(error.message).not.toContain(fixture.executablePath);
    await waitForProcessExit(pid);
  });

  it("uses a selected native profile without replacing its model/config or deleting its credentials", async () => {
    const fixture = await fixtureExecutable();
    const nativeProfilePath = path.join(
      fixture.nativeSessionRoot,
      "native-profile",
    );
    await mkdir(nativeProfilePath);
    await writeFile(
      path.join(nativeProfilePath, "config.toml"),
      'model = "profile-selected-model"\n',
    );
    await writeFile(
      path.join(nativeProfilePath, "auth.json"),
      "native-auth-sentinel",
    );
    const codex = adapter(fixture, { nativeProfilePath, profileName: "work" });
    const session = await codex.createWorldSession(
      "profile-world",
      "Work Codex",
    );
    const calls = await fixture.invocations();
    expect(calls[0]?.codexHome).toBe(nativeProfilePath);
    expect(calls[0]?.args).toContain("--profile");
    expect(calls[0]?.args).toContain("work");
    expect(calls[0]?.args).not.toContain("--ignore-user-config");
    expect(calls[0]?.args).not.toContain("--model");
    await codex.endWorldSession("profile-world", session.id);
    expect(
      await readFile(path.join(nativeProfilePath, "auth.json"), "utf8"),
    ).toBe("native-auth-sentinel");
    expect(
      await readFile(path.join(nativeProfilePath, "config.toml"), "utf8"),
    ).toBe('model = "profile-selected-model"\n');
  });

  it("restores the exact native binding after adapter recreation without creating a replacement conversation", async () => {
    const fixture = await fixtureExecutable();
    const first = adapter(fixture);
    const created = await first.createWorldSession(
      "restart-world",
      "Restart Codex",
    );
    const second = adapter(fixture);
    const attached = await second.attach(created.id, {
      worldInstanceId: "restart-world",
    });
    expect(attached.id).toBe(created.id);
    expect(await second.listSessions()).toEqual([created]);
    expect(
      (await fixture.invocations()).filter((call) => call.args[0] === "exec"),
    ).toHaveLength(1);
    await second.sendText(attached.id, "resume the existing conversation", {
      rootSessionRef: created.id,
      mode: "explore",
    });
    const last = (await fixture.invocations()).at(-1);
    expect(last?.args).toContain("resume");
    expect(last?.args).toContain(created.id);
    await second.endWorldSession("restart-world", created.id);
    await expect(
      adapter(fixture).attach(created.id, { worldInstanceId: "restart-world" }),
    ).rejects.toThrow(/owned/i);
  });

  it("creates a World-owned thread, resumes the exact ID, and maps only sanitized structured events", async () => {
    const fixture = await fixtureExecutable();
    const codex = adapter(fixture);
    const created = await codex.createWorldSession("world-one", "Codex One");
    const attached = await codex.attach(created.rootId as string, {
      worldInstanceId: "world-one",
    });
    const events: unknown[] = [];
    const first = await codex.sendText(attached.id, "hello", {
      mode: "explore",
      rootSessionRef: created.rootId,
      onEvent: (event) => events.push(event),
    });
    const reattached = await codex.attach(created.rootId as string, {
      worldInstanceId: "world-one",
    });
    const second = await codex.sendText(reattached.id, "again", {
      mode: "explore",
      rootSessionRef: created.rootId,
    });

    expect(created).toMatchObject({
      id: "11111111-1111-4111-8111-000000000001",
      rootId: "11111111-1111-4111-8111-000000000001",
      source: "codex",
      title: "Codex One",
    });
    expect(first).toMatchObject({
      finalText: "fixture complete",
      deltas: ["fixture "],
      sessionRef: created.id,
    });
    expect(second.finalText).toBe("fixture complete");
    expect(events).toEqual([
      {
        type: "assistant.delta",
        text: "fixture ",
        redaction: { applied: false, count: 0 },
      },
      {
        type: "tool.started",
        toolName: "command_execution",
        activityId: "item-2",
        repositoryLocator: {
          operation: "read",
          paths: ["codex/Task15Codex.md"],
        },
        redaction: { applied: true, count: 1 },
      },
      {
        type: "tool.completed",
        toolName: "command_execution",
        activityId: "item-2",
        repositoryLocator: {
          operation: "read",
          paths: ["codex/Task15Codex.md"],
        },
        redaction: { applied: true, count: 1 },
      },
      {
        type: "tool.started",
        toolName: "file_change",
        activityId: "item-file-change",
        repositoryLocator: {
          operation: "edit",
          paths: ["src/DigAcceptance.ts"],
        },
        redaction: { applied: true, count: 1 },
      },
      {
        type: "tool.completed",
        toolName: "file_change",
        activityId: "item-file-change",
        repositoryLocator: {
          operation: "edit",
          paths: ["src/DigAcceptance.ts"],
        },
        redaction: { applied: true, count: 1 },
      },
      {
        type: "tool.started",
        toolName: "command_execution",
        redaction: { applied: true, count: 1 },
      },
      {
        type: "tool.completed",
        toolName: "command_execution",
        redaction: { applied: true, count: 1 },
      },
      {
        type: "tool.started",
        toolName: "edit_file",
        activityId: "item-3",
        repositoryLocator: {
          operation: "edit",
          paths: ["/home/private/file"],
        },
        redaction: { applied: true, count: 1 },
      },
      {
        type: "tool.failed",
        toolName: "edit_file",
        activityId: "item-3",
        repositoryLocator: {
          operation: "edit",
          paths: ["/home/private/file"],
        },
        redaction: { applied: true, count: 1 },
      },
    ]);
    expect(JSON.stringify(events)).not.toMatch(/RAW_|private-server/);
    await expect(
      codex.attach(created.rootId as string, {
        worldInstanceId: "wrong-world",
      }),
    ).rejects.toThrow(/World/i);

    const calls = await fixture.invocations();
    const createArgs = [
      "exec",
      "--model",
      "gpt-5.6-sol",
      "-c",
      'model_reasoning_effort="high"',
      "--sandbox",
      "workspace-write",
      "--json",
      "--skip-git-repo-check",
      "--ignore-user-config",
      "-",
    ];
    const resumeArgs = [
      "exec",
      "--model",
      "gpt-5.6-sol",
      "-c",
      'model_reasoning_effort="high"',
      "--sandbox",
      "workspace-write",
      "--json",
      "--skip-git-repo-check",
      "--ignore-user-config",
      "resume",
      created.id,
      "-",
    ];
    expect(calls.map(({ args }) => args)).toEqual([
      createArgs,
      resumeArgs,
      resumeArgs,
    ]);
    expect(JSON.stringify(calls)).not.toContain("Codex One");
    expect(calls.every(({ stdinBytes }) => stdinBytes > 0)).toBe(true);
    const runtimeHomes = calls
      .map(({ codexHome }) => codexHome)
      .filter((value): value is string => Boolean(value));
    expect(runtimeHomes).toHaveLength(3);
    expect(new Set(runtimeHomes).size).toBe(1);
    expect(runtimeHomes[0]).toContain(
      `${fixture.nativeSessionRoot}/.aiw-codex-`,
    );
  });

  it("rejects overlapping turns on the exact native thread", async () => {
    const fixture = await fixtureExecutable({ failure: "delay" });
    const codex = adapter(fixture);
    const created = await codex.createWorldSession("world-overlap");
    const first = codex.sendText(created.id, "one", {
      mode: "explore",
      rootSessionRef: created.rootId,
    });
    await waitForInvocationCount(fixture, 2);
    await expect(
      codex.sendText(created.id, "two", {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).rejects.toThrow(/active/i);
    await first;
  });

  it.each([
    "malformed",
    "output-flood",
    "event-flood",
    "unexpected-exit",
    "resume-failure",
    "thread-mismatch",
  ] as const)(
    "quarantines an ambiguously failed resume: %s",
    async (failure) => {
      const fixture = await fixtureExecutable({ failure });
      const codex = adapter(fixture);
      const created = await codex.createWorldSession(`world-${failure}`);

      await expect(
        codex.sendText(created.id, "ambiguous", {
          mode: "explore",
          rootSessionRef: created.rootId,
        }),
      ).rejects.toThrow(/Codex/);
      await expect(
        codex.attach(created.id, { worldInstanceId: `world-${failure}` }),
      ).rejects.toThrow(/quarantined|stale/i);
      await expect(
        codex.sendText(created.id, "must not replace", {
          mode: "explore",
          rootSessionRef: created.rootId,
        }),
      ).rejects.toThrow(/quarantined|stale/i);
      expect(await codex.listSessions()).toHaveLength(1);
      expect(await fixture.invocations()).toHaveLength(2);
      await codex.endWorldSession(`world-${failure}`, created.id);
      expect(await codex.listSessions()).toHaveLength(0);
    },
  );

  it("gives coding turns a bounded ten-minute budget by default", async () => {
    const fixture = await fixtureExecutable();
    const codex = adapter(fixture);
    const created = await codex.createWorldSession("world-coding-budget");
    const timer = vi.spyOn(globalThis, "setTimeout");
    try {
      await codex.sendText(created.id, "Build the homepage", {
        mode: "collaborate",
        rootSessionRef: created.rootId,
      });
      expect(timer).toHaveBeenCalledWith(expect.any(Function), 600_000);
    } finally {
      timer.mockRestore();
      await codex.endWorldSession("world-coding-budget", created.id);
    }
  });

  it.each(["timeout", "abort"] as const)(
    "terminates the process group and quarantines on %s",
    async (kind) => {
      const fixture = await fixtureExecutable({ failure: "hang" });
      const codex = adapter(fixture, { turnTimeoutMs: 500 });
      const created = await codex.createWorldSession(`world-${kind}`);
      const controller = new AbortController();
      const turn = codex.sendText(created.id, "bounded", {
        mode: "explore",
        rootSessionRef: created.rootId,
        signal: controller.signal,
      });
      await waitForInvocationCount(fixture, 2);
      const pid = await waitForPid(fixture);
      if (kind === "abort") controller.abort();
      await expect(turn).rejects.toThrow(
        kind === "abort" ? /cancel/i : /timed out/i,
      );
      await waitForProcessExit(pid);
      await expect(
        codex.attach(created.id, { worldInstanceId: `world-${kind}` }),
      ).rejects.toThrow(/quarantined|stale/i);
      await codex.endWorldSession(`world-${kind}`, created.id);
    },
  );

  it("kills a resistant descendant even when the process-group leader exits first", async () => {
    const fixture = await fixtureExecutable({
      failure: "leader-exit-descendant",
    });
    const codex = adapter(fixture, { turnTimeoutMs: 500 });
    const created = await codex.createWorldSession("world-descendant");
    // Attach before the bounded fixture timeout can elapse under a loaded CI runner.
    const turn = codex
      .sendText(created.id, "bounded", {
        mode: "explore",
        rootSessionRef: created.rootId,
      })
      .catch((reason: unknown) => reason as Error);
    await waitForInvocationCount(fixture, 2);
    await waitForPid(fixture);
    const descendantPid = await fixture.descendantPid();

    const turnResult = await turn;
    expect(turnResult).toBeInstanceOf(Error);
    if (!(turnResult instanceof Error))
      throw new Error("turn unexpectedly succeeded");
    expect(turnResult.message).toMatch(/timed out/i);
    await waitForProcessExit(descendantPid);
    await codex.endWorldSession("world-descendant", created.id);
  });

  it("sanitizes stderr and never retries or silently creates after failure", async () => {
    const fixture = await fixtureExecutable({ failure: "stderr-canary" });
    const codex = adapter(fixture);
    const created = await codex.createWorldSession("world-stderr");
    const error = await codex
      .sendText(created.id, "RAW_PROMPT", {
        mode: "explore",
        rootSessionRef: created.rootId,
      })
      .catch((reason: unknown) => reason as Error);

    expect(error.message).toBe("Codex CLI turn failed");
    expect(error.message).not.toMatch(/TOKEN_CANARY|RAW_PROMPT|\/home\//);
    expect(await fixture.invocations()).toHaveLength(2);
  });

  it("bounds input before spawn without poisoning an otherwise healthy binding", async () => {
    const fixture = await fixtureExecutable();
    const codex = adapter(fixture);
    const created = await codex.createWorldSession("world-input");
    await expect(
      codex.sendText(created.id, "x".repeat(16_385), {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).rejects.toThrow(/input/i);
    expect(await fixture.invocations()).toHaveLength(1);
    await expect(
      codex.sendText(created.id, "valid", {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).resolves.toMatchObject({ finalText: "fixture complete" });
  });

  it("ends only the exact owner idempotently and requires a new later-World thread", async () => {
    const fixture = await fixtureExecutable();
    const codex = adapter(fixture);
    const first = await codex.createWorldSession("world-one", "Same Name");

    await expect(
      codex.endWorldSession("wrong-world", first.id),
    ).rejects.toThrow(/World/i);
    await codex.endWorldSession("world-one", first.id);
    await codex.endWorldSession("world-one", first.id);
    const firstRuntimeHome = (await fixture.invocations())[0]
      ?.codexHome as string;
    await expect(lstat(firstRuntimeHome)).resolves.toBeDefined();
    await expect(
      lstat(path.join(firstRuntimeHome, "auth.json")),
    ).rejects.toThrow();
    await expect(
      codex.attach(first.id, { worldInstanceId: "world-one" }),
    ).rejects.toThrow(/ended|owned/i);

    const second = await codex.createWorldSession("world-two", "Same Name");
    expect(second.id).not.toBe(first.id);
    const runtimeHomes = (await fixture.invocations()).map(
      ({ codexHome }) => codexHome,
    );
    expect(runtimeHomes[1]).not.toBe(runtimeHomes[0]);
    await expect(
      codex.attach(first.id, { worldInstanceId: "world-two" }),
    ).rejects.toThrow(/World|ended|owned/i);
    expect(await fixture.invocations()).toHaveLength(2);
  });
});

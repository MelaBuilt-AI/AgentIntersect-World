import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLAUDE_CODE_VERSION,
  ClaudeCodeSessionAdapter,
} from "../src/claude-code-session-adapter.js";

type FixtureControl = {
  readonly version?: string;
  readonly invalidHelp?: boolean;
  readonly attestHang?: boolean;
  readonly realSystemEvents?: boolean;
  readonly failure?:
    | "malformed"
    | "stdout-flood"
    | "event-line-flood"
    | "event-flood"
    | "stderr-flood"
    | "unexpected-exit"
    | "result-error"
    | "stderr-canary"
    | "hang"
    | "delay"
    | "session-mismatch"
    | "final-flood"
    | "leader-exit-descendant";
};

type Invocation = {
  readonly args: readonly string[];
  readonly cwd: string;
  readonly envKeys: readonly string[];
  readonly home?: string;
  readonly xdgConfigHome?: string;
  readonly xdgStateHome?: string;
  readonly xdgDataHome?: string;
  readonly xdgCacheHome?: string;
  readonly claudeConfigDir?: string;
  readonly authToken?: string;
  readonly baseUrl?: string;
  readonly apiKeyPresent: boolean;
  readonly apiKey?: string;
  readonly stdinBytes: number;
};

type Fixture = {
  readonly executablePath: string;
  readonly nativeSessionRoot: string;
  invocations(): Promise<readonly Invocation[]>;
  pid(): Promise<number>;
  descendantPid(): Promise<number>;
};

const temporaryRoots: string[] = [];

afterEach(async () => {
  delete process.env.CLAUDE_ADAPTER_SECRET_CANARY;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

async function fixtureExecutable(
  control: FixtureControl = {},
): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-claude-adapter-"));
  temporaryRoots.push(root);
  const executablePath = path.join(root, "claude-fixture.mjs");
  await writeFile(
    path.join(root, "fixture-control.json"),
    JSON.stringify(control),
    { mode: 0o600 },
  );
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
  JSON.stringify({
    args,
    cwd,
    envKeys: Object.keys(process.env).sort(),
    home: process.env.HOME,
    xdgConfigHome: process.env.XDG_CONFIG_HOME,
    xdgStateHome: process.env.XDG_STATE_HOME,
    xdgDataHome: process.env.XDG_DATA_HOME,
    xdgCacheHome: process.env.XDG_CACHE_HOME,
    claudeConfigDir: process.env.CLAUDE_CONFIG_DIR,
    authToken: process.env.ANTHROPIC_AUTH_TOKEN,
    baseUrl: process.env.ANTHROPIC_BASE_URL,
    apiKeyPresent: Object.hasOwn(process.env, "ANTHROPIC_API_KEY"),
    apiKey: process.env.ANTHROPIC_API_KEY,
    stdinBytes: Buffer.byteLength(stdin),
  }) + "\\n",
);

if (control.attestHang && (args.includes("--help") || args.includes("--version"))) {
  process.on("SIGTERM", () => {});
  fs.writeFileSync(path.join(cwd, "fixture-pid"), String(process.pid));
  setInterval(() => {}, 1000);
  await new Promise(() => {});
}

if (args.length === 1 && args[0] === "--version") {
  process.stdout.write((control.version || "2.1.228") + " (Claude Code)\\n");
  process.exit(0);
}

if (args.length === 1 && args[0] === "--help") {
  process.stdout.write(control.invalidHelp
    ? "not claude help\\n"
    : "Usage: claude [options] [command] [prompt]\\n-p, --print\\n-r, --resume [value]\\n--session-id <uuid>\\n--model <model>\\n--output-format <format>\\n--input-format <format>\\n--verbose\\n--include-partial-messages\\n--tools <tools...>\\n--disable-slash-commands\\n--setting-sources <sources>\\n--mcp-config <configs...>\\n--strict-mcp-config\\n");
  process.exit(0);
}

const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const isResume = args.includes("--resume");
const requestedSessionId = isResume ? option("--resume") : option("--session-id");
const sessionId =
  isResume && control.failure === "session-mismatch"
    ? "99999999-9999-4999-8999-999999999999"
    : requestedSessionId;
const emit = (event) => process.stdout.write(JSON.stringify(event) + "\\n");

emit({ type: "system", subtype: "init", session_id: sessionId, cwd, tools: [] });
if (control.realSystemEvents) {
  emit({ type: "system", subtype: "status", status: "requesting", session_id: sessionId });
  emit({ type: "system", subtype: "thinking_tokens", estimated_tokens: 1, estimated_tokens_delta: 1, session_id: sessionId });
}
if (isResume && control.failure === "malformed") {
  process.stdout.write("{not-json\\n");
  process.exit(0);
}
if (isResume && control.failure === "stdout-flood") {
  process.stdout.write("x".repeat(300000));
  process.exit(0);
}
if (isResume && control.failure === "event-line-flood") {
  emit({ type: "stream_event", session_id: sessionId, event: { type: "ping", padding: "x".repeat(40000) } });
  process.exit(0);
}
if (isResume && control.failure === "event-flood") {
  for (let index = 0; index < 1100; index += 1) {
    emit({ type: "stream_event", session_id: sessionId, event: { type: "ping" } });
  }
  process.exit(0);
}
if (isResume && control.failure === "stderr-flood") {
  process.stderr.write("x".repeat(20000));
  process.exit(0);
}
if (isResume && control.failure === "unexpected-exit") process.exit(7);
if (isResume && control.failure === "result-error") {
  emit({ type: "result", subtype: "error_during_execution", is_error: true, result: "RAW_FAILURE_CANARY", session_id: sessionId });
  process.exit(0);
}
if (isResume && control.failure === "stderr-canary") {
  process.stderr.write("TOKEN_CANARY RAW_PROMPT /home/private/.claude.json\\n");
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
  emit({ type: "stream_event", session_id: sessionId, event: { type: "message_start", message: { type: "message" } } });
  emit({ type: "stream_event", session_id: sessionId, event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "fixture " } } });
  emit({
    type: "assistant",
    session_id: sessionId,
    message: {
      type: "message",
      role: "assistant",
      content: [
        { type: "thinking", thinking: "PRIVATE_REASONING_CANARY" },
        { type: "text", text: "fixture complete" },
        { type: "tool_use", id: "tool-1", name: "Edit", input: { file_path: "/home/private/file", old_string: "RAW_PROMPT" } },
        { type: "tool_use", id: "tool-2", name: "bad tool name!", input: { command: "RAW_ARGS_CANARY" } },
      ],
    },
  });
  emit({
    type: "user",
    session_id: sessionId,
    message: {
      type: "message",
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "tool-1", content: "RAW_RESULT_CANARY", is_error: false },
        { type: "tool_result", tool_use_id: "tool-2", content: [{ type: "text", text: "/home/private/result" }], is_error: true },
      ],
    },
  });
  emit({ type: "stream_event", session_id: sessionId, event: { type: "message_stop" } });
}
const result = isResume
  ? control.failure === "final-flood"
    ? "x".repeat(70000)
    : "fixture complete"
  : "ready";
emit({ type: "result", subtype: "success", is_error: false, result, session_id: sessionId });
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
        .map((line) => JSON.parse(line) as Invocation);
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

function modelFetch(available = true): typeof globalThis.fetch {
  return vi.fn(async (input: string | URL | Request) => {
    expect(String(input)).toBe("http://localhost:11434/api/tags");
    return new Response(
      JSON.stringify({
        models: available ? [{ name: "qwythos:claude-q6-64k" }] : [],
      }),
      { status: 200 },
    );
  }) as typeof globalThis.fetch;
}

function adapter(fixture: Fixture, overrides: Record<string, unknown> = {}) {
  return new ClaudeCodeSessionAdapter({
    executablePath: fixture.executablePath,
    nativeSessionRoot: fixture.nativeSessionRoot,
    fetch: modelFetch(),
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

describe("ClaudeCodeSessionAdapter", () => {
  it("attests the exact CLI and local-model contract with the narrow child environment", async () => {
    const fixture = await fixtureExecutable();
    process.env.CLAUDE_ADAPTER_SECRET_CANARY = "must-not-pass";
    const manifest = await adapter(fixture).attest();

    expect(manifest).toMatchObject({
      adapterId: "claude-code",
      adapterVersion: `0.19.0-claude-code-${CLAUDE_CODE_VERSION}`,
      capabilities: {
        attach: true,
        sendText: true,
        streamDeltas: true,
        toolStatus: true,
        interrupt: false,
      },
    });
    const calls = await fixture.invocations();
    expect(calls.map(({ args }) => args)).toEqual([["--version"], ["--help"]]);
    expect(calls.every(({ cwd }) => cwd === fixture.nativeSessionRoot)).toBe(
      true,
    );
    expect(
      calls.every(
        ({ envKeys }) => !envKeys.includes("CLAUDE_ADAPTER_SECRET_CANARY"),
      ),
    ).toBe(true);
    const allowedKeys = new Set([
      "ANTHROPIC_AUTH_TOKEN",
      "ANTHROPIC_BASE_URL",
      "ANTHROPIC_API_KEY",
      "CLAUDE_CONFIG_DIR",
      "HOME",
      "PATH",
      "USER",
      "LOGNAME",
      "LANG",
      "LC_ALL",
      "TERM",
      "COLORTERM",
      "TMPDIR",
      "XDG_CONFIG_HOME",
      "XDG_CACHE_HOME",
      "XDG_DATA_HOME",
      "XDG_STATE_HOME",
      "SSL_CERT_FILE",
      "SSL_CERT_DIR",
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "NO_PROXY",
      "http_proxy",
      "https_proxy",
      "no_proxy",
    ]);
    expect(
      calls.every(({ envKeys }) =>
        envKeys.every((key) => allowedKeys.has(key)),
      ),
    ).toBe(true);
    expect(
      calls.every(
        ({ authToken, baseUrl, apiKeyPresent, apiKey }) =>
          authToken === "ollama" &&
          baseUrl === "http://localhost:11434" &&
          apiKeyPresent &&
          apiKey === "",
      ),
    ).toBe(true);
  });

  it.each([
    [{ version: "2.1.227" }, /version/i],
    [{ invalidHelp: true }, /contract/i],
  ] as const)("fails closed on a CLI mismatch: %o", async (control, reason) => {
    const fixture = await fixtureExecutable(control);
    await expect(adapter(fixture).attest()).rejects.toThrow(reason);
  });

  it("reports an unavailable or missing local model without starting a turn", async () => {
    const fixture = await fixtureExecutable();
    const unavailableFetch = vi.fn(async () => {
      throw new Error("connection refused with TOKEN_CANARY");
    }) as typeof globalThis.fetch;
    await expect(
      adapter(fixture, { fetch: unavailableFetch }).attest(),
    ).rejects.toThrow(/local Ollama prerequisite is unavailable/i);
    await expect(
      adapter(fixture, { fetch: modelFetch(false) }).attest(),
    ).rejects.toThrow(/required local Ollama model is unavailable/i);
    expect(await fixture.invocations()).toHaveLength(4);
  });

  it("bounds and sanitizes an unresponsive attestation", async () => {
    const fixture = await fixtureExecutable({ attestHang: true });
    const startedAt = Date.now();
    const error = await adapter(fixture, { attestTimeoutMs: 500 })
      .attest()
      .catch((reason: unknown) => reason as Error);
    const pid = await waitForPid(fixture);

    expect(Date.now() - startedAt).toBeLessThan(1_500);
    expect(error.message).toMatch(/Claude Code CLI attestation timed out/i);
    expect(error.message).not.toContain(fixture.executablePath);
    await waitForProcessExit(pid);
  });

  it("creates a World-owned session, resumes its exact ID, and emits only sanitized Claude events", async () => {
    const fixture = await fixtureExecutable();
    const claude = adapter(fixture);
    const created = await claude.createWorldSession("world-one", "Claude One");
    const attached = await claude.attach(created.rootId as string, {
      worldInstanceId: "world-one",
    });
    const events: unknown[] = [];
    const first = await claude.sendText(attached.id, "hello", {
      mode: "explore",
      rootSessionRef: created.rootId,
      onEvent: (event) => events.push(event),
    });
    const second = await claude.sendText(created.id, "again", {
      mode: "explore",
      rootSessionRef: created.rootId,
    });

    expect(created).toMatchObject({
      source: "claude-code",
      title: "Claude One",
    });
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
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
        toolName: "Edit",
        activityId: "tool-1",
        repositoryLocator: {
          operation: "edit",
          paths: ["/home/private/file"],
        },
        redaction: { applied: true, count: 1 },
      },
      {
        type: "tool.started",
        toolName: "claude_tool",
        redaction: { applied: true, count: 1 },
      },
      {
        type: "tool.completed",
        toolName: "Edit",
        activityId: "tool-1",
        repositoryLocator: {
          operation: "edit",
          paths: ["/home/private/file"],
        },
        redaction: { applied: true, count: 1 },
      },
      {
        type: "tool.failed",
        toolName: "claude_tool",
        redaction: { applied: true, count: 1 },
      },
    ]);
    expect(JSON.stringify(events)).not.toMatch(/RAW_|PRIVATE_|bad tool name/);
    await expect(
      claude.attach(created.id, { worldInstanceId: "wrong-world" }),
    ).rejects.toThrow(/World/i);

    const calls = await fixture.invocations();
    const common = [
      "-p",
      "--model",
      "qwythos:claude-q6-64k",
      "--output-format",
      "stream-json",
      "--input-format",
      "text",
      "--verbose",
      "--include-partial-messages",
      "--tools",
      "",
      "--disable-slash-commands",
      "--setting-sources",
      "",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--strict-mcp-config",
    ];
    expect(calls.map(({ args }) => args)).toEqual([
      [...common, "--session-id", created.id],
      [...common, "--resume", created.id],
      [...common, "--resume", created.id],
    ]);
    expect(JSON.stringify(calls)).not.toContain("Claude One");
    expect(calls.every(({ stdinBytes }) => stdinBytes > 0)).toBe(true);
  });

  it("accepts the status and thinking-token system events emitted by the real CLI", async () => {
    const fixture = await fixtureExecutable({ realSystemEvents: true });
    const claude = adapter(fixture);
    const created = await claude.createWorldSession("world-real-system-events");

    await expect(
      claude.sendText(created.id, "resume", {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).resolves.toMatchObject({ finalText: "fixture complete" });
  });

  it("isolates each World binding in its own private runtime home", async () => {
    vi.stubEnv("HOME", "/protected-parent/home");
    vi.stubEnv("XDG_CONFIG_HOME", "/protected-parent/config");
    vi.stubEnv("XDG_STATE_HOME", "/protected-parent/state");
    vi.stubEnv("XDG_DATA_HOME", "/protected-parent/data");
    vi.stubEnv("XDG_CACHE_HOME", "/protected-parent/cache");
    vi.stubEnv("CLAUDE_CONFIG_DIR", "/protected-parent/claude");
    const fixture = await fixtureExecutable();
    const claude = adapter(fixture);
    const first = await claude.createWorldSession("world-one");
    await claude.sendText(first.id, "resume", {
      mode: "explore",
      rootSessionRef: first.rootId,
    });

    const firstCalls = await fixture.invocations();
    const firstHome = firstCalls[0]?.home;
    expect(firstHome).toBeTruthy();
    expect(firstCalls[1]?.home).toBe(firstHome);
    expect(
      path.relative(fixture.nativeSessionRoot, firstHome as string),
    ).toMatch(/^[^.][^/]*$/);
    expect((await stat(firstHome as string)).mode & 0o777).toBe(0o700);
    for (const call of firstCalls) {
      expect(call).toMatchObject({
        home: firstHome,
        xdgConfigHome: path.join(firstHome as string, ".config"),
        xdgStateHome: path.join(firstHome as string, ".local", "state"),
        xdgDataHome: path.join(firstHome as string, ".local", "share"),
        xdgCacheHome: path.join(firstHome as string, ".cache"),
        claudeConfigDir: path.join(firstHome as string, ".claude"),
      });
      expect(JSON.stringify(call)).not.toContain("/protected-parent/");
    }

    const history = path.join(firstHome as string, "native-history.jsonl");
    await writeFile(history, "preserve me\n", { mode: 0o600 });
    await claude.endWorldSession("world-one", first.id);
    expect(await readFile(history, "utf8")).toBe("preserve me\n");

    const second = await claude.createWorldSession("world-two");
    const secondHome = (await fixture.invocations())[2]?.home;
    expect(second.id).not.toBe(first.id);
    expect(secondHome).toBeTruthy();
    expect(secondHome).not.toBe(firstHome);
    expect(
      path.relative(fixture.nativeSessionRoot, secondHome as string),
    ).toMatch(/^[^.][^/]*$/);
    expect((await stat(secondHome as string)).mode & 0o777).toBe(0o700);
  });

  it("rejects overlapping turns on the exact native session", async () => {
    const fixture = await fixtureExecutable({ failure: "delay" });
    const claude = adapter(fixture);
    const created = await claude.createWorldSession("world-overlap");
    const first = claude.sendText(created.id, "one", {
      mode: "explore",
      rootSessionRef: created.rootId,
    });
    await waitForInvocationCount(fixture, 2);
    await expect(
      claude.sendText(created.id, "two", {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).rejects.toThrow(/active/i);
    await first;
  });

  it.each([
    "malformed",
    "stdout-flood",
    "event-line-flood",
    "event-flood",
    "stderr-flood",
    "unexpected-exit",
    "result-error",
    "session-mismatch",
    "final-flood",
  ] as const)(
    "quarantines an ambiguously failed resume: %s",
    async (failure) => {
      const fixture = await fixtureExecutable({ failure });
      const claude = adapter(fixture);
      const created = await claude.createWorldSession(`world-${failure}`);

      await expect(
        claude.sendText(created.id, "ambiguous", {
          mode: "explore",
          rootSessionRef: created.rootId,
        }),
      ).rejects.toThrow(/Claude Code/);
      await expect(
        claude.attach(created.id, { worldInstanceId: `world-${failure}` }),
      ).rejects.toThrow(/quarantined|stale/i);
      expect(await fixture.invocations()).toHaveLength(2);
      await claude.endWorldSession(`world-${failure}`, created.id);
    },
  );

  it.each(["timeout", "abort"] as const)(
    "terminates the process group and quarantines on %s",
    async (kind) => {
      const fixture = await fixtureExecutable({ failure: "hang" });
      const claude = adapter(fixture, { turnTimeoutMs: 500 });
      const created = await claude.createWorldSession(`world-${kind}`);
      const controller = new AbortController();
      const turn = claude.sendText(created.id, "bounded", {
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
        claude.attach(created.id, { worldInstanceId: `world-${kind}` }),
      ).rejects.toThrow(/quarantined|stale/i);
    },
  );

  it("kills a resistant descendant after its process-group leader exits", async () => {
    const fixture = await fixtureExecutable({
      failure: "leader-exit-descendant",
    });
    const claude = adapter(fixture, { turnTimeoutMs: 500 });
    const created = await claude.createWorldSession("world-descendant");
    const turn = claude.sendText(created.id, "bounded", {
      mode: "explore",
      rootSessionRef: created.rootId,
    });
    await waitForInvocationCount(fixture, 2);
    await waitForPid(fixture);
    const descendantPid = await fixture.descendantPid();

    await expect(turn).rejects.toThrow(/timed out/i);
    await waitForProcessExit(descendantPid);
  });

  it("sanitizes stderr and never retries or silently creates after failure", async () => {
    const fixture = await fixtureExecutable({ failure: "stderr-canary" });
    const claude = adapter(fixture);
    const created = await claude.createWorldSession("world-stderr");
    const error = await claude
      .sendText(created.id, "RAW_PROMPT", {
        mode: "explore",
        rootSessionRef: created.rootId,
      })
      .catch((reason: unknown) => reason as Error);

    expect(error.message).toBe("Claude Code CLI turn failed");
    expect(error.message).not.toMatch(/TOKEN_CANARY|RAW_PROMPT|\/home\//);
    expect(await fixture.invocations()).toHaveLength(2);
  });

  it("bounds input before spawn without poisoning a healthy binding", async () => {
    const fixture = await fixtureExecutable();
    const claude = adapter(fixture);
    const created = await claude.createWorldSession("world-input");
    await expect(
      claude.sendText(created.id, "x".repeat(16_385), {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).rejects.toThrow(/input/i);
    expect(await fixture.invocations()).toHaveLength(1);
    await expect(
      claude.sendText(created.id, "valid", {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).resolves.toMatchObject({ finalText: "fixture complete" });
  });

  it("ends only the exact owner and gives a later World a distinct identity", async () => {
    const fixture = await fixtureExecutable();
    const unrelatedHistory = path.join(
      fixture.nativeSessionRoot,
      "unrelated-history.jsonl",
    );
    await writeFile(unrelatedHistory, "preserve me\n");
    const claude = adapter(fixture);
    const first = await claude.createWorldSession("world-one", "Same Name");

    await expect(
      claude.endWorldSession("wrong-world", first.id),
    ).rejects.toThrow(/World/i);
    await claude.endWorldSession("world-one", first.id);
    await claude.endWorldSession("world-one", first.id);
    await expect(
      claude.attach(first.id, { worldInstanceId: "world-one" }),
    ).rejects.toThrow(/ended|owned/i);

    const second = await claude.createWorldSession("world-two", "Same Name");
    expect(second.id).not.toBe(first.id);
    await expect(
      claude.attach(first.id, { worldInstanceId: "world-two" }),
    ).rejects.toThrow(/World|ended|owned/i);
    expect(await readFile(unrelatedHistory, "utf8")).toBe("preserve me\n");
    expect(
      (await fixture.invocations()).flatMap(({ args }) => args),
    ).not.toContain("--delete");
  });
});

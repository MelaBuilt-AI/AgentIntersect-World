import {
  chmod,
  mkdir,
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
  readonly fragmented?: boolean;
  readonly toolFlood?: boolean;
  readonly version?: string;
  readonly invalidHelp?: boolean;
  readonly attestHang?: boolean;
  readonly realSystemEvents?: boolean;
  readonly rateLimitEvent?: boolean;
  readonly commandsChanged?: boolean;
  readonly createHang?: boolean;
  readonly realToolResultEnvelope?: boolean;
  readonly invalidToolResultError?: boolean;
  readonly permissionDenied?: boolean;
  readonly resultPermissionDenied?: boolean;
  readonly writeWebsite?: boolean;
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

it("still bounds normalized tool activity independently of text fragments", async () => {
  const fixture = await fixtureExecutable({ toolFlood: true });
  const native = adapter(fixture);
  const session = await native.createWorldSession("tool-limit-proof");
  const types: string[] = [];
  await expect(
    native.sendText(session.id, "bounded tools", {
      mode: "explore",
      rootSessionRef: session.rootId,
      onEvent: (e) => {
        types.push(e.type);
      },
    }),
  ).rejects.toThrow();
  expect(
    types.filter((type) => type === "tool.started").length,
  ).toBeLessThanOrEqual(1024);
});

it("accepts bounded token fragmentation beyond the old raw event count", async () => {
  const fixture = await fixtureExecutable({ fragmented: true });
  const native = adapter(fixture);
  const session = await native.createWorldSession("fragment-proof");
  const result = await native.sendText(session.id, "finish normally", {
    mode: "explore",
    rootSessionRef: session.rootId,
  });
  expect(result.finalText).toBe("fixture complete");
  expect(result.deltas.join("")).toBe("x".repeat(1100) + "fixture ");
  await expect(
    native.sendText(session.id, "next turn", {
      mode: "explore",
      rootSessionRef: session.rootId,
    }),
  ).resolves.toMatchObject({ finalText: "fixture complete" });
});
it("cancels initial native connection without a saved World binding", async () => {
  const fixture = await fixtureExecutable({ createHang: true });
  const native = adapter(fixture, { turnTimeoutMs: 5000 });
  const controller = new AbortController();
  const promise = native.createWorldSession(
    "cancel-connect",
    "Claude",
    controller.signal,
  );
  const timer = setTimeout(() => controller.abort(), 100);
  try {
    await expect(promise).rejects.toThrow(/cancel/i);
  } finally {
    clearTimeout(timer);
  }
  expect(await native.listSessions()).toEqual([]);
});

it("accepts selected-session commands_changed before native initialization", async () => {
  const fixture = await fixtureExecutable({ commandsChanged: true });
  const native = adapter(fixture);
  const created = await native.createWorldSession(
    "commands-change-probe",
    "Claude",
  );
  expect(created.id).toBeTruthy();
  await native.endWorldSession("commands-change-probe", created.id);
});

it("accepts native rate-limit telemetry without killing a successful connection", async () => {
  const fixture = await fixtureExecutable({ rateLimitEvent: true });
  const native = adapter(fixture);
  const created = await native.createWorldSession("rate-limit-probe", "Claude");
  expect(created.id).toBeTruthy();
  await native.endWorldSession("rate-limit-probe", created.id);
});

it.each([false, true])(
  "runs authorized work in its owned directory (native profile: %s)",
  async (nativeProfile) => {
    const fixture = await fixtureExecutable({ writeWebsite: true });
    const workspace = path.join(fixture.nativeSessionRoot, "owned project");
    await mkdir(workspace);
    const native = adapter(
      fixture,
      nativeProfile ? { nativeProfilePath: fixture.nativeSessionRoot } : {},
    );
    const session = await native.createWorldSession("owned-workspace");
    await native.sendText(session.id, "create the page", {
      mode: "collaborate",
      rootSessionRef: session.id,
      workingDirectory: workspace,
      evidenceDirectory: path.join(fixture.nativeSessionRoot, "report only"),
      systemMessage: "Only change this owned Workstream; do not publish.",
    });
    const call = (await fixture.invocations()).at(-1)!;
    expect(call.cwd).toBe(workspace);
    expect(call.args[call.args.indexOf("--add-dir") + 1]).toBe(
      path.join(fixture.nativeSessionRoot, "report only"),
    );
    expect(call.args[call.args.indexOf("--allowedTools") + 1]).toBe(
      "Read,Glob,Grep,Edit,Write,Bash",
    );
    expect(
      call.args[call.args.indexOf("--append-system-prompt") + 1],
    ).toContain("Only change this owned Workstream; do not publish.");
    expect(call.args).not.toContain("--dangerously-skip-permissions");
    expect(await readFile(path.join(workspace, "index.html"), "utf8")).toBe(
      "<p>Claude Codes</p>",
    );
    await expect(
      stat(path.join(fixture.nativeSessionRoot, "index.html")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await native.sendText(session.id, "ordinary chat", {
      mode: "collaborate",
      rootSessionRef: session.id,
    });
    const chat = (await fixture.invocations()).at(-1)!;
    expect(chat.cwd).toBe(fixture.nativeSessionRoot);
    expect(chat.args[chat.args.indexOf("--allowedTools") + 1]).not.toContain(
      "Write",
    );
  },
);

it("preserves denied-tool policy and continues the same session after permission telemetry", async () => {
  const fixture = await fixtureExecutable({
    permissionDenied: true,
    realToolResultEnvelope: true,
  });
  const native = adapter(fixture);
  const created = await native.createWorldSession("denial-recovery", "Claude");
  const events: unknown[] = [];
  const result = await native.sendText(created.id, "try the tool", {
    mode: "explore",
    rootSessionRef: created.id,
    onEvent: (event) => {
      events.push(event);
    },
  });
  expect(result.sessionRef).toBe(created.id);
  expect(
    events.filter(
      (event) => (event as { type: string }).type === "tool.failed",
    ),
  ).toHaveLength(1);
  expect(JSON.stringify(events)).not.toContain("PRIVATE_DENIAL_CANARY");
  const reopened = adapter(fixture);
  await expect(
    reopened.attach(created.id, { worldInstanceId: "denial-recovery" }),
  ).resolves.toMatchObject({ id: created.id });
  await expect(
    reopened.sendText(created.id, "next turn", {
      mode: "explore",
      rootSessionRef: created.id,
    }),
  ).resolves.toMatchObject({ sessionRef: created.id });
});

it.each(["event", "result"])(
  "reports structured permission denials without quarantining the session (%s)",
  async (source) => {
    const fixture = await fixtureExecutable(
      source === "event"
        ? { permissionDenied: true }
        : { resultPermissionDenied: true },
    );
    const native = adapter(fixture);
    const session = await native.createWorldSession("blocked-work");
    const result = await native.sendText(session.id, "create the page", {
      mode: "collaborate",
      rootSessionRef: session.id,
      workingDirectory: fixture.nativeSessionRoot,
    });
    expect(result).toMatchObject({
      blockedReason:
        "Claude Code denied a required tool permission. No permission was bypassed.",
    });
    expect(result.finalText).toBe("fixture complete");
    await expect(
      native.attach(session.id, { worldInstanceId: "blocked-work" }),
    ).resolves.toMatchObject({ id: session.id });
  },
);

it("recovers a quarantined exact session only after explicit tool-free resume validation", async () => {
  const fixture = await fixtureExecutable({ failure: "unexpected-exit" });
  const native = adapter(fixture);
  const created = await native.createWorldSession("recover-exact", "Claude");
  await expect(native.sendText(created.id, "failed request")).rejects.toThrow();
  await writeFile(
    path.join(fixture.nativeSessionRoot, "fixture-control.json"),
    "{}",
  );
  const reopened = adapter(fixture);
  await expect(
    reopened.attach(created.id, { worldInstanceId: "recover-exact" }),
  ).rejects.toThrow(/quarantined/);
  await expect(
    reopened.attach(created.id, {
      worldInstanceId: "other-world",
      recover: true,
    }),
  ).rejects.toThrow(/not owned/);
  await expect(
    reopened.attach(created.id, {
      worldInstanceId: "recover-exact",
      recover: true,
    }),
  ).resolves.toMatchObject({ id: created.id, rootId: created.id });
  const calls = await fixture.invocations();
  const recoveryArgs = calls.at(-1)!.args;
  expect(recoveryArgs[recoveryArgs.indexOf("--tools") + 1]).toBe("");
  expect(recoveryArgs[recoveryArgs.indexOf("--resume") + 1]).toBe(created.id);
  await expect(
    reopened.sendText(created.id, "new request"),
  ).resolves.toMatchObject({ sessionRef: created.id });
});

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
const fixtureRoot = path.dirname(process.argv[1]);
const args = process.argv.slice(2);
const control = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "fixture-control.json"), "utf8"));
let stdin = "";
for await (const chunk of process.stdin) stdin += chunk;
fs.appendFileSync(
  path.join(fixtureRoot, "fixture-invocations.jsonl"),
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
    : "Usage: claude [options] [command] [prompt]\\n-p, --print\\n-r, --resume [value]\\n--session-id <uuid>\\n--model <model>\\n--output-format <format>\\n--input-format <format>\\n--verbose\\n--include-partial-messages\\n--add-dir <directories...>\\n--tools <tools...>\\n--disable-slash-commands\\n--setting-sources <sources>\\n--mcp-config <configs...>\\n--strict-mcp-config\\n");
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
if(control.createHang) await new Promise(() => setInterval(() => {},1000));
const emit = (event) => process.stdout.write(JSON.stringify(event) + "\\n");

if(control.commandsChanged) emit({type:"system",subtype:"commands_changed",commands:[],session_id:sessionId});
emit({ type: "system", subtype: "init", session_id: sessionId, cwd, tools: [] });
if (control.rateLimitEvent) emit({type: "rate_limit_event", rate_limit_info: {status: "allowed"}});
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

if (isResume && control.writeWebsite && option("--allowedTools")?.includes("Write")) {
  fs.writeFileSync(path.join(cwd, "index.html"), "<p>Claude Codes</p>");
}
if (isResume) {
  if (control.toolFlood) for (let i = 0; i < 1025; i++) emit({ type: "assistant", session_id: sessionId, message: { type: "message", role: "assistant", content: [{ type: "tool_use", id: "tool-" + i, name: "Read", input: {} }] } });
  if (control.fragmented) for (let i = 0; i < 1100; i++) emit({ type: "stream_event", session_id: sessionId, event: { type: "content_block_delta", delta: { type: "text_delta", text: "x" } } });
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
        { type: "tool_use", id: "tool-3", name: "Read", input: { file_path: path.join(cwd, "claude-code/Task15Claude.md") } },
      ],
    },
  });
  if (control.permissionDenied) emit({ type: "system", subtype: "permission_denied", session_id: sessionId, tool_name: "bad tool name!", tool_use_id: "tool-2", decision_reason_type: "mode", message: "PRIVATE_DENIAL_CANARY" });
  emit({
    type: "user",
    session_id: sessionId,
    message: {
      ...(control.realToolResultEnvelope ? {} : { type: "message" }),
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool-1",
          content: "RAW_RESULT_CANARY",
          ...(control.invalidToolResultError
            ? { is_error: "false" }
            : control.realToolResultEnvelope
              ? {}
              : { is_error: false }),
        },
        { type: "tool_result", tool_use_id: "tool-2", content: [{ type: "text", text: "/home/private/result" }], is_error: true },
        { type: "tool_result", tool_use_id: "tool-3", content: "fixture read", is_error: false },
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
emit({ type: "result", subtype: "success", is_error: false, result, session_id: sessionId, ...(isResume && control.resultPermissionDenied ? { permission_denials: [{tool_name: "Write", tool_input: {file_path: "PRIVATE_DENIAL_CANARY"}}] } : {}) });
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

  it("preserves native Claude settings and provider without requiring the developer's Ollama model", async () => {
    const fixture = await fixtureExecutable();
    const nativeProfilePath = path.join(fixture.nativeSessionRoot, ".claude");
    await mkdir(nativeProfilePath);
    await writeFile(
      path.join(nativeProfilePath, "settings.json"),
      '{"model":"native-selected-model"}\n',
    );
    const fetch = vi.fn(() =>
      Promise.reject(new Error("must not contact Ollama")),
    );
    const claude = adapter(fixture, {
      nativeProfilePath,
      nativeHomePath: fixture.nativeSessionRoot,
      agentName: "reviewer",
      fetch,
    });
    await claude.attest();
    const created = await claude.createWorldSession(
      "native-profile-world",
      "My Claude",
    );
    const call = (await fixture.invocations()).at(-1);
    expect(call?.claudeConfigDir).toBe(nativeProfilePath);
    expect(call?.home).toBe(fixture.nativeSessionRoot);
    expect(call?.args).toContain("--agent");
    expect(call?.args).toContain("reviewer");
    expect(call?.args).not.toContain("--model");
    expect(call?.args).not.toContain("--setting-sources");
    expect(call?.args).not.toContain("--disable-slash-commands");
    expect(call?.args).not.toContain("--strict-mcp-config");
    expect(call?.baseUrl).not.toBe("http://localhost:11434");
    expect(fetch).not.toHaveBeenCalled();
    await claude.endWorldSession("native-profile-world", created.id);
    expect(
      await readFile(path.join(nativeProfilePath, "settings.json"), "utf8"),
    ).toBe('{"model":"native-selected-model"}\n');
  });

  it("restores the exact native Claude session after adapter recreation", async () => {
    const fixture = await fixtureExecutable();
    const created = await adapter(fixture).createWorldSession(
      "restart-world",
      "Restart Claude",
    );
    const restarted = adapter(fixture);
    expect(
      (await restarted.attach(created.id, { worldInstanceId: "restart-world" }))
        .id,
    ).toBe(created.id);
    expect(await restarted.listSessions()).toEqual([created]);
    expect(
      (await fixture.invocations()).filter((call) =>
        call.args.includes("--session-id"),
      ),
    ).toHaveLength(1);
    await restarted.sendText(created.id, "continue this conversation", {
      rootSessionRef: created.id,
      mode: "explore",
    });
    expect((await fixture.invocations()).at(-1)?.args).toEqual(
      expect.arrayContaining(["--resume", created.id]),
    );
    await restarted.endWorldSession("restart-world", created.id);
    await expect(
      adapter(fixture).attach(created.id, { worldInstanceId: "restart-world" }),
    ).rejects.toThrow(/owned/i);
  });

  it.each(["2.1.227", "99.0.0-next.1"])(
    "accepts compatible Claude version %s without a release allowlist",
    async (version) => {
      const fixture = await fixtureExecutable({ version });
      await expect(adapter(fixture).attest()).resolves.toMatchObject({
        adapterVersion: `0.19.0-claude-code-${version}`,
      });
    },
  );

  it.each([
    [{ version: "bad version metadata" }, /identity/i],
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
        type: "tool.started",
        toolName: "Read",
        activityId: "tool-3",
        repositoryLocator: {
          operation: "read",
          paths: ["claude-code/Task15Claude.md"],
        },
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
      {
        type: "tool.completed",
        toolName: "Read",
        activityId: "tool-3",
        repositoryLocator: {
          operation: "read",
          paths: ["claude-code/Task15Claude.md"],
        },
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
      "Read,Glob,Grep",
      "--allowedTools",
      "Read,Glob,Grep",
      "--permission-mode",
      "dontAsk",
      "--append-system-prompt",
      "Complete the user's full request before ending the turn. When read-only inspection is requested, use only Read, Glob, or Grep and continue through the final answer. Do not stop after narrating an intended next step.",
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

  it("accepts the real successful tool-result envelope with omitted optional markers", async () => {
    const fixture = await fixtureExecutable({ realToolResultEnvelope: true });
    const claude = adapter(fixture);
    const created = await claude.createWorldSession("world-real-tool-result");
    const events: unknown[] = [];

    await expect(
      claude.sendText(created.id, "resume", {
        mode: "explore",
        rootSessionRef: created.rootId,
        onEvent: (event) => {
          events.push(event);
        },
      }),
    ).resolves.toMatchObject({ finalText: "fixture complete" });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "tool.completed",
        toolName: "Edit",
        activityId: "tool-1",
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "tool.failed",
        toolName: "claude_tool",
      }),
    );
  });

  it("rejects a present non-boolean tool-result error marker", async () => {
    const fixture = await fixtureExecutable({ invalidToolResultError: true });
    const claude = adapter(fixture);
    const created = await claude.createWorldSession(
      "world-invalid-tool-result",
    );

    await expect(
      claude.sendText(created.id, "resume", {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).rejects.toThrow(/Claude Code/);
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

    expect(error.message).toBe(
      "Claude Code CLI turn failed (process exited with code 9)",
    );
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

it.each([
  ["malformed", "malformed stream JSON"],
  ["unexpected-exit", "process exited with code 7"],
] as const)(
  "keeps a bounded diagnostic category for %s failures",
  async (failure, reason) => {
    const fixture = await fixtureExecutable({ failure });
    const native = adapter(fixture);
    const session = await native.createWorldSession("diagnostic-category");
    await expect(native.sendText(session.id, "probe")).rejects.toThrow(reason);
  },
);

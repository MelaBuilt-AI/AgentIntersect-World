import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

import { AgentCapabilityManifestSchema } from "@agentintersect-world/agent-session-protocol";

import {
  GatewayError,
  type AdapterSessionSummary,
  type AdapterTurnContext,
  type AdapterTurnEvent,
  type AdapterTurnResult,
  type AgentAdapter,
  type WorldOwnedSessionContext,
} from "./agent-sessions.js";
import { extractAdapterRepositoryLocator } from "./repository-work-focus.js";

export const CLAUDE_CODE_VERSION = "2.1.228";

const CLAUDE_MODEL = "qwythos:claude-q6-64k";
const OLLAMA_BASE_URL = "http://localhost:11434";
const MAX_INPUT_BYTES = 16_384;
const MAX_EVENT_BYTES = 32_768;
const MAX_EVENTS = 1_024;
const MAX_STDOUT_BYTES = 262_144;
const MAX_STDERR_BYTES = 16_384;
const MAX_OUTPUT_BYTES = 65_536;
const MAX_ATTESTATION_BYTES = 65_536;
const CREATE_PROMPT =
  "Establish this World-owned session. Reply only with the word ready.";
const WORLD_COMPLETION_PROMPT =
  "Complete the user's full request before ending the turn. When read-only inspection is requested, use only Read, Glob, or Grep and continue through the final answer. Do not stop after narrating an intended next step.";

function repositoryRelativeLocator(
  locator: AdapterTurnEvent["repositoryLocator"],
  repositoryRoot: string,
): AdapterTurnEvent["repositoryLocator"] {
  if (!locator || locator.operation !== "read") return locator;
  const paths = locator.paths.map((value) => {
    if (!path.isAbsolute(value)) return value;
    const relative = path.relative(repositoryRoot, value);
    if (
      relative.length === 0 ||
      relative.startsWith(`..${path.sep}`) ||
      relative === ".." ||
      path.isAbsolute(relative)
    )
      return value;
    return relative.split(path.sep).join("/");
  });
  return { ...locator, paths };
}
const ENVIRONMENT_ALLOWLIST = [
  "PATH",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "TERM",
  "COLORTERM",
  "TMPDIR",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
] as const;
const STREAM_EVENT_TYPES = new Set([
  "message_start",
  "content_block_start",
  "content_block_delta",
  "content_block_stop",
  "message_delta",
  "message_stop",
  "ping",
]);
const STREAM_DELTA_TYPES = new Set([
  "text_delta",
  "thinking_delta",
  "signature_delta",
  "input_json_delta",
]);

type ClaudeCodeOptions = {
  readonly executablePath: string;
  readonly nativeSessionRoot: string;
  readonly attestTimeoutMs?: number;
  readonly turnTimeoutMs?: number;
  readonly terminateGraceMs?: number;
  readonly fetch?: typeof globalThis.fetch;
};

type OwnedBinding = {
  readonly worldInstanceId: string;
  readonly nativeSessionId: string;
  readonly runtimeHome: string;
  readonly title: string;
  ended: boolean;
  quarantined: boolean;
};

type ProcessResult = {
  readonly stdout: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function claudeFailure(
  message = "Claude Code CLI turn failed",
  code: "validation" | "conflict" | "offline" | "upstream" = "upstream",
): GatewayError {
  return new GatewayError(code, message);
}

function boundedWorldRef(value: string): string {
  if (
    !value ||
    value.length > 256 ||
    Buffer.byteLength(value, "utf8") > 256 ||
    hasControlCharacters(value)
  )
    throw claudeFailure("World instance identity is invalid", "validation");
  return value;
}

function nativeSessionId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw claudeFailure("Claude Code returned an invalid session identity");
  return value;
}

function processEnvironment(runtimeHome: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ANTHROPIC_AUTH_TOKEN: "ollama",
    ANTHROPIC_BASE_URL: OLLAMA_BASE_URL,
    ANTHROPIC_API_KEY: "",
    HOME: runtimeHome,
    XDG_CONFIG_HOME: path.join(runtimeHome, ".config"),
    XDG_STATE_HOME: path.join(runtimeHome, ".local", "state"),
    XDG_DATA_HOME: path.join(runtimeHome, ".local", "share"),
    XDG_CACHE_HOME: path.join(runtimeHome, ".cache"),
    CLAUDE_CONFIG_DIR: path.join(runtimeHome, ".claude"),
  };
  for (const key of ENVIRONMENT_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  return environment;
}

function terminateProcessGroup(
  child: ChildProcessWithoutNullStreams,
  graceMs: number,
): Promise<void> {
  const pid = child.pid;
  if (!pid) return Promise.resolve();
  const signal = (name: NodeJS.Signals) => {
    try {
      process.kill(-pid, name);
    } catch {
      try {
        child.kill(name);
      } catch {
        // The process has already exited.
      }
    }
  };
  signal("SIGTERM");
  return new Promise((resolve) => {
    setTimeout(() => {
      signal("SIGKILL");
      resolve();
    }, graceMs);
  });
}

function safeToolName(value: unknown): string {
  return typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value)
    ? value
    : "claude_tool";
}

function toolUseId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 256 ||
    hasControlCharacters(value)
  )
    throw claudeFailure();
  return value;
}

export class ClaudeCodeSessionAdapter implements AgentAdapter {
  readonly id = "claude-code";
  readonly #options: ClaudeCodeOptions;
  readonly #fetch: typeof globalThis.fetch;
  readonly #bindings = new Map<string, OwnedBinding>();
  readonly #busy = new Set<string>();

  constructor(options: ClaudeCodeOptions) {
    if (
      !path.isAbsolute(options.executablePath) ||
      !path.isAbsolute(options.nativeSessionRoot) ||
      options.executablePath.length > 4_096 ||
      options.nativeSessionRoot.length > 4_096 ||
      hasControlCharacters(options.executablePath) ||
      hasControlCharacters(options.nativeSessionRoot)
    )
      throw claudeFailure(
        "Claude Code executable and session root must be bounded absolute paths",
        "validation",
      );
    this.#options = options;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  #args(sessionId: string, resume: boolean): string[] {
    return [
      "-p",
      "--model",
      CLAUDE_MODEL,
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
      WORLD_COMPLETION_PROMPT,
      "--disable-slash-commands",
      "--setting-sources",
      "",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--strict-mcp-config",
      resume ? "--resume" : "--session-id",
      sessionId,
    ];
  }

  async #createRuntimeHome(id: string): Promise<string> {
    const runtimeHome = path.join(
      this.#options.nativeSessionRoot,
      `claude-runtime-${id}`,
    );
    try {
      await mkdir(runtimeHome, { mode: 0o700 });
    } catch {
      throw claudeFailure(
        "Claude Code private runtime could not be initialized",
        "offline",
      );
    }
    return runtimeHome;
  }

  async #runProcess(
    args: readonly string[],
    input: string,
    options: {
      readonly runtimeHome: string;
      readonly timeoutMs: number;
      readonly timeoutMessage: string;
      readonly failureMessage: string;
      readonly signal?: AbortSignal;
      readonly onEvent?: (event: unknown) => void;
      readonly validate?: () => void;
    },
  ): Promise<ProcessResult> {
    return new Promise<ProcessResult>((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(this.#options.executablePath, args, {
          cwd: this.#options.nativeSessionRoot,
          env: processEnvironment(options.runtimeHome),
          detached: true,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        reject(claudeFailure(options.failureMessage, "offline"));
        return;
      }

      const decoder = new StringDecoder("utf8");
      let stdout = "";
      let lineBuffer = "";
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let eventCount = 0;
      let failure: GatewayError | undefined;
      let closed = false;
      let termination: Promise<void> | undefined;

      const fail = (error: GatewayError) => {
        if (failure || closed) return;
        failure = error;
        termination = terminateProcessGroup(
          child,
          this.#options.terminateGraceMs ?? 250,
        );
      };
      const parseLine = (line: string) => {
        if (!line) return;
        if (Buffer.byteLength(line, "utf8") > MAX_EVENT_BYTES) {
          fail(claudeFailure(options.failureMessage));
          return;
        }
        eventCount += 1;
        if (eventCount > MAX_EVENTS) {
          fail(claudeFailure(options.failureMessage));
          return;
        }
        try {
          const event: unknown = JSON.parse(line);
          if (!isRecord(event) || typeof event.type !== "string")
            throw new Error("invalid event");
          options.onEvent?.(event);
        } catch {
          fail(claudeFailure(options.failureMessage));
        }
      };

      const timeout = setTimeout(
        () => fail(claudeFailure(options.timeoutMessage)),
        options.timeoutMs,
      );
      timeout.unref();
      const onAbort = () =>
        fail(claudeFailure("Claude Code CLI turn was cancelled"));
      options.signal?.addEventListener("abort", onAbort, { once: true });

      child.stdout.on("data", (chunk: Buffer) => {
        if (failure) return;
        stdoutBytes += chunk.length;
        if (stdoutBytes > MAX_STDOUT_BYTES) {
          fail(claudeFailure(options.failureMessage));
          return;
        }
        const text = decoder.write(chunk);
        if (!options.onEvent) {
          stdout += text;
          return;
        }
        lineBuffer += text;
        let newline = lineBuffer.indexOf("\n");
        while (newline >= 0 && !failure) {
          const line = lineBuffer.slice(0, newline).replace(/\r$/, "");
          lineBuffer = lineBuffer.slice(newline + 1);
          parseLine(line);
          newline = lineBuffer.indexOf("\n");
        }
        if (Buffer.byteLength(lineBuffer, "utf8") > MAX_EVENT_BYTES)
          fail(claudeFailure(options.failureMessage));
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes > MAX_STDERR_BYTES)
          fail(claudeFailure(options.failureMessage));
      });
      child.once("error", () =>
        fail(claudeFailure(options.failureMessage, "offline")),
      );
      child.once("close", (code) => {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", onAbort);
        const tail = decoder.end();
        if (options.onEvent) {
          lineBuffer += tail;
          if (lineBuffer && !failure) parseLine(lineBuffer.replace(/\r$/, ""));
        } else {
          stdout += tail;
        }
        if (!failure) {
          try {
            if (code !== 0) throw new Error("unexpected exit");
            options.validate?.();
          } catch {
            fail(claudeFailure(options.failureMessage));
          }
        }
        closed = true;
        void (async () => {
          if (failure) {
            await termination;
            reject(failure);
          } else resolve({ stdout });
        })();
      });

      if (options.signal?.aborted) onAbort();
      child.stdin.on("error", () =>
        fail(claudeFailure(options.failureMessage)),
      );
      child.stdin.end(input);
    });
  }

  async #plain(
    args: readonly string[],
    timeoutMessage: string,
    runtimeHome: string,
  ): Promise<string> {
    const result = await this.#runProcess(args, "", {
      runtimeHome,
      timeoutMs: this.#options.attestTimeoutMs ?? 5_000,
      timeoutMessage,
      failureMessage: "Claude Code CLI attestation failed",
    });
    return result.stdout.trim();
  }

  async #attestLocalModel(): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.#options.attestTimeoutMs ?? 5_000,
    );
    timeout.unref();
    try {
      const response = await this.#fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: controller.signal,
      });
      const contentLength = Number(response.headers.get("content-length"));
      if (
        !response.ok ||
        (Number.isFinite(contentLength) &&
          contentLength > MAX_ATTESTATION_BYTES)
      )
        throw new Error("unavailable");
      const raw = await response.text();
      if (Buffer.byteLength(raw, "utf8") > MAX_ATTESTATION_BYTES)
        throw new Error("unavailable");
      const payload: unknown = JSON.parse(raw);
      if (!isRecord(payload) || !Array.isArray(payload.models))
        throw new Error("unavailable");
      const available = payload.models.some(
        (model) =>
          isRecord(model) &&
          (model.name === CLAUDE_MODEL || model.model === CLAUDE_MODEL),
      );
      if (!available)
        throw claudeFailure(
          "Claude Code required local Ollama model is unavailable",
          "offline",
        );
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      throw claudeFailure(
        "Claude Code local Ollama prerequisite is unavailable",
        "offline",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async attest() {
    const runtimeHome = await this.#createRuntimeHome(randomUUID());
    const version = await this.#plain(
      ["--version"],
      "Claude Code CLI attestation timed out",
      runtimeHome,
    );
    if (version !== `${CLAUDE_CODE_VERSION} (Claude Code)`)
      throw claudeFailure("Claude Code CLI version mismatch", "offline");
    const help = await this.#plain(
      ["--help"],
      "Claude Code CLI attestation timed out",
      runtimeHome,
    );
    const requiredHelp = [
      "Usage: claude",
      "--print",
      "--resume [value]",
      "--session-id <uuid>",
      "--model <model>",
      "--output-format",
      "--input-format",
      "--verbose",
      "--include-partial-messages",
      "--tools <tools...>",
      "--disable-slash-commands",
      "--setting-sources <sources>",
      "--mcp-config <configs...>",
      "--strict-mcp-config",
    ];
    if (!requiredHelp.every((item) => help.includes(item)))
      throw claudeFailure("Claude Code CLI contract mismatch", "offline");
    await this.#attestLocalModel();

    return AgentCapabilityManifestSchema.parse({
      schema: "aiw.agent-capabilities/0.12",
      adapterId: "claude-code",
      adapterVersion: `0.19.0-claude-code-${CLAUDE_CODE_VERSION}`,
      transport: "loopback-http-sse",
      origin: "local",
      auth: "server-bearer",
      supportedModes: ["explore", "collaborate"],
      ordering: "per-session-strict",
      resume: "session-api",
      shutdownOwner: "world",
      maxInputBytes: MAX_INPUT_BYTES,
      maxEventBytes: MAX_EVENT_BYTES,
      capabilities: {
        attach: true,
        sendText: true,
        streamDeltas: true,
        toolStatus: true,
        approvals: false,
        interrupt: false,
        avatarProposal: false,
        skillsDisclosure: false,
        worldActions: false,
      },
      unavailable: {
        approvals: "Claude Code tools and approvals are disabled in World.",
        interrupt:
          "Cancellation is bound to the active turn; no completed run remains interruptible.",
        avatarProposal: "Claude Code does not provide World avatar proposals.",
        skillsDisclosure:
          "Claude Code skill disclosure is not exposed to World.",
      },
    });
  }

  async listSessions(): Promise<readonly AdapterSessionSummary[]> {
    return [...this.#bindings.values()]
      .filter((binding) => !binding.ended)
      .map((binding) => ({
        id: binding.nativeSessionId,
        rootId: binding.nativeSessionId,
        source: "claude-code",
        title: binding.title,
      }));
  }

  async #runTurn(
    input: string,
    expectedSessionId: string,
    resume: boolean,
    runtimeHome: string,
    context?: AdapterTurnContext,
  ): Promise<AdapterTurnResult> {
    let seenSessionId: string | undefined;
    let initialized = false;
    let completed = false;
    let finalText: string | undefined;
    let outputBytes = 0;
    const deltas: string[] = [];
    const toolNames = new Map<
      string,
      {
        readonly name: string;
        readonly locator?: AdapterTurnEvent["repositoryLocator"];
      }
    >();
    let eventDispatch = Promise.resolve();
    const emit = (event: AdapterTurnEvent) => {
      eventDispatch = eventDispatch.then(async () => context?.onEvent?.(event));
    };
    const acceptSession = (value: unknown) => {
      const id = nativeSessionId(value);
      if (id !== expectedSessionId || (seenSessionId && seenSessionId !== id))
        throw claudeFailure("Claude Code resumed an unexpected session");
      seenSessionId = id;
    };

    await this.#runProcess(this.#args(expectedSessionId, resume), input, {
      runtimeHome,
      timeoutMs: this.#options.turnTimeoutMs ?? 120_000,
      timeoutMessage: "Claude Code CLI turn timed out",
      failureMessage: "Claude Code CLI turn failed",
      ...(context?.signal ? { signal: context.signal } : {}),
      validate: () => {
        if (
          !seenSessionId ||
          !initialized ||
          !completed ||
          finalText === undefined
        )
          throw claudeFailure();
      },
      onEvent: (raw) => {
        const envelope = raw as Record<string, unknown>;
        if (
          envelope.type !== "system" &&
          envelope.type !== "stream_event" &&
          envelope.type !== "assistant" &&
          envelope.type !== "user" &&
          envelope.type !== "result"
        )
          throw claudeFailure();
        acceptSession(envelope.session_id);

        if (envelope.type === "system") {
          if (envelope.subtype === "init") {
            if (initialized) throw claudeFailure();
            initialized = true;
            return;
          }
          if (
            !initialized ||
            completed ||
            (envelope.subtype !== "status" &&
              envelope.subtype !== "thinking_tokens")
          )
            throw claudeFailure();
          return;
        }
        if (!initialized || completed) throw claudeFailure();

        if (envelope.type === "stream_event") {
          if (!isRecord(envelope.event)) throw claudeFailure();
          const event = envelope.event;
          if (
            typeof event.type !== "string" ||
            !STREAM_EVENT_TYPES.has(event.type)
          )
            throw claudeFailure();
          if (event.type !== "content_block_delta") return;
          if (
            !isRecord(event.delta) ||
            !STREAM_DELTA_TYPES.has(String(event.delta.type))
          )
            throw claudeFailure();
          if (event.delta.type !== "text_delta") return;
          if (typeof event.delta.text !== "string") throw claudeFailure();
          const bytes = Buffer.byteLength(event.delta.text, "utf8");
          outputBytes += bytes;
          if (bytes > MAX_EVENT_BYTES || outputBytes > MAX_OUTPUT_BYTES)
            throw claudeFailure("Claude Code output exceeded the bound");
          deltas.push(event.delta.text);
          emit({
            type: "assistant.delta",
            text: event.delta.text,
            redaction: { applied: false, count: 0 },
          });
          return;
        }

        if (envelope.type === "assistant") {
          if (
            !isRecord(envelope.message) ||
            envelope.message.type !== "message" ||
            envelope.message.role !== "assistant" ||
            !Array.isArray(envelope.message.content)
          )
            throw claudeFailure();
          for (const value of envelope.message.content) {
            if (!isRecord(value) || typeof value.type !== "string")
              throw claudeFailure();
            if (
              value.type === "text" ||
              value.type === "thinking" ||
              value.type === "redacted_thinking"
            )
              continue;
            if (value.type !== "tool_use") throw claudeFailure();
            const id = toolUseId(value.id);
            if (toolNames.has(id)) throw claudeFailure();
            const name = safeToolName(value.name);
            const locator = repositoryRelativeLocator(
              extractAdapterRepositoryLocator("claude-code", name, value.input),
              this.#options.nativeSessionRoot,
            );
            toolNames.set(id, { name, ...(locator ? { locator } : {}) });
            emit({
              type: "tool.started",
              toolName: name,
              ...(locator
                ? { activityId: id, repositoryLocator: locator }
                : {}),
              redaction: { applied: true, count: 1 },
            });
          }
          return;
        }

        if (envelope.type === "user") {
          if (
            !isRecord(envelope.message) ||
            (envelope.message.type !== undefined &&
              envelope.message.type !== "message") ||
            envelope.message.role !== "user" ||
            !Array.isArray(envelope.message.content)
          )
            throw claudeFailure();
          for (const value of envelope.message.content) {
            if (!isRecord(value) || value.type !== "tool_result")
              throw claudeFailure();
            if (
              Object.hasOwn(value, "is_error") &&
              typeof value.is_error !== "boolean"
            )
              throw claudeFailure();
            const activityId = toolUseId(value.tool_use_id);
            const tool = toolNames.get(activityId);
            if (!tool) throw claudeFailure();
            emit({
              type: value.is_error === true ? "tool.failed" : "tool.completed",
              toolName: tool.name,
              ...(tool.locator
                ? { activityId, repositoryLocator: tool.locator }
                : {}),
              redaction: { applied: true, count: 1 },
            });
            toolNames.delete(activityId);
          }
          return;
        }

        if (
          envelope.subtype !== "success" ||
          envelope.is_error !== false ||
          typeof envelope.result !== "string"
        )
          throw claudeFailure();
        if (Buffer.byteLength(envelope.result, "utf8") > MAX_OUTPUT_BYTES)
          throw claudeFailure("Claude Code output exceeded the bound");
        finalText = envelope.result;
        completed = true;
      },
    });
    await eventDispatch.catch(() => {
      throw claudeFailure();
    });
    return {
      finalText: finalText as string,
      deltas,
      sessionRef: seenSessionId as string,
    };
  }

  async createWorldSession(
    worldInstanceId: string,
    displayName = "Claude Code",
  ): Promise<AdapterSessionSummary> {
    boundedWorldRef(worldInstanceId);
    const title =
      displayName.normalize("NFC").trim().slice(0, 80) || "Claude Code";
    const id = randomUUID();
    const runtimeHome = await this.#createRuntimeHome(id);
    const created = await this.#runTurn(CREATE_PROMPT, id, false, runtimeHome);
    if (created.sessionRef !== id || this.#bindings.has(id))
      throw claudeFailure("Claude Code returned an ambiguous session identity");
    this.#bindings.set(id, {
      worldInstanceId,
      nativeSessionId: id,
      runtimeHome,
      title,
      ended: false,
      quarantined: false,
    });
    return { id, rootId: id, source: "claude-code", title };
  }

  #binding(
    sessionRef: string,
    worldInstanceId?: string,
    allowEnded = false,
  ): OwnedBinding {
    const binding = this.#bindings.get(sessionRef);
    if (
      !binding ||
      (worldInstanceId !== undefined &&
        binding.worldInstanceId !== worldInstanceId) ||
      (!allowEnded && binding.ended)
    )
      throw claudeFailure(
        "Claude Code session is not owned by this active World",
        "conflict",
      );
    return binding;
  }

  async attach(
    sessionRef: string,
    context?: WorldOwnedSessionContext,
  ): Promise<AdapterSessionSummary> {
    if (!context?.worldInstanceId)
      throw claudeFailure(
        "Claude Code World ownership identity is required",
        "conflict",
      );
    const binding = this.#binding(sessionRef, context.worldInstanceId);
    if (binding.quarantined)
      throw claudeFailure(
        "Claude Code owned session is quarantined and stale",
        "conflict",
      );
    return {
      id: binding.nativeSessionId,
      rootId: binding.nativeSessionId,
      source: "claude-code",
      title: binding.title,
    };
  }

  async sendText(
    sessionRef: string,
    text: string,
    context?: AdapterTurnContext,
  ): Promise<AdapterTurnResult> {
    if (Buffer.byteLength(text, "utf8") > MAX_INPUT_BYTES)
      throw claudeFailure("Claude Code input exceeds the bound", "validation");
    const binding = this.#binding(sessionRef);
    if (
      context?.rootSessionRef !== undefined &&
      context.rootSessionRef !== binding.nativeSessionId
    )
      throw claudeFailure(
        "Claude Code root session binding does not match",
        "conflict",
      );
    if (binding.quarantined)
      throw claudeFailure(
        "Claude Code owned session is quarantined and stale",
        "conflict",
      );
    if (this.#busy.has(binding.nativeSessionId))
      throw claudeFailure(
        "This exact Claude Code session already has an active turn",
        "conflict",
      );
    this.#busy.add(binding.nativeSessionId);
    try {
      return await this.#runTurn(
        text,
        binding.nativeSessionId,
        true,
        binding.runtimeHome,
        context,
      );
    } catch (error) {
      binding.quarantined = true;
      throw error instanceof GatewayError ? error : claudeFailure();
    } finally {
      this.#busy.delete(binding.nativeSessionId);
    }
  }

  async endWorldSession(
    worldInstanceId: string,
    rootSessionRef: string,
  ): Promise<void> {
    const binding = this.#binding(rootSessionRef, worldInstanceId, true);
    if (binding.ended) return;
    if (this.#busy.has(binding.nativeSessionId))
      throw claudeFailure(
        "Claude Code session still has an active World turn",
        "conflict",
      );
    binding.ended = true;
  }
}

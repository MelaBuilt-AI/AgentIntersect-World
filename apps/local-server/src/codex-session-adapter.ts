import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, symlink } from "node:fs/promises";
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

export const CODEX_CLI_VERSION = "0.149.1";

const CODEX_MODEL = "gpt-5.6-sol";
const CODEX_REASONING = 'model_reasoning_effort="high"';
const MAX_INPUT_BYTES = 16_384;
const MAX_EVENT_BYTES = 32_768;
const MAX_EVENTS = 1_024;
const MAX_STDOUT_BYTES = 262_144;
const MAX_STDERR_BYTES = 16_384;
const MAX_OUTPUT_BYTES = 65_536;
const CREATE_PROMPT =
  "Establish this World-owned session. Reply only with the word ready and do not use tools.";
const ENVIRONMENT_ALLOWLIST = [
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
  "CODEX_HOME",
  "WSL_DISTRO_NAME",
  "WSL_INTEROP",
  "WSLENV",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
] as const;

type CodexOptions = {
  readonly executablePath: string;
  readonly nativeSessionRoot: string;
  readonly authPath?: string;
  readonly attestTimeoutMs?: number;
  readonly turnTimeoutMs?: number;
  readonly terminateGraceMs?: number;
};

type OwnedBinding = {
  readonly worldInstanceId: string;
  readonly nativeSessionId: string;
  readonly title: string;
  readonly runtimeHome: string;
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

function codexFailure(
  message = "Codex CLI turn failed",
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
    throw codexFailure("World instance identity is invalid", "validation");
  return value;
}

function nativeSessionId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw codexFailure("Codex CLI returned an invalid session identity");
  return value;
}

function processEnvironment(runtimeHome?: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ENVIRONMENT_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  if (runtimeHome) environment.CODEX_HOME = runtimeHome;
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

function safeToolName(item: Record<string, unknown>): string {
  if (item.type === "command_execution") return "command_execution";
  if (item.type === "file_change") return "file_change";
  if (item.type === "web_search") return "web_search";
  const candidate = item.tool ?? item.name;
  return typeof candidate === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(candidate)
    ? candidate
    : "mcp_tool_call";
}

function isToolItem(item: Record<string, unknown>): boolean {
  return [
    "command_execution",
    "file_change",
    "mcp_tool_call",
    "web_search",
  ].includes(String(item.type));
}

function repositoryRelativeLocator(
  locator: AdapterTurnEvent["repositoryLocator"],
  repositoryRoot: string,
): AdapterTurnEvent["repositoryLocator"] {
  if (!locator) return undefined;
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

function codexRepositoryLocator(
  item: Record<string, unknown>,
  repositoryRoot: string,
): AdapterTurnEvent["repositoryLocator"] {
  const toolName = safeToolName(item);
  const structured = repositoryRelativeLocator(
    extractAdapterRepositoryLocator(
      "codex",
      toolName,
      item.type === "file_change" || item.type === "command_execution"
        ? item
        : item.arguments,
    ),
    repositoryRoot,
  );
  if (structured || item.type !== "command_execution") return structured;
  const command = item.command;
  if (typeof command !== "string") return undefined;
  const pathPattern = "([A-Za-z0-9][A-Za-z0-9._/-]{0,255})";
  const exactRead = [
    new RegExp(`^cat ${pathPattern}$`, "u"),
    new RegExp(`^/bin/bash -lc 'cat ${pathPattern}'$`, "u"),
    new RegExp(`^/bin/bash -lc "cat ${pathPattern}"$`, "u"),
  ]
    .map((pattern) => pattern.exec(command))
    .find((match) => match?.[1]);
  if (!exactRead?.[1]) return undefined;
  return repositoryRelativeLocator(
    extractAdapterRepositoryLocator("codex", toolName, {
      parsed_cmd: [{ type: "read", path: exactRead[1] }],
    }),
    repositoryRoot,
  );
}

export class CodexSessionAdapter implements AgentAdapter {
  readonly id = "codex";
  readonly #options: CodexOptions;
  readonly #bindings = new Map<string, OwnedBinding>();
  readonly #busy = new Set<string>();

  constructor(options: CodexOptions) {
    if (
      !path.isAbsolute(options.executablePath) ||
      !path.isAbsolute(options.nativeSessionRoot) ||
      options.executablePath.length > 4_096 ||
      options.nativeSessionRoot.length > 4_096 ||
      hasControlCharacters(options.executablePath) ||
      hasControlCharacters(options.nativeSessionRoot)
    )
      throw codexFailure(
        "Codex executable and session root must be bounded absolute paths",
        "validation",
      );
    this.#options = options;
  }

  #args(sessionId?: string, evidenceDirectory?: string): string[] {
    const args = [
      "exec",
      ...(evidenceDirectory ? ["--add-dir", evidenceDirectory] : []),
      "--model",
      CODEX_MODEL,
      "-c",
      CODEX_REASONING,
      "--sandbox",
      "workspace-write",
      "--json",
      "--skip-git-repo-check",
      "--ignore-user-config",
    ];
    if (sessionId) args.push("resume", sessionId);
    args.push("-");
    return args;
  }

  async #runProcess(
    args: readonly string[],
    input: string,
    options: {
      readonly timeoutMs: number;
      readonly timeoutMessage: string;
      readonly failureMessage: string;
      readonly signal?: AbortSignal;
      readonly runtimeHome?: string;
      readonly workingDirectory?: string;
      readonly onEvent?: (event: unknown) => void;
      readonly validate?: () => void;
    },
  ): Promise<ProcessResult> {
    return new Promise<ProcessResult>((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(this.#options.executablePath, args, {
          cwd: options.workingDirectory ?? this.#options.nativeSessionRoot,
          env: processEnvironment(options.runtimeHome),
          detached: true,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        reject(codexFailure(options.failureMessage, "offline"));
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
          fail(codexFailure(options.failureMessage));
          return;
        }
        eventCount += 1;
        if (eventCount > MAX_EVENTS) {
          fail(codexFailure(options.failureMessage));
          return;
        }
        try {
          const event: unknown = JSON.parse(line);
          if (!isRecord(event) || typeof event.type !== "string")
            throw new Error("invalid event");
          options.onEvent?.(event);
        } catch {
          fail(codexFailure(options.failureMessage));
        }
      };

      const timeout = setTimeout(
        () => fail(codexFailure(options.timeoutMessage)),
        options.timeoutMs,
      );
      timeout.unref();
      const onAbort = () => fail(codexFailure("Codex CLI turn was cancelled"));
      options.signal?.addEventListener("abort", onAbort, { once: true });

      child.stdout.on("data", (chunk: Buffer) => {
        if (failure) return;
        stdoutBytes += chunk.length;
        if (stdoutBytes > MAX_STDOUT_BYTES) {
          fail(codexFailure(options.failureMessage));
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
          fail(codexFailure(options.failureMessage));
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes > MAX_STDERR_BYTES)
          fail(codexFailure(options.failureMessage));
      });
      child.once("error", () =>
        fail(codexFailure(options.failureMessage, "offline")),
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
            fail(codexFailure(options.failureMessage));
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
      child.stdin.on("error", () => fail(codexFailure(options.failureMessage)));
      child.stdin.end(input);
    });
  }

  async #plain(
    args: readonly string[],
    timeoutMessage: string,
  ): Promise<string> {
    const result = await this.#runProcess(args, "", {
      timeoutMs: this.#options.attestTimeoutMs ?? 5_000,
      timeoutMessage,
      failureMessage: "Codex CLI attestation failed",
    });
    return result.stdout.trim();
  }

  async attest() {
    const version = await this.#plain(
      ["--version"],
      "Codex CLI attestation timed out",
    );
    if (
      ![CODEX_CLI_VERSION, "0.153.4"].some(
        (supported) => version === `codex-cli ${supported}`,
      )
    )
      throw codexFailure("Codex CLI version mismatch", "offline");
    const execHelp = await this.#plain(
      ["exec", "--help"],
      "Codex CLI attestation timed out",
    );
    const resumeHelp = await this.#plain(
      ["exec", "resume", "--help"],
      "Codex CLI attestation timed out",
    );
    if (
      !execHelp.includes("Usage: codex exec") ||
      !execHelp.includes("--model") ||
      !execHelp.includes("--sandbox") ||
      !execHelp.includes("--json") ||
      !execHelp.includes("resume") ||
      !resumeHelp.includes("Usage: codex exec resume") ||
      !resumeHelp.includes("[SESSION_ID]") ||
      !resumeHelp.includes("--json")
    )
      throw codexFailure("Codex CLI contract mismatch", "offline");

    return AgentCapabilityManifestSchema.parse({
      schema: "aiw.agent-capabilities/0.12",
      adapterId: "codex",
      adapterVersion: `0.19.0-codex-${version.slice("codex-cli ".length)}`,
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
        approvals: "Codex approvals remain in the native operator surface.",
        interrupt:
          "Cancellation is bound to the active turn; no completed run remains interruptible.",
        avatarProposal: "Codex does not provide World avatar proposals.",
        skillsDisclosure: "Codex skill disclosure is not exposed to World.",
      },
    });
  }

  async listSessions(): Promise<readonly AdapterSessionSummary[]> {
    return [...this.#bindings.values()]
      .filter((binding) => !binding.ended)
      .map((binding) => ({
        id: binding.nativeSessionId,
        rootId: binding.nativeSessionId,
        source: "codex",
        title: binding.title,
      }));
  }

  async #runTurn(
    input: string,
    expectedSessionId?: string,
    context?: AdapterTurnContext,
    runtimeHome?: string,
  ): Promise<AdapterTurnResult> {
    let seenSessionId: string | undefined;
    let turnStarted = false;
    let turnCompleted = false;
    let finalText: string | undefined;
    let outputBytes = 0;
    const deltas: string[] = [];
    const toolLocators = new Map<
      string,
      AdapterTurnEvent["repositoryLocator"]
    >();
    let eventDispatch = Promise.resolve();
    const emit = (event: AdapterTurnEvent) => {
      eventDispatch = eventDispatch.then(async () => context?.onEvent?.(event));
    };

    await this.#runProcess(
      this.#args(expectedSessionId, context?.evidenceDirectory),
      input,
      {
        // Real coding turns can spend several minutes exploring before writing.
        // Keep a finite deadline and the existing abort/process-group cleanup.
        timeoutMs: this.#options.turnTimeoutMs ?? 600_000,
        timeoutMessage: "Codex CLI turn timed out",
        failureMessage: "Codex CLI turn failed",
        ...(context?.signal ? { signal: context.signal } : {}),
        ...(runtimeHome ? { runtimeHome } : {}),
        ...(context?.workingDirectory
          ? { workingDirectory: context.workingDirectory }
          : {}),
        validate: () => {
          if (
            !seenSessionId ||
            !turnStarted ||
            !turnCompleted ||
            finalText === undefined
          )
            throw codexFailure();
        },
        onEvent: (raw) => {
          const event = raw as Record<string, unknown>;
          if (event.type === "thread.started") {
            const id = nativeSessionId(event.thread_id);
            if (seenSessionId && seenSessionId !== id)
              throw codexFailure(
                "Codex CLI returned an ambiguous session identity",
              );
            if (expectedSessionId && expectedSessionId !== id)
              throw codexFailure("Codex CLI resumed an unexpected session");
            seenSessionId = id;
            return;
          }
          if (event.type === "turn.started") {
            turnStarted = true;
            return;
          }
          if (event.type === "turn.failed" || event.type === "error")
            throw codexFailure();
          if (event.type === "turn.completed") {
            turnCompleted = true;
            return;
          }
          if (
            event.type !== "item.started" &&
            event.type !== "item.updated" &&
            event.type !== "item.completed"
          )
            return;
          if (!isRecord(event.item)) return;
          const item = event.item;
          if (
            event.type === "item.updated" &&
            item.type === "agent_message" &&
            typeof event.delta === "string"
          ) {
            const bytes = Buffer.byteLength(event.delta, "utf8");
            outputBytes += bytes;
            if (bytes > MAX_EVENT_BYTES || outputBytes > MAX_OUTPUT_BYTES)
              throw codexFailure("Codex CLI output exceeded the bound");
            deltas.push(event.delta);
            emit({
              type: "assistant.delta",
              text: event.delta,
              redaction: { applied: false, count: 0 },
            });
            return;
          }
          if (
            event.type === "item.completed" &&
            item.type === "agent_message" &&
            typeof item.text === "string"
          ) {
            if (Buffer.byteLength(item.text, "utf8") > MAX_OUTPUT_BYTES)
              throw codexFailure("Codex CLI output exceeded the bound");
            finalText = item.text;
            return;
          }
          if (!isToolItem(item) || event.type === "item.updated") return;
          const failed =
            item.status === "failed" ||
            (typeof item.exit_code === "number" && item.exit_code !== 0) ||
            (item.error !== undefined && item.error !== null);
          const activityId =
            typeof item.id === "string" &&
            /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(item.id)
              ? item.id
              : undefined;
          const locator =
            event.type === "item.started"
              ? codexRepositoryLocator(
                  item,
                  context?.workingDirectory ?? this.#options.nativeSessionRoot,
                )
              : activityId
                ? toolLocators.get(activityId)
                : undefined;
          if (event.type === "item.started" && activityId && locator)
            toolLocators.set(activityId, locator);
          emit({
            type:
              event.type === "item.started"
                ? "tool.started"
                : failed
                  ? "tool.failed"
                  : "tool.completed",
            toolName: safeToolName(item),
            ...(activityId && locator
              ? { activityId, repositoryLocator: locator }
              : {}),
            redaction: { applied: true, count: 1 },
          });
          if (event.type === "item.completed" && activityId)
            toolLocators.delete(activityId);
        },
      },
    );
    await eventDispatch.catch(() => {
      throw codexFailure();
    });
    return {
      finalText: finalText as string,
      deltas,
      sessionRef: seenSessionId as string,
    };
  }

  async createWorldSession(
    worldInstanceId: string,
    displayName = "Codex",
  ): Promise<AdapterSessionSummary> {
    boundedWorldRef(worldInstanceId);
    const title = displayName.normalize("NFC").trim().slice(0, 80) || "Codex";
    const runtimeHome = await this.#createRuntimeHome();
    try {
      const created = await this.#runTurn(
        CREATE_PROMPT,
        undefined,
        undefined,
        runtimeHome,
      );
      const id = nativeSessionId(created.sessionRef);
      if (this.#bindings.has(id))
        throw codexFailure("Codex CLI returned an ambiguous session identity");
      this.#bindings.set(id, {
        worldInstanceId,
        nativeSessionId: id,
        title,
        runtimeHome,
        ended: false,
        quarantined: false,
      });
      return { id, rootId: id, source: "codex", title };
    } catch (error) {
      await rm(path.join(runtimeHome, "auth.json"), { force: true });
      throw error;
    }
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
      throw codexFailure(
        "Codex session is not owned by this active World",
        "conflict",
      );
    return binding;
  }

  async attach(
    sessionRef: string,
    context?: WorldOwnedSessionContext,
  ): Promise<AdapterSessionSummary> {
    if (!context?.worldInstanceId)
      throw codexFailure(
        "Codex World ownership identity is required",
        "conflict",
      );
    const binding = this.#binding(sessionRef, context.worldInstanceId);
    if (binding.quarantined)
      throw codexFailure(
        "Codex owned session is quarantined and stale",
        "conflict",
      );
    return {
      id: binding.nativeSessionId,
      rootId: binding.nativeSessionId,
      source: "codex",
      title: binding.title,
    };
  }

  async sendText(
    sessionRef: string,
    text: string,
    context?: AdapterTurnContext,
  ): Promise<AdapterTurnResult> {
    if (Buffer.byteLength(text, "utf8") > MAX_INPUT_BYTES)
      throw codexFailure("Codex input exceeds the bound", "validation");
    const binding = this.#binding(sessionRef);
    if (
      context?.rootSessionRef !== undefined &&
      context.rootSessionRef !== binding.nativeSessionId
    )
      throw codexFailure(
        "Codex root session binding does not match",
        "conflict",
      );
    if (binding.quarantined)
      throw codexFailure(
        "Codex owned session is quarantined and stale",
        "conflict",
      );
    if (this.#busy.has(binding.nativeSessionId))
      throw codexFailure(
        "This exact Codex session already has an active turn",
        "conflict",
      );
    this.#busy.add(binding.nativeSessionId);
    try {
      return await this.#runTurn(
        context?.systemMessage
          ? `${context.systemMessage}

User request:
${text}`
          : text,
        binding.nativeSessionId,
        context,
        binding.runtimeHome,
      );
    } catch (error) {
      binding.quarantined = true;
      throw error instanceof GatewayError ? error : codexFailure();
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
      throw codexFailure(
        "Codex session still has an active World turn",
        "conflict",
      );
    binding.ended = true;
    await rm(path.join(binding.runtimeHome, "auth.json"), { force: true });
  }

  async #createRuntimeHome(): Promise<string> {
    await mkdir(this.#options.nativeSessionRoot, {
      recursive: true,
      mode: 0o700,
    });
    const runtimeHome = await mkdtemp(
      path.join(this.#options.nativeSessionRoot, ".aiw-codex-"),
    );
    const authPath =
      this.#options.authPath ??
      path.join(
        process.env.CODEX_HOME ?? path.join(process.env.HOME ?? "", ".codex"),
        "auth.json",
      );
    try {
      const auth = await stat(authPath);
      if (!auth.isFile()) throw new Error("not a file");
      await symlink(authPath, path.join(runtimeHome, "auth.json"));
      return runtimeHome;
    } catch {
      await rm(runtimeHome, { recursive: true, force: true });
      throw codexFailure("Codex CLI authentication is unavailable", "offline");
    }
  }
}

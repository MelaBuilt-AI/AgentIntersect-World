import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { AgentCapabilityManifestSchema } from "@agentintersect-world/agent-session-protocol";
import WebSocket from "ws";

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

export const OPENCLAW_GATEWAY_PROTOCOL_VERSION = 4;
export const OPENCLAW_SERVER_VERSION = "2026.7.1";

const MAX_INPUT_BYTES = 16_384;
const MAX_FRAME_BYTES = 1_048_576;
const MAX_EVENT_BYTES = 32_768;
const MAX_EVENTS = 1_024;
const MAX_OUTPUT_BYTES = 65_536;
const REQUIRED_METHODS = [
  "sessions.create",
  "sessions.describe",
  "sessions.send",
  "sessions.abort",
  "sessions.delete",
] as const;

type OpenClawOptions = {
  readonly gatewayUrl: string;
  readonly credential: string | (() => string);
  readonly connectTimeoutMs?: number;
  readonly turnTimeoutMs?: number;
  readonly expectedServerVersion?: string;
};

type GatewayFrame = Record<string, unknown> & { readonly type: string };

type OwnedBinding = {
  readonly worldInstanceId: string;
  readonly rootSessionRef: string;
  readonly effectiveSessionRef: string;
  readonly title: string;
  ended: boolean;
  quarantined: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedRef(value: string, label: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value))
    throw new GatewayError("validation", `${label} is invalid`);
  return value;
}

function gatewayWebSocketUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new GatewayError("validation", "OpenClaw gateway URL is invalid");
  }
  if (
    !["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "http:" && url.protocol !== "https:")
  )
    throw new GatewayError(
      "validation",
      "OpenClaw gateway must be an exact loopback HTTP(S) endpoint",
    );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function safeToolName(value: unknown): {
  readonly name: string;
  readonly changed: boolean;
} {
  const raw = typeof value === "string" ? value : "";
  const name = [...raw]
    .filter((character) => /[A-Za-z0-9._-]/.test(character))
    .join("")
    .slice(0, 64);
  return { name: name || "unknown", changed: !name || name !== raw };
}

function assistantText(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.content)) return null;
  const parts = value.content.flatMap((part) =>
    isRecord(part) && part.type === "text" && typeof part.text === "string"
      ? [part.text]
      : [],
  );
  return parts.length > 0 ? parts.join("") : null;
}

function gatewayFailure(
  message = "OpenClaw gateway request failed",
  code: "offline" | "upstream" = "upstream",
): GatewayError {
  return new GatewayError(code, message);
}

class GatewayConnection {
  readonly #socket: WebSocket;
  readonly #credential: string;
  readonly #connectTimeoutMs: number;
  readonly #expectedServerVersion: string;
  readonly #pending = new Map<
    string,
    {
      readonly resolve: (value: unknown) => void;
      readonly reject: (reason: unknown) => void;
    }
  >();
  readonly #listeners = new Set<(frame: GatewayFrame) => void>();
  readonly #failureListeners = new Set<(error: GatewayError) => void>();
  #frameCount = 0;
  #failed: GatewayError | null = null;

  constructor(options: OpenClawOptions) {
    this.#credential =
      typeof options.credential === "function"
        ? options.credential()
        : options.credential;
    this.#connectTimeoutMs = options.connectTimeoutMs ?? 5_000;
    this.#expectedServerVersion =
      options.expectedServerVersion ?? OPENCLAW_SERVER_VERSION;
    this.#socket = new WebSocket(gatewayWebSocketUrl(options.gatewayUrl), {
      maxPayload: MAX_FRAME_BYTES,
      handshakeTimeout: this.#connectTimeoutMs,
    });
    this.#socket.on("message", (data) => this.#onMessage(data));
    this.#socket.once("error", () =>
      this.#fail(
        gatewayFailure("OpenClaw gateway connection failed", "offline"),
      ),
    );
    this.#socket.once("close", () =>
      this.#fail(gatewayFailure("OpenClaw gateway disconnected", "offline")),
    );
  }

  async start(): Promise<void> {
    const hello = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete("connect");
        reject(
          gatewayFailure("OpenClaw gateway handshake timed out", "offline"),
        );
        this.close();
      }, this.#connectTimeoutMs);
      this.#pending.set("connect", {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (reason) => {
          clearTimeout(timeout);
          reject(reason);
        },
      });
    });
    const payload = await hello;
    this.#validateHello(payload);
  }

  #validateHello(value: unknown): void {
    if (!isRecord(value) || value.type !== "hello-ok")
      throw gatewayFailure("OpenClaw gateway identity mismatch");
    if (value.protocol !== OPENCLAW_GATEWAY_PROTOCOL_VERSION)
      throw gatewayFailure("OpenClaw gateway protocol mismatch");
    if (
      !isRecord(value.server) ||
      value.server.version !== this.#expectedServerVersion
    )
      throw gatewayFailure("OpenClaw gateway version mismatch");
    if (!isRecord(value.auth) || value.auth.role !== "operator")
      throw gatewayFailure("OpenClaw gateway identity mismatch");
    if (
      !Array.isArray(value.auth.scopes) ||
      !value.auth.scopes.includes("operator.admin")
    )
      throw gatewayFailure("OpenClaw gateway capability mismatch");
    if (!isRecord(value.features))
      throw gatewayFailure("OpenClaw gateway capability mismatch");
    const methods = Array.isArray(value.features.methods)
      ? value.features.methods
      : [];
    const events = Array.isArray(value.features.events)
      ? value.features.events
      : [];
    if (
      REQUIRED_METHODS.some((method) => !methods.includes(method)) ||
      !events.includes("agent") ||
      !events.includes("chat")
    )
      throw gatewayFailure("OpenClaw gateway capability mismatch");
  }

  #sendConnect(): void {
    if (this.#socket.readyState !== WebSocket.OPEN) {
      this.#fail(
        gatewayFailure("OpenClaw gateway connection failed", "offline"),
      );
      return;
    }
    this.#socket.send(
      JSON.stringify({
        type: "req",
        id: "connect",
        method: "connect",
        params: {
          minProtocol: OPENCLAW_GATEWAY_PROTOCOL_VERSION,
          maxProtocol: OPENCLAW_GATEWAY_PROTOCOL_VERSION,
          client: {
            id: "gateway-client",
            displayName: "AgentIntersect World",
            version: "0.19.0",
            platform: process.platform,
            mode: "backend",
            instanceId: randomUUID(),
          },
          caps: ["tool-events"],
          auth: { token: this.#credential },
          role: "operator",
          scopes: ["operator.admin"],
        },
      }),
    );
  }

  #onMessage(data: WebSocket.RawData): void {
    if (this.#failed) return;
    const bytes = Buffer.isBuffer(data)
      ? data
      : Buffer.from(data as ArrayBuffer);
    this.#frameCount += 1;
    if (
      bytes.byteLength > MAX_FRAME_BYTES ||
      this.#frameCount > MAX_EVENTS * 4
    ) {
      this.#fail(gatewayFailure("OpenClaw gateway response exceeded a bound"));
      return;
    }
    let frame: GatewayFrame;
    try {
      const parsed: unknown = JSON.parse(bytes.toString("utf8"));
      if (!isRecord(parsed) || typeof parsed.type !== "string")
        throw new Error();
      frame = parsed as GatewayFrame;
    } catch {
      this.#fail(gatewayFailure("OpenClaw gateway returned a malformed frame"));
      return;
    }
    if (
      frame.type === "event" &&
      frame.event === "connect.challenge" &&
      isRecord(frame.payload) &&
      typeof frame.payload.nonce === "string" &&
      frame.payload.nonce.length > 0
    ) {
      this.#sendConnect();
      return;
    }
    if (frame.type === "res" && typeof frame.id === "string") {
      const pending = this.#pending.get(frame.id);
      if (!pending) return;
      this.#pending.delete(frame.id);
      if (frame.ok === true) pending.resolve(frame.payload);
      else pending.reject(gatewayFailure());
      return;
    }
    if (frame.type === "event")
      for (const listener of this.#listeners) listener(frame);
  }

  #fail(error: GatewayError): void {
    if (this.#failed) return;
    this.#failed = error;
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
    for (const listener of this.#failureListeners) listener(error);
    this.#failureListeners.clear();
    if (
      this.#socket.readyState === WebSocket.OPEN ||
      this.#socket.readyState === WebSocket.CONNECTING
    )
      this.#socket.terminate();
  }

  request(method: (typeof REQUIRED_METHODS)[number], params: unknown) {
    if (this.#failed) return Promise.reject(this.#failed);
    if (this.#socket.readyState !== WebSocket.OPEN)
      return Promise.reject(
        gatewayFailure("OpenClaw gateway connection failed", "offline"),
      );
    const id = randomUUID();
    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.#pending.delete(id)) return;
        reject(gatewayFailure("OpenClaw gateway request timed out"));
      }, this.#connectTimeoutMs);
      this.#pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (reason) => {
          clearTimeout(timeout);
          reject(reason);
        },
      });
      try {
        this.#socket.send(JSON.stringify({ type: "req", id, method, params }));
      } catch {
        const pending = this.#pending.get(id);
        this.#pending.delete(id);
        pending?.reject(
          gatewayFailure("OpenClaw gateway connection failed", "offline"),
        );
      }
    });
  }

  onEvent(listener: (frame: GatewayFrame) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  onFailure(listener: (error: GatewayError) => void): () => void {
    if (this.#failed) {
      listener(this.#failed);
      return () => undefined;
    }
    this.#failureListeners.add(listener);
    return () => this.#failureListeners.delete(listener);
  }

  close(): void {
    if (this.#socket.readyState === WebSocket.OPEN) this.#socket.close();
    else if (this.#socket.readyState === WebSocket.CONNECTING)
      this.#socket.terminate();
  }
}

export function resolveOpenClawCredential(
  reference: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  let value: string | undefined;
  if (reference.startsWith("env:")) value = environment[reference.slice(4)];
  else if (reference.startsWith("file:")) {
    const file = reference.slice(5);
    if (!file.startsWith("/") || file.length > 512)
      throw new GatewayError(
        "validation",
        "OpenClaw credential reference is invalid",
      );
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > 4_096)
        throw new Error("invalid credential file");
      value = fs.readFileSync(file, "utf8").trim();
    } catch {
      throw new GatewayError("offline", "OpenClaw credential is unavailable");
    }
  } else
    throw new GatewayError(
      "validation",
      "OpenClaw credential reference is invalid",
    );
  if (
    !value ||
    value.length > 1_024 ||
    [...value].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 33 || code > 126;
    })
  )
    throw new GatewayError("offline", "OpenClaw credential is unavailable");
  return value;
}

export class OpenClawSessionAdapter implements AgentAdapter {
  readonly id = "openclaw";
  readonly #options: OpenClawOptions;
  readonly #bindingsByRoot = new Map<string, OwnedBinding>();
  readonly #bindingsByEffective = new Map<string, OwnedBinding>();
  readonly #busy = new Set<string>();
  readonly #activeRuns = new Map<string, OwnedBinding>();

  constructor(options: OpenClawOptions) {
    gatewayWebSocketUrl(options.gatewayUrl);
    if (
      typeof options.credential === "string" &&
      (!options.credential || options.credential.length > 1_024)
    )
      throw new GatewayError("validation", "OpenClaw credential is invalid");
    this.#options = options;
  }

  async #connection(): Promise<GatewayConnection> {
    let connection: GatewayConnection | undefined;
    try {
      connection = new GatewayConnection(this.#options);
      await connection.start();
      return connection;
    } catch (error) {
      connection?.close();
      throw error instanceof GatewayError ? error : gatewayFailure();
    }
  }

  async attest() {
    const connection = await this.#connection();
    connection.close();
    return AgentCapabilityManifestSchema.parse({
      schema: "aiw.agent-capabilities/0.12",
      adapterId: "openclaw",
      adapterVersion: `0.19.0-openclaw-${OPENCLAW_SERVER_VERSION}`,
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
        approvals: "OpenClaw approvals remain in the native operator surface.",
        interrupt:
          "Cancellation is bound to the active send signal; no post-return run remains interruptible.",
        avatarProposal: "OpenClaw does not provide World avatar proposals.",
        skillsDisclosure: "OpenClaw skill disclosure is not exposed to World.",
      },
    });
  }

  async listSessions(): Promise<readonly AdapterSessionSummary[]> {
    return [...this.#bindingsByRoot.values()]
      .filter((binding) => !binding.ended)
      .map((binding) => ({
        id: binding.effectiveSessionRef,
        rootId: binding.rootSessionRef,
        source: "openclaw",
        title: binding.title,
      }));
  }

  async createWorldSession(
    worldInstanceId: string,
    displayName = "OpenClaw",
  ): Promise<AdapterSessionSummary> {
    boundedRef(worldInstanceId, "World instance identity");
    const title =
      displayName.normalize("NFC").trim().slice(0, 80) || "OpenClaw";
    const connection = await this.#connection();
    try {
      const result = await connection.request("sessions.create", {
        key: `agent:main:aiw:${randomUUID()}`,
        label: title,
      });
      if (
        !isRecord(result) ||
        result.ok !== true ||
        typeof result.key !== "string" ||
        typeof result.sessionId !== "string"
      )
        throw gatewayFailure("OpenClaw session creation response is invalid");
      const rootSessionRef = boundedRef(
        result.key,
        "OpenClaw root session identity",
      );
      const effectiveSessionRef = boundedRef(
        result.sessionId,
        "OpenClaw effective session identity",
      );
      if (
        this.#bindingsByRoot.has(rootSessionRef) ||
        this.#bindingsByEffective.has(effectiveSessionRef)
      )
        throw gatewayFailure("OpenClaw returned an ambiguous session identity");
      const binding: OwnedBinding = {
        worldInstanceId,
        rootSessionRef,
        effectiveSessionRef,
        title,
        ended: false,
        quarantined: false,
      };
      this.#bindingsByRoot.set(rootSessionRef, binding);
      this.#bindingsByEffective.set(effectiveSessionRef, binding);
      return {
        id: effectiveSessionRef,
        rootId: rootSessionRef,
        source: "openclaw",
        title,
      };
    } finally {
      connection.close();
    }
  }

  #ownedBinding(
    sessionRef: string,
    worldInstanceId?: string,
    rootSessionRef?: string,
  ): OwnedBinding {
    const bySession =
      this.#bindingsByEffective.get(sessionRef) ??
      this.#bindingsByRoot.get(sessionRef);
    if (
      !bySession ||
      bySession.ended ||
      (worldInstanceId !== undefined &&
        bySession.worldInstanceId !== worldInstanceId) ||
      (rootSessionRef !== undefined &&
        bySession.rootSessionRef !== rootSessionRef)
    )
      throw new GatewayError(
        "conflict",
        "OpenClaw session is not owned by this active World",
      );
    return bySession;
  }

  async attach(
    sessionRef: string,
    context?: WorldOwnedSessionContext,
  ): Promise<AdapterSessionSummary> {
    if (!context?.worldInstanceId)
      throw new GatewayError(
        "conflict",
        "OpenClaw World ownership identity is required",
      );
    const binding = this.#ownedBinding(sessionRef, context.worldInstanceId);
    if (binding.quarantined)
      throw new GatewayError(
        "conflict",
        "OpenClaw owned session is quarantined and stale",
      );
    const connection = await this.#connection();
    try {
      const result = await connection.request("sessions.describe", {
        key: binding.rootSessionRef,
      });
      if (
        !isRecord(result) ||
        !isRecord(result.session) ||
        result.session.sessionId !== binding.effectiveSessionRef
      )
        throw new GatewayError(
          "not_found",
          "OpenClaw owned session is missing or stale",
        );
      return {
        id: binding.effectiveSessionRef,
        rootId: binding.rootSessionRef,
        source: "openclaw",
        title: binding.title,
      };
    } finally {
      connection.close();
    }
  }

  async sendText(
    sessionRef: string,
    text: string,
    context?: AdapterTurnContext,
  ): Promise<AdapterTurnResult> {
    if (Buffer.byteLength(text, "utf8") > MAX_INPUT_BYTES)
      throw new GatewayError("validation", "OpenClaw input exceeds the bound");
    const binding = this.#ownedBinding(
      sessionRef,
      undefined,
      context?.rootSessionRef,
    );
    if (binding.quarantined)
      throw new GatewayError(
        "conflict",
        "OpenClaw owned session is quarantined and stale",
      );
    if (this.#busy.has(binding.effectiveSessionRef))
      throw new GatewayError(
        "conflict",
        "This exact OpenClaw session already has an active turn",
      );
    this.#busy.add(binding.effectiveSessionRef);
    const connection = await this.#connection().catch((error) => {
      this.#busy.delete(binding.effectiveSessionRef);
      throw error;
    });
    const runId = randomUUID();
    this.#activeRuns.set(runId, binding);
    const deltas: string[] = [];
    let outputBytes = 0;
    let eventCount = 0;
    let settled = false;
    let mayHaveAdmitted = false;
    let terminalConfirmed = false;
    let abortConfirmed = false;
    let timeout: NodeJS.Timeout | undefined;
    let removeAbort: (() => void) | undefined;
    let unsubscribe: (() => void) | undefined;
    let removeFailure: (() => void) | undefined;
    let eventDispatch = Promise.resolve();
    let fallbackToolSequence = 0;
    let activeFallbackTool:
      | {
          readonly activityId: string;
          readonly name: string;
          readonly locator: NonNullable<AdapterTurnEvent["repositoryLocator"]>;
        }
      | undefined;
    const toolLocators = new Map<
      string,
      NonNullable<AdapterTurnEvent["repositoryLocator"]>
    >();
    const emit = (event: AdapterTurnEvent) => {
      eventDispatch = eventDispatch.then(async () => context?.onEvent?.(event));
    };
    const terminal = new Promise<AdapterTurnResult>((resolve, reject) => {
      const finish = (
        result: AdapterTurnResult | Error,
        confirmedTerminal = false,
      ) => {
        if (settled) return;
        if (confirmedTerminal) terminalConfirmed = true;
        settled = true;
        if (timeout) clearTimeout(timeout);
        removeAbort?.();
        unsubscribe?.();
        removeFailure?.();
        if (result instanceof Error) reject(result);
        else resolve(result);
      };
      const abort = (message: string) => {
        void connection
          .request("sessions.abort", {
            key: binding.rootSessionRef,
            runId,
          })
          .then(
            (result) => {
              if (isRecord(result) && result.ok === true) abortConfirmed = true;
              finish(
                abortConfirmed
                  ? gatewayFailure(message)
                  : gatewayFailure(
                      "OpenClaw run cancellation was not confirmed",
                    ),
              );
            },
            () =>
              finish(
                gatewayFailure("OpenClaw run cancellation was not confirmed"),
              ),
          );
      };
      timeout = setTimeout(
        () => abort("OpenClaw session turn timed out"),
        this.#options.turnTimeoutMs ?? 120_000,
      );
      const onAbort = () => abort("OpenClaw session turn was cancelled");
      context?.signal?.addEventListener("abort", onAbort, { once: true });
      removeAbort = () =>
        context?.signal?.removeEventListener("abort", onAbort);
      unsubscribe = connection.onEvent((frame) => {
        eventCount += 1;
        if (eventCount > MAX_EVENTS) {
          finish(gatewayFailure("OpenClaw turn exceeded the event bound"));
          return;
        }
        if (!isRecord(frame.payload)) return;
        const payload = frame.payload;
        if (
          payload.runId !== runId ||
          payload.sessionKey !== binding.rootSessionRef
        )
          return;
        if (frame.event === "chat") {
          if (
            payload.state === "delta" &&
            typeof payload.deltaText === "string"
          ) {
            const bytes = Buffer.byteLength(payload.deltaText, "utf8");
            outputBytes += bytes;
            if (bytes > MAX_EVENT_BYTES || outputBytes > MAX_OUTPUT_BYTES) {
              finish(gatewayFailure("OpenClaw output exceeded the bound"));
              return;
            }
            deltas.push(payload.deltaText);
            emit({
              type: "assistant.delta",
              text: payload.deltaText,
              redaction: { applied: false, count: 0 },
            });
          } else if (payload.state === "final") {
            const finalText = assistantText(payload.message) ?? deltas.join("");
            if (Buffer.byteLength(finalText, "utf8") > MAX_OUTPUT_BYTES) {
              finish(gatewayFailure("OpenClaw output exceeded the bound"));
              return;
            }
            void eventDispatch.then(
              () =>
                finish(
                  {
                    finalText,
                    deltas,
                    runId,
                    sessionRef: binding.effectiveSessionRef,
                  },
                  true,
                ),
              () => finish(gatewayFailure()),
            );
          } else if (payload.state === "aborted")
            finish(gatewayFailure("OpenClaw session turn was cancelled"), true);
          else if (payload.state === "error") finish(gatewayFailure(), true);
          return;
        }
        if (frame.event !== "agent" || payload.stream !== "tool") return;
        if (!isRecord(payload.data)) return;
        const phase = payload.data.phase;
        if (phase !== "start" && phase !== "result") return;
        const tool = safeToolName(payload.data.name);
        const providerActivityId =
          typeof payload.data.toolCallId === "string" &&
          /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(payload.data.toolCallId)
            ? payload.data.toolCallId
            : undefined;
        const startedLocator =
          phase === "start"
            ? extractAdapterRepositoryLocator(
                "openclaw",
                tool.name,
                payload.data.args,
              )
            : undefined;
        let activityId = providerActivityId;
        let locator = providerActivityId
          ? toolLocators.get(providerActivityId)
          : undefined;
        if (
          phase === "start" &&
          startedLocator &&
          !providerActivityId &&
          activeFallbackTool
        ) {
          toolLocators.delete(activeFallbackTool.activityId);
          activeFallbackTool = undefined;
        } else if (phase === "start" && startedLocator) {
          activityId ??= `openclaw-tool-${++fallbackToolSequence}`;
          locator = startedLocator;
          toolLocators.set(activityId, locator);
          if (!providerActivityId)
            activeFallbackTool = { activityId, name: tool.name, locator };
        } else if (
          phase === "result" &&
          !providerActivityId &&
          activeFallbackTool?.name === tool.name
        ) {
          ({ activityId, locator } = activeFallbackTool);
        }
        const event: AdapterTurnEvent = {
          type:
            phase === "start"
              ? "tool.started"
              : payload.data.isError === true
                ? "tool.failed"
                : "tool.completed",
          toolName: tool.name,
          ...(activityId && locator
            ? { activityId, repositoryLocator: locator }
            : {}),
          redaction: {
            applied:
              tool.changed ||
              Object.keys(payload.data).some(
                (key) =>
                  !["phase", "name", "isError", "toolCallId"].includes(key),
              ),
            count: 1,
          },
        };
        emit(event);
        if (phase === "result" && activityId) toolLocators.delete(activityId);
        if (phase === "result" && activeFallbackTool?.activityId === activityId)
          activeFallbackTool = undefined;
      });
      removeFailure = connection.onFailure((error) => finish(error));
    });
    void terminal.catch(() => undefined);
    try {
      if (context?.signal?.aborted)
        throw gatewayFailure("OpenClaw session turn was cancelled");
      mayHaveAdmitted = true;
      await connection.request("sessions.send", {
        key: binding.rootSessionRef,
        message: text,
        timeoutMs: this.#options.turnTimeoutMs ?? 120_000,
        idempotencyKey: runId,
      });
      return await terminal;
    } catch (error) {
      if (mayHaveAdmitted && !terminalConfirmed && !abortConfirmed)
        binding.quarantined = true;
      throw error instanceof GatewayError ? error : gatewayFailure();
    } finally {
      if (timeout) clearTimeout(timeout);
      removeAbort?.();
      unsubscribe?.();
      removeFailure?.();
      connection.close();
      this.#busy.delete(binding.effectiveSessionRef);
      this.#activeRuns.delete(runId);
    }
  }

  async interrupt(runId: string): Promise<void> {
    boundedRef(runId, "OpenClaw run identity");
    const binding = this.#activeRuns.get(runId);
    if (!binding)
      throw new GatewayError(
        "conflict",
        "OpenClaw run identity is not active in this World",
      );
    const connection = await this.#connection();
    try {
      const result = await connection.request("sessions.abort", {
        key: binding.rootSessionRef,
        runId,
      });
      if (!isRecord(result) || result.ok !== true)
        throw gatewayFailure("OpenClaw run cancellation was not confirmed");
    } finally {
      connection.close();
    }
  }

  async endWorldSession(
    worldInstanceId: string,
    rootSessionRef: string,
  ): Promise<void> {
    const binding = this.#ownedBinding(rootSessionRef, worldInstanceId);
    if (this.#busy.has(binding.effectiveSessionRef))
      throw new GatewayError(
        "conflict",
        "OpenClaw session still has an active World turn",
      );
    const connection = await this.#connection();
    try {
      const result = await connection.request("sessions.delete", {
        key: binding.rootSessionRef,
        expectedSessionId: binding.effectiveSessionRef,
        deleteTranscript: true,
      });
      if (!isRecord(result) || result.ok !== true || result.deleted !== true)
        throw gatewayFailure(
          "OpenClaw owned session teardown was not confirmed",
        );
      binding.ended = true;
      this.#bindingsByRoot.delete(binding.rootSessionRef);
      this.#bindingsByEffective.delete(binding.effectiveSessionRef);
    } finally {
      connection.close();
    }
  }
}

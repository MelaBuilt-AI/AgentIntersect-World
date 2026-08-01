import type {
  ImportedAvatarModularSource,
  ImportedAvatarOriginalSource,
} from "@agentintersect-world/avatar-system/imported-avatar";

type ApiEnvelope<T> = { readonly ok: true; readonly data: T };

export type SessionCapability = {
  readonly adapterId: string;
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly unavailable: Readonly<Record<string, string>>;
};

export type NativeSession = {
  readonly id: string;
  readonly source: string;
  readonly title: string;
  readonly displayName?: string;
  readonly messageCount?: number;
};

export type WorldAgentSession = {
  readonly schema: "aiw.agent-session/0.12";
  readonly sessionId: string;
  readonly adapterId: string;
  readonly adapterSessionRef: string;
  readonly profile: string;
  readonly workspaceId: string;
  readonly repositoryRef: string;
  readonly mode: "explore" | "collaborate" | "autonomous" | "guided-build";
  readonly permissionRevision: number;
  readonly capabilitySnapshotHash: string;
  readonly continuity: string;
  readonly status: string;
  readonly [key: string]: unknown;
};

export type DesignPreview = {
  readonly relativePath: string;
  readonly name: string;
  readonly validation: string;
  readonly phaseHeadings: readonly string[];
  readonly acceptanceHeadings: readonly string[];
};

export type AvatarProposal = {
  readonly schema: "aiw.avatar-proposal/0.12";
  readonly proposalId: string;
  readonly sessionId: string;
  readonly displayName: string;
  readonly species: "human" | "dog" | "cat";
  readonly head: "round" | "angular" | "dog" | "cat";
  readonly hands: "hands" | "paws" | "claws";
  readonly feet: "feet" | "paws" | "claws";
  readonly fur: "none" | "short" | "long";
  readonly tail: "none" | "dog" | "cat";
  readonly markings: "solid" | "tuxedo" | "points" | "patches";
  readonly bodyColor: string;
  readonly shirt: "Codex" | "Hermes" | "AgentIntersect" | "World";
  readonly movementStyle: "shared-biped-core";
  readonly sourceDisclosure: string;
  readonly rationale: string;
  readonly createdAt: string;
  readonly avatarSource?:
    ImportedAvatarOriginalSource | ImportedAvatarModularSource;
};

export type SessionHistory = {
  readonly sessionId: string;
  readonly continuity: string;
  readonly messages: readonly {
    readonly role: "user" | "assistant";
    readonly text: string;
  }[];
  readonly transcriptAuthority: "hermes";
  readonly avatarConsent: null | {
    readonly state: "accepted" | "declined" | "revoked";
    readonly current?: AvatarProposal | null;
    readonly previous?: AvatarProposal | null;
  };
};

export type WorldAgentEvent = {
  readonly schema: "aiw.agent-event/0.12";
  readonly eventId: string;
  readonly sessionId: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly type:
    | "message.user-accepted"
    | "message.assistant-delta"
    | "message.assistant-final"
    | "tool.started"
    | "tool.completed"
    | "tool.failed";
  readonly payload: Readonly<Record<string, unknown>>;
  readonly redaction: { readonly applied: boolean; readonly count: number };
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

async function consumeSse(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
  onEvent: (event: string, data: unknown) => Promise<void>,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let name = "";
  let dataLines: string[] = [];
  let frameBytes = 0;
  let totalBytes = 0;
  let events = 0;
  const fail = (message: string): never => {
    throw new Error(message);
  };
  const dispatch = async () => {
    if (!name && dataLines.length === 0) {
      frameBytes = 0;
      return;
    }
    events += 1;
    if (events > 4_096) fail("World stream exceeded its event limit.");
    if (!name || dataLines.length === 0)
      fail("World stream contained a malformed event.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(dataLines.join("\n"));
    } catch {
      fail("World stream contained malformed JSON.");
    }
    await onEvent(name, parsed);
    name = "";
    dataLines = [];
    frameBytes = 0;
  };
  const line = async (raw: string) => {
    const value = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    frameBytes += utf8Bytes(value) + 1;
    if (frameBytes > 32_768) fail("World stream event exceeded its limit.");
    if (!value) {
      await dispatch();
      return;
    }
    if (value.startsWith(":")) return;
    const separator = value.indexOf(":");
    const field = separator === -1 ? value : value.slice(0, separator);
    let fieldValue = separator === -1 ? "" : value.slice(separator + 1);
    if (fieldValue.startsWith(" ")) fieldValue = fieldValue.slice(1);
    if (field === "event") name = fieldValue;
    else if (field === "data") dataLines.push(fieldValue);
    else if (field !== "id" && field !== "retry")
      fail("World stream contained an unsupported SSE field.");
  };
  try {
    while (true) {
      if (signal?.aborted) fail("World session stream disconnected.");
      const next = await reader.read();
      if (next.done) break;
      totalBytes += next.value.byteLength;
      if (totalBytes > 1_048_576) fail("World stream exceeded its byte limit.");
      try {
        buffer += decoder.decode(next.value, { stream: true });
      } catch {
        fail("World stream was not valid UTF-8.");
      }
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const current = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        await line(current);
        newline = buffer.indexOf("\n");
      }
      if (utf8Bytes(buffer) > 32_768)
        fail("World stream event exceeded its limit.");
    }
    try {
      buffer += decoder.decode();
    } catch {
      fail("World stream was not valid UTF-8.");
    }
    if (buffer) await line(buffer);
    if (name || dataLines.length > 0)
      fail("World stream ended with an incomplete event.");
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
}

function worldEvent(value: unknown, sessionId: string): WorldAgentEvent {
  if (
    !record(value) ||
    value.schema !== "aiw.agent-event/0.12" ||
    value.sessionId !== sessionId ||
    typeof value.eventId !== "string" ||
    typeof value.sequence !== "number" ||
    typeof value.occurredAt !== "string" ||
    typeof value.correlationId !== "string" ||
    typeof value.type !== "string" ||
    !record(value.payload) ||
    !record(value.redaction) ||
    typeof value.redaction.applied !== "boolean" ||
    typeof value.redaction.count !== "number"
  )
    throw new Error("World stream event contract is invalid.");
  const type = value.type as WorldAgentEvent["type"];
  const textTypes = new Set([
    "message.user-accepted",
    "message.assistant-delta",
    "message.assistant-final",
  ]);
  const toolTypes = new Set(["tool.started", "tool.completed", "tool.failed"]);
  if (textTypes.has(type)) {
    if (
      Object.keys(value.payload).some((key) => key !== "text") ||
      typeof value.payload.text !== "string" ||
      utf8Bytes(value.payload.text) > 16_384
    )
      throw new Error("World stream text event is invalid.");
  } else if (toolTypes.has(type)) {
    if (
      Object.keys(value.payload).some((key) => key !== "toolName") ||
      typeof value.payload.toolName !== "string" ||
      !/^[A-Za-z0-9._-]{1,64}$/.test(value.payload.toolName)
    )
      throw new Error("World stream tool event is invalid.");
  } else throw new Error("World stream event type is unsupported.");
  return value as WorldAgentEvent;
}

async function data<T>(response: Response): Promise<T> {
  const body = (await response.json()) as
    ApiEnvelope<T> | { readonly error?: { readonly message?: string } };
  if (!response.ok || !("ok" in body) || body.ok !== true)
    throw new Error(
      "error" in body
        ? (body.error?.message ?? "World request failed")
        : "World request failed",
    );
  return body.data;
}

export class AgentSessionClient {
  readonly #fetcher: typeof fetch;

  constructor(fetcher: typeof fetch = globalThis.fetch) {
    this.#fetcher = (input, init) => fetcher(input, init);
  }

  capabilities(): Promise<readonly SessionCapability[]> {
    return this.get("/api/agent-sessions/capabilities");
  }

  nativeSessions(adapterId: string): Promise<readonly NativeSession[]> {
    return this.get(
      `/api/agent-sessions/native?adapterId=${encodeURIComponent(adapterId)}`,
    );
  }

  designs(): Promise<readonly DesignPreview[]> {
    return this.get("/api/guided-build/designs");
  }

  status(sessionId: string): Promise<WorldAgentSession> {
    return this.get(`/api/agent-sessions/${sessionId}/status`);
  }

  history(sessionId: string): Promise<SessionHistory> {
    return this.get(`/api/agent-sessions/${sessionId}/history`);
  }

  avatarProposal(sessionId: string): Promise<AvatarProposal | null> {
    return this.get(`/api/agent-sessions/${sessionId}/avatar-proposal`);
  }

  avatarConsent(
    sessionId: string,
    decision: "accepted" | "declined",
    proposal: unknown,
  ): Promise<{ readonly state: string }> {
    return this.post(`/api/agent-sessions/${sessionId}/avatar-consent`, {
      decision,
      proposal,
    });
  }

  revokeAvatarConsent(sessionId: string): Promise<{ readonly state: string }> {
    return this.delete(`/api/agent-sessions/${sessionId}/avatar-consent`);
  }

  attach(input: {
    readonly adapterId: string;
    readonly adapterSessionRef: string;
    readonly profile: string;
    readonly workspaceId: string;
    readonly repositoryRef: string;
    readonly mode: "explore" | "collaborate";
    readonly modeConfirmed?: boolean;
  }): Promise<WorldAgentSession> {
    return this.post("/api/agent-sessions/attach", input);
  }

  send(
    session: WorldAgentSession,
    text: string,
  ): Promise<{
    readonly finalText: string;
    readonly deltas: readonly string[];
    readonly runId?: string;
  }> {
    return this.post(`/api/agent-sessions/${session.sessionId}/messages`, {
      text,
      binding: session,
    });
  }

  async stream(
    session: WorldAgentSession,
    text: string,
    options: {
      readonly onEvent?: (event: WorldAgentEvent) => Promise<void> | void;
      readonly signal?: AbortSignal;
      readonly userDisplayName?: string;
    } = {},
  ): Promise<{
    readonly finalText: string;
    readonly deltas: readonly string[];
  }> {
    const signal = options.signal;
    let response: Response;
    try {
      response = await this.#fetcher(
        `/api/agent-sessions/${session.sessionId}/stream`,
        {
          method: "POST",
          headers: {
            accept: "text/event-stream",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            text,
            binding: session,
            ...(options.userDisplayName
              ? { context: { userDisplayName: options.userDisplayName } }
              : {}),
          }),
          ...(signal ? { signal } : {}),
        },
      );
    } catch {
      throw new Error("World session stream disconnected.");
    }
    if (!response.ok)
      throw new Error(`World session stream failed (${response.status}).`);
    if (
      !response.headers.get("content-type")?.startsWith("text/event-stream") ||
      !response.body
    )
      throw new Error("World session stream response is invalid.");
    let lastSequence: number | null = null;
    let finalText = "";
    let terminalStatus: "completed" | "error" | null = null;
    let streamError = "";
    const deltas: string[] = [];
    await consumeSse(response.body, signal, async (eventName, value) => {
      if (eventName === "world.event") {
        const event = worldEvent(value, session.sessionId);
        if (lastSequence !== null && event.sequence !== lastSequence + 1)
          throw new Error("World stream event sequence is invalid.");
        lastSequence = event.sequence;
        if (event.type === "message.assistant-delta")
          deltas.push(String(event.payload.text));
        await options.onEvent?.(event);
        return;
      }
      if (!record(value) || value.sessionId !== session.sessionId)
        throw new Error("World stream terminal session identity is invalid.");
      if (eventName === "world.final") {
        if (
          finalText ||
          value.schema !== "aiw.agent-stream-terminal/0.12" ||
          value.status !== "completed" ||
          typeof value.finalText !== "string" ||
          utf8Bytes(value.finalText) > 16_384
        )
          throw new Error("World stream final event is invalid.");
        finalText = value.finalText;
        return;
      }
      if (eventName === "world.error") {
        if (
          value.schema !== "aiw.agent-stream-terminal/0.12" ||
          value.status !== "error" ||
          typeof value.message !== "string" ||
          utf8Bytes(value.message) > 240
        )
          throw new Error("World stream error event is invalid.");
        streamError = value.message;
        return;
      }
      if (eventName === "world.done") {
        if (
          terminalStatus ||
          value.schema !== "aiw.agent-stream-terminal/0.12" ||
          (value.status !== "completed" && value.status !== "error")
        )
          throw new Error("World stream terminal event is invalid.");
        terminalStatus = value.status;
        return;
      }
      throw new Error("World stream event type is unsupported.");
    });
    if (terminalStatus === "error")
      throw new Error(streamError || "World session turn failed.");
    if (terminalStatus !== "completed" || !finalText)
      throw new Error("World session stream ended without a final response.");
    return { finalText, deltas };
  }

  async get<T>(url: string): Promise<T> {
    return data<T>(
      await this.#fetcher(url, { headers: { accept: "application/json" } }),
    );
  }

  async post<T>(url: string, body: unknown): Promise<T> {
    return data<T>(
      await this.#fetcher(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  }

  async delete<T>(url: string): Promise<T> {
    return data<T>(
      await this.#fetcher(url, {
        method: "DELETE",
        headers: { accept: "application/json" },
      }),
    );
  }
}

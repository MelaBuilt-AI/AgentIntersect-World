import type {
  ImportedAvatarModularSource,
  ImportedAvatarOriginalSource,
} from "@agentintersect-world/avatar-system/imported-avatar";

type ApiEnvelope<T> = { readonly ok: true; readonly data: T };

export type Phase19AdapterId = "hermes" | "openclaw" | "codex" | "claude-code";

export type SessionCapability = {
  readonly adapterId: Phase19AdapterId;
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
  readonly adapterId: Phase19AdapterId;
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

export type AgentRepositoryWorkFocus = {
  readonly schema: "aiw.agent-work-focus/0.19";
  readonly activityId: string;
  readonly rosterId: string;
  readonly worldSessionId: string;
  readonly repositoryRef: string;
  readonly objectRef: string;
  readonly objectKind: "symbol" | "file" | "directory" | "package";
  readonly repositoryPath: string;
  readonly layoutGeneration: string;
  readonly movementRequestId: string | null;
  readonly source: "structured-tool-event" | "workstream-binding";
  readonly state:
    | "targeted"
    | "navigating"
    | "coding"
    | "completed"
    | "failed"
    | "cancelled"
    | "stale";
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
  readonly transcriptAuthority: Phase19AdapterId | "world-projection";
  readonly avatarConsent: null | {
    readonly state: "accepted" | "declined" | "revoked";
    readonly current?: AvatarProposal | null;
    readonly previous?: AvatarProposal | null;
  };
};

export type ConstellationAvatar = {
  readonly status: "missing" | "editing" | "accepted";
  readonly profileId: string | null;
  readonly sessionId: string | null;
};

export type ConstellationAgent = {
  readonly rosterId: string;
  readonly adapterId: Phase19AdapterId;
  readonly sessionOwnership: "operator-persistent" | "world-owned";
  readonly worldSessionId: string;
  readonly worldInstanceId: string;
  readonly nativeRootSessionRef: string;
  readonly displayName: string;
  readonly continuity:
    "current" | "previous-recovered" | "stale" | "unavailable";
  readonly connection: "connecting" | "connected" | "stale" | "unavailable";
  readonly avatar: ConstellationAvatar;
  readonly addedOrder: number;
};

export type ConstellationState = {
  readonly projection: {
    readonly schema: "aiw.constellation/0.19";
    readonly mode: "multi-agent";
    readonly worldInstanceId: string;
    readonly lifecycle: "assembling" | "active" | "ending" | "ended";
    readonly revision: number;
    readonly agents: readonly ConstellationAgent[];
    readonly entryReady: boolean;
    readonly truth: "current" | "previous-recovered";
  };
  readonly terminalOutcomes: readonly {
    readonly rosterId: string;
    readonly status: "skipped-operator-persistent" | "ended" | "failed";
  }[];
  readonly unavailableReason: null;
};

export type ConstellationMutation = {
  readonly worldInstanceId: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
};

export type ConstellationMessageRecipient = {
  readonly rosterId: string;
  readonly worldSessionId: string;
  readonly state:
    | "queued"
    | "streaming"
    | "completed"
    | "unavailable"
    | "failed"
    | "cancelled"
    | "interrupted";
  readonly finalText: string | null;
  readonly errorLabel: string | null;
};

export type ConstellationMessageGroup = {
  readonly schema: "aiw.constellation-message/0.19";
  readonly groupId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly text: string;
  readonly target:
    | { readonly kind: "broadcast" }
    | { readonly kind: "agent"; readonly rosterId: string };
  readonly recipientRosterIds: readonly string[];
  readonly recipients: readonly ConstellationMessageRecipient[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AddConstellationAgentInput = ConstellationMutation & {
  readonly agent: Pick<
    ConstellationAgent,
    | "rosterId"
    | "adapterId"
    | "sessionOwnership"
    | "worldSessionId"
    | "nativeRootSessionRef"
    | "displayName"
  >;
};

export type SetConstellationAvatarInput = ConstellationMutation & {
  readonly avatar: ConstellationAvatar;
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

const WORK_FOCUS_KEYS = new Set([
  "schema",
  "activityId",
  "rosterId",
  "worldSessionId",
  "repositoryRef",
  "objectRef",
  "objectKind",
  "repositoryPath",
  "layoutGeneration",
  "movementRequestId",
  "source",
  "state",
]);

function repositoryWorkFocus(value: unknown): AgentRepositoryWorkFocus | null {
  if (value === null) return null;
  if (
    !record(value) ||
    Object.keys(value).some((key) => !WORK_FOCUS_KEYS.has(key)) ||
    value.schema !== "aiw.agent-work-focus/0.19" ||
    !["symbol", "file", "directory", "package"].includes(
      String(value.objectKind),
    ) ||
    !["structured-tool-event", "workstream-binding"].includes(
      String(value.source),
    ) ||
    ![
      "targeted",
      "navigating",
      "coding",
      "completed",
      "failed",
      "cancelled",
      "stale",
    ].includes(String(value.state)) ||
    typeof value.repositoryPath !== "string" ||
    value.repositoryPath.length === 0 ||
    value.repositoryPath.startsWith("/") ||
    value.repositoryPath.includes("\\") ||
    /(?:^|\/)\.\.(?:\/|$)/u.test(value.repositoryPath) ||
    [...value.repositoryPath].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    }) ||
    typeof value.layoutGeneration !== "string" ||
    !/^layout-[0-9a-f]{64}$/u.test(value.layoutGeneration) ||
    (value.movementRequestId !== null &&
      typeof value.movementRequestId !== "string") ||
    [
      value.activityId,
      value.rosterId,
      value.worldSessionId,
      value.repositoryRef,
      value.objectRef,
    ].some((field) => typeof field !== "string" || field.length === 0)
  )
    throw new Error("World repository work focus is invalid.");
  return value as AgentRepositoryWorkFocus;
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
      Object.keys(value.payload).some(
        (key) => !["toolName", "repositoryPath", "activityId"].includes(key),
      ) ||
      typeof value.payload.toolName !== "string" ||
      !/^[A-Za-z0-9._-]{1,64}$/.test(value.payload.toolName) ||
      (value.payload.repositoryPath !== undefined &&
        (typeof value.payload.repositoryPath !== "string" ||
          value.payload.repositoryPath.length === 0 ||
          value.payload.repositoryPath.length > 512 ||
          /^(?:[/\\]|[a-z]:)/iu.test(value.payload.repositoryPath) ||
          value.payload.repositoryPath.split(/[/\\]/u).includes(".."))) ||
      (value.payload.activityId !== undefined &&
        (typeof value.payload.activityId !== "string" ||
          value.payload.activityId.length === 0 ||
          value.payload.activityId.length > 512))
    )
      throw new Error("World stream tool event is invalid.");
  } else throw new Error("World stream event type is unsupported.");
  return value as WorldAgentEvent;
}

function constellationMessageGroup(value: unknown): ConstellationMessageGroup {
  const terminalStates = new Set([
    "queued",
    "streaming",
    "completed",
    "unavailable",
    "failed",
    "cancelled",
    "interrupted",
  ]);
  if (
    !record(value) ||
    value.schema !== "aiw.constellation-message/0.19" ||
    typeof value.groupId !== "string" ||
    typeof value.requestId !== "string" ||
    typeof value.correlationId !== "string" ||
    typeof value.text !== "string" ||
    !record(value.target) ||
    !Array.isArray(value.recipientRosterIds) ||
    !Array.isArray(value.recipients) ||
    value.recipients.length < 1 ||
    value.recipients.length > 4 ||
    value.recipients.length !== value.recipientRosterIds.length ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  )
    throw new Error("Constellation message response is invalid.");
  if (
    (value.target.kind !== "broadcast" && value.target.kind !== "agent") ||
    (value.target.kind === "agent" && typeof value.target.rosterId !== "string")
  )
    throw new Error("Constellation message target is invalid.");
  for (const [index, recipient] of value.recipients.entries()) {
    if (
      !record(recipient) ||
      typeof recipient.rosterId !== "string" ||
      recipient.rosterId !== value.recipientRosterIds[index] ||
      typeof recipient.worldSessionId !== "string" ||
      typeof recipient.state !== "string" ||
      !terminalStates.has(recipient.state) ||
      (recipient.finalText !== null &&
        typeof recipient.finalText !== "string") ||
      (recipient.errorLabel !== null &&
        typeof recipient.errorLabel !== "string")
    )
      throw new Error("Constellation message recipient is invalid.");
  }
  return value as ConstellationMessageGroup;
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

  nativeSessions(
    adapterId: Phase19AdapterId,
  ): Promise<readonly NativeSession[]> {
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

  async workFocus(
    sessionId: string,
  ): Promise<{ readonly focus: AgentRepositoryWorkFocus | null }> {
    const response = await this.get<{ readonly focus: unknown }>(
      `/api/agent-sessions/${sessionId}/work-focus`,
    );
    return { focus: repositoryWorkFocus(response.focus) };
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

  currentConstellation(): Promise<ConstellationState> {
    return this.get("/api/constellation/current");
  }

  addConstellationAgent(
    input: AddConstellationAgentInput,
  ): Promise<ConstellationState> {
    return this.post("/api/constellation/agents", input);
  }

  reconnectConstellationAgent(
    rosterId: string,
    input: ConstellationMutation,
  ): Promise<ConstellationState> {
    return this.post(
      `/api/constellation/agents/${encodeURIComponent(rosterId)}/reconnect`,
      input,
    );
  }

  removeConstellationAgent(
    rosterId: string,
    input: ConstellationMutation,
  ): Promise<ConstellationState> {
    return this.delete(
      `/api/constellation/agents/${encodeURIComponent(rosterId)}`,
      input,
    );
  }

  setConstellationAvatar(
    rosterId: string,
    input: SetConstellationAvatarInput,
  ): Promise<ConstellationState> {
    return this.post(
      `/api/constellation/agents/${encodeURIComponent(rosterId)}/avatar`,
      input,
    );
  }

  endConstellation(input: ConstellationMutation): Promise<ConstellationState> {
    return this.post("/api/constellation/end", input);
  }

  async sendGrouped(
    text: string,
    options: {
      readonly requestId: string;
      readonly idempotencyKey: string;
      readonly targetRosterId?: string;
      readonly userDisplayName?: string;
      readonly intent?: "discussion" | "work";
      readonly signal?: AbortSignal;
    },
  ): Promise<ConstellationMessageGroup> {
    const response = await this.#fetcher("/api/constellation/messages", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...(options.intent ? { intent: options.intent } : {}),
        requestId: options.requestId,
        idempotencyKey: options.idempotencyKey,
        text,
        ...(options.targetRosterId
          ? { targetRosterId: options.targetRosterId }
          : {}),
        ...(options.userDisplayName
          ? { userDisplayName: options.userDisplayName }
          : {}),
      }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return constellationMessageGroup(
      await data<ConstellationMessageGroup>(response),
    );
  }

  async messageGroups(): Promise<readonly ConstellationMessageGroup[]> {
    const groups = await this.get<readonly unknown[]>(
      "/api/constellation/messages",
    );
    if (!Array.isArray(groups))
      throw new Error("Constellation message groups are invalid.");
    return groups.map(constellationMessageGroup);
  }

  async messageGroup(requestId: string): Promise<ConstellationMessageGroup> {
    return constellationMessageGroup(
      await this.get<unknown>(
        `/api/constellation/messages/${encodeURIComponent(requestId)}`,
      ),
    );
  }

  attach(input: {
    readonly adapterId: string;
    readonly adapterSessionRef: string;
    readonly profile: string;
    readonly workspaceId: string;
    readonly repositoryRef: string;
    readonly mode: "explore" | "collaborate";
    readonly modeConfirmed?: boolean;
    readonly worldInstanceId?: string;
  }): Promise<WorldAgentSession> {
    return this.post("/api/agent-sessions/attach", input);
  }

  createWorldSession(input: {
    readonly adapterId: Exclude<Phase19AdapterId, "hermes">;
    readonly worldInstanceId: string;
    readonly displayName: string;
    readonly profile: string;
    readonly workspaceId: string;
    readonly repositoryRef: string;
    readonly mode: "explore" | "collaborate";
    readonly modeConfirmed?: boolean;
  }): Promise<WorldAgentSession> {
    return this.post("/api/agent-sessions/world", input);
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
      readonly intent?: "discussion" | "work";
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
            ...(options.intent ? { intent: options.intent } : {}),
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

  async delete<T>(url: string, body?: unknown): Promise<T> {
    return data<T>(
      await this.#fetcher(url, {
        method: "DELETE",
        headers: {
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  }
}

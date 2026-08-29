import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  copyFile,
  mkdir,
  open,
  readFile,
  rename,
  stat,
} from "node:fs/promises";
import path from "node:path";

import {
  ConstellationMessageGroupSchema,
  isConstellationMessageGroupComplete,
  type ConstellationAgent,
  type ConstellationMessageGroup,
} from "@agentintersect-world/agent-session-protocol";

import { GatewayError, type AgentSessionGateway } from "./agent-sessions.js";
import type { ConstellationService } from "./constellation-service.js";

const MAX_RECORDS = 128;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export type ConstellationMessageRequest = {
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly text: string;
  readonly targetRosterId?: string;
  readonly userDisplayName?: string;
};

type MessageGateway = Pick<AgentSessionGateway, "status" | "sendText">;

type MessageRecord = {
  readonly idempotencyKey: string;
  readonly inputHash: string;
  readonly group: ConstellationMessageGroup;
};

type StorePayload = { readonly records: readonly MessageRecord[] };

type StoreEnvelope = {
  readonly schema: "aiw.constellation-message-store/0.19";
  readonly generation: number;
  readonly payload: StorePayload;
  readonly checksum: string;
};

type DispatchRecipient = {
  readonly rosterId: string;
  readonly worldSessionId: string;
};

export class ConstellationMessageServiceError extends Error {
  constructor(
    readonly code:
      | "validation"
      | "not_found"
      | "conflict"
      | "resource_limit"
      | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "ConstellationMessageServiceError";
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateOpaque(value: unknown, field: string, maximum = 256): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    !OPAQUE_ID.test(value)
  )
    throw new ConstellationMessageServiceError(
      "validation",
      `${field} is invalid`,
    );
  return value;
}

function validateRequest(input: ConstellationMessageRequest): void {
  if (!isRecord(input))
    throw new ConstellationMessageServiceError(
      "validation",
      "Message request is invalid",
    );
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      input.requestId,
    )
  )
    throw new ConstellationMessageServiceError(
      "validation",
      "requestId is invalid",
    );
  validateOpaque(input.idempotencyKey, "idempotencyKey", 128);
  if (
    typeof input.text !== "string" ||
    input.text.trim().length === 0 ||
    Buffer.byteLength(input.text, "utf8") > 16_384
  )
    throw new ConstellationMessageServiceError(
      "validation",
      "Message text is invalid",
    );
  if (input.targetRosterId !== undefined)
    validateOpaque(input.targetRosterId, "targetRosterId");
  if (
    input.userDisplayName !== undefined &&
    (typeof input.userDisplayName !== "string" ||
      input.userDisplayName.trim().length === 0 ||
      Buffer.byteLength(input.userDisplayName, "utf8") > 80)
  )
    throw new ConstellationMessageServiceError(
      "validation",
      "userDisplayName is invalid",
    );
}

function normalizeName(value: string): string {
  // Leading mentions use exact NFKC + case-folded display-name equality.
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function readyAgents(
  constellation: ConstellationService,
): ConstellationAgent[] {
  const current = constellation.current();
  if (!current.projection)
    throw new ConstellationMessageServiceError(
      "unavailable",
      "Constellation state is unavailable",
    );
  return [...current.projection.agents]
    .filter(
      (agent) =>
        agent.connection === "connected" &&
        (agent.continuity === "current" ||
          agent.continuity === "previous-recovered") &&
        agent.avatar.status === "accepted",
    )
    .sort((left, right) => left.addedOrder - right.addedOrder);
}

function resolveRecipients(
  agents: readonly ConstellationAgent[],
  request: ConstellationMessageRequest,
): {
  readonly recipients: readonly ConstellationAgent[];
  readonly text: string;
  readonly target: ConstellationMessageGroup["target"];
} {
  if (request.targetRosterId !== undefined) {
    const selected = agents.find(
      (agent) => agent.rosterId === request.targetRosterId,
    );
    if (!selected)
      throw new ConstellationMessageServiceError(
        "not_found",
        "Message target was not found",
      );
    return {
      recipients: [selected],
      text: request.text.trim(),
      target: { kind: "agent", rosterId: selected.rosterId },
    };
  }

  const trimmed = request.text.trim();
  if (trimmed.startsWith("@")) {
    const matches = agents.flatMap((agent) => {
      const expected = normalizeName(agent.displayName);
      const endpoints: number[] = [];
      const maximum = Math.min(trimmed.length, 82);
      for (let endpoint = 2; endpoint <= maximum; endpoint += 1) {
        if (
          normalizeName(trimmed.slice(1, endpoint)) === expected &&
          (endpoint === trimmed.length || /\s/u.test(trimmed[endpoint] ?? ""))
        )
          endpoints.push(endpoint);
      }
      const endpoint = endpoints.at(-1);
      return endpoint === undefined ? [] : [{ agent, endpoint }];
    });
    if (matches.length === 0)
      throw new ConstellationMessageServiceError(
        "not_found",
        "Message target was not found",
      );
    const longest = Math.max(...matches.map(({ endpoint }) => endpoint));
    const exactMatches = matches.filter(({ endpoint }) => endpoint === longest);
    if (exactMatches.length > 1)
      throw new ConstellationMessageServiceError(
        "conflict",
        "Message target is ambiguous",
      );
    const selected = exactMatches[0]!;
    const text = trimmed.slice(selected.endpoint).trim();
    if (!text)
      throw new ConstellationMessageServiceError(
        "validation",
        "Message text is invalid",
      );
    return {
      recipients: [selected.agent],
      text,
      target: { kind: "agent", rosterId: selected.agent.rosterId },
    };
  }

  if (agents.length === 0)
    throw new ConstellationMessageServiceError(
      "unavailable",
      "No ready constellation recipients are available",
    );
  return {
    recipients: agents,
    text: request.text.trim(),
    target: { kind: "broadcast" },
  };
}

function parsePayload(value: unknown): StorePayload {
  if (
    !isRecord(value) ||
    !Array.isArray(value.records) ||
    value.records.length > MAX_RECORDS
  )
    throw new Error("Invalid constellation message records");
  const seenKeys = new Set<string>();
  const seenRequests = new Set<string>();
  const records = value.records.map((item) => {
    if (!isRecord(item))
      throw new Error("Invalid constellation message record");
    const idempotencyKey = validateOpaque(
      item.idempotencyKey,
      "idempotencyKey",
      128,
    );
    if (
      typeof item.inputHash !== "string" ||
      !/^[a-f0-9]{64}$/u.test(item.inputHash)
    )
      throw new Error("Invalid constellation message input hash");
    const group = ConstellationMessageGroupSchema.parse(item.group);
    if (seenKeys.has(idempotencyKey) || seenRequests.has(group.requestId))
      throw new Error("Duplicate constellation message identity");
    seenKeys.add(idempotencyKey);
    seenRequests.add(group.requestId);
    return { idempotencyKey, inputHash: item.inputHash, group };
  });
  return { records };
}

function parseEnvelope(input: string): StoreEnvelope {
  const value: unknown = JSON.parse(input);
  if (
    !isRecord(value) ||
    value.schema !== "aiw.constellation-message-store/0.19" ||
    !Number.isSafeInteger(value.generation) ||
    (value.generation as number) < 1 ||
    typeof value.checksum !== "string"
  )
    throw new Error("Invalid constellation message generation");
  const payload = parsePayload(value.payload);
  if (value.checksum !== sha256(canonical(payload)))
    throw new Error("Constellation message checksum mismatch");
  return {
    schema: "aiw.constellation-message-store/0.19",
    generation: value.generation as number,
    payload,
    checksum: value.checksum,
  };
}

async function optionalRead(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return null;
    throw error;
  }
}

async function syncFile(filePath: string): Promise<void> {
  const handle = await open(filePath, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(directory: string): Promise<void> {
  try {
    await syncFile(directory);
  } catch {
    // Directory fsync is not portable; same-directory rename remains atomic.
  }
}

function interrupted(
  group: ConstellationMessageGroup,
): ConstellationMessageGroup {
  if (isConstellationMessageGroupComplete(group)) return group;
  return ConstellationMessageGroupSchema.parse({
    ...group,
    recipients: group.recipients.map((recipient) =>
      recipient.state === "queued" || recipient.state === "streaming"
        ? {
            ...recipient,
            state: "interrupted",
            finalText: null,
            errorLabel: "Agent turn interrupted",
          }
        : recipient,
    ),
    updatedAt: new Date().toISOString(),
  });
}

export class ConstellationMessageService {
  readonly #directory: string;
  readonly #currentPath: string;
  readonly #previousPath: string;
  readonly #constellation: ConstellationService;
  readonly #gateway: MessageGateway;
  readonly #sessionTails = new Map<string, Promise<void>>();
  readonly #waiters = new Map<
    string,
    Set<(group: ConstellationMessageGroup) => void>
  >();
  #payload: StorePayload;
  #generation: number;
  #unavailable: boolean;
  #mutationTail: Promise<void> = Promise.resolve();

  private constructor(options: {
    readonly directory: string;
    readonly constellation: ConstellationService;
    readonly gateway: MessageGateway;
    readonly payload: StorePayload;
    readonly generation: number;
    readonly unavailable: boolean;
  }) {
    this.#directory = options.directory;
    this.#currentPath = path.join(
      options.directory,
      "constellation-messages.current.json",
    );
    this.#previousPath = path.join(
      options.directory,
      "constellation-messages.previous.json",
    );
    this.#constellation = options.constellation;
    this.#gateway = options.gateway;
    this.#payload = options.payload;
    this.#generation = options.generation;
    this.#unavailable = options.unavailable;
  }

  static async open(options: {
    readonly directory: string;
    readonly constellation: ConstellationService;
    readonly gateway: MessageGateway;
  }): Promise<ConstellationMessageService> {
    await mkdir(options.directory, { recursive: true, mode: 0o700 });
    await chmod(options.directory, 0o700);
    const currentPath = path.join(
      options.directory,
      "constellation-messages.current.json",
    );
    const previousPath = path.join(
      options.directory,
      "constellation-messages.previous.json",
    );
    const [currentText, previousText] = await Promise.all([
      optionalRead(currentPath),
      optionalRead(previousPath),
    ]);
    let restored: StoreEnvelope | null = null;
    for (const text of [currentText, previousText]) {
      if (text === null || restored) continue;
      try {
        restored = parseEnvelope(text);
      } catch {
        // Try the previous generation before marking authority unavailable.
      }
    }
    const hasInvalidGeneration =
      restored === null && (currentText !== null || previousText !== null);
    const payload = restored?.payload ?? { records: [] };
    const service = new ConstellationMessageService({
      ...options,
      payload,
      generation: restored?.generation ?? 0,
      unavailable: hasInvalidGeneration,
    });
    if (
      restored &&
      payload.records.some(
        ({ group }) => !isConstellationMessageGroupComplete(group),
      )
    ) {
      service.#payload = {
        records: payload.records.map((record) => ({
          ...record,
          group: interrupted(record.group),
        })),
      };
      await service.#persist();
    }
    return service;
  }

  async send(
    request: ConstellationMessageRequest,
  ): Promise<ConstellationMessageGroup> {
    validateRequest(request);
    const created = await this.#enqueueMutation(async () => {
      this.#requireAvailable();
      const inputHash = sha256(canonical(request));
      const replay = this.#payload.records.find(
        (record) => record.idempotencyKey === request.idempotencyKey,
      );
      if (replay) {
        if (replay.inputHash !== inputHash)
          throw new ConstellationMessageServiceError(
            "conflict",
            "Idempotency key was reused with different input",
          );
        return { group: structuredClone(replay.group), dispatch: null };
      }
      if (
        this.#payload.records.some(
          (record) => record.group.requestId === request.requestId,
        )
      )
        throw new ConstellationMessageServiceError(
          "conflict",
          "Request ID was reused",
        );
      const resolved = resolveRecipients(
        readyAgents(this.#constellation),
        request,
      );
      const now = new Date().toISOString();
      const group = ConstellationMessageGroupSchema.parse({
        schema: "aiw.constellation-message/0.19",
        groupId: randomUUID(),
        requestId: request.requestId,
        correlationId: randomUUID(),
        text: resolved.text,
        target: resolved.target,
        recipientRosterIds: resolved.recipients.map(({ rosterId }) => rosterId),
        recipients: resolved.recipients.map(({ rosterId, worldSessionId }) => ({
          rosterId,
          worldSessionId,
          state: "queued",
          finalText: null,
          errorLabel: null,
        })),
        createdAt: now,
        updatedAt: now,
      });
      let retained = this.#payload.records;
      if (retained.length >= MAX_RECORDS) {
        const evict = retained.findIndex(({ group: candidate }) =>
          isConstellationMessageGroupComplete(candidate),
        );
        if (evict < 0)
          throw new ConstellationMessageServiceError(
            "resource_limit",
            "Too many constellation messages are in progress",
          );
        retained = retained.filter((_record, index) => index !== evict);
      }
      this.#payload = {
        records: [
          ...retained,
          { idempotencyKey: request.idempotencyKey, inputHash, group },
        ],
      };
      await this.#persist();
      return {
        group: structuredClone(group),
        dispatch: resolved.recipients.map(({ rosterId, worldSessionId }) => ({
          rosterId,
          worldSessionId,
        })),
      };
    });

    if (created.dispatch)
      for (const recipient of created.dispatch)
        void this.#enqueueSession(recipient.worldSessionId, () =>
          this.#dispatch(
            created.group.groupId,
            recipient,
            created.group.text,
            request.userDisplayName,
          ),
        );
    if (isConstellationMessageGroupComplete(created.group))
      return created.group;
    return this.#waitForTerminal(created.group.groupId);
  }

  get(requestId: string): ConstellationMessageGroup {
    this.#requireAvailable();
    const record = this.#payload.records.find(
      ({ group }) => group.requestId === requestId,
    );
    if (!record)
      throw new ConstellationMessageServiceError(
        "not_found",
        "Message request was not found",
      );
    return structuredClone(record.group);
  }

  list(): readonly ConstellationMessageGroup[] {
    this.#requireAvailable();
    return this.#payload.records.map(({ group }) => structuredClone(group));
  }

  async #dispatch(
    groupId: string,
    recipient: DispatchRecipient,
    text: string,
    userDisplayName: string | undefined,
  ): Promise<void> {
    await this.#updateRecipient(groupId, recipient.rosterId, {
      state: "streaming",
      finalText: null,
      errorLabel: null,
    });
    try {
      const binding = this.#gateway.status(recipient.worldSessionId);
      const result = await this.#gateway.sendText(recipient.worldSessionId, {
        text,
        binding,
        ...(userDisplayName
          ? { context: { userDisplayName: userDisplayName.trim() } }
          : {}),
      });
      await this.#updateRecipient(groupId, recipient.rosterId, {
        state: "completed",
        finalText: result.finalText,
        errorLabel: null,
      });
    } catch (error) {
      const unavailable =
        error instanceof GatewayError &&
        (error.code === "not_found" ||
          error.code === "offline" ||
          error.code === "store_corrupt");
      await this.#updateRecipient(groupId, recipient.rosterId, {
        state: unavailable ? "unavailable" : "failed",
        finalText: null,
        errorLabel: unavailable ? "Agent unavailable" : "Agent turn failed",
      });
    }
  }

  async #updateRecipient(
    groupId: string,
    rosterId: string,
    update: Pick<
      ConstellationMessageGroup["recipients"][number],
      "state" | "finalText" | "errorLabel"
    >,
  ): Promise<void> {
    await this.#enqueueMutation(async () => {
      const index = this.#payload.records.findIndex(
        ({ group }) => group.groupId === groupId,
      );
      const record = this.#payload.records[index];
      if (!record) return;
      const group = ConstellationMessageGroupSchema.parse({
        ...record.group,
        recipients: record.group.recipients.map((recipient) =>
          recipient.rosterId === rosterId
            ? { ...recipient, ...update }
            : recipient,
        ),
        updatedAt: new Date().toISOString(),
      });
      const records = [...this.#payload.records];
      records[index] = { ...record, group };
      this.#payload = { records };
      await this.#persist();
      if (isConstellationMessageGroupComplete(group)) this.#notify(group);
    });
  }

  #waitForTerminal(groupId: string): Promise<ConstellationMessageGroup> {
    const current = this.#payload.records.find(
      ({ group }) => group.groupId === groupId,
    )?.group;
    if (!current)
      return Promise.reject(
        new ConstellationMessageServiceError(
          "not_found",
          "Message request was not found",
        ),
      );
    if (isConstellationMessageGroupComplete(current))
      return Promise.resolve(structuredClone(current));
    return new Promise((resolve) => {
      const waiters = this.#waiters.get(groupId) ?? new Set();
      waiters.add(resolve);
      this.#waiters.set(groupId, waiters);
      const latest = this.#payload.records.find(
        ({ group }) => group.groupId === groupId,
      )?.group;
      if (latest && isConstellationMessageGroupComplete(latest))
        this.#notify(latest);
    });
  }

  #notify(group: ConstellationMessageGroup): void {
    const waiters = this.#waiters.get(group.groupId);
    if (!waiters) return;
    this.#waiters.delete(group.groupId);
    for (const resolve of waiters) resolve(structuredClone(group));
  }

  #enqueueSession<T>(
    sessionId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.#sessionTails.get(sessionId) ?? Promise.resolve();
    const result = previous.then(operation, operation);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.#sessionTails.set(sessionId, tail);
    void tail.finally(() => {
      if (this.#sessionTails.get(sessionId) === tail)
        this.#sessionTails.delete(sessionId);
    });
    return result;
  }

  #enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationTail.then(operation, operation);
    this.#mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  #requireAvailable(): void {
    if (this.#unavailable)
      throw new ConstellationMessageServiceError(
        "unavailable",
        "Constellation message state is unavailable",
      );
  }

  async #persist(): Promise<void> {
    const envelope: StoreEnvelope = {
      schema: "aiw.constellation-message-store/0.19",
      generation: this.#generation + 1,
      payload: this.#payload,
      checksum: sha256(canonical(this.#payload)),
    };
    const temporary = path.join(
      this.#directory,
      `.constellation-messages-${randomUUID()}.tmp`,
    );
    const previousTemporary = path.join(
      this.#directory,
      `.constellation-messages-previous-${randomUUID()}.tmp`,
    );
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(envelope, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await chmod(temporary, 0o600);
    try {
      await stat(this.#currentPath);
      await copyFile(this.#currentPath, previousTemporary);
      await chmod(previousTemporary, 0o600);
      await syncFile(previousTemporary);
      await rename(previousTemporary, this.#previousPath);
    } catch (error) {
      if (!isRecord(error) || error.code !== "ENOENT") throw error;
    }
    await rename(temporary, this.#currentPath);
    await chmod(this.#currentPath, 0o600);
    await syncDirectory(this.#directory);
    this.#generation = envelope.generation;
  }
}

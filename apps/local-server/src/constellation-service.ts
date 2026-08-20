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
  ConstellationAgentSchema,
  ConstellationProjectionSchema,
  deriveConstellationEntryReady,
  type ConstellationAgent,
  type ConstellationProjection,
  type Phase19AdapterId,
} from "@agentintersect-world/agent-session-protocol";

const MAX_IDEMPOTENCY_RECORDS = 128;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export type ConstellationBinding = {
  readonly rosterId: string;
  readonly adapterId: Phase19AdapterId;
  readonly sessionOwnership: "operator-persistent" | "world-owned";
  readonly worldSessionId: string;
  readonly nativeRootSessionRef: string;
  readonly worldInstanceId: string;
};

export type ConstellationBindingValidation = ConstellationBinding & {
  readonly continuity: "current" | "previous-recovered" | "unavailable";
};

export interface ConstellationLifecyclePort {
  validateBinding(
    binding: ConstellationBinding,
  ): Promise<ConstellationBindingValidation>;
  endWorldSession(
    worldSessionId: string,
    worldInstanceId: string,
  ): Promise<void>;
}

export type ConstellationTerminalOutcome = {
  readonly rosterId: string;
  readonly status: "skipped-operator-persistent" | "ended" | "failed";
};

export type ConstellationState = {
  readonly projection: ConstellationProjection;
  readonly terminalOutcomes: readonly ConstellationTerminalOutcome[];
  readonly unavailableReason: null;
};

export type UnavailableConstellationState = {
  readonly projection: null;
  readonly terminalOutcomes: readonly [];
  readonly unavailableReason: "Constellation state is unavailable";
};

type MutationIdentity = {
  readonly worldInstanceId: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
};

export type AddConstellationAgentRequest = MutationIdentity & {
  readonly agent: {
    readonly rosterId: string;
    readonly adapterId: Phase19AdapterId;
    readonly sessionOwnership: "operator-persistent" | "world-owned";
    readonly worldSessionId: string;
    readonly nativeRootSessionRef: string;
    readonly displayName: string;
  };
};

export type ConstellationRosterMutationRequest = MutationIdentity & {
  readonly rosterId: string;
};

export type SetConstellationAvatarRequest =
  ConstellationRosterMutationRequest & {
    readonly avatar: ConstellationAgent["avatar"];
  };

type IdempotencyRecord = {
  readonly key: string;
  readonly operation: string;
  readonly inputHash: string;
  readonly status: "pending" | "completed";
  readonly result: ConstellationState | null;
};

type StorePayload = {
  readonly projection: ConstellationProjection;
  readonly terminalOutcomes: readonly ConstellationTerminalOutcome[];
  readonly idempotency: readonly IdempotencyRecord[];
};

type StoreEnvelope = {
  readonly schema: "aiw.constellation-store/0.19";
  readonly generation: number;
  readonly payload: StorePayload;
  readonly checksum: string;
};

export class ConstellationServiceError extends Error {
  constructor(
    readonly code:
      | "validation"
      | "not_found"
      | "conflict"
      | "revision_conflict"
      | "resource_limit"
      | "unavailable"
      | "upstream",
    message: string,
  ) {
    super(message);
    this.name = "ConstellationServiceError";
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
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
    throw new ConstellationServiceError("validation", `${field} is invalid`);
  return value;
}

function validateMutation(request: MutationIdentity): void {
  validateOpaque(request.worldInstanceId, "worldInstanceId");
  validateOpaque(request.idempotencyKey, "idempotencyKey", 128);
  if (
    !Number.isSafeInteger(request.expectedRevision) ||
    request.expectedRevision < 0
  )
    throw new ConstellationServiceError(
      "validation",
      "expectedRevision is invalid",
    );
}

function parseTerminalOutcomes(
  value: unknown,
): readonly ConstellationTerminalOutcome[] {
  if (!Array.isArray(value) || value.length > 4)
    throw new Error("Invalid terminal outcomes");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("Invalid terminal outcome");
    const rosterId = validateOpaque(item.rosterId, "rosterId");
    if (
      item.status !== "skipped-operator-persistent" &&
      item.status !== "ended" &&
      item.status !== "failed"
    )
      throw new Error("Invalid terminal outcome");
    return { rosterId, status: item.status };
  });
}

function parseState(value: unknown): ConstellationState {
  if (!isRecord(value)) throw new Error("Invalid constellation result");
  return {
    projection: ConstellationProjectionSchema.parse(value.projection),
    terminalOutcomes: parseTerminalOutcomes(value.terminalOutcomes),
    unavailableReason: null,
  };
}

function parseIdempotency(value: unknown): readonly IdempotencyRecord[] {
  if (!Array.isArray(value) || value.length > MAX_IDEMPOTENCY_RECORDS)
    throw new Error("Invalid idempotency records");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("Invalid idempotency record");
    const key = validateOpaque(item.key, "idempotencyKey", 128);
    const operation = validateOpaque(item.operation, "operation", 64);
    if (
      typeof item.inputHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(item.inputHash) ||
      (item.status !== "pending" && item.status !== "completed")
    )
      throw new Error("Invalid idempotency record");
    const result = item.result === null ? null : parseState(item.result);
    if (item.status === "completed" && result === null)
      throw new Error("Completed idempotency record has no result");
    return {
      key,
      operation,
      inputHash: item.inputHash,
      status: item.status,
      result,
    };
  });
}

function parseEnvelope(input: string): StoreEnvelope {
  const value: unknown = JSON.parse(input);
  if (
    !isRecord(value) ||
    value.schema !== "aiw.constellation-store/0.19" ||
    !Number.isSafeInteger(value.generation) ||
    (value.generation as number) < 1 ||
    !isRecord(value.payload) ||
    typeof value.checksum !== "string"
  )
    throw new Error("Invalid constellation generation");
  const payload: StorePayload = {
    projection: ConstellationProjectionSchema.parse(value.payload.projection),
    terminalOutcomes: parseTerminalOutcomes(
      value.payload.terminalOutcomes ?? [],
    ),
    idempotency: parseIdempotency(value.payload.idempotency ?? []),
  };
  if (value.checksum !== sha256(canonical(payload)))
    throw new Error("Constellation generation checksum mismatch");
  return {
    schema: "aiw.constellation-store/0.19",
    generation: value.generation as number,
    payload,
    checksum: value.checksum,
  };
}

async function optionalRead(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (
      isRecord(error) &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    )
      return null;
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

function emptyProjection(worldInstanceId: string): ConstellationProjection {
  return ConstellationProjectionSchema.parse({
    schema: "aiw.constellation/0.19",
    mode: "multi-agent",
    worldInstanceId,
    lifecycle: "assembling",
    revision: 0,
    agents: [],
    entryReady: false,
    truth: "current",
  });
}

function restoredProjection(
  projection: ConstellationProjection,
  truth: "current" | "previous-recovered",
): ConstellationProjection {
  if (projection.lifecycle === "ended")
    return ConstellationProjectionSchema.parse({ ...projection, truth });
  const agents = projection.agents.map((agent) => ({
    ...agent,
    continuity: "stale" as const,
    connection: "stale" as const,
  }));
  return ConstellationProjectionSchema.parse({
    ...projection,
    agents,
    entryReady: false,
    truth,
  });
}

function stateFrom(payload: StorePayload): ConstellationState {
  return {
    projection: structuredClone(payload.projection),
    terminalOutcomes: structuredClone(payload.terminalOutcomes),
    unavailableReason: null,
  };
}

export class ConstellationService {
  readonly #directory: string;
  readonly #currentPath: string;
  readonly #previousPath: string;
  readonly #lifecycle: ConstellationLifecyclePort;
  #payload: StorePayload | null;
  #generation: number;
  #unavailable: boolean;
  #mutationTail: Promise<void> = Promise.resolve();

  private constructor(options: {
    directory: string;
    lifecycle: ConstellationLifecyclePort;
    payload: StorePayload | null;
    generation: number;
    unavailable: boolean;
  }) {
    this.#directory = options.directory;
    this.#currentPath = path.join(
      options.directory,
      "constellation.current.json",
    );
    this.#previousPath = path.join(
      options.directory,
      "constellation.previous.json",
    );
    this.#lifecycle = options.lifecycle;
    this.#payload = options.payload;
    this.#generation = options.generation;
    this.#unavailable = options.unavailable;
  }

  static async open(options: {
    readonly directory: string;
    readonly lifecycle: ConstellationLifecyclePort;
    readonly worldInstanceId?: string;
  }): Promise<ConstellationService> {
    await mkdir(options.directory, { recursive: true, mode: 0o700 });
    await chmod(options.directory, 0o700);
    const currentPath = path.join(
      options.directory,
      "constellation.current.json",
    );
    const previousPath = path.join(
      options.directory,
      "constellation.previous.json",
    );
    const [currentText, previousText] = await Promise.all([
      optionalRead(currentPath),
      optionalRead(previousPath),
    ]);
    let current: StoreEnvelope | null = null;
    let previous: StoreEnvelope | null = null;
    try {
      if (currentText !== null) current = parseEnvelope(currentText);
    } catch {
      current = null;
    }
    try {
      if (previousText !== null) previous = parseEnvelope(previousText);
    } catch {
      previous = null;
    }

    if (current) {
      return new ConstellationService({
        directory: options.directory,
        lifecycle: options.lifecycle,
        payload: {
          ...current.payload,
          projection: restoredProjection(current.payload.projection, "current"),
        },
        generation: current.generation,
        unavailable: false,
      });
    }
    if (previous) {
      return new ConstellationService({
        directory: options.directory,
        lifecycle: options.lifecycle,
        payload: {
          ...previous.payload,
          projection: restoredProjection(
            previous.payload.projection,
            "previous-recovered",
          ),
        },
        generation: previous.generation,
        unavailable: false,
      });
    }
    const hasInvalidGeneration = currentText !== null || previousText !== null;
    const worldInstanceId = options.worldInstanceId;
    if (worldInstanceId !== undefined)
      validateOpaque(worldInstanceId, "worldInstanceId");
    return new ConstellationService({
      directory: options.directory,
      lifecycle: options.lifecycle,
      payload: worldInstanceId
        ? {
            projection: emptyProjection(worldInstanceId),
            terminalOutcomes: [],
            idempotency: [],
          }
        : null,
      generation: 0,
      unavailable: hasInvalidGeneration,
    });
  }

  current(): ConstellationState | UnavailableConstellationState {
    if (this.#unavailable || this.#payload === null)
      return {
        projection: null,
        terminalOutcomes: [],
        unavailableReason: "Constellation state is unavailable",
      };
    return stateFrom(this.#payload);
  }

  addAgent(request: AddConstellationAgentRequest): Promise<ConstellationState> {
    return this.#mutate("agent-add", request, async () => {
      const payload = this.#requirePayload(request.worldInstanceId);
      if (
        payload.projection.lifecycle === "ending" ||
        payload.projection.lifecycle === "ended"
      )
        throw new ConstellationServiceError(
          "conflict",
          "World lifecycle is terminal",
        );
      if (payload.projection.agents.length >= 4)
        throw new ConstellationServiceError(
          "resource_limit",
          "Constellation roster is limited to four agents",
        );
      if (
        request.agent.sessionOwnership === "operator-persistent" &&
        request.agent.adapterId !== "hermes"
      )
        throw new ConstellationServiceError(
          "validation",
          "Session ownership is invalid",
        );
      validateOpaque(request.agent.rosterId, "rosterId");
      validateOpaque(request.agent.worldSessionId, "worldSessionId");
      validateOpaque(
        request.agent.nativeRootSessionRef,
        "nativeRootSessionRef",
      );
      if (
        payload.projection.agents.some(
          (row) => row.rosterId === request.agent.rosterId,
        )
      )
        throw new ConstellationServiceError(
          "conflict",
          "Roster entry already exists",
        );
      if (
        payload.projection.agents.some(
          (row) =>
            row.adapterId === request.agent.adapterId &&
            row.nativeRootSessionRef === request.agent.nativeRootSessionRef,
        )
      )
        throw new ConstellationServiceError(
          "conflict",
          "Native binding already belongs to this constellation",
        );
      const addedOrder =
        (payload.projection.agents.at(-1)?.addedOrder ?? -1) + 1;
      let created: ConstellationAgent;
      try {
        created = ConstellationAgentSchema.parse({
          ...request.agent,
          worldInstanceId: request.worldInstanceId,
          continuity: "current",
          connection: "connected",
          avatar: { status: "missing", profileId: null, sessionId: null },
          addedOrder,
        });
      } catch {
        throw new ConstellationServiceError(
          "validation",
          "Agent binding is invalid",
        );
      }
      this.#replaceProjection([...payload.projection.agents, created]);
      return this.#currentState();
    });
  }

  setAvatar(
    request: SetConstellationAvatarRequest,
  ): Promise<ConstellationState> {
    return this.#mutate("avatar-set", request, async () => {
      validateOpaque(request.rosterId, "rosterId");
      const payload = this.#requirePayload(request.worldInstanceId);
      const index = payload.projection.agents.findIndex(
        (row) => row.rosterId === request.rosterId,
      );
      if (index < 0)
        throw new ConstellationServiceError(
          "not_found",
          "Roster entry was not found",
        );
      let updated: ConstellationAgent;
      try {
        updated = ConstellationAgentSchema.parse({
          ...payload.projection.agents[index],
          avatar: request.avatar,
        });
      } catch {
        throw new ConstellationServiceError(
          "validation",
          "Avatar association is invalid",
        );
      }
      const agents = [...payload.projection.agents];
      agents[index] = updated;
      this.#replaceProjection(agents);
      return this.#currentState();
    });
  }

  reconnect(
    request: ConstellationRosterMutationRequest,
  ): Promise<ConstellationState> {
    return this.#mutate("agent-reconnect", request, async () => {
      validateOpaque(request.rosterId, "rosterId");
      const payload = this.#requirePayload(request.worldInstanceId);
      const index = payload.projection.agents.findIndex(
        (row) => row.rosterId === request.rosterId,
      );
      if (index < 0)
        throw new ConstellationServiceError(
          "not_found",
          "Roster entry was not found",
        );
      const agent = payload.projection.agents[index];
      if (!agent)
        throw new ConstellationServiceError(
          "not_found",
          "Roster entry was not found",
        );
      const expected: ConstellationBinding = {
        rosterId: agent.rosterId,
        adapterId: agent.adapterId,
        sessionOwnership: agent.sessionOwnership,
        worldSessionId: agent.worldSessionId,
        nativeRootSessionRef: agent.nativeRootSessionRef,
        worldInstanceId: agent.worldInstanceId,
      };
      let validated: ConstellationBindingValidation;
      try {
        validated = await this.#lifecycle.validateBinding(expected);
      } catch {
        throw new ConstellationServiceError(
          "unavailable",
          "Exact session validation is unavailable",
        );
      }
      if (
        validated.rosterId !== expected.rosterId ||
        validated.adapterId !== expected.adapterId ||
        validated.sessionOwnership !== expected.sessionOwnership ||
        validated.worldSessionId !== expected.worldSessionId ||
        validated.nativeRootSessionRef !== expected.nativeRootSessionRef ||
        validated.worldInstanceId !== expected.worldInstanceId
      )
        throw new ConstellationServiceError(
          "conflict",
          "Reconnect identity does not match the retained binding",
        );
      const available = validated.continuity !== "unavailable";
      const agents = [...payload.projection.agents];
      agents[index] = ConstellationAgentSchema.parse({
        ...agent,
        continuity: validated.continuity,
        connection: available ? "connected" : "unavailable",
      });
      this.#replaceProjection(agents);
      return this.#currentState();
    });
  }

  removeAgent(
    request: ConstellationRosterMutationRequest,
  ): Promise<ConstellationState> {
    return this.#mutate("agent-remove", request, async () => {
      validateOpaque(request.rosterId, "rosterId");
      const payload = this.#requirePayload(request.worldInstanceId);
      if (
        !payload.projection.agents.some(
          (row) => row.rosterId === request.rosterId,
        )
      )
        throw new ConstellationServiceError(
          "not_found",
          "Roster entry was not found",
        );
      this.#replaceProjection(
        payload.projection.agents.filter(
          (row) => row.rosterId !== request.rosterId,
        ),
      );
      this.#payload = {
        ...this.#requirePayload(request.worldInstanceId),
        terminalOutcomes: [],
      };
      return this.#currentState();
    });
  }

  end(request: MutationIdentity): Promise<ConstellationState> {
    return this.#enqueue(async () => {
      validateMutation(request);
      const payload = this.#requirePayload(request.worldInstanceId);
      const inputHash = sha256(canonical(request));
      const existing = payload.idempotency.find(
        (record) => record.key === request.idempotencyKey,
      );
      if (existing) {
        if (
          existing.operation !== "world-end" ||
          existing.inputHash !== inputHash
        )
          throw new ConstellationServiceError(
            "conflict",
            "Idempotency identity was reused with different input",
          );
        if (existing.status === "completed" && existing.result)
          return structuredClone(existing.result);
      } else {
        this.#assertRevision(request.expectedRevision);
        this.#setIdempotency({
          key: request.idempotencyKey,
          operation: "world-end",
          inputHash,
          status: "pending",
          result: null,
        });
        this.#payload = {
          ...this.#requirePayload(request.worldInstanceId),
          projection: ConstellationProjectionSchema.parse({
            ...payload.projection,
            lifecycle: "ending",
            revision: payload.projection.revision + 1,
            entryReady: false,
            truth: "current",
          }),
        };
        await this.#persist();
      }

      const current = this.#requirePayload(request.worldInstanceId);
      for (const agent of current.projection.agents) {
        const prior = current.terminalOutcomes.find(
          (outcome) => outcome.rosterId === agent.rosterId,
        );
        if (agent.sessionOwnership === "operator-persistent") {
          if (!prior)
            await this.#recordOutcome({
              rosterId: agent.rosterId,
              status: "skipped-operator-persistent",
            });
          continue;
        }
        if (prior?.status === "ended") continue;
        try {
          await this.#lifecycle.endWorldSession(
            agent.worldSessionId,
            request.worldInstanceId,
          );
          await this.#recordOutcome({
            rosterId: agent.rosterId,
            status: "ended",
          });
        } catch {
          await this.#recordOutcome({
            rosterId: agent.rosterId,
            status: "failed",
          });
          throw new ConstellationServiceError(
            "upstream",
            "A World-owned session could not be ended",
          );
        }
      }

      const finishing = this.#requirePayload(request.worldInstanceId);
      this.#payload = {
        ...finishing,
        projection: ConstellationProjectionSchema.parse({
          ...finishing.projection,
          lifecycle: "ended",
          revision: finishing.projection.revision + 1,
          entryReady: false,
          truth: "current",
        }),
      };
      const result = this.#currentState();
      this.#setIdempotency({
        key: request.idempotencyKey,
        operation: "world-end",
        inputHash,
        status: "completed",
        result,
      });
      await this.#persist();
      return this.#currentState();
    });
  }

  #mutate(
    operation: string,
    request: MutationIdentity,
    action: () => Promise<ConstellationState>,
  ): Promise<ConstellationState> {
    return this.#enqueue(async () => {
      validateMutation(request);
      if (this.#payload === null && !this.#unavailable) {
        this.#payload = {
          projection: emptyProjection(request.worldInstanceId),
          terminalOutcomes: [],
          idempotency: [],
        };
      }
      const payload = this.#requirePayload(request.worldInstanceId);
      const inputHash = sha256(canonical(request));
      const existing = payload.idempotency.find(
        (record) => record.key === request.idempotencyKey,
      );
      if (existing) {
        if (
          existing.operation !== operation ||
          existing.inputHash !== inputHash
        )
          throw new ConstellationServiceError(
            "conflict",
            "Idempotency identity was reused with different input",
          );
        if (existing.result) return structuredClone(existing.result);
      }
      this.#assertRevision(request.expectedRevision);
      const result = await action();
      this.#setIdempotency({
        key: request.idempotencyKey,
        operation,
        inputHash,
        status: "completed",
        result,
      });
      await this.#persist();
      return this.#currentState();
    });
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationTail.then(operation, operation);
    this.#mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  #requirePayload(worldInstanceId: string): StorePayload {
    if (this.#unavailable || this.#payload === null)
      throw new ConstellationServiceError(
        "unavailable",
        "Constellation state is unavailable",
      );
    if (this.#payload.projection.worldInstanceId !== worldInstanceId)
      throw new ConstellationServiceError(
        "conflict",
        "World instance does not match the constellation",
      );
    return this.#payload;
  }

  #assertRevision(expectedRevision: number): void {
    if (this.#payload?.projection.revision !== expectedRevision)
      throw new ConstellationServiceError(
        "revision_conflict",
        "Expected revision is stale",
      );
  }

  #replaceProjection(agents: readonly ConstellationAgent[]): void {
    if (!this.#payload) throw new Error("Constellation payload is missing");
    const entryReady = deriveConstellationEntryReady(agents);
    this.#payload = {
      ...this.#payload,
      projection: ConstellationProjectionSchema.parse({
        ...this.#payload.projection,
        lifecycle: entryReady ? "active" : "assembling",
        revision: this.#payload.projection.revision + 1,
        agents,
        entryReady,
        truth: "current",
      }),
    };
  }

  #setIdempotency(record: IdempotencyRecord): void {
    if (!this.#payload) throw new Error("Constellation payload is missing");
    const records = this.#payload.idempotency.filter(
      (existing) => existing.key !== record.key,
    );
    records.push(record);
    this.#payload = {
      ...this.#payload,
      idempotency: records.slice(-MAX_IDEMPOTENCY_RECORDS),
    };
  }

  async #recordOutcome(outcome: ConstellationTerminalOutcome): Promise<void> {
    if (!this.#payload) throw new Error("Constellation payload is missing");
    const outcomes = this.#payload.terminalOutcomes.filter(
      (existing) => existing.rosterId !== outcome.rosterId,
    );
    outcomes.push(outcome);
    const order = new Map(
      this.#payload.projection.agents.map((agent, index) => [
        agent.rosterId,
        index,
      ]),
    );
    outcomes.sort(
      (left, right) =>
        (order.get(left.rosterId) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.rosterId) ?? Number.MAX_SAFE_INTEGER),
    );
    this.#payload = { ...this.#payload, terminalOutcomes: outcomes };
    await this.#persist();
  }

  #currentState(): ConstellationState {
    if (!this.#payload) throw new Error("Constellation payload is missing");
    return stateFrom(this.#payload);
  }

  async #persist(): Promise<void> {
    if (!this.#payload) throw new Error("Constellation payload is missing");
    const envelope: StoreEnvelope = {
      schema: "aiw.constellation-store/0.19",
      generation: this.#generation + 1,
      payload: this.#payload,
      checksum: sha256(canonical(this.#payload)),
    };
    const temporary = path.join(
      this.#directory,
      `.constellation-${randomUUID()}.tmp`,
    );
    const previousTemporary = path.join(
      this.#directory,
      `.constellation-previous-${randomUUID()}.tmp`,
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
      if (
        !isRecord(error) ||
        !("code" in error) ||
        (error as { code: unknown }).code !== "ENOENT"
      )
        throw error;
    }
    await rename(temporary, this.#currentPath);
    await chmod(this.#currentPath, 0o600);
    await syncDirectory(this.#directory);
    this.#generation = envelope.generation;
  }
}

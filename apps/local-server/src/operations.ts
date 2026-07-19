import { randomUUID } from "node:crypto";

import {
  OperationRecordSchema,
  type OperationRecord,
  type OperationRequest,
} from "@agentintersect-world/world-schema";

const IDEMPOTENCY_KEY_PATTERN = /^[!-~]{1,128}$/;

export class OperationServiceError extends Error {
  override readonly name = "OperationServiceError";

  constructor(
    readonly code: "validation" | "conflict" | "not_found",
    message: string,
  ) {
    super(message);
  }
}

type StoredOperation = {
  record: OperationRecord;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
};

export class DemoOperationService {
  readonly #operations = new Map<string, StoredOperation>();
  readonly #keys = new Map<string, string>();
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    readonly maxDurationMs: number,
    readonly maxRecords = 100,
  ) {}

  get activeTimerCount(): number {
    return this.#timers.size;
  }

  create(
    idempotencyKey: string | undefined,
    request: OperationRequest,
  ): { operation: OperationRecord; replay: boolean } {
    if (
      idempotencyKey === undefined ||
      !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
    ) {
      throw new OperationServiceError(
        "validation",
        "idempotency-key must contain 1..128 visible ASCII characters",
      );
    }
    if (request.durationMs > this.maxDurationMs) {
      throw new OperationServiceError(
        "validation",
        `durationMs must be at most ${this.maxDurationMs}`,
      );
    }

    const fingerprint = JSON.stringify(request);
    const existingId = this.#keys.get(idempotencyKey);
    if (existingId !== undefined) {
      const existing = this.#operations.get(existingId);
      if (existing === undefined) {
        this.#keys.delete(idempotencyKey);
      } else if (existing.requestFingerprint !== fingerprint) {
        throw new OperationServiceError(
          "conflict",
          "Idempotency key was already used with a different request",
        );
      } else {
        return { operation: existing.record, replay: true };
      }
    }

    this.#makeRoom();
    const timestamp = new Date().toISOString();
    const id = randomUUID();
    const record = OperationRecordSchema.parse({
      id,
      kind: request.kind,
      durationMs: request.durationMs,
      ...(request.label === undefined ? {} : { label: request.label }),
      status: "running",
      createdAt: timestamp,
      updatedAt: timestamp,
      result: "Demo operation running",
    });
    this.#operations.set(id, {
      record,
      idempotencyKey,
      requestFingerprint: fingerprint,
    });
    this.#keys.set(idempotencyKey, id);

    const timer = setTimeout(() => this.#complete(id), request.durationMs);
    timer.unref();
    this.#timers.set(id, timer);
    return { operation: record, replay: false };
  }

  list(): OperationRecord[] {
    return [...this.#operations.values()].reverse().map(({ record }) => record);
  }

  get(id: string): OperationRecord | undefined {
    return this.#operations.get(id)?.record;
  }

  require(id: string): OperationRecord {
    const operation = this.get(id);
    if (operation === undefined) {
      throw new OperationServiceError("not_found", "Operation not found");
    }
    return operation;
  }

  cancel(id: string): OperationRecord {
    const stored = this.#operations.get(id);
    if (stored === undefined) {
      throw new OperationServiceError("not_found", "Operation not found");
    }
    if (stored.record.status !== "running") return stored.record;
    this.#clearTimer(id);
    stored.record = OperationRecordSchema.parse({
      ...stored.record,
      status: "cancelled",
      updatedAt: new Date().toISOString(),
      result: "Demo operation cancelled",
    });
    return stored.record;
  }

  close(): void {
    for (const [id, timer] of this.#timers) {
      clearTimeout(timer);
      const stored = this.#operations.get(id);
      if (stored !== undefined && stored.record.status === "running") {
        stored.record = OperationRecordSchema.parse({
          ...stored.record,
          status: "cancelled",
          updatedAt: new Date().toISOString(),
          result: "Demo operation cancelled during server shutdown",
        });
      }
    }
    this.#timers.clear();
  }

  #complete(id: string): void {
    const stored = this.#operations.get(id);
    this.#timers.delete(id);
    if (stored === undefined || stored.record.status !== "running") return;
    stored.record = OperationRecordSchema.parse({
      ...stored.record,
      status: "succeeded",
      updatedAt: new Date().toISOString(),
      result: "Demo operation completed",
    });
  }

  #clearTimer(id: string): void {
    const timer = this.#timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    this.#timers.delete(id);
  }

  #makeRoom(): void {
    if (this.#operations.size < this.maxRecords) return;
    for (const [id, stored] of this.#operations) {
      if (stored.record.status === "running") continue;
      this.#operations.delete(id);
      this.#keys.delete(stored.idempotencyKey);
      return;
    }
    throw new OperationServiceError(
      "conflict",
      "Operation capacity is temporarily full",
    );
  }
}

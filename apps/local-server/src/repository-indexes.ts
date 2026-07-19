import { randomUUID } from "node:crypto";

import { indexRepository } from "@agentintersect-world/repo-indexer";
import {
  RepositoryIndexOperationSchema,
  type RepositoryGeneration,
  type RepositoryIndexOperation,
  type RepositoryIndexProgress,
  type RepositoryIndexRequest,
} from "@agentintersect-world/world-schema";

const IDEMPOTENCY_KEY_PATTERN = /^[!-~]{1,128}$/;

export class RepositoryIndexServiceError extends Error {
  override readonly name = "RepositoryIndexServiceError";
  constructor(
    readonly code: "validation" | "conflict" | "not_found",
    message: string,
  ) {
    super(message);
  }
}

type IndexFunction = typeof indexRepository;
type Stored = {
  record: RepositoryIndexOperation;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
};
type SuccessfulGenerationListener = (generation: RepositoryGeneration) => void;

export class RepositoryIndexService {
  readonly #operations = new Map<string, Stored>();
  readonly #keys = new Map<string, string>();
  readonly #controllers = new Map<string, AbortController>();
  readonly #tasks = new Map<string, Promise<void>>();
  #lastGood: RepositoryGeneration | null = null;

  constructor(
    readonly maxFiles: number,
    readonly maxRecords = 20,
    readonly runIndex: IndexFunction = indexRepository,
    readonly onSuccessfulGeneration: SuccessfulGenerationListener = () => {},
  ) {}

  get activeCount(): number {
    return this.#tasks.size;
  }
  current(): RepositoryGeneration | null {
    return this.#lastGood;
  }
  list(): RepositoryIndexOperation[] {
    return [...this.#operations.values()].reverse().map(({ record }) => record);
  }
  get(id: string): RepositoryIndexOperation | undefined {
    return this.#operations.get(id)?.record;
  }
  require(id: string): RepositoryIndexOperation {
    const record = this.get(id);
    if (!record)
      throw new RepositoryIndexServiceError(
        "not_found",
        "Repository index operation not found",
      );
    return record;
  }

  create(
    idempotencyKey: string | undefined,
    request: RepositoryIndexRequest,
  ): { operation: RepositoryIndexOperation; replay: boolean } {
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey))
      throw new RepositoryIndexServiceError(
        "validation",
        "idempotency-key must contain 1..128 visible ASCII characters",
      );
    const requestFingerprint = JSON.stringify(request);
    const existingId = this.#keys.get(idempotencyKey);
    if (existingId) {
      const existing = this.#operations.get(existingId);
      if (!existing) this.#keys.delete(idempotencyKey);
      else if (existing.requestFingerprint !== requestFingerprint)
        throw new RepositoryIndexServiceError(
          "conflict",
          "Idempotency key was already used with a different repository root",
        );
      else return { operation: existing.record, replay: true };
    }
    this.#makeRoom();
    const now = new Date().toISOString();
    const id = randomUUID();
    const record = RepositoryIndexOperationSchema.parse({
      id,
      rootPath: request.rootPath,
      status: "running",
      createdAt: now,
      updatedAt: now,
      progress: {
        phase: "validating",
        discoveredFiles: 0,
        indexedFiles: 0,
        bytesHashed: 0,
      },
    });
    this.#operations.set(id, { record, idempotencyKey, requestFingerprint });
    this.#keys.set(idempotencyKey, id);
    const controller = new AbortController();
    this.#controllers.set(id, controller);
    const task = this.#run(id, request.rootPath, controller);
    this.#tasks.set(id, task);
    void task.finally(() => this.#tasks.delete(id));
    return { operation: record, replay: false };
  }

  cancel(id: string): RepositoryIndexOperation {
    const stored = this.#operations.get(id);
    if (!stored)
      throw new RepositoryIndexServiceError(
        "not_found",
        "Repository index operation not found",
      );
    if (stored.record.status !== "running") return stored.record;
    this.#controllers.get(id)?.abort();
    stored.record = RepositoryIndexOperationSchema.parse({
      ...stored.record,
      status: "cancelled",
      updatedAt: new Date().toISOString(),
      error: "Repository indexing cancelled",
    });
    return stored.record;
  }

  async close(): Promise<void> {
    for (const id of this.#controllers.keys()) this.cancel(id);
    await Promise.allSettled([...this.#tasks.values()]);
    this.#controllers.clear();
    this.#tasks.clear();
  }

  async #run(
    id: string,
    rootPath: string,
    controller: AbortController,
  ): Promise<void> {
    try {
      const generation = await this.runIndex({
        rootPath,
        maxFiles: this.maxFiles,
        signal: controller.signal,
        onProgress: (progress) => this.#updateProgress(id, progress),
      });
      const stored = this.#operations.get(id);
      if (!stored || stored.record.status !== "running") return;
      stored.record = RepositoryIndexOperationSchema.parse({
        ...stored.record,
        rootPath: generation.rootPath,
        status: "succeeded",
        updatedAt: new Date().toISOString(),
        progress: { ...stored.record.progress, phase: "complete" },
        generation,
      });
      this.#lastGood = generation;
      try {
        this.onSuccessfulGeneration(generation);
      } catch {
        // Projection consumers must not change the successful Phase 3 result.
      }
    } catch (error) {
      const stored = this.#operations.get(id);
      if (!stored || stored.record.status !== "running") return;
      stored.record = RepositoryIndexOperationSchema.parse({
        ...stored.record,
        status: controller.signal.aborted ? "cancelled" : "failed",
        updatedAt: new Date().toISOString(),
        error: controller.signal.aborted
          ? "Repository indexing cancelled"
          : error instanceof Error
            ? error.message.slice(0, 500)
            : "Repository indexing failed",
      });
    } finally {
      this.#controllers.delete(id);
    }
  }

  #updateProgress(id: string, progress: RepositoryIndexProgress): void {
    const stored = this.#operations.get(id);
    if (!stored || stored.record.status !== "running") return;
    stored.record = RepositoryIndexOperationSchema.parse({
      ...stored.record,
      updatedAt: new Date().toISOString(),
      progress,
    });
  }

  #makeRoom(): void {
    if (this.#operations.size < this.maxRecords) return;
    for (const [id, stored] of this.#operations) {
      if (stored.record.status === "running") continue;
      this.#operations.delete(id);
      this.#keys.delete(stored.idempotencyKey);
      return;
    }
    throw new RepositoryIndexServiceError(
      "conflict",
      "Repository index capacity is temporarily full",
    );
  }
}

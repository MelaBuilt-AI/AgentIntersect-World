import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import * as Y from "yjs";

import {
  PRESENTATION_LIMITS,
  PRESENTATION_SCHEMA,
  PresentationValidationError,
  applyValidatedPresentationUpdate,
  createPresentationDocument,
  validatePresentationDocument,
} from "./index.js";

type StoreLimits = {
  readonly maxIncomingUpdateBytes: number;
  readonly maxDocumentBytes: number;
  readonly compactUpdateCount: number;
  readonly compactTailBytes: number;
  readonly maxDocuments: number;
  readonly inactiveDocumentMs: number;
};

type StoredDocument = {
  readonly documentId: string;
  readonly schema: typeof PRESENTATION_SCHEMA;
  readonly updatedAt: string;
  readonly compactions: number;
  readonly snapshot: string;
  readonly tail: readonly string[];
};

type StoredEnvelope = {
  readonly checksum: string;
  readonly data: StoredDocument;
};

export type PresentationStoreStatus = {
  readonly documentId: string;
  readonly snapshotBytes: number;
  readonly tailBytes: number;
  readonly tailUpdates: number;
  readonly compactions: number;
  readonly updatedAt: string;
};

export type PresentationSnapshotStoreOptions = {
  readonly directory: string;
  readonly now?: () => Date;
  readonly limits?: Partial<StoreLimits>;
};

const DOCUMENT_ID = /^doc_[a-f0-9]{32}$/;

function checksum(data: StoredDocument): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

function encode(update: Uint8Array): string {
  return Buffer.from(update).toString("base64");
}

function decode(update: string): Uint8Array {
  return new Uint8Array(Buffer.from(update, "base64"));
}

function parseEnvelope(raw: string, expectedId: string): StoredEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new PresentationValidationError("Presentation snapshot is corrupt");
  }
  const envelope = value as Partial<StoredEnvelope>;
  if (
    typeof envelope.checksum !== "string" ||
    typeof envelope.data !== "object" ||
    envelope.data === null ||
    envelope.data.documentId !== expectedId ||
    envelope.data.schema !== PRESENTATION_SCHEMA ||
    checksum(envelope.data as StoredDocument) !== envelope.checksum
  ) {
    throw new PresentationValidationError(
      "Presentation snapshot checksum is invalid",
    );
  }
  return envelope as StoredEnvelope;
}

export class PresentationSnapshotStore {
  readonly #directory: string;
  readonly #now: () => Date;
  readonly #limits: StoreLimits;

  constructor(options: PresentationSnapshotStoreOptions) {
    this.#directory = options.directory;
    this.#now = options.now ?? (() => new Date());
    this.#limits = { ...PRESENTATION_LIMITS, ...options.limits };
  }

  pathsForTest(documentId: string): { current: string; previous: string } {
    this.#assertDocumentId(documentId);
    return {
      current: join(this.#directory, `${documentId}.json`),
      previous: join(this.#directory, `${documentId}.previous.json`),
    };
  }

  async #readVerified(documentId: string): Promise<StoredDocument | null> {
    const paths = this.pathsForTest(documentId);
    try {
      return parseEnvelope(await readFile(paths.current, "utf8"), documentId)
        .data;
    } catch (currentError) {
      try {
        return parseEnvelope(await readFile(paths.previous, "utf8"), documentId)
          .data;
      } catch (previousError) {
        if (
          (currentError as NodeJS.ErrnoException).code === "ENOENT" &&
          (previousError as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return null;
        }
        throw new PresentationValidationError(
          "No verified presentation snapshot is available",
        );
      }
    }
  }

  #documentFrom(stored: StoredDocument): Y.Doc {
    const document = new Y.Doc({ guid: stored.documentId });
    Y.applyUpdate(document, decode(stored.snapshot), "aiw-snapshot");
    for (const update of stored.tail) {
      applyValidatedPresentationUpdate(document, decode(update));
    }
    validatePresentationDocument(document);
    return document;
  }

  async load(documentId: string): Promise<Y.Doc> {
    this.#assertDocumentId(documentId);
    const stored = await this.#readVerified(documentId);
    return stored
      ? this.#documentFrom(stored)
      : createPresentationDocument(documentId);
  }

  async ensure(documentId: string, document: Y.Doc): Promise<void> {
    this.#assertDocumentId(documentId);
    if (document.guid !== documentId) {
      throw new PresentationValidationError(
        "Presentation document identity is invalid",
      );
    }
    if ((await this.#readVerified(documentId)) !== null) return;
    validatePresentationDocument(document);
    const snapshot = Y.encodeStateAsUpdate(document);
    if (snapshot.byteLength > this.#limits.maxDocumentBytes) {
      throw new PresentationValidationError(
        "Compacted document exceeds the 8 MiB limit",
      );
    }
    await this.#writeAtomic({
      documentId,
      schema: PRESENTATION_SCHEMA,
      updatedAt: this.#now().toISOString(),
      compactions: 0,
      snapshot: encode(snapshot),
      tail: [],
    });
    await this.#prune();
  }

  async append(
    documentId: string,
    update: Uint8Array,
  ): Promise<PresentationStoreStatus> {
    this.#assertDocumentId(documentId);
    if (update.byteLength > this.#limits.maxIncomingUpdateBytes) {
      throw new PresentationValidationError("Incoming update exceeds 128 KiB");
    }
    const existing = await this.#readVerified(documentId);
    const document = existing
      ? this.#documentFrom(existing)
      : createPresentationDocument(documentId);
    applyValidatedPresentationUpdate(document, update);
    const compacted = Y.encodeStateAsUpdate(document);
    if (compacted.byteLength > this.#limits.maxDocumentBytes) {
      throw new PresentationValidationError(
        "Compacted document exceeds the 8 MiB limit",
      );
    }
    const tail = [...(existing?.tail ?? []), encode(update)];
    const tailBytes = tail.reduce(
      (total, item) => total + decode(item).byteLength,
      0,
    );
    const shouldCompact =
      tail.length >= this.#limits.compactUpdateCount ||
      tailBytes >= this.#limits.compactTailBytes;
    const initialized =
      existing?.snapshot ??
      encode(Y.encodeStateAsUpdate(createPresentationDocument(documentId)));
    const data: StoredDocument = {
      documentId,
      schema: PRESENTATION_SCHEMA,
      updatedAt: this.#now().toISOString(),
      compactions: (existing?.compactions ?? 0) + (shouldCompact ? 1 : 0),
      snapshot: shouldCompact ? encode(compacted) : initialized,
      tail: shouldCompact ? [] : tail,
    };
    await this.#writeAtomic(data);
    await this.#prune();
    return this.#status(data);
  }

  async delete(
    documentId: string,
    confirmation: { readonly documentId: string; readonly confirmed: boolean },
  ): Promise<void> {
    this.#assertDocumentId(documentId);
    if (!confirmation.confirmed || confirmation.documentId !== documentId) {
      throw new PresentationValidationError(
        "Presentation deletion requires the exact document ID and explicit confirmation",
      );
    }
    const paths = this.pathsForTest(documentId);
    await Promise.all([
      rm(paths.current, { force: true }),
      rm(paths.previous, { force: true }),
    ]);
  }

  async status(documentId: string): Promise<PresentationStoreStatus | null> {
    this.#assertDocumentId(documentId);
    const stored = await this.#readVerified(documentId);
    return stored ? this.#status(stored) : null;
  }

  #status(data: StoredDocument): PresentationStoreStatus {
    return {
      documentId: data.documentId,
      snapshotBytes: decode(data.snapshot).byteLength,
      tailBytes: data.tail.reduce(
        (total, item) => total + decode(item).byteLength,
        0,
      ),
      tailUpdates: data.tail.length,
      compactions: data.compactions,
      updatedAt: data.updatedAt,
    };
  }

  async #writeAtomic(data: StoredDocument): Promise<void> {
    await mkdir(this.#directory, { recursive: true });
    const paths = this.pathsForTest(data.documentId);
    const temporary = join(
      this.#directory,
      `.${data.documentId}.${process.pid}.${randomUUID()}.tmp`,
    );
    const envelope: StoredEnvelope = { checksum: checksum(data), data };
    await writeFile(temporary, `${JSON.stringify(envelope)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    try {
      parseEnvelope(await readFile(paths.current, "utf8"), data.documentId);
      await copyFile(paths.current, paths.previous);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "ENOENT" &&
        !(error instanceof PresentationValidationError)
      )
        throw error;
    }
    await rename(temporary, paths.current);
  }

  async #prune(): Promise<void> {
    const entries = await readdir(this.#directory, { withFileTypes: true });
    const records: StoredDocument[] = [];
    for (const entry of entries) {
      const match = /^(doc_[a-f0-9]{32})\.json$/.exec(entry.name);
      if (!entry.isFile() || !match?.[1]) continue;
      try {
        const stored = await this.#readVerified(match[1]);
        if (stored) records.push(stored);
      } catch {
        // Corrupt/unverified records are not considered live retention candidates.
      }
    }
    records.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
    const cutoff = this.#now().getTime() - this.#limits.inactiveDocumentMs;
    for (const [index, record] of records.entries()) {
      if (
        index >= this.#limits.maxDocuments ||
        Date.parse(record.updatedAt) < cutoff
      ) {
        await this.delete(record.documentId, {
          documentId: record.documentId,
          confirmed: true,
        });
      }
    }
  }

  #assertDocumentId(documentId: string): void {
    if (!DOCUMENT_ID.test(documentId)) {
      throw new PresentationValidationError(
        "Presentation document ID is invalid",
      );
    }
  }
}

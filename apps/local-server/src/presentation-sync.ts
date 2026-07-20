import { randomBytes } from "node:crypto";

import type { PresentationIdentity } from "@agentintersect-world/sync-yjs";
import {
  PRESENTATION_LIMITS,
  PRESENTATION_SCHEMA,
  PRESENTATION_SYNC_CAPABILITY,
  PresentationValidationError,
  applyValidatedPresentationUpdate,
  derivePresentationDocumentId,
  exportPresentationDocument,
} from "@agentintersect-world/sync-yjs";
import {
  PresentationSnapshotStore,
  type PresentationStoreStatus,
} from "@agentintersect-world/sync-yjs/node";
import * as Y from "yjs";

type Ticket = {
  readonly documentId: string;
  readonly expiresAt: number;
};

export type PresentationSyncServiceOptions = {
  readonly store: PresentationSnapshotStore;
  readonly identity: () => PresentationIdentity | null;
  readonly objects?: () => ReadonlyMap<string, string>;
  readonly now?: () => number;
};

export class PresentationSyncService {
  readonly #store: PresentationSnapshotStore;
  readonly #identity: () => PresentationIdentity | null;
  readonly #objects: () => ReadonlyMap<string, string>;
  readonly #now: () => number;
  readonly #documents = new Map<string, Y.Doc>();
  readonly #loading = new Map<string, Promise<Y.Doc>>();
  readonly #updates = new Map<string, Promise<void>>();
  readonly #tickets = new Map<string, Ticket>();

  constructor(options: PresentationSyncServiceOptions) {
    this.#store = options.store;
    this.#identity = options.identity;
    this.#objects = options.objects ?? (() => new Map());
    this.#now = options.now ?? Date.now;
  }

  currentDocumentId(): string | null {
    const identity = this.#identity();
    return identity ? derivePresentationDocumentId(identity) : null;
  }

  requireCurrentDocumentId(): string {
    const documentId = this.currentDocumentId();
    if (!documentId) {
      throw new PresentationValidationError(
        "No authoritative World workspace/repository identity is available",
      );
    }
    return documentId;
  }

  async document(documentId: string): Promise<Y.Doc> {
    this.#assertCurrent(documentId);
    const current = this.#documents.get(documentId);
    if (current) return current;
    const pending = this.#loading.get(documentId);
    if (pending) return pending;
    const loading = (async () => {
      const document = await this.#store.load(documentId);
      await this.#store.ensure(documentId, document);
      this.#documents.set(documentId, document);
      return document;
    })();
    this.#loading.set(documentId, loading);
    try {
      return await loading;
    } finally {
      this.#loading.delete(documentId);
    }
  }

  async applyUpdate(documentId: string, update: Uint8Array): Promise<void> {
    const previous = this.#updates.get(documentId) ?? Promise.resolve();
    const applying = previous
      .catch(() => undefined)
      .then(async () => {
        const document = await this.document(documentId);
        await this.#store.append(documentId, update);
        applyValidatedPresentationUpdate(document, update);
      });
    this.#updates.set(documentId, applying);
    try {
      await applying;
    } finally {
      if (this.#updates.get(documentId) === applying) {
        this.#updates.delete(documentId);
      }
    }
  }

  issueTicket(documentId: string): { ticket: string; expiresAt: string } {
    this.#assertCurrent(documentId);
    const now = this.#now();
    for (const [ticket, record] of this.#tickets) {
      if (record.expiresAt <= now) this.#tickets.delete(ticket);
    }
    const ticket = `ticket_${randomBytes(24).toString("hex")}`;
    const expiresAt = now + 60_000;
    this.#tickets.set(ticket, { documentId, expiresAt });
    return { ticket, expiresAt: new Date(expiresAt).toISOString() };
  }

  consumeTicket(documentId: string, ticket: string): boolean {
    const record = this.#tickets.get(ticket);
    this.#tickets.delete(ticket);
    return (
      record !== undefined &&
      record.documentId === documentId &&
      record.expiresAt > this.#now()
    );
  }

  async export(documentId: string): Promise<string> {
    return exportPresentationDocument(
      await this.document(documentId),
      this.#objects(),
    );
  }

  async delete(
    documentId: string,
    confirmation: { readonly documentId: string; readonly confirmed: boolean },
  ): Promise<void> {
    this.#assertCurrent(documentId);
    await this.#store.delete(documentId, confirmation);
    this.#documents.get(documentId)?.destroy();
    this.#documents.delete(documentId);
    for (const [ticket, record] of this.#tickets) {
      if (record.documentId === documentId) this.#tickets.delete(ticket);
    }
  }

  async status(documentId: string): Promise<PresentationStoreStatus | null> {
    this.#assertCurrent(documentId);
    return this.#store.status(documentId);
  }

  capabilityStatus(networkScope: "loopback" | "lan") {
    const documentId = this.currentDocumentId();
    return {
      ...PRESENTATION_SYNC_CAPABILITY,
      schema: PRESENTATION_SCHEMA,
      documentId,
      networkScope,
      commandAuthority: false as const,
      maximumPeers: PRESENTATION_LIMITS.maxPeers,
      heartbeatMs: PRESENTATION_LIMITS.heartbeatMs,
      awarenessExpiryMs: PRESENTATION_LIMITS.awarenessExpiryMs,
      limits: PRESENTATION_LIMITS,
    };
  }

  close(): void {
    for (const document of this.#documents.values()) document.destroy();
    this.#documents.clear();
    this.#tickets.clear();
  }

  #assertCurrent(documentId: string): void {
    if (documentId !== this.requireCurrentDocumentId()) {
      throw new PresentationValidationError(
        "Presentation document does not match the authoritative World identity",
      );
    }
  }
}

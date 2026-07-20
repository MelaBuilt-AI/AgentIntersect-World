import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  PRESENTATION_LIMITS,
  createPresentationDocument,
  derivePresentationDocumentId,
  projectPresentationDocument,
  upsertAnnotation,
} from "../src/index.js";
import {
  BrowserPresentationProvider,
  type PresentationProvider,
} from "../src/provider.js";

const documentId = derivePresentationDocumentId({
  workspaceId: "workspace_01jz8provider",
  repositoryId: "repository_01jz8provider",
});

describe("Phase 9 offline CRDT behavior", () => {
  it("converges concurrent field edits after state-vector reconnect", () => {
    const base = createPresentationDocument(documentId);
    upsertAnnotation(base, {
      id: "annotation_01jz8provider",
      objectId: "object_01jz8provider",
      text: "Base",
    });
    const left = new Y.Doc({ guid: documentId });
    const right = new Y.Doc({ guid: documentId });
    const baseUpdate = Y.encodeStateAsUpdate(base);
    Y.applyUpdate(left, baseUpdate);
    Y.applyUpdate(right, baseUpdate);

    upsertAnnotation(left, {
      id: "annotation_01jz8provider",
      objectId: "object_01jz8provider",
      text: "Left offline",
    });
    upsertAnnotation(right, {
      id: "annotation_01jz8provider",
      objectId: "object_01jz8provider",
      text: "Right offline",
    });
    Y.applyUpdate(
      left,
      Y.encodeStateAsUpdate(right, Y.encodeStateVector(left)),
    );
    Y.applyUpdate(
      right,
      Y.encodeStateAsUpdate(left, Y.encodeStateVector(right)),
    );

    expect(Y.encodeStateAsUpdate(left)).toEqual(Y.encodeStateAsUpdate(right));
    expect(projectPresentationDocument(left, new Map())).toEqual(
      projectPresentationDocument(right, new Map()),
    );
  });
});

describe("Phase 9 browser provider abstraction", () => {
  it("uses an opaque IndexedDB key and a single-use join ticket without authority", () => {
    class FakeSocket {
      static readonly OPEN = 1;
    }
    const provider: PresentationProvider = new BrowserPresentationProvider({
      documentId,
      websocketBaseUrl: "ws://127.0.0.1:3770/presentation-sync",
      joinTicket: "ticket_single_use_123456",
      connect: false,
      offlinePersistence: false,
      webSocketPolyfill: FakeSocket as never,
    });

    expect(provider.capabilities).toMatchObject({
      schema: "aiw.presentation/0.9",
      commandAuthority: false,
      publicRooms: false,
    });
    expect(provider.documentId).toBe(documentId);
    expect(provider.localCacheKey).toBe(documentId);
    expect(provider.heartbeatMs).toBe(PRESENTATION_LIMITS.heartbeatMs);
    expect(provider.awarenessExpiryMs).toBe(
      PRESENTATION_LIMITS.awarenessExpiryMs,
    );
    provider.destroy();
  });
});

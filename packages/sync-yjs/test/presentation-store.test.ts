import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  PRESENTATION_LIMITS,
  PresentationValidationError,
  createPresentationDocument,
  derivePresentationDocumentId,
  exportPresentationDocument,
  upsertAnnotation,
} from "../src/index.js";
import { PresentationSnapshotStore } from "../src/node.js";

const roots: string[] = [];
afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const identity = (suffix: string) =>
  derivePresentationDocumentId({
    workspaceId: `workspace_01jz8${suffix}aaa`,
    repositoryId: `repository_01jz8${suffix}bbb`,
  });

describe("Phase 9 deterministic export", () => {
  it("exports sanitized byte-stable JSON capped at one MiB", () => {
    const documentId = identity("store0");
    const first = createPresentationDocument(documentId);
    const second = createPresentationDocument(documentId);
    for (const document of [first, second]) {
      upsertAnnotation(document, {
        id: "annotation_01jz8store",
        objectId: "object_01jz8storeaa",
        text: "Safe <note>",
      });
    }

    const one = exportPresentationDocument(first, new Map());
    const two = exportPresentationDocument(second, new Map());
    expect(one).toBe(two);
    expect(Buffer.byteLength(one)).toBeLessThanOrEqual(
      PRESENTATION_LIMITS.maxExportBytes,
    );
    expect(one).toContain("Safe &lt;note&gt;");
    expect(one).not.toMatch(/command|token|\/home\//i);
  });
});

describe("Phase 9 atomic presentation store", () => {
  it("compacts a bounded update tail and restores byte-stable state after restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-p9-store-"));
    roots.push(root);
    const documentId = identity("store1");
    const store = new PresentationSnapshotStore({
      directory: root,
      limits: { compactUpdateCount: 2 },
    });
    const source = createPresentationDocument(documentId);
    const vector = Y.encodeStateVector(source);
    upsertAnnotation(source, {
      id: "annotation_01jz8store",
      objectId: "object_01jz8storeaa",
      text: "First",
    });
    await store.append(documentId, Y.encodeStateAsUpdate(source, vector));
    const nextVector = Y.encodeStateVector(source);
    upsertAnnotation(source, {
      id: "annotation_01jz8store",
      objectId: "object_01jz8storeaa",
      text: "Second",
    });
    const status = await store.append(
      documentId,
      Y.encodeStateAsUpdate(source, nextVector),
    );

    expect(status.tailUpdates).toBe(0);
    expect(status.compactions).toBe(1);
    const beforeRestart = await store.load(documentId);
    const restarted = new PresentationSnapshotStore({ directory: root });
    const recovered = await restarted.load(documentId);
    expect(Y.encodeStateAsUpdate(recovered)).toEqual(
      Y.encodeStateAsUpdate(beforeRestart),
    );
  });

  it("falls closed to the previous verified snapshot when the current file is corrupt", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-p9-corrupt-"));
    roots.push(root);
    const documentId = identity("store2");
    const store = new PresentationSnapshotStore({ directory: root });
    const source = createPresentationDocument(documentId);
    upsertAnnotation(source, {
      id: "annotation_01jz8store",
      objectId: "object_01jz8storeaa",
      text: "Last good",
    });
    await store.append(documentId, Y.encodeStateAsUpdate(source));
    upsertAnnotation(source, {
      id: "annotation_01jz8store",
      objectId: "object_01jz8storeaa",
      text: "New current",
    });
    await store.append(documentId, Y.encodeStateAsUpdate(source));

    const paths = store.pathsForTest(documentId);
    const previous = await readFile(paths.previous, "utf8");
    await writeFile(paths.current, "corrupt", "utf8");
    const recovered = await store.load(documentId);
    expect(exportPresentationDocument(recovered, new Map())).toContain(
      "Last good",
    );
    expect(previous).toContain("checksum");

    const replacement = createPresentationDocument(documentId);
    upsertAnnotation(replacement, {
      id: "annotation_01jz8store",
      objectId: "object_01jz8storeaa",
      text: "Recovered current",
    });
    await store.append(documentId, Y.encodeStateAsUpdate(replacement));
    await writeFile(paths.current, "corrupt again", "utf8");
    await expect(store.load(documentId)).resolves.toBeInstanceOf(Y.Doc);
  });

  it("rejects over-bound updates/documents and requires exact confirmed deletion", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-p9-bounds-"));
    roots.push(root);
    const documentId = identity("store3");
    const store = new PresentationSnapshotStore({
      directory: root,
      limits: { maxDocumentBytes: 300 },
    });
    const source = createPresentationDocument(documentId);
    upsertAnnotation(source, {
      id: "annotation_01jz8store",
      objectId: "object_01jz8storeaa",
      text: "x".repeat(250),
    });
    await expect(
      store.append(documentId, Y.encodeStateAsUpdate(source)),
    ).rejects.toThrow(/8 MiB|document/i);
    await expect(
      store.append(
        documentId,
        new Uint8Array(PRESENTATION_LIMITS.maxIncomingUpdateBytes + 1),
      ),
    ).rejects.toThrow(/128 KiB/);
    await expect(
      store.delete(documentId, { documentId, confirmed: false }),
    ).rejects.toThrow(PresentationValidationError);
  });

  it("retains at most the bounded document count and expires inactive state", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-p9-retention-"));
    roots.push(root);
    let now = new Date("2026-07-01T00:00:00.000Z");
    const store = new PresentationSnapshotStore({
      directory: root,
      now: () => now,
      limits: { maxDocuments: 2, inactiveDocumentMs: 1000 },
    });
    const first = identity("retain1");
    const second = identity("retain2");
    const third = identity("retain3");
    await store.ensure(first, createPresentationDocument(first));
    now = new Date(now.getTime() + 100);
    await store.ensure(second, createPresentationDocument(second));
    now = new Date(now.getTime() + 100);
    await store.ensure(third, createPresentationDocument(third));
    expect(await store.status(first)).toBeNull();
    expect(await store.status(second)).not.toBeNull();
    expect(await store.status(third)).not.toBeNull();

    now = new Date(now.getTime() + 2_000);
    const fourth = identity("retain4");
    await store.ensure(fourth, createPresentationDocument(fourth));
    expect(await store.status(second)).toBeNull();
    expect(await store.status(third)).toBeNull();
    expect(await store.status(fourth)).not.toBeNull();
  });
});

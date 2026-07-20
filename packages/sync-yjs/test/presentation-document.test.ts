import { describe, expect, it } from "vitest";

import {
  PRESENTATION_SCHEMA,
  PresentationValidationError,
  applyValidatedPresentationUpdate,
  createPresentationDocument,
  derivePresentationDocumentId,
  projectPresentationDocument,
  sanitizeAwarenessState,
  upsertAnnotation,
  upsertBookmark,
  upsertObjectLayout,
  validateAwarenessPeerCount,
} from "../src/index.js";
import * as Y from "yjs";

describe("Phase 9 presentation identity and roots", () => {
  it("derives one stable opaque document ID without exposing workspace identity", () => {
    const input = {
      workspaceId: "workspace_01jz8rx5k2",
      repositoryId: "repository_01jz8rx8ds",
    } as const;
    const first = derivePresentationDocumentId(input);
    const second = derivePresentationDocumentId(input);

    expect(first).toBe(second);
    expect(first).toMatch(/^doc_[a-f0-9]{32}$/);
    expect(first).not.toContain(input.workspaceId);
    expect(first).not.toContain(input.repositoryId);
    expect(
      derivePresentationDocumentId({
        workspaceId: "a".repeat(32),
        repositoryId: "b".repeat(32),
      }),
    ).toMatch(/^doc_[a-f0-9]{32}$/);
    expect(() =>
      derivePresentationDocumentId({
        workspaceId: "/home/operator/world",
        repositoryId: input.repositoryId,
      }),
    ).toThrow(/opaque/i);
  });

  it("creates only the strict aiw.presentation/0.9 durable roots", () => {
    const documentId = derivePresentationDocumentId({
      workspaceId: "workspace_01jz8rx5k2",
      repositoryId: "repository_01jz8rx8ds",
    });
    const document = createPresentationDocument(documentId);

    expect(PRESENTATION_SCHEMA).toBe("aiw.presentation/0.9");
    expect([...document.share.keys()].sort()).toEqual([
      "annotations",
      "bookmarks",
      "metadata",
      "objectLayouts",
      "phaseBoardLayout",
    ]);
    expect(document.getMap("metadata").toJSON()).toEqual({
      documentId,
      schema: PRESENTATION_SCHEMA,
    });
  });
});

describe("Phase 9 presentation entry and projection", () => {
  const documentId = derivePresentationDocumentId({
    workspaceId: "workspace_01jz8rx5k2",
    repositoryId: "repository_01jz8rx8ds",
  });

  it("stores only bounded escaped presentation values and explicit orphans", () => {
    const document = createPresentationDocument(documentId);
    upsertAnnotation(document, {
      id: "annotation_01jz8s0c",
      objectId: "object_01jz8s1d",
      text: "Review <bridge> & return",
    });
    upsertBookmark(document, {
      id: "bookmark_01jz8s2e",
      objectId: "object_01jz8s1d",
      label: "Bridge <focus>",
    });
    upsertObjectLayout(document, {
      objectId: "object_01jz8s1d",
      x: 12,
      z: -4,
    });

    const orphaned = projectPresentationDocument(document, new Map());
    expect(orphaned.annotations[0]).toMatchObject({
      text: "Review &lt;bridge&gt; &amp; return",
      orphan: true,
    });
    expect(orphaned.bookmarks[0]).toMatchObject({ orphan: true });
    expect(orphaned.objectLayouts[0]).toMatchObject({ orphan: true });

    const resolved = projectPresentationDocument(
      document,
      new Map([["object_01jz8s1d", "Current safe label"]]),
    );
    expect(resolved.annotations[0]).toMatchObject({
      orphan: false,
      currentLabel: "Current safe label",
    });
    expect(JSON.stringify(resolved)).not.toContain("/home/");
  });

  it("rejects prohibited command-shaped updates without mutating the target", () => {
    const target = createPresentationDocument(documentId);
    const attacker = new Y.Doc({ guid: documentId });
    attacker.getMap("commands").set("run", "pnpm test");
    const update = Y.encodeStateAsUpdate(attacker);
    const before = Y.encodeStateAsUpdate(target);

    expect(() => applyValidatedPresentationUpdate(target, update)).toThrow(
      PresentationValidationError,
    );
    expect(Y.encodeStateAsUpdate(target)).toEqual(before);
    expect([...target.share.keys()]).not.toContain("commands");
  });

  it("rejects unescaped markup injected directly into an otherwise allowed root", () => {
    const target = createPresentationDocument(documentId);
    const attacker = new Y.Doc({ guid: documentId });
    Y.applyUpdate(attacker, Y.encodeStateAsUpdate(target));
    const entry = new Y.Map<unknown>();
    entry.set("id", "annotation_01jz8markup");
    entry.set("objectId", "object_01jz8markupaa");
    entry.set("text", "<img src=x>");
    attacker
      .getMap<Y.Map<unknown>>("annotations")
      .set("annotation_01jz8markup", entry);

    expect(() =>
      applyValidatedPresentationUpdate(
        target,
        Y.encodeStateAsUpdate(attacker, Y.encodeStateVector(target)),
      ),
    ).toThrow(/escaped|markup/i);
    expect(projectPresentationDocument(target, new Map()).annotations).toEqual(
      [],
    );
  });

  it("rejects absolute paths and command-shaped fields at entry", () => {
    const document = createPresentationDocument(documentId);
    expect(() =>
      upsertAnnotation(document, {
        id: "annotation_01jz8s0c",
        objectId: "object_01jz8s1d",
        text: "/home/operator/private.ts",
      }),
    ).toThrow(/prohibited/i);
    expect(() =>
      upsertAnnotation(document, {
        id: "annotation_01jz8s0c",
        objectId: "object_01jz8s1d",
        text: "safe",
        command: "run" as never,
      }),
    ).toThrow(/field/i);
  });
});

describe("Phase 9 awareness bounds", () => {
  it("accepts only bounded presentation awareness and escapes display text", () => {
    expect(
      sanitizeAwarenessState({
        peerId: "peer_01jz8s3f",
        viewId: "view_01jz8s4g",
        display: "Desk <left>",
        colorToken: "blue",
        ownedAgentIds: ["agent_01jz8s5h"],
        focusObjectId: "object_01jz8s1d",
        cursor: { x: 0.25, y: 0.75 },
        camera: { x: 1, y: 2, z: 3, zoom: 1 },
        activity: "active",
        presenterPeerId: "peer_01jz8s3f",
        followPresenterId: null,
      }),
    ).toMatchObject({ display: "Desk &lt;left&gt;" });
    expect(() =>
      sanitizeAwarenessState({
        peerId: "peer_01jz8s3f",
        viewId: "view_01jz8s4g",
        display: "Desk",
        colorToken: "blue",
        ownedAgentIds: [],
        activity: "active",
        commandToken: "secret",
      }),
    ).toThrow(/field/i);
  });

  it("caps connected awareness at sixteen peers", () => {
    expect(validateAwarenessPeerCount(16)).toBe(16);
    expect(() => validateAwarenessPeerCount(17)).toThrow(/16/);
  });
});

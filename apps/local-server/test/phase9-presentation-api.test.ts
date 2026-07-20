import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";

import { loadLocalServerConfig } from "@agentintersect-world/config/node";
import {
  PresentationValidationError,
  createPresentationDocument,
  derivePresentationDocumentId,
  upsertAnnotation,
} from "@agentintersect-world/sync-yjs";
import { PresentationSnapshotStore } from "@agentintersect-world/sync-yjs/node";

import { createLocalServer } from "../src/server.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Phase 9 strict presentation HTTP API", () => {
  it("issues single-use tickets and exposes truthful status/OpenAPI without authority crossover", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-p9-api-"));
    roots.push(root);
    const config = loadLocalServerConfig({
      AIW_PORT: "43770",
      AIW_PRESENTATION_ALLOWED_ORIGIN: "http://127.0.0.1:45173",
      AIW_PRESENTATION_ALLOWED_HOST: "127.0.0.1:45173",
      AIW_PRESENTATION_DATA_DIR: root,
    });
    const identity = {
      workspaceId: "a".repeat(32),
      repositoryId: "b".repeat(32),
    } as const;
    const documentId = derivePresentationDocumentId(identity);
    const server = createLocalServer({
      config,
      presentationStore: new PresentationSnapshotStore({ directory: root }),
      presentationIdentity: () => identity,
    });
    await server.ready();
    const headers = {
      origin: config.presentationSync.allowedOrigin,
      host: config.presentationSync.allowedHost,
    };

    const status = await server.inject({
      method: "GET",
      url: "/presentation/status",
      headers,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().data).toMatchObject({
      schema: "aiw.presentation/0.9",
      documentId,
      networkScope: "loopback",
      commandAuthority: false,
      maximumPeers: 16,
    });

    const ticketResponse = await server.inject({
      method: "POST",
      url: "/presentation/tickets",
      headers,
      payload: { documentId },
    });
    expect(ticketResponse.statusCode).toBe(201);
    const ticket = ticketResponse.json().data.ticket as string;
    expect(ticket).toMatch(/^ticket_[a-f0-9]{48}$/);
    expect(JSON.stringify(ticketResponse.json())).not.toContain("command");
    expect(server.presentationService.consumeTicket(documentId, ticket)).toBe(
      true,
    );
    expect(server.presentationService.consumeTicket(documentId, ticket)).toBe(
      false,
    );

    const openapi = await server.inject({
      method: "GET",
      url: "/openapi.json",
    });
    expect(openapi.json().paths).toMatchObject({
      "/presentation/status": expect.any(Object),
      "/presentation/tickets": expect.any(Object),
      "/presentation/documents/{documentId}/export": expect.any(Object),
      "/presentation/documents/{documentId}": expect.any(Object),
    });
    await server.close();
  });

  it("persists sanitized export/delete and rejects command-shaped updates with zero jobs", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-p9-delete-"));
    roots.push(root);
    const config = loadLocalServerConfig({
      AIW_PRESENTATION_ALLOWED_ORIGIN: "http://127.0.0.1:45173",
      AIW_PRESENTATION_ALLOWED_HOST: "127.0.0.1:45173",
      AIW_PRESENTATION_DATA_DIR: root,
    });
    const identity = {
      workspaceId: "c".repeat(32),
      repositoryId: "d".repeat(32),
    } as const;
    const documentId = derivePresentationDocumentId(identity);
    const server = createLocalServer({
      config,
      presentationStore: new PresentationSnapshotStore({ directory: root }),
      presentationIdentity: () => identity,
      presentationObjects: () =>
        new Map([["object_01jz8server", "Current object"]]),
    });
    await server.ready();
    const base = await server.presentationService.document(documentId);
    const client = createPresentationDocument(documentId);
    Y.applyUpdate(client, Y.encodeStateAsUpdate(base));
    upsertAnnotation(client, {
      id: "annotation_01jz8server",
      objectId: "object_01jz8server",
      text: "Shared <note>",
    });
    await server.presentationService.applyUpdate(
      documentId,
      Y.encodeStateAsUpdate(client),
    );

    const attacker = new Y.Doc({ guid: documentId });
    attacker.getMap("commandIntents").set("run", "test");
    await expect(
      server.presentationService.applyUpdate(
        documentId,
        Y.encodeStateAsUpdate(attacker),
      ),
    ).rejects.toThrow(PresentationValidationError);
    expect(server.operationService.list()).toHaveLength(0);
    expect(server.commandIntentService).toBeUndefined();

    const headers = {
      origin: config.presentationSync.allowedOrigin,
      host: config.presentationSync.allowedHost,
    };
    const exported = await server.inject({
      method: "GET",
      url: `/presentation/documents/${documentId}/export`,
      headers,
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.body).toContain("Shared &lt;note&gt;");
    expect(exported.body).toContain("Current object");
    expect(exported.body).not.toMatch(/command|token|\/home\//i);

    const denied = await server.inject({
      method: "DELETE",
      url: `/presentation/documents/${documentId}`,
      headers,
      payload: { documentId, confirmed: false },
    });
    expect(denied.statusCode).toBe(400);
    const removed = await server.inject({
      method: "DELETE",
      url: `/presentation/documents/${documentId}`,
      headers,
      payload: { documentId, confirmed: true },
    });
    expect(removed.statusCode).toBe(200);
    expect(await server.presentationService.status(documentId)).toBeNull();
    await server.close();
  });

  it("recovers byte-stable durable presentation state across a graceful server restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-p9-restart-"));
    roots.push(root);
    const config = loadLocalServerConfig({
      AIW_PRESENTATION_DATA_DIR: root,
    });
    const identity = {
      workspaceId: "1".repeat(32),
      repositoryId: "2".repeat(32),
    } as const;
    const documentId = derivePresentationDocumentId(identity);
    const first = createLocalServer({
      config,
      presentationStore: new PresentationSnapshotStore({ directory: root }),
      presentationIdentity: () => identity,
    });
    await first.ready();
    const client = createPresentationDocument(documentId);
    upsertAnnotation(client, {
      id: "annotation_01jz8restart",
      objectId: "object_01jz8restartaa",
      text: "Restart stable",
    });
    await first.presentationService.applyUpdate(
      documentId,
      Y.encodeStateAsUpdate(client),
    );
    const before = await first.presentationService.export(documentId);
    const beforeBytes = Y.encodeStateAsUpdate(
      await first.presentationService.document(documentId),
    );
    await first.close();

    const restarted = createLocalServer({
      config,
      presentationStore: new PresentationSnapshotStore({ directory: root }),
      presentationIdentity: () => identity,
    });
    await restarted.ready();
    expect(await restarted.presentationService.export(documentId)).toBe(before);
    expect(
      Y.encodeStateAsUpdate(
        await restarted.presentationService.document(documentId),
      ),
    ).toEqual(beforeBytes);
    await restarted.close();
  });

  it("enforces the deterministic private-LAN origin/host and dedicated bearer contract", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-p9-lan-"));
    roots.push(root);
    const config = loadLocalServerConfig({
      AIW_NETWORK_SCOPE: "lan",
      AIW_HOST: "192.168.1.20",
      AIW_PRESENTATION_ALLOWED_ORIGIN: "http://192.168.1.20:45173",
      AIW_PRESENTATION_ALLOWED_HOST: "192.168.1.20:45173",
      AIW_PRESENTATION_TOKEN: "presentation-authority",
      AIW_PRESENTATION_DATA_DIR: root,
    });
    const identity = {
      workspaceId: "3".repeat(32),
      repositoryId: "4".repeat(32),
    } as const;
    const documentId = derivePresentationDocumentId(identity);
    const server = createLocalServer({
      config,
      presentationStore: new PresentationSnapshotStore({ directory: root }),
      presentationIdentity: () => identity,
    });
    await server.ready();
    const base = {
      method: "POST" as const,
      url: "/presentation/tickets",
      remoteAddress: "192.168.1.42",
      payload: { documentId },
      headers: {
        origin: config.presentationSync.allowedOrigin,
        host: config.presentationSync.allowedHost,
      },
    };
    expect((await server.inject(base)).statusCode).toBe(401);
    expect(
      (
        await server.inject({
          ...base,
          headers: {
            ...base.headers,
            authorization: "Bearer command-authority",
          },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          ...base,
          headers: {
            ...base.headers,
            origin: "http://192.168.1.99:45173",
            authorization: "Bearer presentation-authority",
          },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          ...base,
          headers: {
            ...base.headers,
            authorization: "Bearer presentation-authority",
          },
        })
      ).statusCode,
    ).toBe(201);
    await server.close();
  });
});

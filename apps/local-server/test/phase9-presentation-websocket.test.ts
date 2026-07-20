import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { loadLocalServerConfig } from "@agentintersect-world/config/node";
import {
  derivePresentationDocumentId,
  projectPresentationDocument,
  upsertAnnotation,
  upsertPhaseBoardLayout,
} from "@agentintersect-world/sync-yjs";
import { PresentationSnapshotStore } from "@agentintersect-world/sync-yjs/node";
import { BrowserPresentationProvider } from "@agentintersect-world/sync-yjs/provider";

import { createLocalServer } from "../src/server.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Phase 9 self-hosted WebSocket synchronization", () => {
  it("gracefully closes with a live presentation peer and preserves durable state", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-p9-ws-close-"));
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
    const store = new PresentationSnapshotStore({ directory: root });
    const server = createLocalServer({
      config,
      presentationStore: store,
      presentationIdentity: () => identity,
    });
    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.server.address();
    if (!address || typeof address === "string")
      throw new Error("missing address");
    const response = await server.inject({
      method: "POST",
      url: "/presentation/tickets",
      headers: {
        origin: config.presentationSync.allowedOrigin,
        host: config.presentationSync.allowedHost,
      },
      payload: { documentId },
    });
    class HeaderSocket extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols, {
          origin: config.presentationSync.allowedOrigin,
          headers: { host: config.presentationSync.allowedHost },
        });
      }
    }
    const provider = new BrowserPresentationProvider({
      documentId,
      websocketBaseUrl: `ws://127.0.0.1:${address.port}/presentation-sync`,
      joinTicket: response.json().data.ticket as string,
      offlinePersistence: false,
      webSocketPolyfill: HeaderSocket as typeof WebSocket,
    });
    await expect.poll(() => provider.status).toBe("connected");
    upsertAnnotation(provider.document, {
      id: "annotation_01jz8close",
      objectId: "object_01jz8closepeer",
      text: "Persist before close",
    });
    await expect
      .poll(
        async () =>
          projectPresentationDocument(
            await server.presentationService.document(documentId),
            new Map(),
          ).annotations.length,
      )
      .toBe(1);

    const closePromise = server.close();
    const closedWithinBound = await Promise.race([
      closePromise.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 250)),
    ]);
    if (!closedWithinBound) provider.destroy();
    await closePromise;

    expect(closedWithinBound).toBe(true);
    expect(server.server.listening).toBe(false);
    expect(
      projectPresentationDocument(await store.load(documentId), new Map())
        .annotations,
    ).toHaveLength(1);
    provider.destroy();
  });

  it("automatically refreshes a consumed ticket after socket loss and server restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-p9-ws-reconnect-"));
    roots.push(root);
    const config = loadLocalServerConfig({
      AIW_PORT: "43770",
      AIW_PRESENTATION_ALLOWED_ORIGIN: "http://127.0.0.1:45173",
      AIW_PRESENTATION_ALLOWED_HOST: "127.0.0.1:45173",
      AIW_PRESENTATION_DATA_DIR: root,
    });
    const identity = {
      workspaceId: "c".repeat(32),
      repositoryId: "d".repeat(32),
    } as const;
    const documentId = derivePresentationDocumentId(identity);
    const createServer = () =>
      createLocalServer({
        config,
        presentationStore: new PresentationSnapshotStore({ directory: root }),
        presentationIdentity: () => identity,
      });
    let server = createServer();
    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.server.address();
    if (!address || typeof address === "string")
      throw new Error("missing address");
    const port = address.port;
    const headers = {
      origin: config.presentationSync.allowedOrigin,
      host: config.presentationSync.allowedHost,
    };
    const issue = async () => {
      const response = await server.inject({
        method: "POST",
        url: "/presentation/tickets",
        headers,
        payload: { documentId },
      });
      if (response.statusCode !== 201) throw new Error("ticket unavailable");
      return response.json().data.ticket as string;
    };
    const sockets: WebSocket[] = [];
    class HeaderSocket extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols, {
          origin: config.presentationSync.allowedOrigin,
          headers: { host: config.presentationSync.allowedHost },
        });
        sockets.push(this);
      }
    }
    let refreshCalls = 0;
    let activeRefreshes = 0;
    let maximumActiveRefreshes = 0;
    const provider = new BrowserPresentationProvider({
      documentId,
      websocketBaseUrl: `ws://127.0.0.1:${port}/presentation-sync`,
      joinTicket: await issue(),
      offlinePersistence: false,
      webSocketPolyfill: HeaderSocket as typeof WebSocket,
      refreshJoinTicket: async () => {
        refreshCalls += 1;
        activeRefreshes += 1;
        maximumActiveRefreshes = Math.max(
          maximumActiveRefreshes,
          activeRefreshes,
        );
        try {
          return await issue();
        } finally {
          activeRefreshes -= 1;
        }
      },
      reconnectDelayMs: 25,
    });
    try {
      await expect.poll(() => provider.status).toBe("connected");
      sockets.at(-1)?.terminate();
      await expect.poll(() => refreshCalls).toBeGreaterThanOrEqual(1);
      await expect.poll(() => provider.status).toBe("connected");
      expect(maximumActiveRefreshes).toBe(1);

      await server.close();
      const callsBeforeRestart = refreshCalls;
      await expect.poll(() => refreshCalls).toBeGreaterThan(callsBeforeRestart);
      upsertAnnotation(provider.document, {
        id: "annotation_01jz8restart",
        objectId: "object_01jz8restartaa",
        text: "Edited while the server was offline",
      });
      server = createServer();
      await server.listen({ host: "127.0.0.1", port });

      await expect.poll(() => provider.status).toBe("connected");
      await expect
        .poll(
          async () =>
            projectPresentationDocument(
              await server.presentationService.document(documentId),
              new Map(),
            ).annotations.length,
        )
        .toBe(1);
      expect(maximumActiveRefreshes).toBe(1);

      provider.disconnect();
      const callsWhileOffline = refreshCalls;
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(refreshCalls).toBe(callsWhileOffline);
      provider.connect();
      await expect.poll(() => provider.status).toBe("connected");
      expect(refreshCalls).toBeGreaterThan(callsWhileOffline);
    } finally {
      provider.destroy();
      await server.close();
    }
  }, 15_000);

  it("converges two contexts, relays bounded awareness, and removes clean/abrupt peers", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-p9-ws-"));
    roots.push(root);
    const config = loadLocalServerConfig({
      AIW_PORT: "43770",
      AIW_PRESENTATION_ALLOWED_ORIGIN: "http://127.0.0.1:45173",
      AIW_PRESENTATION_ALLOWED_HOST: "127.0.0.1:45173",
      AIW_PRESENTATION_DATA_DIR: root,
    });
    const identity = {
      workspaceId: "e".repeat(32),
      repositoryId: "f".repeat(32),
    } as const;
    const documentId = derivePresentationDocumentId(identity);
    const server = createLocalServer({
      config,
      presentationStore: new PresentationSnapshotStore({ directory: root }),
      presentationIdentity: () => identity,
    });
    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.server.address();
    if (!address || typeof address === "string")
      throw new Error("missing address");
    const headers = {
      origin: config.presentationSync.allowedOrigin,
      host: config.presentationSync.allowedHost,
    };
    const issue = async () => {
      const response = await server.inject({
        method: "POST",
        url: "/presentation/tickets",
        headers,
        payload: { documentId },
      });
      return response.json().data.ticket as string;
    };
    const sockets: WebSocket[] = [];
    class HeaderSocket extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols, {
          origin: config.presentationSync.allowedOrigin,
          headers: { host: config.presentationSync.allowedHost },
        });
        sockets.push(this);
      }
    }
    const baseUrl = `ws://127.0.0.1:${address.port}/presentation-sync`;
    const left = new BrowserPresentationProvider({
      documentId,
      websocketBaseUrl: baseUrl,
      joinTicket: await issue(),
      offlinePersistence: false,
      webSocketPolyfill: HeaderSocket as typeof WebSocket,
    });
    const right = new BrowserPresentationProvider({
      documentId,
      websocketBaseUrl: baseUrl,
      joinTicket: await issue(),
      offlinePersistence: false,
      webSocketPolyfill: HeaderSocket as typeof WebSocket,
    });
    await expect.poll(() => left.status).toBe("connected");
    await expect.poll(() => right.status).toBe("connected");

    upsertAnnotation(left.document, {
      id: "annotation_01jz8socket",
      objectId: "object_01jz8socketaa",
      text: "Two context note",
    });
    upsertPhaseBoardLayout(left.document, {
      phaseId: "phase_01jz8socketaa",
      column: 2,
      row: 1,
    });
    await expect
      .poll(
        () =>
          projectPresentationDocument(right.document, new Map()).annotations
            .length,
      )
      .toBe(1);
    await expect
      .poll(
        () =>
          projectPresentationDocument(right.document, new Map())
            .phaseBoardLayout.length,
      )
      .toBe(1);

    left.setAwareness({
      peerId: "peer_01jz8socketleft",
      viewId: "view_01jz8socketleft",
      display: "Left desk",
      colorToken: "blue",
      ownedAgentIds: ["agent_01jz8socketaa"],
      focusObjectId: "object_01jz8socketaa",
      activity: "active",
      presenterPeerId: "peer_01jz8socketleft",
      followPresenterId: null,
    });
    await expect
      .poll(() =>
        right.awarenessStates.some((peer) => peer.display === "Left desk"),
      )
      .toBe(true);
    left.disconnect();
    await expect
      .poll(() =>
        right.awarenessStates.some((peer) => peer.display === "Left desk"),
      )
      .toBe(false);

    const abrupt = new BrowserPresentationProvider({
      documentId,
      websocketBaseUrl: baseUrl,
      joinTicket: await issue(),
      offlinePersistence: false,
      webSocketPolyfill: HeaderSocket as typeof WebSocket,
    });
    await expect.poll(() => abrupt.status).toBe("connected");
    abrupt.setAwareness({
      peerId: "peer_01jz8socketdrop",
      viewId: "view_01jz8socketdrop",
      display: "Drop desk",
      colorToken: "rose",
      ownedAgentIds: [],
      activity: "active",
    });
    await expect
      .poll(() =>
        right.awarenessStates.some((peer) => peer.display === "Drop desk"),
      )
      .toBe(true);
    sockets.at(-1)?.terminate();
    await expect
      .poll(() =>
        right.awarenessStates.some((peer) => peer.display === "Drop desk"),
      )
      .toBe(false);

    const attacker = new BrowserPresentationProvider({
      documentId,
      websocketBaseUrl: baseUrl,
      joinTicket: await issue(),
      offlinePersistence: false,
      webSocketPolyfill: HeaderSocket as typeof WebSocket,
    });
    await expect.poll(() => attacker.status).toBe("connected");
    attacker.document.getMap("commandIntents").set("run", "test");
    await expect.poll(() => attacker.status).toBe("offline");
    expect([
      ...(await server.presentationService.document(documentId)).share.keys(),
    ]).not.toContain("commandIntents");
    expect(server.operationService.list()).toHaveLength(0);

    attacker.destroy();
    abrupt.destroy();
    right.destroy();
    left.destroy();
    await server.close();
  }, 15_000);
});

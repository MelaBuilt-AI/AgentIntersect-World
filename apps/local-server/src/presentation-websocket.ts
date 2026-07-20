import type { IncomingMessage, Server } from "node:http";
import type { Socket } from "node:net";

import {
  PRESENTATION_LIMITS,
  PresentationValidationError,
  sanitizeAwarenessState,
  validateAwarenessPeerCount,
} from "@agentintersect-world/sync-yjs";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import WebSocket, { WebSocketServer } from "ws";

import type { PresentationSyncService } from "./presentation-sync.js";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const SYNC_STEP_1 = 0;
const SYNC_STEP_2 = 1;
const SYNC_UPDATE = 2;

type Room = {
  readonly awareness: Awareness;
  readonly connections: Map<WebSocket, Set<number>>;
};

export type PresentationWebSocketTransportOptions = {
  readonly server: Server;
  readonly service: PresentationSyncService;
  readonly allowedOrigin: string;
  readonly allowedHost: string;
  readonly isAllowedAddress: (address: string) => boolean;
};

export class PresentationWebSocketTransport {
  readonly #server: Server;
  readonly #service: PresentationSyncService;
  readonly #allowedOrigin: string;
  readonly #allowedHost: string;
  readonly #isAllowedAddress: (address: string) => boolean;
  readonly #websockets = new WebSocketServer({ noServer: true });
  readonly #rooms = new Map<string, Room>();
  readonly #queues = new WeakMap<WebSocket, Promise<void>>();
  readonly #upgrade: (
    request: IncomingMessage,
    socket: Socket,
    head: Buffer,
  ) => void;

  constructor(options: PresentationWebSocketTransportOptions) {
    this.#server = options.server;
    this.#service = options.service;
    this.#allowedOrigin = options.allowedOrigin;
    this.#allowedHost = options.allowedHost;
    this.#isAllowedAddress = options.isAllowedAddress;
    this.#upgrade = (request, socket, head) => {
      void this.#handleUpgrade(request, socket, head);
    };
    this.#server.on("upgrade", this.#upgrade);
  }

  async #handleUpgrade(
    request: IncomingMessage,
    socket: Socket,
    head: Buffer,
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? "/", "http://local");
      const match = /^\/presentation-sync\/(doc_[a-f0-9]{32})$/.exec(
        url.pathname,
      );
      const documentId = match?.[1];
      const ticket = url.searchParams.get("ticket");
      const address = request.socket.remoteAddress ?? "";
      const reject = (status: string) => {
        socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
        socket.destroy();
      };
      if (!documentId || !ticket) {
        reject("400 Bad Request");
        return;
      }
      if (
        request.headers.origin !== this.#allowedOrigin ||
        request.headers.host !== this.#allowedHost ||
        !this.#isAllowedAddress(address)
      ) {
        reject("403 Forbidden");
        return;
      }
      if (!this.#service.consumeTicket(documentId, ticket)) {
        reject("401 Unauthorized");
        return;
      }
      const document = await this.#service.document(documentId);
      let room = this.#rooms.get(documentId);
      if (!room) {
        const awareness = new Awareness(document);
        awareness.setLocalState(null);
        room = { awareness, connections: new Map() };
        awareness.on(
          "update",
          ({
            added,
            updated,
            removed,
          }: {
            added: number[];
            updated: number[];
            removed: number[];
          }) => {
            const changed = [...added, ...updated, ...removed];
            if (changed.length === 0) return;
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
            encoding.writeVarUint8Array(
              encoder,
              encodeAwarenessUpdate(awareness, changed),
            );
            this.#broadcast(room as Room, encoding.toUint8Array(encoder));
          },
        );
        this.#rooms.set(documentId, room);
      }
      if (room.connections.size >= PRESENTATION_LIMITS.maxPeers) {
        socket.write(
          "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n",
        );
        socket.destroy();
        return;
      }
      const selectedRoom = room;
      this.#websockets.handleUpgrade(request, socket, head, (websocket) => {
        selectedRoom.connections.set(websocket, new Set());
        this.#connect(documentId, selectedRoom, websocket);
      });
    } catch {
      socket.destroy();
    }
  }

  #connect(documentId: string, room: Room, websocket: WebSocket): void {
    const sync = encoding.createEncoder();
    encoding.writeVarUint(sync, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(sync, room.awareness.doc);
    websocket.send(encoding.toUint8Array(sync));
    const awarenessClients = [...room.awareness.getStates().keys()];
    if (awarenessClients.length > 0) {
      const awareness = encoding.createEncoder();
      encoding.writeVarUint(awareness, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awareness,
        encodeAwarenessUpdate(room.awareness, awarenessClients),
      );
      websocket.send(encoding.toUint8Array(awareness));
    }
    websocket.on("message", (data) => {
      const bytes = new Uint8Array(data as Buffer);
      const previous = this.#queues.get(websocket) ?? Promise.resolve();
      const next = previous
        .then(() => this.#message(documentId, room, websocket, bytes))
        .catch(() => {
          websocket.close(1008, "invalid presentation message");
        });
      this.#queues.set(websocket, next);
    });
    websocket.on("close", () => {
      const clients = room.connections.get(websocket);
      room.connections.delete(websocket);
      if (clients && clients.size > 0) {
        removeAwarenessStates(room.awareness, [...clients], "disconnect");
      }
    });
  }

  async #message(
    documentId: string,
    room: Room,
    websocket: WebSocket,
    bytes: Uint8Array,
  ): Promise<void> {
    if (bytes.byteLength > PRESENTATION_LIMITS.maxIncomingUpdateBytes + 64) {
      throw new PresentationValidationError(
        "Presentation message is too large",
      );
    }
    const decoder = decoding.createDecoder(bytes);
    const kind = decoding.readVarUint(decoder);
    if (kind === MESSAGE_SYNC) {
      const syncKind = decoding.readVarUint(decoder);
      if (syncKind === SYNC_STEP_1) {
        const stateVector = decoding.readVarUint8Array(decoder);
        const response = encoding.createEncoder();
        encoding.writeVarUint(response, MESSAGE_SYNC);
        syncProtocol.writeSyncStep2(response, room.awareness.doc, stateVector);
        websocket.send(encoding.toUint8Array(response));
        return;
      }
      if (syncKind !== SYNC_STEP_2 && syncKind !== SYNC_UPDATE) {
        throw new PresentationValidationError("Unsupported Yjs sync message");
      }
      const update = decoding.readVarUint8Array(decoder);
      await this.#service.applyUpdate(documentId, update);
      this.#broadcast(room, bytes, websocket);
      return;
    }
    if (kind === MESSAGE_AWARENESS) {
      const update = decoding.readVarUint8Array(decoder);
      const validated = this.#validateAwareness(room, websocket, update);
      const owned = room.connections.get(websocket);
      if (!owned) throw new PresentationValidationError("Peer is disconnected");
      for (const client of validated.clients) owned.add(client);
      if (validated.apply)
        applyAwarenessUpdate(room.awareness, update, websocket);
      return;
    }
    throw new PresentationValidationError("Unsupported presentation message");
  }

  #validateAwareness(
    room: Room,
    websocket: WebSocket,
    update: Uint8Array,
  ): { readonly clients: number[]; readonly apply: boolean } {
    const decoder = decoding.createDecoder(update);
    const count = decoding.readVarUint(decoder);
    if (count > 1) {
      throw new PresentationValidationError(
        "One awareness peer is allowed per view",
      );
    }
    const owned = room.connections.get(websocket);
    if (!owned) throw new PresentationValidationError("Peer is disconnected");
    const clients: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const client = decoding.readVarUint(decoder);
      decoding.readVarUint(decoder);
      const json = decoding.readVarString(decoder);
      const state = JSON.parse(json) as unknown;
      if (!owned.has(client) && state === null) {
        return { clients: [], apply: false };
      }
      if (!owned.has(client) && room.awareness.getStates().has(client)) {
        const existing = room.awareness.getStates().get(client);
        if (
          state === null ||
          JSON.stringify(existing) === JSON.stringify(state)
        ) {
          return { clients: [], apply: false };
        }
        throw new PresentationValidationError(
          "Awareness client identity changed",
        );
      }
      if (owned.size > 0 && !owned.has(client)) {
        throw new PresentationValidationError(
          "Awareness client identity changed",
        );
      }
      if (state !== null) {
        const sanitized = sanitizeAwarenessState(state as never);
        if (JSON.stringify(sanitized) !== JSON.stringify(state)) {
          throw new PresentationValidationError(
            "Awareness state must already be sanitized presentation data",
          );
        }
      }
      clients.push(client);
    }
    const newClients = clients.filter(
      (client) => !room.awareness.getStates().has(client),
    ).length;
    validateAwarenessPeerCount(room.awareness.getStates().size + newClients);
    return { clients, apply: true };
  }

  #broadcast(room: Room, message: Uint8Array, except?: WebSocket): void {
    for (const connection of room.connections.keys()) {
      if (connection !== except && connection.readyState === WebSocket.OPEN) {
        connection.send(message);
      }
    }
  }

  deleteDocument(documentId: string): void {
    const room = this.#rooms.get(documentId);
    if (!room) return;
    for (const connection of room.connections.keys()) {
      connection.close(1008, "presentation document deleted");
    }
    room.awareness.destroy();
    this.#rooms.delete(documentId);
  }

  close(): void {
    this.#server.off("upgrade", this.#upgrade);
    for (const room of this.#rooms.values()) {
      for (const connection of room.connections.keys()) {
        connection.close(1001, "presentation server stopping");
      }
      room.awareness.destroy();
    }
    this.#rooms.clear();
    this.#websockets.close();
  }
}

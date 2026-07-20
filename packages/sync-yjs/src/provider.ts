import { IndexeddbPersistence, clearDocument } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

import {
  PRESENTATION_LIMITS,
  PRESENTATION_SYNC_CAPABILITY,
  type PresentationAwarenessState,
  createPresentationDocument,
  sanitizeAwarenessState,
} from "./index.js";

export type PresentationConnectionStatus =
  "offline" | "connecting" | "connected";

export interface PresentationProvider {
  readonly capabilities: typeof PRESENTATION_SYNC_CAPABILITY;
  readonly documentId: string;
  readonly localCacheKey: string;
  readonly heartbeatMs: number;
  readonly awarenessExpiryMs: number;
  readonly document: Y.Doc;
  readonly status: PresentationConnectionStatus;
  readonly lastSyncAt: string | null;
  readonly awarenessStates: readonly PresentationAwarenessState[];
  connect(joinTicket?: string): void;
  disconnect(): void;
  setAwareness(state: PresentationAwarenessState): void;
  clearLocal(): Promise<void>;
  destroy(): void;
}

export type BrowserPresentationProviderOptions = {
  readonly documentId: string;
  readonly websocketBaseUrl: string;
  readonly joinTicket: string;
  readonly connect?: boolean;
  readonly offlinePersistence?: boolean;
  readonly webSocketPolyfill?: typeof WebSocket;
  readonly refreshJoinTicket?: () => Promise<string>;
  readonly reconnectDelayMs?: number;
};

export class BrowserPresentationProvider implements PresentationProvider {
  readonly capabilities = PRESENTATION_SYNC_CAPABILITY;
  readonly localCacheKey: string;
  readonly heartbeatMs = PRESENTATION_LIMITS.heartbeatMs;
  readonly awarenessExpiryMs = PRESENTATION_LIMITS.awarenessExpiryMs;
  readonly document: Y.Doc;
  readonly #websocket: WebsocketProvider;
  readonly #indexeddb: IndexeddbPersistence | null;
  readonly #refreshJoinTicket: (() => Promise<string>) | null;
  readonly #reconnectDelayMs: number;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #refreshPromise: Promise<void> | null = null;
  #reconnectAttempt = 0;
  #desiredOnline: boolean;
  #destroyed = false;
  #status: PresentationConnectionStatus = "offline";
  #lastSyncAt: string | null = null;
  #localAwarenessState: PresentationAwarenessState;

  constructor(options: BrowserPresentationProviderOptions) {
    if (
      options.reconnectDelayMs !== undefined &&
      (!Number.isInteger(options.reconnectDelayMs) ||
        options.reconnectDelayMs < 0 ||
        options.reconnectDelayMs > 5_000)
    ) {
      throw new Error("Presentation reconnect delay must be 0 through 5000 ms");
    }
    this.localCacheKey = options.documentId;
    this.#refreshJoinTicket = options.refreshJoinTicket ?? null;
    this.#reconnectDelayMs = options.reconnectDelayMs ?? 250;
    this.#desiredOnline = options.connect ?? true;
    this.document = createPresentationDocument(options.documentId);
    this.#indexeddb =
      options.offlinePersistence === false
        ? null
        : new IndexeddbPersistence(this.localCacheKey, this.document);
    const awareness = new Awareness(this.document);
    const clientToken = this.document.clientID.toString(36).padStart(8, "0");
    this.#localAwarenessState = sanitizeAwarenessState({
      peerId: `peer_${clientToken}`,
      viewId: `view_${clientToken}`,
      display: "Local view",
      colorToken: "blue",
      ownedAgentIds: [],
      activity: "active",
    });
    awareness.setLocalState(this.#localAwarenessState);
    this.#websocket = new WebsocketProvider(
      options.websocketBaseUrl,
      options.documentId,
      this.document,
      {
        connect: options.connect ?? true,
        awareness,
        params: { ticket: options.joinTicket },
        disableBc: true,
        resyncInterval: this.heartbeatMs,
        ...(options.webSocketPolyfill
          ? { WebSocketPolyfill: options.webSocketPolyfill }
          : {}),
      },
    );
    this.#websocket.on("status", ({ status }) => {
      this.#status = status === "disconnected" ? "offline" : status;
      if (status === "connected") this.#reconnectAttempt = 0;
    });
    this.#websocket.on("connection-close", () => {
      if (!this.#refreshJoinTicket || !this.#desiredOnline || this.#destroyed)
        return;
      this.#websocket.shouldConnect = false;
      this.#status = "offline";
      this.#scheduleTicketRefresh();
    });
    this.#websocket.on("sync", (synced) => {
      if (synced) this.#lastSyncAt = new Date().toISOString();
    });
    if (options.connect ?? true) this.#startHeartbeat();
  }

  get documentId(): string {
    return this.document.guid;
  }

  get status(): PresentationConnectionStatus {
    return this.#status;
  }

  get lastSyncAt(): string | null {
    return this.#lastSyncAt;
  }

  get awarenessStates(): readonly PresentationAwarenessState[] {
    const states: PresentationAwarenessState[] = [];
    for (const state of this.#websocket.awareness.getStates().values()) {
      try {
        states.push(
          sanitizeAwarenessState(state as PresentationAwarenessState),
        );
      } catch {
        // Invalid remote awareness is never projected.
      }
    }
    const presenters = new Set(
      states
        .map((state) => state.presenterPeerId)
        .filter((peer): peer is string => typeof peer === "string"),
    );
    return states.map((state) =>
      state.followPresenterId && !presenters.has(state.followPresenterId)
        ? { ...state, followPresenterId: null }
        : state,
    );
  }

  connect(joinTicket?: string): void {
    if (this.#destroyed) return;
    this.#desiredOnline = true;
    this.#clearReconnectTimer();
    if (!joinTicket && this.#refreshJoinTicket) {
      this.#websocket.shouldConnect = false;
      this.#scheduleTicketRefresh(true);
      return;
    }
    if (joinTicket) this.#websocket.params.ticket = joinTicket;
    this.#websocket.awareness.setLocalState(this.#localAwarenessState);
    this.#status = "connecting";
    this.#websocket.connect();
    this.#startHeartbeat();
  }

  disconnect(): void {
    this.#desiredOnline = false;
    this.#clearReconnectTimer();
    this.#stopHeartbeat();
    this.#websocket.awareness.setLocalState(null);
    this.#websocket.disconnect();
    this.#status = "offline";
  }

  setAwareness(state: PresentationAwarenessState): void {
    this.#localAwarenessState = sanitizeAwarenessState(state);
    this.#websocket.awareness.setLocalState(this.#localAwarenessState);
  }

  async clearLocal(): Promise<void> {
    if (this.#indexeddb) await this.#indexeddb.clearData();
    else await clearDocument(this.localCacheKey);
  }

  destroy(): void {
    this.#destroyed = true;
    this.#desiredOnline = false;
    this.#clearReconnectTimer();
    this.#stopHeartbeat();
    this.#websocket.awareness.setLocalState(null);
    this.#websocket.destroy();
    if (this.#indexeddb) void this.#indexeddb.destroy();
    this.document.destroy();
    this.#status = "offline";
  }

  #startHeartbeat(): void {
    if (this.#heartbeat) return;
    this.#heartbeat = setInterval(() => {
      const state = this.#websocket.awareness.getLocalState();
      if (state) this.#websocket.awareness.setLocalState(state);
    }, this.heartbeatMs);
  }

  #stopHeartbeat(): void {
    if (!this.#heartbeat) return;
    clearInterval(this.#heartbeat);
    this.#heartbeat = null;
  }

  #scheduleTicketRefresh(immediate = false): void {
    if (
      this.#reconnectTimer ||
      this.#refreshPromise ||
      !this.#refreshJoinTicket ||
      !this.#desiredOnline ||
      this.#destroyed
    )
      return;
    const delay = immediate
      ? 0
      : Math.min(
          this.#reconnectDelayMs * 2 ** Math.min(this.#reconnectAttempt, 5),
          5_000,
        );
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      void this.#refreshTicketAndConnect();
    }, delay);
  }

  async #refreshTicketAndConnect(): Promise<void> {
    if (
      this.#refreshPromise ||
      !this.#refreshJoinTicket ||
      !this.#desiredOnline ||
      this.#destroyed
    )
      return;
    this.#status = "connecting";
    const refresh = (async () => {
      try {
        const ticket = await this.#refreshJoinTicket!();
        if (!/^ticket_[a-f0-9]{48}$/.test(ticket)) {
          throw new Error(
            "Presentation ticket refresh returned an invalid ticket",
          );
        }
        if (!this.#desiredOnline || this.#destroyed) return;
        this.#websocket.params.ticket = ticket;
        this.#websocket.awareness.setLocalState(this.#localAwarenessState);
        this.#websocket.connect();
        this.#startHeartbeat();
      } catch {
        this.#status = "offline";
        this.#reconnectAttempt += 1;
      }
    })();
    this.#refreshPromise = refresh;
    await refresh;
    this.#refreshPromise = null;
    if (
      this.#desiredOnline &&
      !this.#destroyed &&
      !this.#websocket.shouldConnect
    ) {
      this.#scheduleTicketRefresh();
    }
  }

  #clearReconnectTimer(): void {
    if (!this.#reconnectTimer) return;
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
  }
}

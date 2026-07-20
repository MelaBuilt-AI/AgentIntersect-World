import {
  projectPresentationDocument,
  upsertAnnotation,
  upsertBookmark,
  upsertObjectLayout,
  type PresentationAwarenessState,
} from "@agentintersect-world/sync-yjs";
import {
  BrowserPresentationProvider,
  type PresentationProvider,
} from "@agentintersect-world/sync-yjs/provider";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  deletePresentationDocument,
  exportPresentationDocument,
  getPresentationStatus,
  issuePresentationTicket,
  loadPresentationAuthority,
} from "./presentation-client.js";
import {
  PresentationPanel,
  type PresentationLaneActions,
  type PresentationLaneState,
} from "./PresentationPanel.js";

const INITIAL_STATE: PresentationLaneState = {
  documentId: null,
  currentObjectId: null,
  networkScope: "loopback",
  transport: "ws/http",
  encrypted: false,
  unencryptedLanWarning: false,
  connection: "offline",
  peers: [],
  annotations: [],
  bookmarks: [],
  objectLayouts: [],
  phaseBoardLayouts: 0,
  lastSyncAt: null,
  previousSyncAt: null,
  authoritativeMessage: "Loading authoritative local presentation status.",
};

function browserSocketBase(path: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api${path}`;
}

function ephemeralId(prefix: "peer" | "view"): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function PresentationPanelLoader() {
  const [state, setState] = useState<PresentationLaneState>(INITIAL_STATE);
  const provider = useRef<PresentationProvider | null>(null);
  const bearer = useRef("");
  const counter = useRef(0);
  const userOffline = useRef(false);
  const identity = useRef({
    peerId: ephemeralId("peer"),
    viewId: ephemeralId("view"),
  });
  const awareness = useRef<PresentationAwarenessState | null>(null);
  const authoritativeObjects = useRef<ReadonlyMap<string, string> | null>(null);

  const updateProjection = useCallback(() => {
    const current = provider.current;
    const currentObjects = authoritativeObjects.current;
    if (!current || !currentObjects) return;
    try {
      const projection = projectPresentationDocument(
        current.document,
        currentObjects,
      );
      setState((previous) => {
        const lastSyncAt = current.lastSyncAt;
        return {
          ...previous,
          connection: current.status,
          peers: current.awarenessStates,
          annotations: projection.annotations.map((entry) => ({
            id: String(entry["id"]),
            orphan: entry.orphan,
          })),
          bookmarks: projection.bookmarks.map((entry) => ({
            id: String(entry["id"]),
            orphan: entry.orphan,
          })),
          objectLayouts: projection.objectLayouts.map((entry) => ({
            objectId: String(entry["objectId"]),
            orphan: entry.orphan,
          })),
          phaseBoardLayouts: projection.phaseBoardLayout.length,
          previousSyncAt:
            lastSyncAt && lastSyncAt !== previous.lastSyncAt
              ? previous.lastSyncAt
              : previous.previousSyncAt,
          lastSyncAt,
        };
      });
    } catch {
      setState((previous) => ({
        ...previous,
        authoritativeMessage: "Invalid presentation state was ignored.",
      }));
    }
  }, []);

  const refresh = useCallback(async () => {
    const status = await getPresentationStatus(
      fetch,
      bearer.current || undefined,
    );
    if (status.status !== "ok") {
      setState((previous) => ({
        ...previous,
        connection: "offline",
        authoritativeMessage:
          status.status === "unavailable" ? status.message : status.message,
      }));
      return;
    }
    const capability = status.data;
    setState((previous) => ({
      ...previous,
      documentId: capability.documentId,
      networkScope: capability.networkScope,
      transport: capability.transport,
      encrypted: capability.encrypted,
      unencryptedLanWarning: capability.unencryptedLanWarning,
      authoritativeMessage: capability.documentId
        ? "Authoritative World presentation room is available."
        : "Index a repository to establish the authoritative presentation room.",
    }));
    if (!capability.documentId) return;
    let authority;
    try {
      authority = await loadPresentationAuthority(fetch);
    } catch {
      setState((previous) => ({
        ...previous,
        authoritativeMessage:
          "Authoritative World objects or owned-agent roster are unavailable.",
      }));
      return;
    }
    authoritativeObjects.current = authority.authoritativeObjects;
    setState((previous) => ({
      ...previous,
      currentObjectId: authority.selectedObjectId,
    }));
    const freshTicket = async () => {
      const result = await issuePresentationTicket(
        capability.documentId!,
        bearer.current || undefined,
      );
      if (result.status !== "ok") throw new Error(result.message);
      return result.data.ticket;
    };
    const ticket = await issuePresentationTicket(
      capability.documentId,
      bearer.current || undefined,
    );
    if (ticket.status !== "ok") {
      setState((previous) => ({
        ...previous,
        authoritativeMessage: ticket.message,
      }));
      return;
    }
    provider.current?.destroy();
    const next = new BrowserPresentationProvider({
      documentId: capability.documentId,
      websocketBaseUrl: browserSocketBase(ticket.data.websocketPath),
      joinTicket: ticket.data.ticket,
      refreshJoinTicket: freshTicket,
      connect: !userOffline.current,
    });
    provider.current = next;
    const viewName = new URLSearchParams(window.location.search).get("view");
    awareness.current = {
      ...identity.current,
      display: viewName === "right" ? "Right desk" : "Left desk",
      colorToken: viewName === "right" ? "rose" : "blue",
      ownedAgentIds: authority.ownedAgentIds,
      ...(authority.selectedObjectId
        ? { focusObjectId: authority.selectedObjectId }
        : {}),
      activity: "active",
      presenterPeerId: null,
      followPresenterId: null,
    };
    next.setAwareness(awareness.current);
    next.document.on("update", updateProjection);
    updateProjection();
  }, [updateProjection]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(updateProjection, 500);
    return () => {
      window.clearInterval(timer);
      const current = provider.current;
      if (current) {
        current.document.off("update", updateProjection);
        current.destroy();
      }
      provider.current = null;
    };
  }, [refresh, updateProjection]);

  const nextId = (prefix: string) => {
    counter.current += 1;
    const peer = identity.current.peerId.slice("peer_".length);
    return `${prefix}_${peer}${counter.current.toString(36).padStart(8, "0")}`;
  };
  const setAwareness = (patch: Partial<PresentationAwarenessState>) => {
    if (!provider.current || !awareness.current) return;
    awareness.current = { ...awareness.current, ...patch };
    provider.current.setAwareness(awareness.current);
    updateProjection();
  };

  const actions: PresentationLaneActions = {
    connect: () => {
      userOffline.current = false;
      if (provider.current && state.documentId) {
        provider.current.connect();
      } else void refresh();
    },
    disconnect: () => {
      userOffline.current = true;
      provider.current?.disconnect();
      updateProjection();
    },
    addAnnotation: (objectId, text) => {
      if (!provider.current) return;
      try {
        upsertAnnotation(provider.current.document, {
          id: nextId("annotation"),
          objectId,
          text,
        });
        setState((previous) => ({
          ...previous,
          authoritativeMessage: "Annotation stored as presentation-only state.",
        }));
      } catch {
        setState((previous) => ({
          ...previous,
          authoritativeMessage:
            "Annotation was rejected by presentation bounds.",
        }));
      }
    },
    addBookmark: (objectId, label) => {
      if (!provider.current) return;
      try {
        upsertBookmark(provider.current.document, {
          id: nextId("bookmark"),
          objectId,
          label,
        });
      } catch {
        setState((previous) => ({
          ...previous,
          authoritativeMessage: "Bookmark was rejected by presentation bounds.",
        }));
      }
    },
    setLayout: (objectId) => {
      if (!provider.current) return;
      try {
        upsertObjectLayout(provider.current.document, {
          objectId,
          x: counter.current % 8,
          z: (counter.current * 2) % 8,
        });
      } catch {
        setState((previous) => ({
          ...previous,
          authoritativeMessage: "Layout was rejected by presentation bounds.",
        }));
      }
    },
    present: () => setAwareness({ presenterPeerId: identity.current.peerId }),
    follow: () => {
      const presenter = provider.current?.awarenessStates.find(
        (peer) => peer.presenterPeerId === peer.peerId,
      );
      setAwareness({ followPresenterId: presenter?.peerId ?? null });
    },
    exportDocument: () => {
      if (!state.documentId) return;
      void exportPresentationDocument(
        state.documentId,
        bearer.current || undefined,
      ).then((text) => {
        const blob = new Blob([text], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = `${state.documentId}.presentation.json`;
        anchor.click();
        URL.revokeObjectURL(href);
      });
    },
    deleteDocument: (documentId) => {
      void deletePresentationDocument(
        documentId,
        bearer.current || undefined,
      ).then((result) => {
        if (result.status === "ok") {
          provider.current?.destroy();
          provider.current = null;
          setState((previous) => ({
            ...previous,
            connection: "offline",
            peers: [],
            annotations: [],
            bookmarks: [],
            objectLayouts: [],
            phaseBoardLayouts: 0,
            authoritativeMessage: "Server presentation state deleted.",
          }));
        }
      });
    },
    clearLocal: () => {
      void provider.current?.clearLocal().then(() => {
        setState((previous) => ({
          ...previous,
          authoritativeMessage: "Browser-local presentation cache cleared.",
        }));
      });
    },
    setBearer: (value) => {
      bearer.current = value;
    },
    refreshStatus: () => void refresh(),
  };

  return (
    <PresentationPanel
      key={state.currentObjectId ?? "no-current-object"}
      state={state}
      actions={actions}
    />
  );
}

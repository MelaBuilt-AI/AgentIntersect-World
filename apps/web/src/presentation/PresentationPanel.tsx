import { useState } from "react";

export type PresentationPeerView = {
  readonly peerId: string;
  readonly display: string;
  readonly colorToken: string;
  readonly ownedAgentIds: readonly string[];
  readonly focusObjectId?: string;
  readonly presenterPeerId?: string | null;
  readonly followPresenterId?: string | null;
};

export type PresentationLaneState = {
  readonly documentId: string | null;
  readonly currentObjectId: string | null;
  readonly networkScope: "loopback" | "lan";
  readonly transport: "ws/http" | "wss/https";
  readonly encrypted: boolean;
  readonly unencryptedLanWarning: boolean;
  readonly connection: "offline" | "connecting" | "connected";
  readonly peers: readonly PresentationPeerView[];
  readonly annotations: readonly {
    readonly id: string;
    readonly orphan: boolean;
  }[];
  readonly bookmarks: readonly {
    readonly id: string;
    readonly orphan: boolean;
  }[];
  readonly objectLayouts: readonly {
    readonly objectId: string;
    readonly orphan: boolean;
  }[];
  readonly phaseBoardLayouts: number;
  readonly lastSyncAt: string | null;
  readonly previousSyncAt: string | null;
  readonly authoritativeMessage: string;
};

export type PresentationLaneActions = {
  readonly connect: () => void;
  readonly disconnect: () => void;
  readonly addAnnotation: (objectId: string, text: string) => void;
  readonly addBookmark: (objectId: string, label: string) => void;
  readonly setLayout: (objectId: string) => void;
  readonly present: () => void;
  readonly follow: () => void;
  readonly exportDocument: () => void;
  readonly deleteDocument: (documentId: string) => void;
  readonly clearLocal: () => void;
  readonly setBearer?: (bearer: string) => void;
  readonly refreshStatus?: () => void;
};

function syncTime(value: string | null): string {
  return value ?? "not synchronized";
}

export function PresentationPanel({
  state,
  actions,
}: {
  readonly state: PresentationLaneState;
  readonly actions?: PresentationLaneActions;
}) {
  const [objectId, setObjectId] = useState(state.currentObjectId ?? "");
  const [note, setNote] = useState("Shared note");
  const [confirmation, setConfirmation] = useState("");
  const enabled = state.documentId !== null && actions !== undefined;
  const presenter = state.peers.find(
    (peer) => peer.presenterPeerId === peer.peerId,
  );
  const follower = state.peers.find((peer) => peer.followPresenterId);
  const followed = follower?.followPresenterId
    ? state.peers.find((peer) => peer.peerId === follower.followPresenterId)
    : undefined;
  const orphans = [
    ...state.annotations,
    ...state.bookmarks,
    ...state.objectLayouts,
  ].filter((item) => item.orphan).length;

  return (
    <section className="presentation-lane" aria-labelledby="presentation-title">
      <header className="presentation-lane__header">
        <div>
          <span className="terminal-kicker">phase9_presentation_</span>
          <h2 id="presentation-title">Presentation sync</h2>
        </div>
        <span
          className={`integration-status integration-status--${state.connection}`}
        >
          {state.connection}
        </span>
      </header>

      <div className="presentation-summary">
        <div>
          <span>Current room</span>
          <strong>{state.documentId ?? "not established"}</strong>
        </div>
        <div>
          <span>Privacy</span>
          <strong>private · one trusted operator</strong>
        </div>
        <div>
          <span>Transport</span>
          <strong>
            {state.transport} · {state.networkScope}
          </strong>
        </div>
        <div>
          <span>Presence</span>
          <strong>{state.peers.length} / 16 peers</strong>
        </div>
      </div>

      {state.unencryptedLanWarning && (
        <p className="presentation-warning" role="alert">
          Trusted-LAN presentation transport is unencrypted. Use an
          operator-controlled TLS reverse proxy when encryption is required.
        </p>
      )}

      {state.networkScope === "lan" && (
        <div className="presentation-lan-authority">
          <label>
            LAN presentation bearer (memory only)
            <input
              type="password"
              autoComplete="off"
              onChange={(event) => actions?.setBearer?.(event.target.value)}
            />
          </label>
          <button type="button" onClick={actions?.refreshStatus}>
            Authorize presentation
          </button>
        </div>
      )}

      <div className="presentation-grid">
        <section>
          <h3>Peers and owned-agent presence</h3>
          {state.peers.length === 0 ? (
            <p>No awareness peers connected.</p>
          ) : (
            <ul className="presentation-peers">
              {state.peers.map((peer) => (
                <li key={peer.peerId}>
                  <strong>{peer.display}</strong>
                  <span>{peer.ownedAgentIds.length} owned agents</span>
                  <span>Agent focus: {peer.focusObjectId ?? "none"}</span>
                </li>
              ))}
            </ul>
          )}
          <p>Presenter: {presenter?.display ?? "none"}</p>
          <p>Following: {followed?.display ?? "none"}</p>
          <div className="presentation-actions">
            <button
              type="button"
              disabled={!enabled}
              onClick={actions?.present}
            >
              Present this view
            </button>
            <button type="button" disabled={!enabled} onClick={actions?.follow}>
              Follow presenter
            </button>
          </div>
        </section>

        <section>
          <h3>Durable presentation state</h3>
          <dl className="presentation-counts">
            <div>
              <dt>Annotations</dt>
              <dd>{state.annotations.length}</dd>
            </div>
            <div>
              <dt>Bookmarks</dt>
              <dd>{state.bookmarks.length}</dd>
            </div>
            <div>
              <dt>Layout overrides</dt>
              <dd>{state.objectLayouts.length}</dd>
            </div>
            <div>
              <dt>Phase-board layout</dt>
              <dd>{state.phaseBoardLayouts}</dd>
            </div>
          </dl>
          <p>
            {orphans} orphan{orphans === 1 ? "" : "s"}
          </p>
          <label>
            Opaque object ID
            <input
              value={objectId}
              onChange={(event) => setObjectId(event.target.value)}
              disabled={!enabled}
            />
          </label>
          <label>
            Shared plain-text note
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={!enabled}
            />
          </label>
          <div className="presentation-actions">
            <button
              type="button"
              disabled={!enabled}
              onClick={() => actions?.addAnnotation(objectId, note)}
            >
              Add annotation
            </button>
            <button
              type="button"
              disabled={!enabled}
              onClick={() => actions?.addBookmark(objectId, note)}
            >
              Add bookmark
            </button>
            <button
              type="button"
              disabled={!enabled}
              onClick={() => actions?.setLayout(objectId)}
            >
              Set layout override
            </button>
          </div>
        </section>

        <section>
          <h3>Reconnect / offline</h3>
          <p>Last sync: {syncTime(state.lastSyncAt)}</p>
          <p>Previous sync: {syncTime(state.previousSyncAt)}</p>
          <div className="presentation-actions">
            <button
              type="button"
              disabled={!enabled || state.connection === "connected"}
              onClick={actions?.connect}
            >
              Reconnect
            </button>
            <button
              type="button"
              disabled={!enabled || state.connection === "offline"}
              onClick={actions?.disconnect}
            >
              Work offline
            </button>
          </div>
          <label>
            Exact document ID to delete
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={!enabled}
            />
          </label>
          <div className="presentation-actions">
            <button
              type="button"
              disabled={!enabled}
              onClick={actions?.exportDocument}
            >
              Export sanitized JSON
            </button>
            <button
              type="button"
              disabled={!enabled || confirmation !== state.documentId}
              onClick={() => actions?.deleteDocument(confirmation)}
            >
              Delete server state
            </button>
            <button
              type="button"
              disabled={!enabled}
              onClick={actions?.clearLocal}
            >
              Clear local cache
            </button>
          </div>
        </section>
      </div>

      <p className="truthful-copy" role="status" aria-live="polite">
        {state.authoritativeMessage} Presentation-only. No command authority.
      </p>
    </section>
  );
}

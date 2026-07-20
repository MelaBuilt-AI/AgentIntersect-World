import type { PresentationLaneState } from "./PresentationPanel.js";

export const PHASE9_PRESENTATION_FIXTURE: PresentationLaneState = {
  documentId: "doc_0123456789abcdef0123456789abcdef",
  currentObjectId: "00000000000000000000000000000005",
  networkScope: "loopback",
  transport: "ws/http",
  encrypted: false,
  unencryptedLanWarning: false,
  connection: "connected",
  peers: [
    {
      peerId: "peer_01jz8fixtureleft",
      display: "Left desk",
      colorToken: "blue",
      ownedAgentIds: ["agent_01jz8fixtureaa"],
      focusObjectId: "object_01jz8fixtureaa",
      presenterPeerId: "peer_01jz8fixtureleft",
    },
    {
      peerId: "peer_01jz8fixtureright",
      display: "Right desk",
      colorToken: "rose",
      ownedAgentIds: [],
      followPresenterId: "peer_01jz8fixtureleft",
    },
  ],
  annotations: [{ id: "annotation_01jz8fixture", orphan: true }],
  bookmarks: [{ id: "bookmark_01jz8fixture", orphan: false }],
  objectLayouts: [{ objectId: "object_01jz8fixtureaa", orphan: false }],
  phaseBoardLayouts: 1,
  lastSyncAt: "2026-07-20T14:00:00.000Z",
  previousSyncAt: "2026-07-20T13:59:00.000Z",
  authoritativeMessage:
    "Durable presentation state is synchronized by the local World server.",
};

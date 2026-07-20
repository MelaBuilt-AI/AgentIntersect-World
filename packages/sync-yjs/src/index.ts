import * as Y from "yjs";

export const PRESENTATION_SCHEMA = "aiw.presentation/0.9" as const;

export const PRESENTATION_ROOTS = [
  "metadata",
  "objectLayouts",
  "annotations",
  "bookmarks",
  "phaseBoardLayout",
] as const;

export const PRESENTATION_SYNC_CAPABILITY = {
  package: "sync-yjs",
  phase: "phase9",
  synchronizationAvailable: true,
  authority: "presentation-only",
  schema: PRESENTATION_SCHEMA,
  provider: "local-self-hosted",
  publicRooms: false,
  commandAuthority: false,
} as const;

export type PresentationIdentity = {
  readonly workspaceId: string;
  readonly repositoryId: string;
};

const OPAQUE_ID = /^(?:[a-f0-9]{32,64}|[a-z][a-z0-9]*_[a-z0-9]{8,64})$/;
const ABSOLUTE_PATH = /(?:^|\s)(?:\/[^\s]+|[a-z]:[\\/][^\s]+|\\\\[^\s]+)/i;
const SAFE_COLORS = new Set([
  "blue",
  "cyan",
  "green",
  "orange",
  "purple",
  "rose",
]);
const MAX_TEXT_LENGTH = 500;

export const PRESENTATION_LIMITS = {
  maxPeers: 16,
  heartbeatMs: 10_000,
  awarenessExpiryMs: 30_000,
  maxIncomingUpdateBytes: 128 * 1024,
  maxDocumentBytes: 8 * 1024 * 1024,
  compactUpdateCount: 128,
  compactTailBytes: 1024 * 1024,
  maxDocuments: 20,
  inactiveDocumentMs: 30 * 24 * 60 * 60 * 1000,
  maxExportBytes: 1024 * 1024,
} as const;

export class PresentationValidationError extends Error {
  override readonly name = "PresentationValidationError";
}

function assertExactFields(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unsupported) {
    throw new PresentationValidationError(
      `Presentation field ${unsupported} is not allowed`,
    );
  }
}

function opaqueId(value: unknown, kind: string): string {
  if (typeof value !== "string" || !OPAQUE_ID.test(value)) {
    throw new PresentationValidationError(`${kind} must be an opaque ID`);
  }
  return value;
}

function escapedText(
  value: unknown,
  label: string,
  maximum = MAX_TEXT_LENGTH,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum ||
    ABSOLUTE_PATH.test(value) ||
    /(?:javascript:|data:text\/html|bearer\s+|token\s*[=:])/i.test(value)
  ) {
    throw new PresentationValidationError(
      `${label} contains prohibited content`,
    );
  }
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function storedEscapedText(
  value: unknown,
  label: string,
  maximum = MAX_TEXT_LENGTH,
): string {
  escapedText(value, label, maximum);
  if (typeof value !== "string" || /[<>"']/.test(value)) {
    throw new PresentationValidationError(
      `${label} must contain escaped plain text without markup`,
    );
  }
  return value;
}

function boundedNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new PresentationValidationError(`${label} is out of bounds`);
  }
  return value;
}

function upsertFields(
  document: Y.Doc,
  rootName: string,
  entryId: string,
  fields: Readonly<Record<string, string | number>>,
): void {
  document.transact(() => {
    const root = document.getMap<Y.Map<unknown>>(rootName);
    const existing = root.get(entryId);
    const current = existing ?? new Y.Map<unknown>();
    for (const [key, value] of Object.entries(fields)) current.set(key, value);
    if (!existing) root.set(entryId, current);
  }, "aiw-presentation-entry");
}

function stableHex(input: string): string {
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  return seeds
    .map((seed) => {
      let hash = seed >>> 0;
      for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash.toString(16).padStart(8, "0");
    })
    .join("");
}

export function derivePresentationDocumentId(
  identity: PresentationIdentity,
): string {
  if (
    !OPAQUE_ID.test(identity.workspaceId) ||
    !OPAQUE_ID.test(identity.repositoryId)
  ) {
    throw new Error("Presentation identity must contain only opaque IDs");
  }
  return `doc_${stableHex(
    `${PRESENTATION_SCHEMA}\u0000${identity.workspaceId}\u0000${identity.repositoryId}`,
  )}`;
}

export function createPresentationDocument(documentId: string): Y.Doc {
  if (!/^doc_[a-f0-9]{32}$/.test(documentId)) {
    throw new Error("Presentation document ID must be opaque");
  }
  const document = new Y.Doc({ guid: documentId });
  document.transact(() => {
    const metadata = document.getMap<string>("metadata");
    metadata.set("schema", PRESENTATION_SCHEMA);
    metadata.set("documentId", documentId);
    document.getMap("objectLayouts");
    document.getMap("annotations");
    document.getMap("bookmarks");
    document.getMap("phaseBoardLayout");
  }, "aiw-initialize");
  return document;
}

export type AnnotationInput = {
  readonly id: string;
  readonly objectId: string;
  readonly text: string;
};

export function upsertAnnotation(
  document: Y.Doc,
  input: AnnotationInput,
): void {
  assertExactFields(input, ["id", "objectId", "text"]);
  const id = opaqueId(input.id, "Annotation ID");
  upsertFields(document, "annotations", id, {
    id,
    objectId: opaqueId(input.objectId, "Object ID"),
    text: escapedText(input.text, "Annotation text"),
  });
}

export type BookmarkInput = {
  readonly id: string;
  readonly objectId: string;
  readonly label: string;
};

export function upsertBookmark(document: Y.Doc, input: BookmarkInput): void {
  assertExactFields(input, ["id", "objectId", "label"]);
  const id = opaqueId(input.id, "Bookmark ID");
  upsertFields(document, "bookmarks", id, {
    id,
    objectId: opaqueId(input.objectId, "Object ID"),
    label: escapedText(input.label, "Bookmark label", 120),
  });
}

export type ObjectLayoutInput = {
  readonly objectId: string;
  readonly x: number;
  readonly z: number;
};

export function upsertObjectLayout(
  document: Y.Doc,
  input: ObjectLayoutInput,
): void {
  assertExactFields(input, ["objectId", "x", "z"]);
  const objectId = opaqueId(input.objectId, "Object ID");
  upsertFields(document, "objectLayouts", objectId, {
    objectId,
    x: boundedNumber(input.x, "Layout x", -10_000, 10_000),
    z: boundedNumber(input.z, "Layout z", -10_000, 10_000),
  });
}

export type PhaseBoardLayoutInput = {
  readonly phaseId: string;
  readonly column: number;
  readonly row: number;
};

export function upsertPhaseBoardLayout(
  document: Y.Doc,
  input: PhaseBoardLayoutInput,
): void {
  assertExactFields(input, ["phaseId", "column", "row"]);
  const phaseId = opaqueId(input.phaseId, "Phase ID");
  upsertFields(document, "phaseBoardLayout", phaseId, {
    phaseId,
    column: boundedNumber(input.column, "Phase column", 0, 64),
    row: boundedNumber(input.row, "Phase row", 0, 64),
  });
}

type ProjectedEntry = Record<string, string | number | boolean | undefined> & {
  readonly orphan: boolean;
  readonly currentLabel?: string;
};

export type PresentationProjection = {
  readonly schema: typeof PRESENTATION_SCHEMA;
  readonly documentId: string;
  readonly annotations: readonly ProjectedEntry[];
  readonly bookmarks: readonly ProjectedEntry[];
  readonly objectLayouts: readonly ProjectedEntry[];
  readonly phaseBoardLayout: readonly ProjectedEntry[];
};

const ENTRY_FIELDS = {
  annotations: ["id", "objectId", "text"],
  bookmarks: ["id", "objectId", "label"],
  objectLayouts: ["objectId", "x", "z"],
  phaseBoardLayout: ["phaseId", "column", "row"],
} as const;

function validateEntry(
  rootName: keyof typeof ENTRY_FIELDS,
  entryId: string,
  value: unknown,
): Record<string, string | number> {
  if (!(value instanceof Y.Map)) {
    throw new PresentationValidationError(
      `${rootName} entries must be field maps`,
    );
  }
  const json = value.toJSON() as Record<string, unknown>;
  assertExactFields(json, ENTRY_FIELDS[rootName]);
  const identityField =
    rootName === "phaseBoardLayout"
      ? "phaseId"
      : rootName === "objectLayouts"
        ? "objectId"
        : "id";
  if (opaqueId(json[identityField], `${rootName} identity`) !== entryId) {
    throw new PresentationValidationError(
      `${rootName} identity does not match its key`,
    );
  }
  if (rootName === "annotations") {
    opaqueId(json.objectId, "Object ID");
    storedEscapedText(json.text, "Annotation text");
  } else if (rootName === "bookmarks") {
    opaqueId(json.objectId, "Object ID");
    storedEscapedText(json.label, "Bookmark label", 120);
  } else if (rootName === "objectLayouts") {
    boundedNumber(json.x, "Layout x", -10_000, 10_000);
    boundedNumber(json.z, "Layout z", -10_000, 10_000);
  } else {
    boundedNumber(json.column, "Phase column", 0, 64);
    boundedNumber(json.row, "Phase row", 0, 64);
  }
  return json as Record<string, string | number>;
}

export function validatePresentationDocument(document: Y.Doc): void {
  const roots = [...document.share.keys()].sort();
  const expected = new Set(PRESENTATION_ROOTS);
  if (
    roots.some(
      (root) => !expected.has(root as (typeof PRESENTATION_ROOTS)[number]),
    )
  ) {
    throw new PresentationValidationError(
      `Presentation document contains a prohibited root: ${roots.join(",")}`,
    );
  }
  const metadata = document.getMap("metadata").toJSON();
  assertExactFields(metadata, ["schema", "documentId"]);
  if (
    metadata.schema !== PRESENTATION_SCHEMA ||
    typeof metadata.documentId !== "string" ||
    !/^doc_[a-f0-9]{32}$/.test(metadata.documentId)
  ) {
    throw new PresentationValidationError("Presentation metadata is invalid");
  }
  for (const rootName of Object.keys(
    ENTRY_FIELDS,
  ) as (keyof typeof ENTRY_FIELDS)[]) {
    for (const [entryId, value] of document.getMap(rootName).entries()) {
      validateEntry(rootName, entryId, value);
    }
  }
}

export function applyValidatedPresentationUpdate(
  document: Y.Doc,
  update: Uint8Array,
): void {
  if (update.byteLength > PRESENTATION_LIMITS.maxIncomingUpdateBytes) {
    throw new PresentationValidationError("Incoming update exceeds 128 KiB");
  }
  const candidate = new Y.Doc({ guid: document.guid });
  Y.applyUpdate(
    candidate,
    Y.encodeStateAsUpdate(document),
    "aiw-current-state",
  );
  Y.applyUpdate(candidate, update, "aiw-untrusted-update");
  validatePresentationDocument(candidate);
  Y.applyUpdate(document, update, "aiw-validated-update");
}

function projectedEntries(
  document: Y.Doc,
  rootName: keyof typeof ENTRY_FIELDS,
  authoritativeObjects: ReadonlyMap<string, string>,
): ProjectedEntry[] {
  return [...document.getMap(rootName).entries()]
    .map<ProjectedEntry>(([entryId, value]) => {
      const entry = validateEntry(rootName, entryId, value);
      const reference = String(entry.objectId ?? entry.phaseId);
      const currentLabel = authoritativeObjects.get(reference);
      return {
        ...entry,
        orphan: currentLabel === undefined,
        ...(currentLabel === undefined
          ? {}
          : { currentLabel: escapedText(currentLabel, "Current label", 120) }),
      };
    })
    .sort((left, right) =>
      String(left["id"] ?? left["objectId"] ?? left["phaseId"]).localeCompare(
        String(right["id"] ?? right["objectId"] ?? right["phaseId"]),
      ),
    );
}

export function projectPresentationDocument(
  document: Y.Doc,
  authoritativeObjects: ReadonlyMap<string, string>,
): PresentationProjection {
  validatePresentationDocument(document);
  return {
    schema: PRESENTATION_SCHEMA,
    documentId: String(document.getMap("metadata").get("documentId")),
    annotations: projectedEntries(
      document,
      "annotations",
      authoritativeObjects,
    ),
    bookmarks: projectedEntries(document, "bookmarks", authoritativeObjects),
    objectLayouts: projectedEntries(
      document,
      "objectLayouts",
      authoritativeObjects,
    ),
    phaseBoardLayout: projectedEntries(
      document,
      "phaseBoardLayout",
      authoritativeObjects,
    ),
  };
}

export function exportPresentationDocument(
  document: Y.Doc,
  authoritativeObjects: ReadonlyMap<string, string>,
): string {
  const json = `${JSON.stringify(projectPresentationDocument(document, authoritativeObjects))}\n`;
  if (
    new TextEncoder().encode(json).byteLength >
    PRESENTATION_LIMITS.maxExportBytes
  ) {
    throw new PresentationValidationError("Presentation export exceeds 1 MiB");
  }
  return json;
}

export type PresentationAwarenessState = {
  readonly peerId: string;
  readonly viewId: string;
  readonly display: string;
  readonly colorToken: string;
  readonly ownedAgentIds: readonly string[];
  readonly focusObjectId?: string;
  readonly cursor?: { readonly x: number; readonly y: number };
  readonly camera?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly zoom: number;
  };
  readonly activity: "active" | "idle" | "away";
  readonly presenterPeerId?: string | null;
  readonly followPresenterId?: string | null;
};

export function sanitizeAwarenessState(
  input: PresentationAwarenessState,
): PresentationAwarenessState {
  assertExactFields(input, [
    "peerId",
    "viewId",
    "display",
    "colorToken",
    "ownedAgentIds",
    "focusObjectId",
    "cursor",
    "camera",
    "activity",
    "presenterPeerId",
    "followPresenterId",
  ]);
  if (!SAFE_COLORS.has(input.colorToken)) {
    throw new PresentationValidationError("Awareness color token is invalid");
  }
  if (!Array.isArray(input.ownedAgentIds) || input.ownedAgentIds.length > 16) {
    throw new PresentationValidationError(
      "Awareness owned-agent list is out of bounds",
    );
  }
  if (!["active", "idle", "away"].includes(input.activity)) {
    throw new PresentationValidationError("Awareness activity is invalid");
  }
  return {
    peerId: opaqueId(input.peerId, "Peer ID"),
    viewId: opaqueId(input.viewId, "View ID"),
    display: escapedText(input.display, "Awareness display", 40),
    colorToken: input.colorToken,
    ownedAgentIds: input.ownedAgentIds.map((id) => opaqueId(id, "Agent ID")),
    ...(input.focusObjectId
      ? { focusObjectId: opaqueId(input.focusObjectId, "Focus object ID") }
      : {}),
    ...(input.cursor
      ? {
          cursor: {
            x: boundedNumber(input.cursor.x, "Cursor x", 0, 1),
            y: boundedNumber(input.cursor.y, "Cursor y", 0, 1),
          },
        }
      : {}),
    ...(input.camera
      ? {
          camera: {
            x: boundedNumber(input.camera.x, "Camera x", -10_000, 10_000),
            y: boundedNumber(input.camera.y, "Camera y", -10_000, 10_000),
            z: boundedNumber(input.camera.z, "Camera z", -10_000, 10_000),
            zoom: boundedNumber(input.camera.zoom, "Camera zoom", 0.1, 20),
          },
        }
      : {}),
    activity: input.activity,
    ...(input.presenterPeerId !== undefined
      ? {
          presenterPeerId:
            input.presenterPeerId === null
              ? null
              : opaqueId(input.presenterPeerId, "Peer ID"),
        }
      : {}),
    ...(input.followPresenterId !== undefined
      ? {
          followPresenterId:
            input.followPresenterId === null
              ? null
              : opaqueId(input.followPresenterId, "Peer ID"),
        }
      : {}),
  };
}

export function validateAwarenessPeerCount(count: number): number {
  if (!Number.isInteger(count) || count < 0 || count > 16) {
    throw new PresentationValidationError("Awareness is limited to 16 peers");
  }
  return count;
}

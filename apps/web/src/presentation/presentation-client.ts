import { WEB_API_BASE_PATH } from "@agentintersect-world/config";

import { getCurrentWorld } from "../world-client.js";

export type PresentationStatus = {
  readonly schema: "aiw.presentation/0.9";
  readonly documentId: string | null;
  readonly networkScope: "loopback" | "lan";
  readonly provider: "local-self-hosted";
  readonly commandAuthority: false;
  readonly maximumPeers: 16;
  readonly heartbeatMs: 10_000;
  readonly awarenessExpiryMs: 30_000;
  readonly transport: "ws/http" | "wss/https";
  readonly encrypted: boolean;
  readonly unencryptedLanWarning: boolean;
  readonly limits: Readonly<Record<string, number>>;
};

export type PresentationTicket = {
  readonly ticket: string;
  readonly expiresAt: string;
  readonly documentId: string;
  readonly websocketPath: "/presentation-sync";
};

export type PresentationClientResult<T> =
  | { readonly status: "ok"; readonly data: T }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "unavailable";
      readonly message: "Local server unavailable";
    };

export type PresentationAuthority = {
  readonly authoritativeObjects: ReadonlyMap<string, string>;
  readonly selectedObjectId: string | null;
  readonly ownedAgentIds: readonly string[];
};

const OPAQUE_PRESENTATION_ID =
  /^(?:[a-f0-9]{32,64}|[a-z][a-z0-9]*_[a-z0-9]{8,64})$/;
const ROSTER_FIELDS = new Set(["id", "harness", "status", "jobId", "runId"]);

function bearerHeaders(bearer: string | undefined): Record<string, string> {
  return bearer ? { authorization: `Bearer ${bearer}` } : {};
}

async function ownedAgentPresentationId(sourceId: string): Promise<string> {
  if (OPAQUE_PRESENTATION_ID.test(sourceId)) return sourceId;
  const digest = new Uint8Array(
    await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        `aiw.presentation/0.9\0owned-agent\0${sourceId}`,
      ),
    ),
  );
  return `agent_${[...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)}`;
}

function strictRosterIds(value: unknown): string[] {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !Array.isArray((value as { roster?: unknown }).roster) ||
    Object.keys(value).some((key) => key !== "roster")
  ) {
    throw new Error("invalid presentation roster response");
  }
  const roster = (value as { roster: unknown[] }).roster;
  if (roster.length > 256)
    throw new Error("invalid presentation roster response");
  return roster.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry) ||
      Object.keys(entry).some((key) => !ROSTER_FIELDS.has(key))
    ) {
      throw new Error("invalid presentation roster response");
    }
    const record = entry as Record<string, unknown>;
    if (
      typeof record["id"] !== "string" ||
      record["id"].length === 0 ||
      record["id"].length > 256 ||
      ["harness", "status", "jobId", "runId"].some(
        (key) =>
          record[key] !== undefined &&
          (typeof record[key] !== "string" || record[key].length > 256),
      )
    ) {
      throw new Error("invalid presentation roster response");
    }
    return record["id"];
  });
}

async function requestJson(
  path: string,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<PresentationClientResult<unknown>> {
  let response: Response;
  try {
    response = await fetcher(`${WEB_API_BASE_PATH}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    return { status: "unavailable", message: "Local server unavailable" };
  }
  try {
    const payload = (await response.json()) as {
      readonly ok?: boolean;
      readonly data?: unknown;
      readonly error?: { readonly message?: unknown };
    };
    if (!response.ok || payload.ok !== true) {
      return {
        status: "error",
        message:
          typeof payload.error?.message === "string"
            ? payload.error.message
            : "Presentation request failed",
      };
    }
    return { status: "ok", data: payload.data };
  } catch {
    return { status: "error", message: "Invalid presentation server response" };
  }
}

function statusValue(value: unknown): PresentationStatus | null {
  if (typeof value !== "object" || value === null) return null;
  const status = value as Partial<PresentationStatus>;
  if (
    status.schema !== "aiw.presentation/0.9" ||
    (status.documentId !== null &&
      (typeof status.documentId !== "string" ||
        !/^doc_[a-f0-9]{32}$/.test(status.documentId))) ||
    !["loopback", "lan"].includes(status.networkScope ?? "") ||
    status.provider !== "local-self-hosted" ||
    status.commandAuthority !== false ||
    status.maximumPeers !== 16 ||
    status.heartbeatMs !== 10_000 ||
    status.awarenessExpiryMs !== 30_000 ||
    !["ws/http", "wss/https"].includes(status.transport ?? "") ||
    typeof status.encrypted !== "boolean" ||
    typeof status.unencryptedLanWarning !== "boolean" ||
    typeof status.limits !== "object" ||
    status.limits === null
  )
    return null;
  return status as PresentationStatus;
}

export async function getPresentationStatus(
  fetcher: typeof fetch = fetch,
  bearer?: string,
): Promise<PresentationClientResult<PresentationStatus>> {
  const result = await requestJson(
    "/presentation/status",
    { headers: bearerHeaders(bearer) },
    fetcher,
  );
  if (result.status !== "ok") return result;
  const parsed = statusValue(result.data);
  return parsed
    ? { status: "ok", data: parsed }
    : { status: "error", message: "Invalid presentation server response" };
}

export async function loadPresentationAuthority(
  fetcher: typeof fetch = fetch,
): Promise<PresentationAuthority> {
  const world = await getCurrentWorld(fetcher);
  if (world.status !== "ok")
    throw new Error("authoritative World snapshot unavailable");
  const rosterResult = await requestJson("/integration/roster", {}, fetcher);
  if (rosterResult.status !== "ok")
    throw new Error("authoritative integration roster unavailable");
  const rosterIds = strictRosterIds(rosterResult.data);
  const objects = world.data.snapshot.objects
    .filter((object) => object.kind !== "tombstone")
    .sort((left, right) => left.id.localeCompare(right.id));
  const preferred = objects.find((object) => object.kind === "file") ?? null;
  const ownedAgentIds = [
    ...new Set(
      await Promise.all(
        [...rosterIds]
          .sort((left, right) => left.localeCompare(right))
          .map(ownedAgentPresentationId),
      ),
    ),
  ].slice(0, 16);
  return {
    authoritativeObjects: new Map(
      objects.map((object) => [
        object.id,
        [...object.name]
          .map((character) => {
            const code = character.charCodeAt(0);
            return code < 32 || code === 127 ? " " : character;
          })
          .join("")
          .trim()
          .slice(0, 120),
      ]),
    ),
    selectedObjectId: preferred?.id ?? objects[0]?.id ?? null,
    ownedAgentIds,
  };
}

export async function issuePresentationTicket(
  documentId: string,
  bearer: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<PresentationClientResult<PresentationTicket>> {
  const result = await requestJson(
    "/presentation/tickets",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...bearerHeaders(bearer),
      },
      body: JSON.stringify({ documentId }),
    },
    fetcher,
  );
  if (result.status !== "ok") return result;
  const ticket = result.data as Partial<PresentationTicket>;
  if (
    typeof ticket.ticket !== "string" ||
    !/^ticket_[a-f0-9]{48}$/.test(ticket.ticket) ||
    ticket.documentId !== documentId ||
    ticket.websocketPath !== "/presentation-sync" ||
    typeof ticket.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(ticket.expiresAt))
  ) {
    return { status: "error", message: "Invalid presentation server response" };
  }
  return { status: "ok", data: ticket as PresentationTicket };
}

export async function exportPresentationDocument(
  documentId: string,
  bearer: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher(
    `${WEB_API_BASE_PATH}/presentation/documents/${encodeURIComponent(documentId)}/export`,
    { headers: bearerHeaders(bearer), signal: AbortSignal.timeout(3_000) },
  );
  if (!response.ok) throw new Error("Presentation export failed");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 1024 * 1024) {
    throw new Error("Presentation export exceeded 1 MiB");
  }
  return text;
}

export async function deletePresentationDocument(
  documentId: string,
  bearer: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<PresentationClientResult<{ documentId: string; deleted: true }>> {
  const result = await requestJson(
    `/presentation/documents/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        ...bearerHeaders(bearer),
      },
      body: JSON.stringify({ documentId, confirmed: true }),
    },
    fetcher,
  );
  if (result.status !== "ok") return result;
  const data = result.data as { documentId?: unknown; deleted?: unknown };
  return data.documentId === documentId && data.deleted === true
    ? {
        status: "ok",
        data: { documentId, deleted: true },
      }
    : { status: "error", message: "Invalid presentation server response" };
}

import type { WorkstreamApiRecord } from "./workstream-client.js";

export type PreviewRecipe = {
  readonly schema: "aiw.preview-recipe/1";
  readonly recipeId: string;
  readonly revision: number;
  readonly repositoryId: string;
  readonly label: string;
  readonly executable: string;
  readonly args: readonly string[];
  readonly readinessPath: string;
  readonly browserPath: string;
  readonly approvedAt: string;
};

export type PreviewRecord = {
  readonly schema: "aiw.preview-record/1";
  readonly previewId: string;
  readonly revision: number;
  readonly state: "starting" | "ready" | "failed" | "stopped";
  readonly workstreamId: string;
  readonly workstreamRevision: number;
  readonly repository: WorkstreamApiRecord["repository"];
  readonly agent: WorkstreamApiRecord["agent"];
  readonly worktreeId: string;
  readonly worktreeState: "current" | "dirty";
  readonly recipeId: string;
  readonly recipeRevision: number;
  readonly host: "127.0.0.1";
  readonly port: number;
  readonly pid: number | null;
  readonly url: string | null;
  readonly health: {
    readonly ok: true;
    readonly status: number;
    readonly checkedAt: string;
  } | null;
  readonly logs: string;
  readonly logsTruncated: boolean;
  readonly startedAt: string;
  readonly readyAt: string | null;
  readonly stoppedAt: string | null;
  readonly portClosed: boolean | null;
  readonly recovered: boolean;
  readonly error: string | null;
};

export type PreviewProjection = {
  readonly schema: "aiw.preview-manager/1";
  readonly active: PreviewRecord | null;
  readonly latestAttempt: PreviewRecord | null;
  readonly previousVerified: PreviewRecord | null;
  readonly display: {
    readonly truth: "current" | "previous-verified";
    readonly preview: PreviewRecord;
  } | null;
};

type ApiResult<T> = {
  readonly ok: true;
  readonly data: T;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function errorMessage(body: unknown): string {
  if (!isObject(body) || !isObject(body.error))
    return "Preview Manager request failed";
  return typeof body.error.message === "string"
    ? body.error.message
    : "Preview Manager request failed";
}

function recipeFrom(value: unknown): PreviewRecipe {
  if (!isObject(value)) throw new Error("Invalid Preview Manager response");
  if (
    value.schema !== "aiw.preview-recipe/1" ||
    typeof value.recipeId !== "string" ||
    typeof value.revision !== "number" ||
    typeof value.repositoryId !== "string" ||
    typeof value.label !== "string" ||
    typeof value.executable !== "string" ||
    !Array.isArray(value.args) ||
    !value.args.every((argument) => typeof argument === "string") ||
    typeof value.readinessPath !== "string" ||
    typeof value.browserPath !== "string" ||
    typeof value.approvedAt !== "string"
  )
    throw new Error("Invalid Preview Manager response");
  return value as PreviewRecipe;
}

function recordFrom(value: unknown): PreviewRecord {
  if (!isObject(value)) throw new Error("Invalid Preview Manager response");
  if (
    value.schema !== "aiw.preview-record/1" ||
    typeof value.previewId !== "string" ||
    typeof value.revision !== "number" ||
    !["starting", "ready", "failed", "stopped"].includes(String(value.state)) ||
    typeof value.workstreamId !== "string" ||
    typeof value.workstreamRevision !== "number" ||
    !isObject(value.repository) ||
    !isObject(value.agent) ||
    typeof value.worktreeId !== "string" ||
    !["current", "dirty"].includes(String(value.worktreeState)) ||
    typeof value.recipeId !== "string" ||
    typeof value.recipeRevision !== "number" ||
    value.host !== "127.0.0.1" ||
    typeof value.port !== "number" ||
    (value.url !== null &&
      (typeof value.url !== "string" ||
        !value.url.startsWith("http://127.0.0.1:"))) ||
    (value.readyAt !== null && typeof value.readyAt !== "string")
  )
    throw new Error("Invalid Preview Manager response");
  return value as PreviewRecord;
}

const nullableRecord = (value: unknown): PreviewRecord | null =>
  value === null ? null : recordFrom(value);

function projectionFrom(value: unknown): PreviewProjection {
  if (!isObject(value) || value.schema !== "aiw.preview-manager/1")
    throw new Error("Invalid Preview Manager response");
  const display = value.display;
  if (
    display !== null &&
    (!isObject(display) ||
      !["current", "previous-verified"].includes(String(display.truth)))
  )
    throw new Error("Invalid Preview Manager response");
  return {
    schema: "aiw.preview-manager/1",
    active: nullableRecord(value.active),
    latestAttempt: nullableRecord(value.latestAttempt),
    previousVerified: nullableRecord(value.previousVerified),
    display:
      display === null
        ? null
        : {
            truth: display.truth as "current" | "previous-verified",
            preview: recordFrom(display.preview),
          },
  };
}

export class PreviewManagerClient {
  constructor(
    readonly fetcher: typeof fetch = fetch.bind(globalThis),
    readonly id: () => string = () => crypto.randomUUID(),
  ) {}

  async recipes(repositoryId: string): Promise<readonly PreviewRecipe[]> {
    const body = await this.#get(
      `/api/preview-recipes?repositoryId=${encodeURIComponent(repositoryId)}`,
    );
    if (!Array.isArray(body))
      throw new Error("Invalid Preview Manager response");
    return body.map(recipeFrom);
  }

  async current(workstreamId: string): Promise<PreviewProjection> {
    return projectionFrom(
      await this.#get(
        `/api/workstreams/${encodeURIComponent(workstreamId)}/previews/current`,
      ),
    );
  }

  async start(
    workstream: WorkstreamApiRecord,
    recipe: PreviewRecipe,
  ): Promise<{ readonly preview: PreviewRecord; readonly replayed: boolean }> {
    if (
      !workstream.authority ||
      (workstream.worktreeState !== "current" &&
        workstream.worktreeState !== "dirty")
    )
      throw new Error("World View requires current owned Workstream authority");
    const requestId = this.id();
    const response = await this.fetcher(
      `/api/workstreams/${encodeURIComponent(workstream.workstreamId)}/previews`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId,
          correlationId: requestId,
          expectedWorkstreamRevision: workstream.revision,
          repository: workstream.repository,
          agent: workstream.agent,
          recipeId: recipe.recipeId,
          expectedRecipeRevision: recipe.revision,
        }),
      },
    );
    const body: unknown = await response.json();
    if (!response.ok) throw new Error(errorMessage(body));
    const envelope = body as ApiResult<{
      readonly preview?: unknown;
      readonly replayed?: unknown;
    }>;
    if (envelope.ok !== true || typeof envelope.data?.replayed !== "boolean")
      throw new Error("Invalid Preview Manager response");
    return {
      preview: recordFrom(envelope.data.preview),
      replayed: envelope.data.replayed,
    };
  }

  async #get(url: string): Promise<unknown> {
    const response = await this.fetcher(url, {
      headers: { accept: "application/json" },
    });
    const body: unknown = await response.json();
    if (!response.ok) throw new Error(errorMessage(body));
    const envelope = body as ApiResult<unknown>;
    if (envelope.ok !== true)
      throw new Error("Invalid Preview Manager response");
    return envelope.data;
  }
}

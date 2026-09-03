import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  stat,
} from "node:fs/promises";
import net from "node:net";
import { join, resolve } from "node:path";

import { z } from "zod";

import type {
  WorkstreamAgentReference,
  WorkstreamRepositoryReference,
} from "./workstream-service.js";

const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);
const timestamp = z.string().datetime({ offset: true });
const safeText = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => !/[\0\r\n]/u.test(value));
const safeArgument = safeText(1_024).refine((value) => {
  const remainder = value.replaceAll("{host}", "").replaceAll("{port}", "");
  return !/[{}]/u.test(remainder);
});
const safeHttpPath = z
  .string()
  .min(1)
  .max(512)
  .startsWith("/")
  .refine((value) => !value.includes("\\") && !value.includes("\0"))
  .refine(
    (value) =>
      !value
        .split(/[/?#]/u)
        .filter(Boolean)
        .some((part) => part === ".."),
  );

const RepositoryReferenceSchema = z.strictObject({
  repositoryId: identifier,
  revision: identifier,
});
const AgentReferenceSchema = z.strictObject({
  agentId: identifier,
  nativeSessionId: identifier,
  rootNativeSessionId: identifier.optional(),
  revision: identifier,
});
const PreviewRecipeSchema = z.strictObject({
  schema: z.literal("aiw.preview-recipe/1"),
  recipeId: identifier,
  revision: z.number().int().positive(),
  repositoryId: identifier,
  label: z.string().trim().min(1).max(160),
  executable: safeText(512),
  args: z.array(safeArgument).max(32),
  readinessPath: safeHttpPath,
  browserPath: safeHttpPath,
  approvedAt: timestamp,
});
const PreviewHealthSchema = z.strictObject({
  ok: z.literal(true),
  status: z.number().int().min(200).max(399),
  checkedAt: timestamp,
});
const PreviewRecordSchema = z.strictObject({
  schema: z.literal("aiw.preview-record/1"),
  previewId: identifier,
  revision: z.number().int().positive(),
  state: z.enum(["starting", "ready", "failed", "stopped"]),
  workstreamId: identifier,
  workstreamRevision: z.number().int().nonnegative(),
  repository: RepositoryReferenceSchema,
  agent: AgentReferenceSchema,
  worktreeId: identifier,
  worktreeState: z.enum(["current", "dirty"]),
  recipeId: identifier,
  recipeRevision: z.number().int().positive(),
  host: z.literal("127.0.0.1"),
  port: z.number().int().min(1).max(65_535),
  pid: z.number().int().positive().nullable(),
  url: z.string().url().startsWith("http://127.0.0.1:").nullable(),
  health: PreviewHealthSchema.nullable(),
  logs: z.string().max(65_536),
  logsTruncated: z.boolean(),
  startedAt: timestamp,
  readyAt: timestamp.nullable(),
  stoppedAt: timestamp.nullable(),
  portClosed: z.boolean().nullable(),
  recovered: z.boolean(),
  error: z.string().max(512).nullable(),
});
const CommandRecordSchema = z.strictObject({
  kind: z.enum(["approve", "start", "stop"]),
  requestId: identifier,
  correlationId: identifier,
  canonical: z.string().min(1).max(16_384),
  result: z.union([PreviewRecipeSchema, PreviewRecordSchema]),
});
const PreviewManagerStateSchema = z.strictObject({
  schema: z.literal("aiw.preview-manager-store/1"),
  recipes: z.array(PreviewRecipeSchema).max(32),
  active: PreviewRecordSchema.nullable(),
  latestAttempt: PreviewRecordSchema.nullable(),
  previousVerified: PreviewRecordSchema.nullable(),
  commands: z.array(CommandRecordSchema).max(32),
});
const StoreEnvelopeSchema = z.strictObject({
  schema: z.literal("aiw.preview-manager-store-envelope/1"),
  generation: z.number().int().positive(),
  payload: PreviewManagerStateSchema,
  checksum: z.string().regex(/^[a-f0-9]{64}$/u),
});
const ApproveRecipeRequestSchema = z.strictObject({
  requestId: identifier,
  correlationId: identifier,
  recipeId: identifier,
  expectedRevision: z.number().int().positive().nullable(),
  repositoryId: identifier,
  label: z.string().trim().min(1).max(160),
  executable: safeText(512),
  args: z.array(safeArgument).max(32),
  readinessPath: safeHttpPath,
  browserPath: safeHttpPath,
});
const StartPreviewRequestSchema = z.strictObject({
  requestId: identifier,
  correlationId: identifier,
  workstreamId: identifier,
  expectedWorkstreamRevision: z.number().int().nonnegative(),
  repository: RepositoryReferenceSchema,
  agent: AgentReferenceSchema,
  recipeId: identifier,
  expectedRecipeRevision: z.number().int().positive(),
});
const StopPreviewRequestSchema = z.strictObject({
  requestId: identifier,
  correlationId: identifier,
  workstreamId: identifier,
  expectedPreviewRevision: z.number().int().positive(),
});

export type PreviewRecipe = z.infer<typeof PreviewRecipeSchema>;
export type PreviewRecord = z.infer<typeof PreviewRecordSchema>;
export type PreviewWorkstreamBinding = {
  readonly workstreamId: string;
  readonly workstreamRevision: number;
  readonly repository: WorkstreamRepositoryReference;
  readonly agent: WorkstreamAgentReference;
  readonly worktreeId: string;
  readonly worktreeState: "current" | "dirty";
  readonly worktreePath: string;
};
export type PreviewWorkstreamRequest = z.infer<
  typeof StartPreviewRequestSchema
>;

type PreviewManagerState = z.infer<typeof PreviewManagerStateSchema>;
type StartPreviewRequest = z.infer<typeof StartPreviewRequestSchema>;
type ActivePreview = {
  readonly child: ChildProcess;
  readonly logs: BoundedText;
  intentionalStop: boolean;
};

export type PreviewManagerServiceOptions = {
  readonly directory: string;
  readonly resolveWorkstream: (
    request: PreviewWorkstreamRequest,
  ) => Promise<PreviewWorkstreamBinding> | PreviewWorkstreamBinding;
  readonly now?: () => number;
  readonly id?: () => string;
  readonly fetch?: typeof fetch;
  readonly startupTimeoutMs?: number;
  readonly healthPollMs?: number;
};

export class PreviewManagerServiceError extends Error {
  constructor(
    readonly code:
      | "validation"
      | "recipe-not-found"
      | "recipe-revision-conflict"
      | "workstream-mismatch"
      | "preview-not-found"
      | "preview-revision-conflict"
      | "correlation-conflict"
      | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "PreviewManagerServiceError";
  }
}

class BoundedText {
  readonly #maximumBytes: number;
  #buffer = Buffer.alloc(0);
  truncated = false;

  constructor(maximumBytes = 65_536) {
    this.#maximumBytes = maximumBytes;
  }

  push(chunk: Buffer | string): void {
    const incoming = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const remaining = this.#maximumBytes - this.#buffer.length;
    if (incoming.length > remaining) this.truncated = true;
    if (remaining > 0)
      this.#buffer = Buffer.concat([
        this.#buffer,
        incoming.subarray(0, remaining),
      ]);
  }

  text(): string {
    return this.#buffer.toString("utf8");
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function optionalRead(path: string): Promise<string | null> {
  return readFile(path, "utf8").catch((error: unknown) => {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    )
      return null;
    throw error;
  });
}

async function syncFile(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function reserveLoopbackPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to reserve a loopback preview port");
  }
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  return address.port;
}

async function portIsClosed(port: number): Promise<boolean> {
  return new Promise((resolveResult) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolveResult(false);
    });
    socket.once("error", () => resolveResult(true));
    socket.setTimeout(250, () => {
      socket.destroy();
      resolveResult(false);
    });
  });
}

function processEnvironment(port: number): NodeJS.ProcessEnv {
  const keep = [
    "PATH",
    "HOME",
    "USERPROFILE",
    "SystemRoot",
    "ComSpec",
    "PATHEXT",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
  ] as const;
  const environment: NodeJS.ProcessEnv = {};
  for (const key of keep) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  environment.HOST = "127.0.0.1";
  environment.PORT = String(port);
  environment.BROWSER = "none";
  environment.NO_COLOR = "1";
  return environment;
}

function substituteArguments(args: readonly string[], port: number): string[] {
  return args.map((argument) =>
    argument
      .replaceAll("{host}", "127.0.0.1")
      .replaceAll("{port}", String(port)),
  );
}

function initialState(): PreviewManagerState {
  return {
    schema: "aiw.preview-manager-store/1",
    recipes: [],
    active: null,
    latestAttempt: null,
    previousVerified: null,
    commands: [],
  };
}

export class PreviewManagerService {
  readonly #directory: string;
  readonly #currentPath: string;
  readonly #previousPath: string;
  readonly #resolveWorkstream: PreviewManagerServiceOptions["resolveWorkstream"];
  readonly #now: () => number;
  readonly #id: () => string;
  readonly #fetch: typeof fetch;
  readonly #startupTimeoutMs: number;
  readonly #healthPollMs: number;
  readonly #active = new Map<string, ActivePreview>();
  #state: PreviewManagerState = initialState();
  #generation = 0;
  #loadedFromPrevious = false;
  #loadPromise: Promise<void> | null = null;
  #mutationTail: Promise<void> = Promise.resolve();

  constructor(options: PreviewManagerServiceOptions) {
    this.#directory = resolve(options.directory);
    this.#currentPath = join(this.#directory, "preview-manager.current.json");
    this.#previousPath = join(this.#directory, "preview-manager.previous.json");
    this.#resolveWorkstream = options.resolveWorkstream;
    this.#now = options.now ?? Date.now;
    this.#id = options.id ?? randomUUID;
    this.#fetch = options.fetch ?? fetch;
    this.#startupTimeoutMs = options.startupTimeoutMs ?? 10_000;
    this.#healthPollMs = options.healthPollMs ?? 50;
  }

  async approveRecipe(input: unknown): Promise<{
    readonly recipe: PreviewRecipe;
    readonly replayed: boolean;
  }> {
    const request = this.#parse(ApproveRecipeRequestSchema, input);
    return this.#serialize(async () => {
      await this.#ensureLoaded();
      const canonicalRequest = canonical({ kind: "approve", request });
      const replay = this.#replay(
        "approve",
        request.requestId,
        request.correlationId,
        canonicalRequest,
      );
      if (replay)
        return { recipe: PreviewRecipeSchema.parse(replay), replayed: true };
      const existing = this.#state.recipes.find(
        ({ recipeId }) => recipeId === request.recipeId,
      );
      if (
        (existing === undefined && request.expectedRevision !== null) ||
        (existing !== undefined &&
          request.expectedRevision !== existing.revision)
      )
        throw new PreviewManagerServiceError(
          "recipe-revision-conflict",
          existing
            ? `Expected recipe revision ${request.expectedRevision}; current is ${existing.revision}`
            : "The preview recipe does not exist",
        );
      const recipe = PreviewRecipeSchema.parse({
        schema: "aiw.preview-recipe/1",
        recipeId: request.recipeId,
        revision: (existing?.revision ?? 0) + 1,
        repositoryId: request.repositoryId,
        label: request.label,
        executable: request.executable,
        args: request.args,
        readinessPath: request.readinessPath,
        browserPath: request.browserPath,
        approvedAt: new Date(this.#now()).toISOString(),
      });
      this.#state.recipes = [
        ...this.#state.recipes.filter(
          ({ recipeId }) => recipeId !== request.recipeId,
        ),
        recipe,
      ].sort((left, right) => left.recipeId.localeCompare(right.recipeId));
      this.#recordCommand(
        "approve",
        request.requestId,
        request.correlationId,
        canonicalRequest,
        recipe,
      );
      await this.#persist();
      return { recipe: clone(recipe), replayed: false };
    });
  }

  async recipes(repositoryId?: string): Promise<readonly PreviewRecipe[]> {
    await this.#ensureLoaded();
    return this.#state.recipes
      .filter((recipe) => !repositoryId || recipe.repositoryId === repositoryId)
      .map(clone);
  }

  async start(input: unknown): Promise<{
    readonly preview: PreviewRecord;
    readonly replayed: boolean;
  }> {
    const request = this.#parse(StartPreviewRequestSchema, input);
    return this.#serialize(async () => {
      await this.#ensureLoaded();
      const canonicalRequest = canonical({ kind: "start", request });
      const replay = this.#replay(
        "start",
        request.requestId,
        request.correlationId,
        canonicalRequest,
      );
      if (replay)
        return { preview: PreviewRecordSchema.parse(replay), replayed: true };
      const recipe = this.#state.recipes.find(
        ({ recipeId }) => recipeId === request.recipeId,
      );
      if (!recipe)
        throw new PreviewManagerServiceError(
          "recipe-not-found",
          "Approved preview recipe not found",
        );
      if (recipe.revision !== request.expectedRecipeRevision)
        throw new PreviewManagerServiceError(
          "recipe-revision-conflict",
          `Expected recipe revision ${request.expectedRecipeRevision}; current is ${recipe.revision}`,
        );
      if (recipe.repositoryId !== request.repository.repositoryId)
        throw new PreviewManagerServiceError(
          "workstream-mismatch",
          "Preview recipe does not belong to the Workstream repository",
        );
      let binding: PreviewWorkstreamBinding;
      try {
        binding = await this.#resolveWorkstream(request);
      } catch (error) {
        throw new PreviewManagerServiceError(
          "workstream-mismatch",
          error instanceof Error
            ? error.message
            : "Workstream authority changed",
        );
      }
      if (
        binding.workstreamId !== request.workstreamId ||
        binding.workstreamRevision !== request.expectedWorkstreamRevision ||
        canonical(binding.repository) !== canonical(request.repository) ||
        canonical(binding.agent) !== canonical(request.agent)
      )
        throw new PreviewManagerServiceError(
          "workstream-mismatch",
          "Resolved Workstream authority does not match the preview request",
        );
      const worktreePath = await realpath(binding.worktreePath);
      if (!(await stat(worktreePath)).isDirectory())
        throw new PreviewManagerServiceError(
          "workstream-mismatch",
          "Resolved Workstream worktree is unavailable",
        );
      const port = await reserveLoopbackPort();
      const startedAt = new Date(this.#now()).toISOString();
      const preview = PreviewRecordSchema.parse({
        schema: "aiw.preview-record/1",
        previewId: identifier.parse(this.#id()),
        revision: (this.#state.latestAttempt?.revision ?? 0) + 1,
        state: "starting",
        workstreamId: binding.workstreamId,
        workstreamRevision: binding.workstreamRevision,
        repository: binding.repository,
        agent: binding.agent,
        worktreeId: binding.worktreeId,
        worktreeState: binding.worktreeState,
        recipeId: recipe.recipeId,
        recipeRevision: recipe.revision,
        host: "127.0.0.1",
        port,
        pid: null,
        url: null,
        health: null,
        logs: "",
        logsTruncated: false,
        startedAt,
        readyAt: null,
        stoppedAt: null,
        portClosed: null,
        recovered: false,
        error: null,
      });
      this.#state.latestAttempt = preview;
      await this.#persist();

      const logs = new BoundedText();
      const spawnError: { value: Error | null } = { value: null };
      let child: ChildProcess;
      try {
        child = spawn(
          recipe.executable,
          substituteArguments(recipe.args, port),
          {
            cwd: worktreePath,
            shell: false,
            detached: process.platform !== "win32",
            stdio: ["ignore", "pipe", "pipe"],
            env: processEnvironment(port),
          },
        );
      } catch (error) {
        return this.#finishFailedStart(
          request,
          preview,
          canonicalRequest,
          logs,
          error instanceof Error
            ? error.message
            : "Preview process failed to spawn",
        );
      }
      const active: ActivePreview = {
        child,
        logs,
        intentionalStop: false,
      };
      this.#active.set(preview.previewId, active);
      child.stdout?.on("data", (chunk: Buffer) => logs.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => logs.push(chunk));
      child.once("error", (error) => {
        spawnError.value = error;
      });
      if (child.pid) preview.pid = child.pid;
      this.#state.latestAttempt = clone(preview);
      await this.#persist();

      const deadline = Date.now() + this.#startupTimeoutMs;
      let health: PreviewRecord["health"] = null;
      while (Date.now() <= deadline) {
        if (
          spawnError.value ||
          child.exitCode !== null ||
          child.signalCode !== null
        )
          break;
        health = await this.#health(port, recipe.readinessPath);
        if (health) break;
        await wait(this.#healthPollMs);
      }
      if (!health) {
        active.intentionalStop = true;
        await this.#terminate(active);
        this.#active.delete(preview.previewId);
        return this.#finishFailedStart(
          request,
          preview,
          canonicalRequest,
          logs,
          spawnError.value?.message ??
            "Preview did not become healthy before timeout.",
        );
      }

      preview.state = "ready";
      preview.url = `http://127.0.0.1:${port}${recipe.browserPath}`;
      preview.health = health;
      preview.logs = logs.text();
      preview.logsTruncated = logs.truncated;
      preview.readyAt = new Date(this.#now()).toISOString();
      const previous = this.#state.active;
      if (previous && previous.previewId !== preview.previewId) {
        const previousProcess = this.#active.get(previous.previewId);
        if (previousProcess) {
          previousProcess.intentionalStop = true;
          await this.#terminate(previousProcess);
          this.#active.delete(previous.previewId);
        }
        previous.state = "stopped";
        previous.stoppedAt = new Date(this.#now()).toISOString();
        previous.portClosed = await this.#proveClosed(previous.port);
        this.#state.previousVerified = clone(previous);
      }
      this.#state.active = clone(preview);
      this.#state.latestAttempt = clone(preview);
      this.#recordCommand(
        "start",
        request.requestId,
        request.correlationId,
        canonicalRequest,
        preview,
      );
      child.once("exit", () => {
        if (!active.intentionalStop)
          void this.#recordUnexpectedExit(preview.previewId);
      });
      await this.#persist();
      return { preview: clone(preview), replayed: false };
    });
  }

  async current(): Promise<{
    readonly schema: "aiw.preview-manager/1";
    readonly active: PreviewRecord | null;
    readonly latestAttempt: PreviewRecord | null;
    readonly previousVerified: PreviewRecord | null;
    readonly display: {
      readonly truth: "current" | "previous-verified";
      readonly preview: PreviewRecord;
    } | null;
  }> {
    await this.#ensureLoaded();
    const active = this.#state.active ? clone(this.#state.active) : null;
    const latestAttempt = this.#state.latestAttempt
      ? clone(this.#state.latestAttempt)
      : null;
    return {
      schema: "aiw.preview-manager/1",
      active,
      latestAttempt,
      previousVerified: this.#state.previousVerified
        ? clone(this.#state.previousVerified)
        : null,
      display:
        active?.state === "ready"
          ? {
              truth:
                latestAttempt?.previewId !== active.previewId &&
                latestAttempt?.state === "failed"
                  ? "previous-verified"
                  : "current",
              preview: clone(active),
            }
          : null,
    };
  }

  async stopForWorkstream(workstreamId: string): Promise<boolean> {
    const parsedWorkstreamId = identifier.safeParse(workstreamId);
    if (!parsedWorkstreamId.success) return false;
    return this.#serialize(async () => {
      await this.#ensureLoaded();
      const preview = this.#state.active;
      if (!preview || preview.workstreamId !== parsedWorkstreamId.data)
        return false;
      const active = this.#active.get(preview.previewId);
      if (!active) return false;
      active.intentionalStop = true;
      await this.#terminate(active);
      this.#active.delete(preview.previewId);
      preview.state = "stopped";
      preview.stoppedAt = new Date(this.#now()).toISOString();
      preview.portClosed = await this.#proveClosed(preview.port);
      preview.logs = active.logs.text();
      preview.logsTruncated = active.logs.truncated;
      this.#state.active = null;
      this.#state.latestAttempt = clone(preview);
      this.#state.previousVerified = clone(preview);
      await this.#persist();
      return true;
    });
  }

  async stop(input: unknown): Promise<{
    readonly preview: PreviewRecord;
    readonly replayed: boolean;
  }> {
    const request = this.#parse(StopPreviewRequestSchema, input);
    return this.#serialize(async () => {
      await this.#ensureLoaded();
      const canonicalRequest = canonical({ kind: "stop", request });
      const replay = this.#replay(
        "stop",
        request.requestId,
        request.correlationId,
        canonicalRequest,
      );
      if (replay)
        return { preview: PreviewRecordSchema.parse(replay), replayed: true };
      const preview = this.#state.active;
      if (!preview || preview.workstreamId !== request.workstreamId)
        throw new PreviewManagerServiceError(
          "preview-not-found",
          "No active owned preview exists for this Workstream",
        );
      if (preview.revision !== request.expectedPreviewRevision)
        throw new PreviewManagerServiceError(
          "preview-revision-conflict",
          `Expected preview revision ${request.expectedPreviewRevision}; current is ${preview.revision}`,
        );
      const active = this.#active.get(preview.previewId);
      if (!active)
        throw new PreviewManagerServiceError(
          "unavailable",
          "Owned preview process is unavailable",
        );
      active.intentionalStop = true;
      await this.#terminate(active);
      this.#active.delete(preview.previewId);
      preview.state = "stopped";
      preview.stoppedAt = new Date(this.#now()).toISOString();
      preview.portClosed = await this.#proveClosed(preview.port);
      preview.logs = active.logs.text();
      preview.logsTruncated = active.logs.truncated;
      this.#state.active = null;
      this.#state.latestAttempt = clone(preview);
      this.#state.previousVerified = clone(preview);
      this.#recordCommand(
        "stop",
        request.requestId,
        request.correlationId,
        canonicalRequest,
        preview,
      );
      await this.#persist();
      return { preview: clone(preview), replayed: false };
    });
  }

  async dispose(): Promise<void> {
    await this.#serialize(async () => {
      if (!this.#loadPromise && this.#active.size === 0) return;
      await this.#ensureLoaded();
      for (const [previewId, active] of this.#active) {
        active.intentionalStop = true;
        await this.#terminate(active);
        this.#active.delete(previewId);
        if (this.#state.active?.previewId === previewId) {
          this.#state.active.state = "stopped";
          this.#state.active.stoppedAt = new Date(this.#now()).toISOString();
          this.#state.active.portClosed = await this.#proveClosed(
            this.#state.active.port,
          );
          this.#state.active.logs = active.logs.text();
          this.#state.active.logsTruncated = active.logs.truncated;
          this.#state.latestAttempt = clone(this.#state.active);
          this.#state.previousVerified = clone(this.#state.active);
          this.#state.active = null;
        }
      }
      await this.#persist();
    });
  }

  #parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success)
      throw new PreviewManagerServiceError(
        "validation",
        parsed.error.issues[0]?.message ?? "Invalid preview manager request",
      );
    return parsed.data;
  }

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationTail.then(operation, operation);
    this.#mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  #replay(
    kind: "approve" | "start" | "stop",
    requestId: string,
    correlationId: string,
    canonicalRequest: string,
  ): PreviewRecipe | PreviewRecord | null {
    const byRequest = this.#state.commands.find(
      (command) => command.requestId === requestId,
    );
    const byCorrelation = this.#state.commands.find(
      (command) => command.correlationId === correlationId,
    );
    if (!byRequest && !byCorrelation) return null;
    if (
      !byRequest ||
      !byCorrelation ||
      byRequest !== byCorrelation ||
      byRequest.kind !== kind ||
      byRequest.canonical !== canonicalRequest
    )
      throw new PreviewManagerServiceError(
        "correlation-conflict",
        "Request or correlation ID was reused with different preview input",
      );
    const result = byRequest.result;
    if (result.schema === "aiw.preview-record/1") {
      const currentResult = [
        this.#state.latestAttempt,
        this.#state.active,
        this.#state.previousVerified,
      ].find((preview) => preview?.previewId === result.previewId);
      return clone(currentResult ?? result);
    }
    return clone(result);
  }

  #recordCommand(
    kind: "approve" | "start" | "stop",
    requestId: string,
    correlationId: string,
    canonicalRequest: string,
    result: PreviewRecipe | PreviewRecord,
  ): void {
    this.#state.commands = [
      ...this.#state.commands,
      { kind, requestId, correlationId, canonical: canonicalRequest, result },
    ].slice(-32);
  }

  async #finishFailedStart(
    request: StartPreviewRequest,
    preview: PreviewRecord,
    canonicalRequest: string,
    logs: BoundedText,
    message: string,
  ): Promise<{ readonly preview: PreviewRecord; readonly replayed: false }> {
    preview.state = "failed";
    preview.logs = logs.text();
    preview.logsTruncated = logs.truncated;
    preview.stoppedAt = new Date(this.#now()).toISOString();
    preview.portClosed = await this.#proveClosed(preview.port);
    preview.error = message.slice(0, 512);
    this.#state.latestAttempt = clone(preview);
    this.#recordCommand(
      "start",
      request.requestId,
      request.correlationId,
      canonicalRequest,
      preview,
    );
    await this.#persist();
    return { preview: clone(preview), replayed: false };
  }

  async #health(
    port: number,
    readinessPath: string,
  ): Promise<PreviewRecord["health"]> {
    try {
      const response = await this.#fetch(
        `http://127.0.0.1:${port}${readinessPath}`,
        { redirect: "error", signal: AbortSignal.timeout(500) },
      );
      if (!response.ok) return null;
      return {
        ok: true,
        status: response.status,
        checkedAt: new Date(this.#now()).toISOString(),
      };
    } catch {
      return null;
    }
  }

  async #recordUnexpectedExit(previewId: string): Promise<void> {
    await this.#serialize(async () => {
      await this.#ensureLoaded();
      const preview = this.#state.active;
      if (!preview || preview.previewId !== previewId) return;
      const active = this.#active.get(previewId);
      this.#active.delete(previewId);
      preview.state = "failed";
      preview.stoppedAt = new Date(this.#now()).toISOString();
      preview.portClosed = await this.#proveClosed(preview.port);
      preview.logs = active?.logs.text() ?? preview.logs;
      preview.logsTruncated = active?.logs.truncated ?? preview.logsTruncated;
      preview.error = "Owned preview process exited after readiness.";
      this.#state.latestAttempt = clone(preview);
      this.#state.active = null;
      await this.#persist();
    });
  }

  async #terminate(active: ActivePreview): Promise<void> {
    const child = active.child;
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit").catch(() => []);
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else if (child.pid) process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
    const completed = await Promise.race([
      exited.then(() => true),
      wait(750).then(() => false),
    ]);
    if (completed || child.exitCode !== null || child.signalCode !== null)
      return;
    try {
      if (process.platform === "win32") child.kill("SIGKILL");
      else if (child.pid) process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
    await exited;
  }

  async #proveClosed(port: number): Promise<boolean> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await portIsClosed(port)) return true;
      await wait(25);
    }
    return false;
  }

  #ensureLoaded(): Promise<void> {
    this.#loadPromise ??= this.#load();
    return this.#loadPromise;
  }

  async #load(): Promise<void> {
    await mkdir(this.#directory, { recursive: true, mode: 0o700 });
    const [currentText, previousText] = await Promise.all([
      optionalRead(this.#currentPath),
      optionalRead(this.#previousPath),
    ]);
    if (currentText === null && previousText === null) return;
    let envelope: z.infer<typeof StoreEnvelopeSchema>;
    try {
      if (!currentText) throw new Error("Current preview generation missing");
      envelope = this.#parseEnvelope(currentText);
    } catch {
      if (!previousText)
        throw new PreviewManagerServiceError(
          "unavailable",
          "Both preview manager generations failed validation",
        );
      envelope = this.#parseEnvelope(previousText);
      this.#loadedFromPrevious = true;
    }
    this.#generation = envelope.generation;
    this.#state = envelope.payload;
    const interrupted = this.#state.active;
    if (interrupted && ["starting", "ready"].includes(interrupted.state)) {
      const recoveredAt = new Date(this.#now()).toISOString();
      if (interrupted.state === "ready")
        this.#state.previousVerified = {
          ...clone(interrupted),
          state: "stopped",
          stoppedAt: recoveredAt,
          portClosed: null,
          recovered: true,
          error: "Preview process ownership was interrupted by restart.",
        };
      this.#state.latestAttempt = {
        ...clone(interrupted),
        state: "failed",
        stoppedAt: recoveredAt,
        portClosed: null,
        recovered: true,
        error: "Preview process ownership was interrupted by restart.",
      };
      this.#state.active = null;
      await this.#persist();
    }
  }

  #parseEnvelope(input: string): z.infer<typeof StoreEnvelopeSchema> {
    const raw: unknown = JSON.parse(input);
    if (
      !raw ||
      typeof raw !== "object" ||
      !("payload" in raw) ||
      !("checksum" in raw) ||
      (raw as { checksum: unknown }).checksum !==
        sha256(canonical((raw as { payload: unknown }).payload))
    )
      throw new Error("Preview manager generation checksum mismatch");
    return StoreEnvelopeSchema.parse(raw);
  }

  async #persist(): Promise<void> {
    const payload = PreviewManagerStateSchema.parse(this.#state);
    const nextGeneration = this.#generation + 1;
    const encoded = `${JSON.stringify(
      StoreEnvelopeSchema.parse({
        schema: "aiw.preview-manager-store-envelope/1",
        generation: nextGeneration,
        payload,
        checksum: sha256(canonical(payload)),
      }),
      null,
      2,
    )}\n`;
    if (Buffer.byteLength(encoded) > 256 * 1024)
      throw new PreviewManagerServiceError(
        "unavailable",
        "Preview manager store exceeds its byte ceiling",
      );
    const temporary = join(
      this.#directory,
      `.preview-manager.${process.pid}.${nextGeneration}.tmp`,
    );
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(encoded, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    const current = await optionalRead(this.#currentPath);
    if (current !== null && !this.#loadedFromPrevious) {
      this.#parseEnvelope(current);
      await copyFile(this.#currentPath, this.#previousPath);
      await syncFile(this.#previousPath);
    }
    await rename(temporary, this.#currentPath);
    this.#generation = nextGeneration;
    this.#loadedFromPrevious = false;
  }
}

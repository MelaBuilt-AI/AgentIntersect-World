import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const GIT_TIMEOUT_MS = 15_000;
const GIT_OUTPUT_BYTES = 64 * 1024;

type GitResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export type WorktreeAuthorityOptions = {
  readonly approvedRepositoryRoot: string;
  readonly currentRepositoryRoot?: () => string | null;
  readonly allowedWorktreeParent: string;
};

export type WorktreeCreateRequest = {
  readonly ownerId: string;
  readonly requestId: string;
  readonly worktreeId: string;
  readonly repositoryRoot: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly startPoint: string;
};

export type WorktreeAttachRequest = WorktreeCreateRequest;

export type WorktreeReceipt = {
  readonly schema: "aiw.worktree-authority-receipt/1";
  readonly ownerId: string;
  readonly requestId: string;
  readonly worktreeId: string;
  readonly repositoryId: string;
  readonly relativePath: string;
  readonly branch: string;
  readonly head: string;
  readonly state: "current" | "dirty" | "wrong-branch";
  readonly statusSummary: string;
  readonly validatedAt: string;
  readonly attestation: string;
};

export type WorktreeCreateResult = {
  readonly receipt: WorktreeReceipt;
  readonly replayed: boolean;
};

export type WorktreeCancellationResult = {
  readonly state: "cancelled" | "cleanup-required";
  readonly removed: boolean;
  readonly replayed: boolean;
  readonly receipt: WorktreeReceipt;
};

type WorktreeBinding = {
  readonly ownerId: string;
  readonly requestId: string;
  readonly worktreeId: string;
  readonly repositoryRoot: string;
  readonly worktreePath: string;
  readonly relativePath: string;
  readonly branch: string;
  receipt: WorktreeReceipt;
};

type ReplayRecord = {
  readonly canonical: string;
  readonly result: WorktreeCreateResult | WorktreeCancellationResult;
};

export class WorktreeAuthorityError extends Error {
  constructor(
    readonly code:
      | "validation"
      | "git-refused"
      | "git-failed"
      | "ownership-mismatch"
      | "correlation-conflict"
      | "not-found"
      | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "WorktreeAuthorityError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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

function contained(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
}

function displayGitFailure(result: GitResult): string {
  return (result.stderr || result.stdout || "Git operation failed")
    .trim()
    .slice(0, 512);
}

function boundedGitOutput(value: string, maximumBytes: number): string {
  const bytes = Buffer.from(value, "utf8");
  return bytes.length <= maximumBytes
    ? value
    : bytes.subarray(0, maximumBytes).toString("utf8");
}

async function missing(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return false;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    )
      return true;
    throw error;
  }
}

export class WorktreeAuthority {
  readonly #defaultRepositoryRoot: string;
  readonly #currentRepositoryRoot: (() => string | null) | undefined;
  readonly #allowedWorktreeParent: string;
  readonly #bindings = new Map<string, WorktreeBinding>();
  readonly #replays = new Map<string, ReplayRecord>();
  #mutationTail: Promise<void> = Promise.resolve();
  #gitTail: Promise<void> = Promise.resolve();
  #activeChild: ChildProcess | null = null;
  #closed = false;

  constructor(options: WorktreeAuthorityOptions) {
    this.#defaultRepositoryRoot = resolve(options.approvedRepositoryRoot);
    this.#currentRepositoryRoot = options.currentRepositoryRoot;
    this.#allowedWorktreeParent = resolve(options.allowedWorktreeParent);
  }

  get #approvedRepositoryRoot(): string {
    const root = this.#currentRepositoryRoot
      ? this.#currentRepositoryRoot()
      : this.#defaultRepositoryRoot;
    if (!root || !isAbsolute(root))
      throw new WorktreeAuthorityError(
        "git-refused",
        "Select a repository before starting work",
      );
    return resolve(root);
  }

  ownedProcessCount(): number {
    return this.#activeChild ? 1 : 0;
  }

  async repositoryIdentity(): Promise<string> {
    const { repositoryRoot } = await this.#approvedBoundary(
      this.#approvedRepositoryRoot,
    );
    return `git-${sha256(await this.#commonDirectory(repositoryRoot)).slice(0, 24)}`;
  }

  async create(input: WorktreeCreateRequest): Promise<WorktreeCreateResult> {
    return this.#serialize(async () => {
      this.#validateRequest(input);
      const canonicalRequest = canonical({ operation: "create", input });
      const replay = this.#replay<WorktreeCreateResult>(
        input.requestId,
        canonicalRequest,
      );
      if (replay) return { ...replay, replayed: true };
      if (this.#bindings.has(input.worktreeId))
        throw new WorktreeAuthorityError(
          "git-refused",
          "Worktree identity is already owned",
        );
      const boundary = await this.#createBoundary(input);
      await this.#validateBranch(boundary.repositoryRoot, input.branch);
      await this.#validateStartPoint(boundary.repositoryRoot, input.startPoint);
      const result = await this.#git([
        "-C",
        boundary.repositoryRoot,
        "worktree",
        "add",
        "-b",
        input.branch,
        input.worktreePath,
        input.startPoint,
      ]);
      if (result.exitCode !== 0)
        throw new WorktreeAuthorityError(
          "git-failed",
          displayGitFailure(result),
        );
      const binding = await this.#measureNewBinding(input, boundary);
      this.#bindings.set(input.worktreeId, binding);
      const created = { receipt: binding.receipt, replayed: false } as const;
      this.#replays.set(input.requestId, {
        canonical: canonicalRequest,
        result: created,
      });
      return created;
    });
  }

  async attach(input: WorktreeAttachRequest): Promise<WorktreeCreateResult> {
    return this.#serialize(async () => {
      this.#validateRequest(input);
      const canonicalRequest = canonical({ operation: "attach", input });
      const replay = this.#replay<WorktreeCreateResult>(
        input.requestId,
        canonicalRequest,
      );
      if (replay) return { ...replay, replayed: true };
      const existing = this.#bindings.get(input.worktreeId);
      if (existing && existing.ownerId !== input.ownerId)
        throw new WorktreeAuthorityError(
          "ownership-mismatch",
          "Worktree is owned by a different authority",
        );
      const boundary = await this.#existingBoundary(input);
      await this.#validateBranch(boundary.repositoryRoot, input.branch);
      if (
        existing &&
        (existing.repositoryRoot !== boundary.repositoryRoot ||
          existing.worktreePath !== boundary.worktreePath ||
          existing.branch !== input.branch)
      )
        throw new WorktreeAuthorityError(
          "git-refused",
          "Existing worktree ownership cannot be rebound",
        );
      if (
        [...this.#bindings.values()].some(
          (binding) =>
            binding.worktreeId !== input.worktreeId &&
            binding.worktreePath === boundary.worktreePath,
        )
      )
        throw new WorktreeAuthorityError(
          "git-refused",
          "Real worktree path is already owned",
        );
      const binding = await this.#measureBinding({
        ownerId: input.ownerId,
        requestId: input.requestId,
        worktreeId: input.worktreeId,
        repositoryRoot: boundary.repositoryRoot,
        worktreePath: boundary.worktreePath,
        relativePath: boundary.relativePath,
        branch: input.branch,
        receipt: null,
      });
      this.#bindings.set(input.worktreeId, binding);
      const attached = { receipt: binding.receipt, replayed: false } as const;
      this.#replays.set(input.requestId, {
        canonical: canonicalRequest,
        result: attached,
      });
      return attached;
    });
  }

  async measure(input: {
    readonly ownerId: string;
    readonly worktreeId: string;
    readonly repositoryRoot?: string;
    readonly worktreePath?: string;
  }): Promise<WorktreeReceipt> {
    return this.#serialize(async () => {
      const binding = this.#ownedBinding(input.ownerId, input.worktreeId);
      if (
        input.repositoryRoot !== undefined ||
        input.worktreePath !== undefined
      ) {
        if (!input.repositoryRoot || !input.worktreePath)
          throw new WorktreeAuthorityError(
            "validation",
            "Repository and worktree paths must be supplied together",
          );
        const boundary = await this.#existingBoundary({
          ...binding,
          requestId: "measure",
          startPoint: "HEAD",
          repositoryRoot: input.repositoryRoot,
          worktreePath: input.worktreePath,
        });
        if (
          boundary.repositoryRoot !== binding.repositoryRoot ||
          boundary.worktreePath !== binding.worktreePath
        )
          throw new WorktreeAuthorityError(
            "git-refused",
            "Measurement cannot change an owned worktree path",
          );
      }
      const measured = await this.#measureBinding(binding);
      this.#bindings.set(input.worktreeId, measured);
      return measured.receipt;
    });
  }

  async cancel(input: {
    readonly ownerId: string;
    readonly requestId: string;
    readonly worktreeId: string;
  }): Promise<WorktreeCancellationResult> {
    return this.#serialize(async () => {
      this.#validateIdentifier("ownerId", input.ownerId);
      this.#validateIdentifier("requestId", input.requestId);
      this.#validateIdentifier("worktreeId", input.worktreeId);
      const canonicalRequest = canonical({ operation: "cancel", input });
      const replay = this.#replay<WorktreeCancellationResult>(
        input.requestId,
        canonicalRequest,
      );
      if (replay) return { ...replay, replayed: true };
      const binding = this.#ownedBinding(input.ownerId, input.worktreeId);
      const measured = await this.#measureBinding(binding);
      this.#bindings.set(input.worktreeId, measured);
      if (measured.receipt.state !== "current") {
        const retained = {
          state: "cleanup-required",
          removed: false,
          replayed: false,
          receipt: measured.receipt,
        } as const;
        this.#replays.set(input.requestId, {
          canonical: canonicalRequest,
          result: retained,
        });
        return retained;
      }
      const removal = await this.#git([
        "-C",
        measured.repositoryRoot,
        "worktree",
        "remove",
        measured.worktreePath,
      ]);
      if (removal.exitCode !== 0)
        throw new WorktreeAuthorityError(
          "git-failed",
          displayGitFailure(removal),
        );
      if (!(await missing(measured.worktreePath)))
        throw new WorktreeAuthorityError(
          "git-failed",
          "Git reported removal but the worktree remains",
        );
      this.#bindings.delete(input.worktreeId);
      const cancelled = {
        state: "cancelled",
        removed: true,
        replayed: false,
        receipt: measured.receipt,
      } as const;
      this.#replays.set(input.requestId, {
        canonical: canonicalRequest,
        result: cancelled,
      });
      return cancelled;
    });
  }

  async createGenerated(input: {
    readonly ownerId: string;
    readonly requestId: string;
    readonly worktreeId: string;
    readonly startPoint?: string;
    readonly branch?: string;
  }): Promise<WorktreeCreateResult> {
    this.#validateIdentifier("ownerId", input.ownerId);
    this.#validateIdentifier("requestId", input.requestId);
    this.#validateIdentifier("worktreeId", input.worktreeId);
    const suffix = sha256(`${input.ownerId}\0${input.requestId}`).slice(0, 12);
    const stem = input.worktreeId
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return this.create({
      ownerId: input.ownerId,
      requestId: input.requestId,
      worktreeId: input.worktreeId,
      repositoryRoot: this.#approvedRepositoryRoot,
      worktreePath: join(
        this.#allowedWorktreeParent,
        `aiw-${stem || "worktree"}-${suffix}`,
      ),
      branch: input.branch ?? `workstream/${stem || "worktree"}-${suffix}`,
      startPoint: input.startPoint ?? "HEAD",
    });
  }

  async restore(receipt: WorktreeReceipt): Promise<WorktreeReceipt> {
    this.#assertReceipt(receipt);
    const result = await this.attach({
      ownerId: receipt.ownerId,
      requestId: `restore/${receipt.worktreeId}/${receipt.attestation.slice(0, 12)}`,
      worktreeId: receipt.worktreeId,
      repositoryRoot: this.#approvedRepositoryRoot,
      worktreePath: join(this.#allowedWorktreeParent, receipt.relativePath),
      branch: receipt.branch,
      startPoint: receipt.head,
    });
    if (result.receipt.repositoryId !== receipt.repositoryId)
      throw new WorktreeAuthorityError(
        "git-refused",
        "Restored worktree belongs to a different repository",
      );
    return this.measure({
      ownerId: receipt.ownerId,
      worktreeId: receipt.worktreeId,
      repositoryRoot: this.#approvedRepositoryRoot,
      worktreePath: join(this.#allowedWorktreeParent, receipt.relativePath),
    });
  }

  async dispose(): Promise<void> {
    this.#closed = true;
    this.#activeChild?.kill("SIGTERM");
    await Promise.all([this.#mutationTail, this.#gitTail]);
  }

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationTail.then(operation, operation);
    this.#mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  #replay<T extends ReplayRecord["result"]>(
    requestId: string,
    canonicalRequest: string,
  ): T | null {
    const existing = this.#replays.get(requestId);
    if (!existing) return null;
    if (existing.canonical !== canonicalRequest)
      throw new WorktreeAuthorityError(
        "correlation-conflict",
        "Request ID was reused with different input",
      );
    return existing.result as T;
  }

  #ownedBinding(ownerId: string, worktreeId: string): WorktreeBinding {
    const binding = this.#bindings.get(worktreeId);
    if (!binding)
      throw new WorktreeAuthorityError(
        "not-found",
        "Worktree ownership is unavailable",
      );
    if (binding.ownerId !== ownerId)
      throw new WorktreeAuthorityError(
        "ownership-mismatch",
        "Worktree is owned by a different authority",
      );
    return binding;
  }

  #validateRequest(input: WorktreeCreateRequest): void {
    this.#validateIdentifier("ownerId", input.ownerId);
    this.#validateIdentifier("requestId", input.requestId);
    this.#validateIdentifier("worktreeId", input.worktreeId);
    if (
      Buffer.byteLength(input.branch) > 256 ||
      input.branch.length === 0 ||
      /[\0-\x20\x7f]/.test(input.branch)
    )
      throw new WorktreeAuthorityError(
        "validation",
        "Branch is outside the bounded Git ref grammar",
      );
    if (
      Buffer.byteLength(input.startPoint) > 256 ||
      input.startPoint.length === 0 ||
      /[\0-\x20\x7f]/.test(input.startPoint)
    )
      throw new WorktreeAuthorityError(
        "validation",
        "Start point is outside the bounded Git ref grammar",
      );
  }

  async #validateBranch(repositoryRoot: string, branch: string): Promise<void> {
    const result = await this.#git([
      "-C",
      repositoryRoot,
      "check-ref-format",
      "--branch",
      branch,
    ]);
    if (result.exitCode !== 0)
      throw new WorktreeAuthorityError(
        "git-refused",
        "Branch is not a valid bounded Git branch",
      );
  }

  async #validateStartPoint(
    repositoryRoot: string,
    startPoint: string,
  ): Promise<void> {
    const result = await this.#git([
      "-C",
      repositoryRoot,
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${startPoint}^{commit}`,
    ]);
    if (result.exitCode !== 0)
      throw new WorktreeAuthorityError(
        "git-refused",
        "Selected repository needs an initial commit before an isolated Workstream can start; create that commit and reload the repository",
      );
  }

  #validateIdentifier(label: string, value: string): void {
    if (!IDENTIFIER.test(value))
      throw new WorktreeAuthorityError(
        "validation",
        `${label} is outside the bounded identifier grammar`,
      );
  }

  async #createBoundary(input: WorktreeCreateRequest): Promise<{
    readonly repositoryRoot: string;
    readonly allowedParent: string;
    readonly relativePath: string;
  }> {
    const boundary = await this.#approvedBoundary(input.repositoryRoot);
    if (!isAbsolute(input.worktreePath))
      throw new WorktreeAuthorityError(
        "git-refused",
        "Worktree path must be absolute",
      );
    const parent = await this.#validatedDirectory(dirname(input.worktreePath));
    if (!contained(boundary.allowedParent, parent))
      throw new WorktreeAuthorityError(
        "git-refused",
        "Worktree path is outside the allowed parent",
      );
    if (!(await missing(input.worktreePath)))
      throw new WorktreeAuthorityError(
        "git-refused",
        "New worktree path already exists",
      );
    return {
      ...boundary,
      relativePath: relative(boundary.allowedParent, input.worktreePath),
    };
  }

  async #existingBoundary(input: WorktreeCreateRequest): Promise<{
    readonly repositoryRoot: string;
    readonly allowedParent: string;
    readonly worktreePath: string;
    readonly relativePath: string;
  }> {
    const boundary = await this.#approvedBoundary(input.repositoryRoot);
    const worktreePath = await this.#validatedDirectory(input.worktreePath);
    if (
      worktreePath === boundary.repositoryRoot ||
      !contained(boundary.allowedParent, worktreePath)
    )
      throw new WorktreeAuthorityError(
        "git-refused",
        "Worktree is outside the allowed editing boundary",
      );
    return {
      ...boundary,
      worktreePath,
      relativePath: relative(boundary.allowedParent, worktreePath),
    };
  }

  async #approvedBoundary(repositoryRootInput: string): Promise<{
    readonly repositoryRoot: string;
    readonly allowedParent: string;
  }> {
    if (!isAbsolute(repositoryRootInput))
      throw new WorktreeAuthorityError(
        "git-refused",
        "Repository root must be absolute",
      );
    const [approvedRepositoryRoot, allowedParent, repositoryRoot] =
      await Promise.all([
        this.#validatedDirectory(this.#approvedRepositoryRoot),
        this.#validatedDirectory(this.#allowedWorktreeParent),
        this.#validatedDirectory(repositoryRootInput),
      ]);
    if (repositoryRoot !== approvedRepositoryRoot)
      throw new WorktreeAuthorityError(
        "git-refused",
        "Repository root is not the operator-approved repository",
      );
    return { repositoryRoot, allowedParent };
  }

  async #validatedDirectory(path: string): Promise<string> {
    if (!isAbsolute(path))
      throw new WorktreeAuthorityError(
        "git-refused",
        "Git roots must be absolute",
      );
    const information = await lstat(path);
    if (information.isSymbolicLink() || !information.isDirectory())
      throw new WorktreeAuthorityError(
        "git-refused",
        "Git root must be a real directory",
      );
    return realpath(path);
  }

  async #measureNewBinding(
    input: WorktreeCreateRequest,
    boundary: {
      readonly repositoryRoot: string;
      readonly relativePath: string;
    },
  ): Promise<WorktreeBinding> {
    const worktreePath = await this.#validatedDirectory(input.worktreePath);
    return this.#measureBinding({
      ownerId: input.ownerId,
      requestId: input.requestId,
      worktreeId: input.worktreeId,
      repositoryRoot: boundary.repositoryRoot,
      worktreePath,
      relativePath: boundary.relativePath,
      branch: input.branch,
      receipt: null,
    });
  }

  async #measureBinding(
    input: Omit<WorktreeBinding, "receipt"> & {
      readonly receipt: WorktreeReceipt | null;
    },
  ): Promise<WorktreeBinding> {
    const [repositoryCommon, worktreeCommon] = await Promise.all([
      this.#commonDirectory(input.repositoryRoot),
      this.#commonDirectory(input.worktreePath),
    ]);
    if (repositoryCommon !== worktreeCommon)
      throw new WorktreeAuthorityError(
        "git-refused",
        "Worktree belongs to a different repository",
      );
    const registered = await this.#git([
      "-C",
      input.repositoryRoot,
      "worktree",
      "list",
      "--porcelain",
    ]);
    if (
      registered.exitCode !== 0 ||
      !registered.stdout
        .split(/\r?\n/)
        .some((line) => line === `worktree ${input.worktreePath}`)
    )
      throw new WorktreeAuthorityError(
        "git-refused",
        "Worktree is not registered in the approved repository",
      );
    const [branchResult, headResult, statusResult] = await Promise.all([
      this.#git([
        "-C",
        input.worktreePath,
        "rev-parse",
        "--abbrev-ref",
        "HEAD",
      ]),
      this.#git(["-C", input.worktreePath, "rev-parse", "HEAD"]),
      this.#git([
        "-C",
        input.worktreePath,
        "status",
        "--porcelain=v2",
        "--untracked-files=normal",
      ]),
    ]);
    if (
      branchResult.exitCode !== 0 ||
      headResult.exitCode !== 0 ||
      statusResult.exitCode !== 0
    )
      throw new WorktreeAuthorityError(
        "git-failed",
        "Could not measure worktree branch, HEAD, and status",
      );
    const branch = branchResult.stdout.trim();
    const dirty = statusResult.stdout.trim().length > 0;
    const wrongBranch = branch !== input.branch;
    const unsigned = {
      schema: "aiw.worktree-authority-receipt/1" as const,
      ownerId: input.ownerId,
      requestId: input.requestId,
      worktreeId: input.worktreeId,
      repositoryId: `git-${sha256(repositoryCommon).slice(0, 24)}`,
      relativePath: input.relativePath,
      branch: input.branch,
      head: headResult.stdout.trim(),
      state: wrongBranch
        ? ("wrong-branch" as const)
        : dirty
          ? ("dirty" as const)
          : ("current" as const),
      statusSummary: wrongBranch
        ? `Expected ${input.branch}; found ${branch}`
        : dirty
          ? boundedGitOutput(statusResult.stdout.trim(), 2_048)
          : "clean",
      validatedAt: new Date().toISOString(),
    };
    const receipt: WorktreeReceipt = {
      ...unsigned,
      attestation: sha256(canonical(unsigned)),
    };
    return { ...input, receipt };
  }

  #assertReceipt(receipt: WorktreeReceipt): void {
    const { attestation, ...unsigned } = receipt;
    if (
      receipt.schema !== "aiw.worktree-authority-receipt/1" ||
      attestation !== sha256(canonical(unsigned))
    )
      throw new WorktreeAuthorityError(
        "git-refused",
        "Worktree receipt attestation failed",
      );
  }

  async #commonDirectory(repositoryRoot: string): Promise<string> {
    const result = await this.#git([
      "-C",
      repositoryRoot,
      "rev-parse",
      "--git-common-dir",
    ]);
    if (result.exitCode !== 0)
      throw new WorktreeAuthorityError(
        "git-refused",
        "Directory is not a valid Git worktree",
      );
    const raw = result.stdout.trim();
    return realpath(isAbsolute(raw) ? raw : resolve(repositoryRoot, raw));
  }

  async #git(args: readonly string[]): Promise<GitResult> {
    let release!: () => void;
    const prior = this.#gitTail;
    this.#gitTail = new Promise<void>((resolveTail) => {
      release = resolveTail;
    });
    await prior;
    try {
      if (this.#closed)
        throw new WorktreeAuthorityError(
          "unavailable",
          "Worktree authority is closed",
        );
      return await new Promise<GitResult>((resolveResult, reject) => {
        const child = spawn("git", [...args], {
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            GIT_CONFIG_NOSYSTEM: "1",
            GIT_TERMINAL_PROMPT: "0",
            LC_ALL: "C",
          },
        });
        this.#activeChild = child;
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let bytes = 0;
        const add = (target: Buffer[], value: Buffer) => {
          bytes += value.length;
          if (bytes > GIT_OUTPUT_BYTES) {
            child.kill("SIGTERM");
            return;
          }
          target.push(value);
        };
        child.stdout.on("data", (value: Buffer) => add(stdout, value));
        child.stderr.on("data", (value: Buffer) => add(stderr, value));
        const timer = setTimeout(() => child.kill("SIGTERM"), GIT_TIMEOUT_MS);
        child.once("error", reject);
        child.once("close", (code) => {
          clearTimeout(timer);
          this.#activeChild = null;
          resolveResult({
            stdout: Buffer.concat(stdout).toString("utf8"),
            stderr: Buffer.concat(stderr).toString("utf8"),
            exitCode: code ?? 1,
          });
        });
      });
    } finally {
      this.#activeChild = null;
      release();
    }
  }
}

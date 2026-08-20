import { createHash } from "node:crypto";
import path from "node:path";

import {
  AgentRepositoryWorkFocusSchema,
  type AgentSession,
  type AgentRepositoryWorkFocus,
} from "@agentintersect-world/agent-session-protocol";
import type {
  RepositoryGeneration,
  WorldObject,
  WorldSnapshot,
} from "@agentintersect-world/world-schema";

export type AdapterRepositoryLocator = {
  readonly operation: "read" | "edit" | "tool";
  readonly paths: readonly string[];
  readonly symbol?: {
    readonly name?: string;
    readonly line?: number;
    readonly column?: number;
  };
};

export type RepositoryWorkstreamRecovery = {
  readonly workstreamId: string;
  readonly revision: number;
  readonly repository: {
    readonly repositoryId: string;
    readonly revision: string;
  };
  readonly agent: {
    readonly agentId: string;
    readonly nativeSessionId: string;
    readonly rootNativeSessionId?: string | undefined;
  };
  readonly authority: {
    readonly repositoryId: string;
    readonly worktreeId: string;
  };
  readonly worktreeState: string;
  readonly projection: {
    readonly changedFiles: readonly { readonly path: string }[];
  };
  readonly status: string;
};

type AdapterId = "codex" | "claude-code" | "hermes" | "openclaw";
type LocatorPolicy = {
  readonly operation: AdapterRepositoryLocator["operation"];
  readonly fields: readonly string[];
};

const TOOL_POLICIES: Readonly<
  Record<AdapterId, Readonly<Record<string, LocatorPolicy>>>
> = {
  codex: {
    file_change: { operation: "edit", fields: [] },
    read_file: { operation: "read", fields: ["path", "file_path"] },
    write_file: { operation: "edit", fields: ["path", "file_path"] },
    edit_file: { operation: "edit", fields: ["path", "file_path"] },
    apply_patch: { operation: "edit", fields: ["path", "file_path"] },
  },
  "claude-code": {
    read: { operation: "read", fields: ["file_path", "path"] },
    edit: { operation: "edit", fields: ["file_path", "path"] },
    write: { operation: "edit", fields: ["file_path", "path"] },
    notebookedit: {
      operation: "edit",
      fields: ["notebook_path"],
    },
  },
  hermes: {
    read_file: { operation: "read", fields: ["path", "file_path"] },
    write_file: { operation: "edit", fields: ["path", "file_path"] },
    edit_file: { operation: "edit", fields: ["path", "file_path"] },
    apply_patch: { operation: "edit", fields: ["path", "file_path"] },
  },
  openclaw: {
    read_file: { operation: "read", fields: ["path", "file_path"] },
    write_file: { operation: "edit", fields: ["path", "file_path"] },
    edit_file: { operation: "edit", fields: ["path", "file_path"] },
    apply_patch: { operation: "edit", fields: ["path", "file_path"] },
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function boundedLocatorPaths(values: readonly unknown[]): string[] | undefined {
  const paths: string[] = [];
  for (const value of values) {
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      Buffer.byteLength(value, "utf8") > 4_096 ||
      hasControlCharacters(value)
    )
      return undefined;
    if (!paths.includes(value)) paths.push(value);
  }
  return paths.length > 0 && paths.length <= 32 ? paths : undefined;
}

export function extractAdapterRepositoryLocator(
  adapterId: AdapterId,
  toolName: string,
  args: unknown,
): AdapterRepositoryLocator | undefined {
  if (!isRecord(args)) return undefined;
  const policy = TOOL_POLICIES[adapterId][toolName.toLowerCase()];
  if (!policy) return undefined;
  if (adapterId === "codex" && toolName.toLowerCase() === "file_change") {
    if (!Array.isArray(args.changes)) return undefined;
    const paths = boundedLocatorPaths(
      args.changes.map((change) =>
        isRecord(change) ? change.path : undefined,
      ),
    );
    return paths ? { operation: policy.operation, paths } : undefined;
  }
  const paths = boundedLocatorPaths(
    policy.fields
      .map((field) => args[field])
      .filter((value) => value !== undefined),
  );
  return paths ? { operation: policy.operation, paths } : undefined;
}

export type RepositoryWorkTarget = Pick<
  AgentRepositoryWorkFocus,
  | "repositoryRef"
  | "objectRef"
  | "objectKind"
  | "repositoryPath"
  | "layoutGeneration"
>;

type RepositorySelection = {
  readonly generation: RepositoryGeneration;
  readonly snapshot: WorldSnapshot;
};
type LiveWorldObject = Extract<
  WorldObject,
  { kind: "file" | "directory" | "package" }
>;

type Resolution =
  | { readonly ok: true; readonly target: RepositoryWorkTarget }
  | { readonly ok: false; readonly reason: string };

const refuse = (reason: string): Resolution => ({ ok: false, reason });
const hasControlCharacters = (value: string) =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });

function canonicalRepositoryPath(
  rootPath: string,
  candidate: string,
): string | null {
  if (
    Buffer.byteLength(candidate, "utf8") > 4_096 ||
    candidate.length === 0 ||
    hasControlCharacters(candidate)
  )
    return null;
  const posixCandidate = candidate.replaceAll("\\", "/");
  if (posixCandidate.split("/").includes("..")) return null;
  const root = path.resolve(rootPath);
  const absolute = path.isAbsolute(posixCandidate)
    ? path.resolve(posixCandidate)
    : path.resolve(root, posixCandidate);
  const relative = path.relative(root, absolute);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    return null;
  return relative.split(path.sep).join("/");
}

function repositoryPath(object: LiveWorldObject): string {
  return object.path;
}

function commonDirectory(paths: readonly string[]): string {
  const directories = paths.map((value) => value.split("/").slice(0, -1));
  const first = directories[0] ?? [];
  let length = first.length;
  for (const current of directories.slice(1)) {
    length = Math.min(length, current.length);
    for (let index = 0; index < length; index += 1) {
      if (first[index] !== current[index]) {
        length = index;
        break;
      }
    }
  }
  return first.slice(0, length).join("/");
}

function packageDirectory(object: Extract<WorldObject, { kind: "package" }>) {
  const directory = path.posix.dirname(object.path);
  return directory === "." ? "" : directory;
}

export function resolveRepositoryWorkTarget(input: {
  readonly locator: AdapterRepositoryLocator;
  readonly repositoryRef: string;
  readonly selection: RepositorySelection;
  readonly hiddenObjectRefs?: ReadonlySet<string>;
  readonly unreachableObjectRefs?: ReadonlySet<string>;
}): Resolution {
  const { locator, selection } = input;
  if (
    input.repositoryRef !== selection.snapshot.repositoryRef ||
    selection.generation.fingerprint !==
      selection.snapshot.generationFingerprint
  )
    return refuse("repository-mismatch");
  if (locator.paths.length < 1 || locator.paths.length > 32)
    return refuse("invalid-path-count");
  const paths = locator.paths.map((candidate) =>
    canonicalRepositoryPath(selection.generation.rootPath, candidate),
  );
  if (paths.some((candidate) => candidate === null))
    return refuse("invalid-path");
  const canonicalPaths = paths as string[];
  const live = selection.snapshot.objects.filter(
    (object): object is LiveWorldObject =>
      object.kind === "file" ||
      object.kind === "directory" ||
      object.kind === "package",
  );
  const tombstones = selection.snapshot.objects.filter(
    (object) => object.kind === "tombstone",
  );
  if (
    canonicalPaths.some((candidate) =>
      tombstones.some((object) => object.lastKnownPath === candidate),
    )
  )
    return refuse("stale-target");

  let candidates: LiveWorldObject[];
  let resolvedPath = canonicalPaths[0] ?? "";
  if (canonicalPaths.length === 1) {
    candidates = live.filter(
      (object) => repositoryPath(object) === resolvedPath,
    );
    if (candidates.length === 0) {
      let parent = path.posix.dirname(resolvedPath);
      if (parent === ".") parent = "";
      while (true) {
        candidates = live.filter(
          (object) => object.kind === "directory" && object.path === parent,
        );
        if (candidates.length > 0) {
          resolvedPath = parent;
          break;
        }
        if (parent === "") break;
        parent = path.posix.dirname(parent);
        if (parent === ".") parent = "";
      }
      if (candidates.length === 0) {
        const packages = live.filter(
          (object): object is Extract<LiveWorldObject, { kind: "package" }> =>
            object.kind === "package" &&
            (resolvedPath === packageDirectory(object) ||
              resolvedPath.startsWith(`${packageDirectory(object)}/`)),
        );
        const deepest = Math.max(
          -1,
          ...packages.map((object) => packageDirectory(object).length),
        );
        candidates = packages.filter(
          (object) => packageDirectory(object).length === deepest,
        );
        if (candidates[0]) resolvedPath = candidates[0].path;
      }
    }
  } else {
    resolvedPath = commonDirectory(canonicalPaths);
    let ancestor = resolvedPath;
    while (true) {
      candidates = live.filter(
        (object) => object.kind === "directory" && object.path === ancestor,
      );
      if (candidates.length > 0) {
        resolvedPath = ancestor;
        break;
      }
      if (ancestor === "") break;
      ancestor = path.posix.dirname(ancestor);
      if (ancestor === ".") ancestor = "";
    }
    if (candidates.length === 0) {
      const packages = live.filter(
        (object): object is Extract<LiveWorldObject, { kind: "package" }> =>
          object.kind === "package" &&
          canonicalPaths.every((candidate) =>
            candidate.startsWith(`${packageDirectory(object)}/`),
          ),
      );
      const deepest = Math.max(
        -1,
        ...packages.map((object) => packageDirectory(object).length),
      );
      candidates = packages.filter(
        (object) => packageDirectory(object).length === deepest,
      );
      if (candidates[0]) resolvedPath = candidates[0].path;
    }
  }
  if (candidates.length !== 1)
    return refuse(
      candidates.length > 1 ? "ambiguous-target" : "missing-target",
    );
  const target = candidates[0];
  if (!target) return refuse("missing-target");
  if (input.hiddenObjectRefs?.has(target.ref)) return refuse("hidden-target");
  if (input.unreachableObjectRefs?.has(target.ref))
    return refuse("unreachable-target");
  return {
    ok: true,
    target: {
      repositoryRef: selection.snapshot.repositoryRef,
      objectRef: target.ref,
      objectKind: target.kind,
      repositoryPath: resolvedPath || ".",
      layoutGeneration: `layout-${selection.snapshot.generationFingerprint}`,
    },
  };
}

type FocusEvent =
  | {
      readonly type: "arrived";
      readonly activityId: string;
      readonly requestId: string;
      readonly actorId: string;
      readonly objectRef: string;
      readonly layoutGeneration: string;
      readonly currentLayoutGeneration: string;
      readonly actorIsAtSafeApproachPoint: boolean;
      readonly toolActive: boolean;
    }
  | {
      readonly type: "terminal";
      readonly state: "completed" | "failed" | "cancelled" | "stale";
    }
  | { readonly type: "moved-away" };

export function advanceRepositoryWorkFocus(
  focus: AgentRepositoryWorkFocus,
  event: FocusEvent,
): AgentRepositoryWorkFocus {
  if (["completed", "failed", "cancelled", "stale"].includes(focus.state))
    return focus;
  if (event.type === "terminal") return { ...focus, state: event.state };
  if (event.type === "moved-away")
    return focus.state === "coding" ? { ...focus, state: "navigating" } : focus;
  const exact =
    event.toolActive &&
    event.actorIsAtSafeApproachPoint &&
    event.activityId === focus.activityId &&
    event.requestId === focus.movementRequestId &&
    event.actorId === focus.worldSessionId &&
    event.objectRef === focus.objectRef &&
    event.layoutGeneration === focus.layoutGeneration &&
    event.currentLayoutGeneration === focus.layoutGeneration;
  return exact ? { ...focus, state: "coding" } : focus;
}

export type RepositoryMovementSubmission = {
  readonly worldSessionId: string;
  readonly activityId: string;
  readonly sequence: number;
  readonly objectRef: string;
  readonly layoutGeneration: string;
};

export class RepositoryWorkFocusCoordinator {
  readonly #selectedRepository: () => RepositorySelection | null;
  readonly #submitMovement: (
    request: RepositoryMovementSubmission,
  ) => Promise<{ readonly movementRequestId: string } | null>;
  readonly #cancelMovement: (request: {
    readonly worldSessionId: string;
    readonly movementRequestId: string;
  }) => Promise<void>;
  readonly #sequences = new Map<string, number>();

  constructor(options: {
    readonly selectedRepository: () => RepositorySelection | null;
    readonly submitMovement: (
      request: RepositoryMovementSubmission,
    ) => Promise<{ readonly movementRequestId: string } | null>;
    readonly cancelMovement?: (request: {
      readonly worldSessionId: string;
      readonly movementRequestId: string;
    }) => Promise<void>;
  }) {
    this.#selectedRepository = options.selectedRepository;
    this.#submitMovement = options.submitMovement;
    this.#cancelMovement = options.cancelMovement ?? (async () => undefined);
  }

  async start(input: {
    readonly session: {
      readonly sessionId: string;
      readonly repositoryRef: string;
    };
    readonly rosterId: string;
    readonly activityId: string;
    readonly locator: AdapterRepositoryLocator;
  }): Promise<AgentRepositoryWorkFocus | null> {
    const selection = this.#selectedRepository();
    if (!selection) return null;
    return this.#start(input, selection, "structured-tool-event");
  }

  async recover(input: {
    readonly session: AgentSession;
    readonly rosterId: string;
    readonly workstream: RepositoryWorkstreamRecovery;
  }): Promise<AgentRepositoryWorkFocus | null> {
    const selection = this.#selectedRepository();
    if (!selection) return null;
    const { session, workstream } = input;
    const rootSessionRef =
      session.adapterRootSessionRef ?? session.adapterSessionRef;
    if (
      workstream.status !== "working" ||
      (workstream.worktreeState !== "current" &&
        workstream.worktreeState !== "dirty") ||
      session.status !== "ready" ||
      session.continuity !== "current" ||
      session.mode !== "collaborate" ||
      session.sessionId !== workstream.agent.agentId ||
      session.adapterSessionRef !== workstream.agent.nativeSessionId ||
      rootSessionRef !==
        (workstream.agent.rootNativeSessionId ??
          workstream.agent.nativeSessionId) ||
      session.repositoryRef !== workstream.repository.repositoryId ||
      session.repositoryRef !== workstream.authority.repositoryId ||
      selection.snapshot.repositoryRef !== workstream.repository.repositoryId ||
      selection.generation.id !== workstream.repository.revision ||
      session.worktreeRef !== workstream.authority.worktreeId ||
      session.currentTaskRef !== workstream.workstreamId ||
      workstream.projection.changedFiles.length === 0 ||
      workstream.projection.changedFiles.length > 32
    )
      return null;
    const paths = workstream.projection.changedFiles.map(({ path }) => path);
    const activityId = `workstream-${createHash("sha256")
      .update(
        JSON.stringify({
          workstreamId: workstream.workstreamId,
          revision: workstream.revision,
          repositoryRevision: workstream.repository.revision,
          paths,
        }),
      )
      .digest("hex")}`;
    return this.#start(
      {
        session,
        rosterId: input.rosterId,
        activityId,
        locator: { operation: "tool", paths },
      },
      selection,
      "workstream-binding",
    );
  }

  async #start(
    input: {
      readonly session: {
        readonly sessionId: string;
        readonly repositoryRef: string;
      };
      readonly rosterId: string;
      readonly activityId: string;
      readonly locator: AdapterRepositoryLocator;
    },
    selection: RepositorySelection,
    source: AgentRepositoryWorkFocus["source"],
  ): Promise<AgentRepositoryWorkFocus | null> {
    const resolution = resolveRepositoryWorkTarget({
      locator: input.locator,
      repositoryRef: input.session.repositoryRef,
      selection,
    });
    if (!resolution.ok) return null;
    const sequence = (this.#sequences.get(input.session.sessionId) ?? 0) + 1;
    const movement = await this.#submitMovement({
      worldSessionId: input.session.sessionId,
      activityId: input.activityId,
      sequence,
      objectRef: resolution.target.objectRef,
      layoutGeneration: resolution.target.layoutGeneration,
    });
    if (!movement) return null;
    this.#sequences.set(input.session.sessionId, sequence);
    return AgentRepositoryWorkFocusSchema.parse({
      schema: "aiw.agent-work-focus/0.19",
      activityId: input.activityId,
      rosterId: input.rosterId,
      worldSessionId: input.session.sessionId,
      ...resolution.target,
      movementRequestId: movement.movementRequestId,
      source,
      state: "navigating",
    });
  }

  async stop(
    focus: AgentRepositoryWorkFocus,
    state: "completed" | "failed" | "cancelled" | "stale",
  ): Promise<AgentRepositoryWorkFocus> {
    if (focus.movementRequestId)
      await this.#cancelMovement({
        worldSessionId: focus.worldSessionId,
        movementRequestId: focus.movementRequestId,
      });
    return { ...focus, state };
  }
}

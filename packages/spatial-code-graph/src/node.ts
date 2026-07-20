import { createHash, randomUUID } from "node:crypto";
import { renameSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { availableParallelism } from "node:os";
import { dirname, extname, posix, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import {
  isMainThread,
  parentPort,
  Worker,
  workerData,
  type ResourceLimits,
} from "node:worker_threads";

import TreeSitter from "@vscode/tree-sitter-wasm";
import {
  CODE_GRAPH_MAX_DEPENDENCIES_PER_FILE,
  CODE_GRAPH_MAX_AGGREGATE_EDGES,
  CODE_GRAPH_MAX_FOCUSED_SYMBOL_NODES,
  CODE_GRAPH_MAX_DIAGNOSTICS_PER_FILE,
  CODE_GRAPH_MAX_SYMBOLS_PER_FILE,
  CODE_GRAPH_SCHEMA_VERSION,
  CodeGraphSnapshotSchema,
  DEPENDENCY_SCHEMA_VERSION,
  DependencyEdgeSchema,
  FileGraphCoverageSchema,
  SYMBOL_SCHEMA_VERSION,
  SymbolRecordSchema,
  type DependencyEdge,
  type DependencyKind,
  type FileGraphCoverage,
  type CodeGraphSnapshot,
  type RepositoryGeneration,
  type SymbolKind,
  type SymbolLanguage,
  type SymbolRecord,
  type WorldObjectRef,
  type WorldSnapshot,
} from "@agentintersect-world/world-schema";

export const PHASE10_MAX_WORKERS = 2 as const;
export const PHASE10_MAX_QUEUED_FILES = 128 as const;
export const PHASE10_MAX_SOURCE_BYTES = 512 * 1024;
export const PHASE10_FILE_TIMEOUT_MS = 500 as const;
export const PHASE10_MAX_AST_DEPTH = 256 as const;
export const PHASE10_EXTRACTOR_VERSION = "aiw.extractor/0.10.0" as const;
export const PHASE10_CACHE_FORMAT = "aiw.code-graph-cache/0.10" as const;

export const PHASE10_WORKER_RESOURCE_LIMITS: ResourceLimits = {
  maxOldGenerationSizeMb: 128,
  maxYoungGenerationSizeMb: 32,
  stackSizeMb: 4,
};

const ARTIFACT_HASHES = {
  "tree-sitter-javascript.wasm":
    "5fb488d0cabb4775a594bab85682de5ad6ce83c0d6ac997a9f82dd084d571240",
  "tree-sitter-tsx.wasm":
    "79e5da75ea62855a0cd67177685f0164eac87d5f630b3cbe1e0a099751ad30f8",
  "tree-sitter-typescript.wasm":
    "778025db5a8be0e70f8ccc3671e486dfeddd048c25d9e8a70c26de2e1bf6f97d",
  "tree-sitter.wasm":
    "3a31af706ffdf4a7116b064cdd4988df6791823298615009fc5b6bccbd42909b",
} as const;

type ArtifactName = keyof typeof ARTIFACT_HASHES;

const GRAMMAR_BY_LANGUAGE: Readonly<Record<SymbolLanguage, ArtifactName>> = {
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  javascript: "tree-sitter-javascript.wasm",
  jsx: "tree-sitter-javascript.wasm",
};

const LANGUAGE_BY_EXTENSION: Readonly<Record<string, SymbolLanguage>> = {
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "jsx",
};

const require = createRequire(import.meta.url);

function defaultArtifactRoot(): string {
  return dirname(require.resolve("@vscode/tree-sitter-wasm"));
}

function hash(values: readonly string[]): string {
  const digest = createHash("sha256");
  for (const value of values) {
    digest.update(value.normalize("NFC"), "utf8");
    digest.update("\0", "utf8");
  }
  return digest.digest("hex").slice(0, 32);
}

function safeSpecifier(specifier: string): string {
  const normalized = specifier.normalize("NFC").slice(0, 512);
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("\\\\") ||
    /^[A-Za-z]:[\\/]/u.test(normalized)
  )
    return "[absolute-specifier]";
  return Array.from(normalized)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("");
}

export function languageForPath(path: string): SymbolLanguage | null {
  return LANGUAGE_BY_EXTENSION[extname(path).toLowerCase()] ?? null;
}

export async function verifyParserArtifacts(
  artifactRoot = defaultArtifactRoot(),
): Promise<readonly (readonly [ArtifactName, string])[]> {
  const verified: Array<readonly [ArtifactName, string]> = [];
  for (const name of Object.keys(ARTIFACT_HASHES).sort() as ArtifactName[]) {
    let bytes: Uint8Array;
    try {
      bytes = await readFile(resolve(artifactRoot, name));
    } catch {
      throw new Error(`Phase 10 parser artifact unavailable: ${name}`);
    }
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== ARTIFACT_HASHES[name])
      throw new Error(`Phase 10 parser artifact hash mismatch: ${name}`);
    verified.push([name, actual]);
  }
  return verified;
}

export type GraphCacheEntry = {
  readonly repositoryId: string;
  readonly fileRef: WorldObjectRef;
  readonly contentHash: string | null;
  readonly grammarHash: string | null;
  readonly schema: typeof CODE_GRAPH_SCHEMA_VERSION;
  readonly extractorVersion: typeof PHASE10_EXTRACTOR_VERSION;
  readonly result: ParsedFileGraph;
};

export type GraphCacheRecord = {
  readonly graph: CodeGraphSnapshot;
  readonly entries: readonly GraphCacheEntry[];
};

export type LoadedCodeGraphCache = {
  readonly current: GraphCacheRecord | null;
  readonly previous: GraphCacheRecord | null;
  readonly recovered: boolean;
  readonly needsRebuild: boolean;
};

type CacheEnvelope = {
  readonly payload: {
    readonly format: typeof PHASE10_CACHE_FORMAT;
    readonly schema: typeof CODE_GRAPH_SCHEMA_VERSION;
    readonly extractorVersion: typeof PHASE10_EXTRACTOR_VERSION;
    readonly artifactHashes: typeof ARTIFACT_HASHES;
    readonly record: GraphCacheRecord;
  };
  readonly checksum: string;
};

function envelope(record: GraphCacheRecord): CacheEnvelope {
  const storageRecord: GraphCacheRecord = {
    graph: record.graph,
    entries: record.entries.map((entry) => ({
      ...entry,
      result: {
        ...entry.result,
        // The canonical graph owns persisted symbol/edge DTOs. Cache entries retain
        // only coverage and extraction occurrences to avoid a second 100k copy.
        symbols: [],
        dependencies: [],
      },
    })),
  };
  const payload = {
    format: PHASE10_CACHE_FORMAT,
    schema: CODE_GRAPH_SCHEMA_VERSION,
    extractorVersion: PHASE10_EXTRACTOR_VERSION,
    artifactHashes: ARTIFACT_HASHES,
    record: storageRecord,
  } as const;
  return {
    payload,
    checksum: createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex"),
  };
}

function parseCacheRecord(value: unknown): GraphCacheRecord | null {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return null;
  const record = value as Partial<GraphCacheRecord>;
  const graph = CodeGraphSnapshotSchema.safeParse(record.graph);
  if (!graph.success || !Array.isArray(record.entries)) return null;
  const entries: GraphCacheEntry[] = [];
  const symbolsByFile = new Map<WorldObjectRef, SymbolRecord[]>();
  for (const symbol of graph.data.symbols) {
    const symbols = symbolsByFile.get(symbol.fileRef) ?? [];
    symbols.push(symbol);
    symbolsByFile.set(symbol.fileRef, symbols);
  }
  for (const raw of record.entries) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw))
      return null;
    const entry = raw as Partial<GraphCacheEntry>;
    if (
      typeof entry.repositoryId !== "string" ||
      typeof entry.fileRef !== "string" ||
      !(
        entry.contentHash === null ||
        /^[0-9a-f]{64}$/u.test(entry.contentHash ?? "")
      ) ||
      !(
        entry.grammarHash === null ||
        /^[0-9a-f]{64}$/u.test(entry.grammarHash ?? "")
      ) ||
      entry.schema !== CODE_GRAPH_SCHEMA_VERSION ||
      entry.extractorVersion !== PHASE10_EXTRACTOR_VERSION ||
      !entry.result ||
      !FileGraphCoverageSchema.safeParse(entry.result.coverage).success ||
      !entry.result.symbols.every(
        (symbol) => SymbolRecordSchema.safeParse(symbol).success,
      ) ||
      !entry.result.dependencies.every(
        (edge) => DependencyEdgeSchema.safeParse(edge).success,
      ) ||
      !Array.isArray(entry.result.occurrences)
    )
      return null;
    entries.push({
      ...(entry as GraphCacheEntry),
      result: {
        ...(entry.result as ParsedFileGraph),
        symbols: symbolsByFile.get(entry.fileRef as WorldObjectRef) ?? [],
        dependencies: [],
      },
    });
  }
  return { graph: graph.data, entries };
}

export class CodeGraphCacheStore {
  readonly #currentPath: string;
  readonly #previousPath: string;

  constructor(readonly directory: string) {
    this.#currentPath = resolve(directory, "current.json");
    this.#previousPath = resolve(directory, "previous.json");
  }

  async load(): Promise<LoadedCodeGraphCache> {
    const current = await this.#read(this.#currentPath);
    const previous = await this.#read(this.#previousPath);
    if (current)
      return {
        current,
        previous: previous ? this.#withState(previous, "previous") : null,
        recovered: false,
        needsRebuild: false,
      };
    if (previous)
      return {
        current: this.#withState(previous, "previous"),
        previous: null,
        recovered: true,
        needsRebuild: true,
      };
    return {
      current: null,
      previous: null,
      recovered: false,
      needsRebuild: await this.#exists(this.#currentPath),
    };
  }

  async commit(
    record: GraphCacheRecord,
    canCommit: () => boolean = () => true,
  ): Promise<void> {
    if (
      record.graph.schema !== CODE_GRAPH_SCHEMA_VERSION ||
      record.entries.some(
        (entry) =>
          entry.schema !== CODE_GRAPH_SCHEMA_VERSION ||
          entry.extractorVersion !== PHASE10_EXTRACTOR_VERSION,
      )
    )
      throw new Error("Phase 10 cache commit record is invalid");
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const stage = resolve(this.directory, `stage-${randomUUID()}.json`);
    const previousStage = `${stage}.previous`;
    let hasPreviousStage = false;
    const encoded = `${JSON.stringify(envelope(record))}\n`;
    await writeFile(stage, encoded, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    try {
      if (!canCommit()) {
        await rm(stage);
        throw new Error("Phase 10 staged generation superseded or cancelled");
      }
      if (await this.#read(this.#currentPath)) {
        await copyFile(this.#currentPath, previousStage);
        hasPreviousStage = true;
      }
      if (!canCommit()) {
        await rm(stage);
        if (hasPreviousStage) await rm(previousStage);
        throw new Error("Phase 10 staged generation superseded or cancelled");
      }
      if (hasPreviousStage) renameSync(previousStage, this.#previousPath);
      renameSync(stage, this.#currentPath);
    } catch (error) {
      if (hasPreviousStage) await rm(previousStage, { force: true });
      try {
        await rename(stage, `${stage}.failed`);
      } catch {
        // The staged file was already committed or is unavailable.
      }
      throw error;
    }
  }

  async #read(path: string): Promise<GraphCacheRecord | null> {
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<CacheEnvelope>;
      if (
        !parsed.payload ||
        typeof parsed.checksum !== "string" ||
        parsed.payload.format !== PHASE10_CACHE_FORMAT ||
        parsed.payload.schema !== CODE_GRAPH_SCHEMA_VERSION ||
        parsed.payload.extractorVersion !== PHASE10_EXTRACTOR_VERSION ||
        JSON.stringify(parsed.payload.artifactHashes) !==
          JSON.stringify(ARTIFACT_HASHES)
      )
        return null;
      const checksum = createHash("sha256")
        .update(JSON.stringify(parsed.payload))
        .digest("hex");
      if (checksum !== parsed.checksum) return null;
      return parseCacheRecord(parsed.payload.record);
    } catch {
      return null;
    }
  }

  async #exists(path: string): Promise<boolean> {
    try {
      await readFile(path, { encoding: "utf8", flag: "r" });
      return true;
    } catch {
      return false;
    }
  }

  #withState(record: GraphCacheRecord, state: "previous"): GraphCacheRecord {
    return {
      ...record,
      graph: CodeGraphSnapshotSchema.parse({ ...record.graph, state }),
    };
  }
}

export type SymbolIdentityInput = {
  readonly repositoryId: string;
  readonly fileRef: WorldObjectRef;
  readonly language: SymbolLanguage;
  readonly kind: SymbolKind;
  readonly qualifiedName: string;
  readonly duplicateOrdinal: number;
};

export function deriveSymbolIdentity(input: SymbolIdentityInput): {
  readonly id: string;
  readonly ref: `aiw://symbol/${string}`;
  readonly groupKey: string;
} {
  const common = [
    SYMBOL_SCHEMA_VERSION,
    input.repositoryId,
    input.fileRef,
    input.language,
    input.kind,
    input.qualifiedName.normalize("NFC"),
  ];
  const groupKey = hash([...common, "duplicate-group"]);
  const id = hash([...common, String(input.duplicateOrdinal)]);
  return { id, ref: `aiw://symbol/${id}`, groupKey };
}

export type StaticDependencyOccurrence = {
  readonly kind: DependencyKind;
  readonly specifier: string;
  readonly occurrenceOrdinal: number;
};

type DependencyIdentityInput = Pick<
  DependencyEdge,
  "sourceFileRef" | "kind" | "specifier" | "occurrenceOrdinal" | "candidateRefs"
>;

export function deriveDependencyIdentity(
  input: DependencyIdentityInput,
): string {
  return hash([
    DEPENDENCY_SCHEMA_VERSION,
    input.sourceFileRef,
    input.kind,
    input.specifier.normalize("NFC"),
    String(input.occurrenceOrdinal),
    ...[...input.candidateRefs].sort(),
  ]);
}

const RESOLUTION_EXTENSIONS = [
  ".ts",
  ".mts",
  ".cts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
] as const;

function relativeCandidates(sourcePath: string, specifier: string): string[] {
  const base = posix.normalize(
    posix.join(posix.dirname(sourcePath), specifier),
  );
  const candidates = new Set<string>();
  if (languageForPath(base) !== null) candidates.add(base);
  else {
    for (const extension of RESOLUTION_EXTENSIONS)
      candidates.add(`${base}${extension}`);
    for (const extension of RESOLUTION_EXTENSIONS)
      candidates.add(posix.join(base, `index${extension}`));
  }
  return [...candidates].sort();
}

function packageNameFromSpecifier(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@")
    ? parts.slice(0, 2).join("/")
    : (parts[0] ?? specifier);
}

export function resolveStaticDependencies(input: {
  readonly sourcePath: string;
  readonly sourceFileRef: WorldObjectRef;
  readonly occurrences: readonly StaticDependencyOccurrence[];
  readonly indexedFiles: ReadonlyMap<string, WorldObjectRef>;
  readonly workspacePackages: ReadonlyMap<string, readonly WorldObjectRef[]>;
}): DependencyEdge[] {
  return input.occurrences.map((occurrence) => {
    const specifier = safeSpecifier(occurrence.specifier);
    let candidateRefs: WorldObjectRef[];
    let confidence: DependencyEdge["confidence"];
    if (occurrence.specifier.startsWith(".")) {
      candidateRefs = relativeCandidates(input.sourcePath, occurrence.specifier)
        .flatMap((candidate) => {
          const ref = input.indexedFiles.get(candidate);
          return ref === undefined ? [] : [ref];
        })
        .sort();
      confidence =
        candidateRefs.length === 1
          ? ["exact_file"]
          : candidateRefs.length > 1
            ? ["ambiguous"]
            : ["unresolved"];
    } else {
      const packageName = packageNameFromSpecifier(occurrence.specifier);
      const internal = [
        ...(input.workspacePackages.get(occurrence.specifier) ?? []),
      ].sort();
      const knownWorkspacePackage = [...input.workspacePackages.keys()].some(
        (mappedSpecifier) =>
          mappedSpecifier === packageName ||
          mappedSpecifier.startsWith(`${packageName}/`),
      );
      candidateRefs = internal;
      confidence =
        internal.length === 1
          ? ["exact_workspace_package"]
          : internal.length > 1
            ? ["ambiguous"]
            : knownWorkspacePackage
              ? ["unresolved"]
              : occurrence.specifier.startsWith("#")
                ? ["unresolved"]
                : ["external"];
    }
    const identityInput = {
      sourceFileRef: input.sourceFileRef,
      kind: occurrence.kind,
      specifier,
      occurrenceOrdinal: occurrence.occurrenceOrdinal,
      candidateRefs,
    };
    const id = deriveDependencyIdentity(identityInput);
    return DependencyEdgeSchema.parse({
      schema: DEPENDENCY_SCHEMA_VERSION,
      id,
      ref: `aiw://dependency/${id}`,
      ...identityInput,
      confidence,
      cycleGroupId: null,
    });
  });
}

export function assignDependencyCycleGroups(
  edges: readonly DependencyEdge[],
): DependencyEdge[] {
  const adjacency = new Map<WorldObjectRef, Set<WorldObjectRef>>();
  const reverse = new Map<WorldObjectRef, Set<WorldObjectRef>>();
  for (const edge of edges) {
    const targets =
      adjacency.get(edge.sourceFileRef) ?? new Set<WorldObjectRef>();
    for (const candidate of edge.candidateRefs) {
      targets.add(candidate);
      const sources = reverse.get(candidate) ?? new Set<WorldObjectRef>();
      sources.add(edge.sourceFileRef);
      reverse.set(candidate, sources);
    }
    adjacency.set(edge.sourceFileRef, targets);
  }
  const nodes = [
    ...new Set([
      ...adjacency.keys(),
      ...[...adjacency.values()].flatMap((set) => [...set]),
    ]),
  ].sort();
  const groupByRef = new Map<WorldObjectRef, string>();
  const visited = new Set<WorldObjectRef>();
  const finished: WorldObjectRef[] = [];
  for (const root of nodes) {
    if (visited.has(root)) continue;
    const stack: Array<{ node: WorldObjectRef; expanded: boolean }> = [
      { node: root, expanded: false },
    ];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current.expanded) {
        finished.push(current.node);
        continue;
      }
      if (visited.has(current.node)) continue;
      visited.add(current.node);
      stack.push({ node: current.node, expanded: true });
      const targets = [...(adjacency.get(current.node) ?? [])].sort().reverse();
      for (const target of targets)
        if (!visited.has(target)) stack.push({ node: target, expanded: false });
    }
  }
  const assigned = new Set<WorldObjectRef>();
  for (let index = finished.length - 1; index >= 0; index -= 1) {
    const root = finished[index]!;
    if (assigned.has(root)) continue;
    const component: WorldObjectRef[] = [];
    const stack = [root];
    assigned.add(root);
    while (stack.length > 0) {
      const member = stack.pop()!;
      component.push(member);
      const sources = [...(reverse.get(member) ?? [])].sort().reverse();
      for (const source of sources) {
        if (assigned.has(source)) continue;
        assigned.add(source);
        stack.push(source);
      }
    }
    component.sort();
    const selfCycle = component.length === 1 && adjacency.get(root)?.has(root);
    if (component.length > 1 || selfCycle) {
      const group = hash(["aiw.dependency-cycle/0.10", ...component]);
      for (const member of component) groupByRef.set(member, group);
    }
  }
  return edges.map((edge) =>
    DependencyEdgeSchema.parse({
      ...edge,
      cycleGroupId: edge.candidateRefs.some(
        (candidate) =>
          groupByRef.get(candidate) === groupByRef.get(edge.sourceFileRef),
      )
        ? (groupByRef.get(edge.sourceFileRef) ?? null)
        : null,
    }),
  );
}

export type ParseFileRequest = {
  readonly repositoryId: string;
  readonly fileRef: WorldObjectRef;
  readonly path: string;
  readonly source: Uint8Array;
  readonly signal?: AbortSignal;
};

export type ParsedFileGraph = {
  readonly coverage: FileGraphCoverage;
  readonly symbols: readonly SymbolRecord[];
  readonly dependencies: readonly DependencyEdge[];
  readonly occurrences: readonly StaticDependencyOccurrence[];
};

function fallback(
  request: Pick<ParseFileRequest, "fileRef" | "path">,
  reason: NonNullable<FileGraphCoverage["fallbackReason"]>,
): ParsedFileGraph {
  const language = languageForPath(request.path);
  const confidence: FileGraphCoverage["confidence"] =
    reason === "unsupported_extension" ? ["unsupported"] : ["unavailable"];
  return {
    coverage: FileGraphCoverageSchema.parse({
      fileRef: request.fileRef,
      language,
      state: "fallback",
      confidence,
      fallbackReason: reason,
      symbolCount: 0,
      dependencyCount: 0,
      diagnostics: [{ code: reason, count: 1 }],
    }),
    symbols: [],
    dependencies: [],
    occurrences: [],
  };
}

type WorkerRequest = Omit<ParseFileRequest, "signal"> & {
  readonly taskId: number;
};
type WorkerResponse = {
  readonly taskId: number;
  readonly result?: ParsedFileGraph;
  readonly error?: string;
};

type Task = {
  readonly id: number;
  readonly request: ParseFileRequest;
  readonly resolve: (result: ParsedFileGraph) => void;
  abort?: () => void;
};

type WorkerSlot = {
  worker: Worker;
  task: Task | null;
  timer: ReturnType<typeof setTimeout> | null;
};

export class GraphParserPool {
  readonly #slots: WorkerSlot[] = [];
  readonly #queue: Task[] = [];
  readonly #admission: Array<() => void> = [];
  readonly #workerCount: number;
  readonly #workerFixture:
    "timeout" | "crash" | "malformed" | "unavailable" | undefined;
  #nextTaskId = 1;
  #closing = false;

  constructor(
    options: {
      readonly workerCount?: number;
      /** Finite acceptance-fixture fault injection; selected repository input cannot set it. */
      readonly workerFixture?:
        "timeout" | "crash" | "malformed" | "unavailable";
    } = {},
  ) {
    const available = Math.max(1, availableParallelism());
    this.#workerCount = Math.max(
      1,
      Math.min(
        PHASE10_MAX_WORKERS,
        available === 1 ? 1 : (options.workerCount ?? 2),
      ),
    );
    this.#workerFixture = options.workerFixture;
  }

  async parse(request: ParseFileRequest): Promise<ParsedFileGraph> {
    const language = languageForPath(request.path);
    if (language === null) return fallback(request, "unsupported_extension");
    if (request.source.byteLength > PHASE10_MAX_SOURCE_BYTES)
      return fallback(request, "source_too_large");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(request.source);
    } catch {
      return fallback(request, "invalid_utf8");
    }
    if (request.signal?.aborted) return fallback(request, "cancelled");
    this.#ensureWorkers();
    while (this.#queue.length >= PHASE10_MAX_QUEUED_FILES && !this.#closing)
      await new Promise<void>((resolveAdmission) =>
        this.#admission.push(resolveAdmission),
      );
    if (this.#closing) return fallback(request, "cancelled");
    return new Promise<ParsedFileGraph>((resolveTask) => {
      const task: Task = {
        id: this.#nextTaskId++,
        request,
        resolve: resolveTask,
      };
      if (request.signal) {
        task.abort = () => this.#cancel(task);
        request.signal.addEventListener("abort", task.abort, { once: true });
      }
      this.#queue.push(task);
      this.#dispatch();
    });
  }

  async close(): Promise<void> {
    this.#closing = true;
    for (const task of this.#queue.splice(0))
      this.#finish(task, fallback(task.request, "cancelled"));
    for (const release of this.#admission.splice(0)) release();
    await Promise.all(
      this.#slots.map(async (slot) => {
        if (slot.timer) clearTimeout(slot.timer);
        if (slot.task)
          this.#finish(slot.task, fallback(slot.task.request, "cancelled"));
        slot.task = null;
        await slot.worker.terminate();
      }),
    );
  }

  #spawn(): WorkerSlot {
    const worker = new Worker(new URL("./node.js", import.meta.url), {
      workerData: {
        phase10ParserWorker: true,
        workerFixture: this.#workerFixture,
      },
      resourceLimits: PHASE10_WORKER_RESOURCE_LIMITS,
    });
    const slot: WorkerSlot = { worker, task: null, timer: null };
    worker.on("message", (message: unknown) => this.#message(slot, message));
    worker.on("error", () => this.#failed(slot, "worker_crash"));
    worker.on("exit", (code) => {
      if (!this.#closing && code !== 0) this.#failed(slot, "worker_crash");
    });
    return slot;
  }

  #ensureWorkers(): void {
    while (!this.#closing && this.#slots.length < this.#workerCount)
      this.#slots.push(this.#spawn());
  }

  #dispatch(): void {
    if (this.#closing) return;
    for (const slot of this.#slots) {
      if (slot.task !== null) continue;
      const task = this.#queue.shift();
      if (!task) break;
      this.#admission.shift()?.();
      slot.task = task;
      slot.timer = setTimeout(
        () => this.#failed(slot, "timeout"),
        PHASE10_FILE_TIMEOUT_MS,
      );
      const message: WorkerRequest = {
        taskId: task.id,
        repositoryId: task.request.repositoryId,
        fileRef: task.request.fileRef,
        path: task.request.path,
        source: task.request.source,
      };
      slot.worker.postMessage(message);
    }
  }

  #message(slot: WorkerSlot, message: unknown): void {
    const task = slot.task;
    if (!task) return;
    const candidate = message as Partial<WorkerResponse>;
    if (candidate.taskId !== task.id || candidate.result === undefined) {
      this.#failed(slot, "malformed_worker_response");
      return;
    }
    const coverage = FileGraphCoverageSchema.safeParse(
      candidate.result.coverage,
    );
    const symbols =
      Array.isArray(candidate.result.symbols) &&
      candidate.result.symbols.every(
        (symbol) => SymbolRecordSchema.safeParse(symbol).success,
      );
    const dependencies = Array.isArray(candidate.result.dependencies);
    const occurrences = Array.isArray(candidate.result.occurrences);
    if (!coverage.success || !symbols || !dependencies || !occurrences) {
      this.#failed(slot, "malformed_worker_response");
      return;
    }
    if (slot.timer) clearTimeout(slot.timer);
    slot.timer = null;
    slot.task = null;
    this.#finish(task, candidate.result);
    this.#dispatch();
  }

  #cancel(task: Task): void {
    const queued = this.#queue.indexOf(task);
    if (queued >= 0) {
      this.#queue.splice(queued, 1);
      this.#finish(task, fallback(task.request, "cancelled"));
      return;
    }
    const slot = this.#slots.find((candidate) => candidate.task === task);
    if (slot) this.#failed(slot, "cancelled");
  }

  #failed(
    slot: WorkerSlot,
    reason:
      "timeout" | "worker_crash" | "malformed_worker_response" | "cancelled",
  ): void {
    const index = this.#slots.indexOf(slot);
    if (index < 0) return;
    const task = slot.task;
    if (slot.timer) clearTimeout(slot.timer);
    slot.timer = null;
    slot.task = null;
    void slot.worker.terminate();
    const replacement = this.#spawn();
    this.#slots[index] = replacement;
    if (task) this.#finish(task, fallback(task.request, reason));
    this.#dispatch();
  }

  #finish(task: Task, result: ParsedFileGraph): void {
    if (task.abort)
      task.request.signal?.removeEventListener("abort", task.abort);
    task.resolve(result);
  }
}

export type CodeGraphGenerationResult = {
  readonly graph: CodeGraphSnapshot;
  readonly stats: {
    readonly parsedFiles: number;
    readonly reusedFiles: number;
    readonly fallbackFiles: number;
  };
};

export type CodeGraphInitializationResult = Pick<
  LoadedCodeGraphCache,
  "recovered" | "needsRebuild"
>;

export class CodeGraphGenerationEngine {
  readonly #pool: GraphParserPool;
  readonly #store: CodeGraphCacheStore;
  readonly #beforeRead: (() => Promise<void>) | undefined;
  #loaded = false;
  #loadTask: Promise<CodeGraphInitializationResult> | null = null;
  #initializationResult: CodeGraphInitializationResult | null = null;
  #currentRecord: GraphCacheRecord | null = null;
  #previousRecord: GraphCacheRecord | null = null;
  #generationController: AbortController | null = null;
  #serial = 0;

  constructor(options: {
    readonly store: CodeGraphCacheStore;
    readonly workerCount?: number;
    readonly beforeRead?: () => Promise<void>;
  }) {
    this.#store = options.store;
    this.#pool = new GraphParserPool(
      options.workerCount === undefined
        ? {}
        : { workerCount: options.workerCount },
    );
    this.#beforeRead = options.beforeRead;
  }

  current(): CodeGraphSnapshot | null {
    return this.#currentRecord?.graph ?? null;
  }

  previous(): CodeGraphSnapshot | null {
    return this.#previousRecord?.graph ?? null;
  }

  async initialize(): Promise<CodeGraphInitializationResult> {
    if (this.#loaded)
      return (
        this.#initializationResult ?? {
          recovered: false,
          needsRebuild: false,
        }
      );
    if (this.#loadTask) return await this.#loadTask;
    this.#loadTask = (async () => {
      const loaded = await this.#store.load();
      this.#currentRecord = loaded.current;
      this.#previousRecord = loaded.previous;
      this.#loaded = true;
      this.#initializationResult = {
        recovered: loaded.recovered,
        needsRebuild: loaded.needsRebuild,
      };
      return this.#initializationResult;
    })();
    try {
      return await this.#loadTask;
    } finally {
      this.#loadTask = null;
    }
  }

  async generate(
    generation: RepositoryGeneration,
    world: WorldSnapshot,
  ): Promise<CodeGraphGenerationResult> {
    await this.#ensureLoaded();
    this.#generationController?.abort();
    const controller = new AbortController();
    this.#generationController = controller;
    const serial = ++this.#serial;
    const repositoryId = world.repositoryRef.split("/").at(-1) ?? "";
    const fileObjects = new Map(
      world.objects.flatMap((object) =>
        object.kind === "file" ? [[object.path, object] as const] : [],
      ),
    );
    const indexedFiles = new Map<string, WorldObjectRef>();
    for (const [path, object] of fileObjects)
      indexedFiles.set(path, object.ref);
    const previousEntries = new Map(
      (this.#currentRecord?.entries ?? []).map((entry) => [
        entry.fileRef,
        entry,
      ]),
    );
    const stagedEntries: GraphCacheEntry[] = [];
    let parsedFiles = 0;
    let reusedFiles = 0;
    const files = [...generation.files].sort((left, right) =>
      left.path.localeCompare(right.path),
    );
    for (
      let offset = 0;
      offset < files.length;
      offset += PHASE10_MAX_QUEUED_FILES
    ) {
      const chunk = files.slice(offset, offset + PHASE10_MAX_QUEUED_FILES);
      const entries = await Promise.all(
        chunk.map(async (file): Promise<GraphCacheEntry> => {
          const object = fileObjects.get(file.path);
          if (!object)
            throw new Error(
              "Phase 10 generation is missing an authoritative file object",
            );
          const language = languageForPath(file.path);
          const grammarHash =
            language === null
              ? null
              : ARTIFACT_HASHES[GRAMMAR_BY_LANGUAGE[language]];
          const previous = previousEntries.get(object.ref);
          if (
            previous &&
            previous.repositoryId === repositoryId &&
            previous.contentHash !== null &&
            file.contentHash !== null &&
            previous.contentHash === file.contentHash &&
            previous.grammarHash === grammarHash &&
            previous.schema === CODE_GRAPH_SCHEMA_VERSION &&
            previous.extractorVersion === PHASE10_EXTRACTOR_VERSION
          ) {
            reusedFiles += 1;
            return previous;
          }
          if (controller.signal.aborted)
            throw new Error("Phase 10 generation superseded or cancelled");
          let result: ParsedFileGraph;
          if (language === null)
            result = fallback(
              { fileRef: object.ref, path: file.path },
              "unsupported_extension",
            );
          else if (file.oversized || file.size > PHASE10_MAX_SOURCE_BYTES)
            result = fallback(
              { fileRef: object.ref, path: file.path },
              "source_too_large",
            );
          else {
            await this.#beforeRead?.();
            if (controller.signal.aborted)
              throw new Error("Phase 10 generation superseded or cancelled");
            const root = resolve(generation.rootPath);
            const absolute = resolve(root, file.path);
            if (absolute !== root && !absolute.startsWith(`${root}${sep}`))
              result = fallback(
                { fileRef: object.ref, path: file.path },
                "source_unavailable",
              );
            else {
              try {
                const source = await readFile(absolute);
                result = await this.#pool.parse({
                  repositoryId,
                  fileRef: object.ref,
                  path: file.path,
                  source,
                  signal: controller.signal,
                });
              } catch {
                if (controller.signal.aborted)
                  throw new Error(
                    "Phase 10 generation superseded or cancelled",
                  );
                result = fallback(
                  { fileRef: object.ref, path: file.path },
                  "source_unavailable",
                );
              }
            }
          }
          parsedFiles += result.coverage.state === "parsed" ? 1 : 0;
          return {
            repositoryId,
            fileRef: object.ref,
            contentHash: file.contentHash,
            grammarHash,
            schema: CODE_GRAPH_SCHEMA_VERSION,
            extractorVersion: PHASE10_EXTRACTOR_VERSION,
            result,
          };
        }),
      );
      stagedEntries.push(...entries);
      if (controller.signal.aborted || serial !== this.#serial)
        throw new Error("Phase 10 generation superseded or cancelled");
    }
    const workspacePackages = this.#workspacePackageTargets(
      generation,
      indexedFiles,
    );
    const dependencies = assignDependencyCycleGroups(
      stagedEntries.flatMap((entry) => {
        const path = fileObjects.get(
          [...fileObjects.entries()].find(
            ([, object]) => object.ref === entry.fileRef,
          )?.[0] ?? "",
        )?.path;
        if (!path) return [];
        return resolveStaticDependencies({
          sourcePath: path,
          sourceFileRef: entry.fileRef,
          occurrences: entry.result.occurrences,
          indexedFiles,
          workspacePackages,
        });
      }),
    );
    const symbols = stagedEntries.flatMap((entry) => [...entry.result.symbols]);
    const coverage = stagedEntries.map((entry) => entry.result.coverage);
    const graph = CodeGraphSnapshotSchema.parse({
      schema: CODE_GRAPH_SCHEMA_VERSION,
      repositoryRef: world.repositoryRef,
      generationId: generation.id,
      state: "current",
      degraded: coverage.some((record) => record.state === "fallback"),
      coverage,
      symbols,
      dependencies,
      counts: {
        files: coverage.length,
        parsedFiles: coverage.filter((record) => record.state === "parsed")
          .length,
        symbols: symbols.length,
        dependencies: dependencies.length,
      },
      limits: {
        maxSymbolsPerFile: CODE_GRAPH_MAX_SYMBOLS_PER_FILE,
        maxDependenciesPerFile: CODE_GRAPH_MAX_DEPENDENCIES_PER_FILE,
        maxAggregateEdges: CODE_GRAPH_MAX_AGGREGATE_EDGES,
        maxFocusedSymbolNodes: CODE_GRAPH_MAX_FOCUSED_SYMBOL_NODES,
      },
    });
    if (controller.signal.aborted || serial !== this.#serial)
      throw new Error("Phase 10 generation superseded or cancelled");
    const record: GraphCacheRecord = { graph, entries: stagedEntries };
    await this.#store.commit(
      record,
      () => !controller.signal.aborted && serial === this.#serial,
    );
    if (controller.signal.aborted || serial !== this.#serial)
      throw new Error("Phase 10 generation superseded or cancelled");
    this.#previousRecord = this.#currentRecord
      ? {
          ...this.#currentRecord,
          graph: CodeGraphSnapshotSchema.parse({
            ...this.#currentRecord.graph,
            state: "previous",
          }),
        }
      : null;
    this.#currentRecord = record;
    return {
      graph,
      stats: {
        parsedFiles,
        reusedFiles,
        fallbackFiles: coverage.filter((record) => record.state === "fallback")
          .length,
      },
    };
  }

  async close(): Promise<void> {
    this.#generationController?.abort();
    await this.#pool.close();
  }

  async #ensureLoaded(): Promise<void> {
    await this.initialize();
  }

  #workspacePackageTargets(
    generation: RepositoryGeneration,
    indexedFiles: ReadonlyMap<string, WorldObjectRef>,
  ): ReadonlyMap<string, readonly WorldObjectRef[]> {
    const targets = new Map<string, Set<WorldObjectRef>>();
    const add = (specifier: string, targetPath: string): void => {
      const ref = indexedFiles.get(targetPath);
      if (!ref) return;
      const refs = targets.get(specifier) ?? new Set<WorldObjectRef>();
      refs.add(ref);
      targets.set(specifier, refs);
    };
    for (const item of generation.packages) {
      if (item.kind !== "npm" || !item.name || !item.npmResolution) continue;
      if (!targets.has(item.name)) targets.set(item.name, new Set());
      const packageRoot = posix.dirname(item.path);
      const targetPath = (target: string) =>
        posix.normalize(posix.join(packageRoot, target.slice(2)));
      for (const entry of item.npmResolution.exports) {
        const specifier =
          entry.specifier === "."
            ? item.name
            : `${item.name}/${entry.specifier.replace(/^\.\//u, "")}`;
        add(specifier, targetPath(entry.target));
      }
      for (const entry of item.npmResolution.imports)
        add(entry.specifier, targetPath(entry.target));
      for (const fallbackTarget of [
        item.npmResolution.types,
        item.npmResolution.module,
        item.npmResolution.main,
      ])
        if (fallbackTarget) add(item.name, targetPath(fallbackTarget));
    }
    return new Map(
      [...targets.entries()].map(([specifier, refs]) => [
        specifier,
        [...refs].sort(),
      ]),
    );
  }
}

type TreeNode = {
  readonly type: string;
  readonly text: string;
  readonly startPosition: { readonly row: number; readonly column: number };
  readonly endPosition: { readonly row: number; readonly column: number };
  readonly namedChildren: readonly (TreeNode | null)[];
  readonly hasError: boolean;
  childForFieldName(name: string): TreeNode | null;
};

type TreeSitterRuntime = {
  Parser: (new () => {
    setLanguage(language: unknown): void;
    parse(source: string): { rootNode: TreeNode; delete(): void } | null;
    delete(): void;
  }) & { init(options: { locateFile(): string }): Promise<void> };
  Language: { load(path: string): Promise<unknown> };
};

const workerTreeSitter = TreeSitter as unknown as TreeSitterRuntime;
let workerRuntimeInitialized = false;
let workerArtifactsVerified = false;
const workerLanguages = new Map<SymbolLanguage, unknown>();

const DECLARATION_KIND: Readonly<Record<string, SymbolKind>> = {
  class_declaration: "class",
  abstract_class_declaration: "class",
  interface_declaration: "interface",
  type_alias_declaration: "type",
  enum_declaration: "enum",
  function_declaration: "function",
  function_signature: "function",
  method_definition: "method",
  method_signature: "method",
  abstract_method_signature: "method",
  variable_declarator: "variable",
  internal_module: "namespace",
  module: "namespace",
};

function stringLiteral(node: TreeNode | null): string | null {
  if (
    !node ||
    !["string", "string_fragment", "template_string"].includes(node.type)
  )
    return null;
  const text = node.text;
  if (text.length < 2) return null;
  const first = text[0];
  const last = text.at(-1);
  if (!(
    (first === "'" && last === "'") ||
    (first === '"' && last === '"') ||
    (first === "`" && last === "`")
  ))
    return null;
  if (first === "`" && text.includes("${")) return null;
  return text.slice(1, -1);
}

async function parseInWorker(request: WorkerRequest): Promise<ParsedFileGraph> {
  const languageName = languageForPath(request.path);
  if (languageName === null) return fallback(request, "unsupported_extension");
  try {
    if (!workerArtifactsVerified) {
      await verifyParserArtifacts();
      workerArtifactsVerified = true;
    }
  } catch (error) {
    return fallback(
      request,
      error instanceof Error && error.message.includes("hash mismatch")
        ? "grammar_mismatch"
        : "grammar_unavailable",
    );
  }
  const artifactRoot = defaultArtifactRoot();
  const runtimePath = resolve(artifactRoot, "tree-sitter.wasm");
  const grammarPath = resolve(artifactRoot, GRAMMAR_BY_LANGUAGE[languageName]);
  try {
    if (!workerRuntimeInitialized) {
      await workerTreeSitter.Parser.init({ locateFile: () => runtimePath });
      workerRuntimeInitialized = true;
    }
    let grammar = workerLanguages.get(languageName);
    if (!grammar) {
      grammar = await workerTreeSitter.Language.load(grammarPath);
      workerLanguages.set(languageName, grammar);
    }
    const parser = new workerTreeSitter.Parser();
    parser.setLanguage(grammar);
    const source = new TextDecoder("utf-8", { fatal: true }).decode(
      request.source,
    );
    const tree = parser.parse(source);
    if (!tree || tree.rootNode.hasError) {
      tree?.delete();
      parser.delete();
      return fallback(request, "syntax_error");
    }
    const symbols: SymbolRecord[] = [];
    const occurrences: StaticDependencyOccurrence[] = [];
    const duplicates = new Map<string, number>();
    const stack: Array<{
      readonly node: TreeNode;
      readonly depth: number;
      readonly scope: readonly string[];
      readonly exported: boolean;
    }> = [{ node: tree.rootNode, depth: 0, scope: [], exported: false }];
    let exceededDepth = false;
    let exceededSymbols = false;
    let exceededDependencies = false;
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current.depth > PHASE10_MAX_AST_DEPTH) {
        exceededDepth = true;
        break;
      }
      const node = current.node;
      const exported = current.exported || node.type === "export_statement";
      const kind = DECLARATION_KIND[node.type];
      let childScope = current.scope;
      if (kind !== undefined) {
        const nameNode = node.childForFieldName("name");
        const name = nameNode?.text.normalize("NFC").slice(0, 240) ?? "";
        if (
          name.length > 0 &&
          Array.from(name).every((character) => {
            const codePoint = character.codePointAt(0) ?? 0;
            return codePoint >= 32 && codePoint !== 127;
          })
        ) {
          const qualifiedName = [...current.scope, name].join(".");
          const key = `${kind}\0${qualifiedName}`;
          const duplicateOrdinal = duplicates.get(key) ?? 0;
          duplicates.set(key, duplicateOrdinal + 1);
          const identity = deriveSymbolIdentity({
            repositoryId: request.repositoryId,
            fileRef: request.fileRef,
            language: languageName,
            kind,
            qualifiedName,
            duplicateOrdinal,
          });
          symbols.push(
            SymbolRecordSchema.parse({
              schema: SYMBOL_SCHEMA_VERSION,
              id: identity.id,
              ref: identity.ref,
              fileRef: request.fileRef,
              language: languageName,
              kind,
              name,
              qualifiedName,
              duplicateOrdinal,
              duplicateGroupKey: identity.groupKey,
              exported,
              range: {
                start: {
                  line: node.startPosition.row + 1,
                  column: node.startPosition.column,
                },
                end: {
                  line: node.endPosition.row + 1,
                  column: node.endPosition.column,
                },
              },
              confidence: ["exact_file"],
            }),
          );
          if (symbols.length > CODE_GRAPH_MAX_SYMBOLS_PER_FILE) {
            exceededSymbols = true;
            break;
          }
          if (["class", "interface", "namespace"].includes(kind))
            childScope = [...current.scope, name];
        }
      }
      let dependency: Omit<
        StaticDependencyOccurrence,
        "occurrenceOrdinal"
      > | null = null;
      if (node.type === "import_statement") {
        const literal = stringLiteral(node.childForFieldName("source"));
        if (literal !== null)
          dependency = {
            kind: node.namedChildren.some(
              (child) => child?.type === "import_clause",
            )
              ? "import"
              : "side_effect_import",
            specifier: literal,
          };
      } else if (node.type === "export_statement") {
        const literal = stringLiteral(node.childForFieldName("source"));
        if (literal !== null)
          dependency = { kind: "export", specifier: literal };
      } else if (node.type === "call_expression") {
        const callable = node.childForFieldName("function")?.text;
        if (callable === "require" || callable === "import") {
          const argument =
            node.childForFieldName("arguments")?.namedChildren[0] ?? null;
          const literal = stringLiteral(argument);
          if (literal !== null)
            dependency = {
              kind: callable === "require" ? "require" : "dynamic_import",
              specifier: literal,
            };
        }
      }
      if (dependency) {
        occurrences.push({
          ...dependency,
          occurrenceOrdinal: occurrences.length,
        });
        if (occurrences.length > CODE_GRAPH_MAX_DEPENDENCIES_PER_FILE) {
          exceededDependencies = true;
          break;
        }
      }
      const children = node.namedChildren;
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child)
          stack.push({
            node: child,
            depth: current.depth + 1,
            scope: childScope,
            exported,
          });
      }
    }
    tree.delete();
    parser.delete();
    if (exceededDepth) return fallback(request, "depth_exceeded");
    if (exceededSymbols) return fallback(request, "symbol_limit_exceeded");
    if (exceededDependencies)
      return fallback(request, "dependency_limit_exceeded");
    const diagnostics: Array<{ code: string; count: number }> = [];
    return {
      coverage: FileGraphCoverageSchema.parse({
        fileRef: request.fileRef,
        language: languageName,
        state: "parsed",
        confidence: ["exact_file"],
        fallbackReason: null,
        symbolCount: symbols.length,
        dependencyCount: occurrences.length,
        diagnostics: diagnostics.slice(0, CODE_GRAPH_MAX_DIAGNOSTICS_PER_FILE),
      }),
      symbols,
      dependencies: [],
      occurrences,
    };
  } catch (error) {
    return fallback(
      request,
      error instanceof Error && /version|abi|grammar/iu.test(error.message)
        ? "grammar_mismatch"
        : "grammar_unavailable",
    );
  }
}

async function workerMain(): Promise<void> {
  const port = parentPort;
  if (!port) return;
  port.on("message", (request: WorkerRequest) => {
    const fixture = (
      workerData as {
        workerFixture?: "timeout" | "crash" | "malformed" | "unavailable";
      }
    ).workerFixture;
    if (fixture === "timeout") return;
    if (fixture === "crash") process.exit(91);
    if (fixture === "malformed") {
      port.postMessage({ taskId: request.taskId, result: {} });
      return;
    }
    if (fixture === "unavailable") {
      port.postMessage({
        taskId: request.taskId,
        result: fallback(request, "grammar_unavailable"),
      });
      return;
    }
    void parseInWorker(request).then((result) => {
      const response: WorkerResponse = { taskId: request.taskId, result };
      port.postMessage(response);
    });
  });
}

if (
  !isMainThread &&
  (workerData as { phase10ParserWorker?: boolean }).phase10ParserWorker
)
  await workerMain();

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { createLocalServer } from "../../apps/local-server/src/server.js";
import { Phase17Service } from "../../apps/local-server/src/phase17-service.js";

const executeFile = promisify(execFile);
const identity = {
  repositoryId: "repo-phase17-drill",
  sessionId: "phase17-recovery-drill",
} as const;
const bindings = [
  {
    agentId: "mr-fluff",
    taskId: "task-fluff-doc",
    worktreeId: "worktree-fluff",
    worktreeLabel: "worktrees/mr-fluff",
  },
  {
    agentId: "beans",
    taskId: "task-beans-doc",
    worktreeId: "worktree-beans",
    worktreeLabel: "worktrees/beans",
  },
] as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await executeFile("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 256 * 1024,
    env: {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
    },
  });
  return result.stdout;
}

async function present(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

type ApiResponse<T> = {
  readonly statusCode: number;
  readonly body: { readonly data: T };
};

async function inject<T>(
  server: ReturnType<typeof createLocalServer>,
  request: {
    readonly method: "GET" | "POST" | "DELETE";
    readonly url: string;
    readonly payload?: Record<string, unknown>;
  },
): Promise<ApiResponse<T>> {
  const response = await server.inject(request);
  return {
    statusCode: response.statusCode,
    body: response.json() as { data: T },
  };
}

export type Phase17DrillResult = {
  readonly schema: "aiw.phase17-recovery-drill/0.17";
  readonly verdict: "PASS" | "FAIL";
  readonly checks: Readonly<Record<string, boolean>>;
  readonly measurements: {
    readonly currentRevision: number;
    readonly previousRevision: number;
    readonly eventCount: number;
    readonly incidentCount: number;
    readonly readinessRows: number;
    readonly exportBytes: number;
    readonly ownedProcesses: number;
    readonly listenerCount: number;
    readonly temporaryFiles: number;
  };
  readonly truth: {
    readonly currentState: string;
    readonly previousVerifiedState: string;
    readonly lossWindow: string;
    readonly recoverySource: string;
    readonly operationState: string;
    readonly completionRecorded: false;
    readonly applyReplayed: boolean;
    readonly exportReplayed: boolean;
    readonly deleteReplayed: boolean;
  };
  readonly privacy: {
    readonly absolutePathLeak: boolean;
    readonly secretCanaryLeak: boolean;
    readonly personaCanaryLeak: boolean;
    readonly rawContentFields: boolean;
  };
  readonly git: {
    readonly repositoryHeadBefore: string;
    readonly repositoryHeadAfter: string;
    readonly worktreeTopologyBefore: string;
    readonly worktreeTopologyAfter: string;
    readonly statusBefore: string;
    readonly statusAfter: string;
    readonly markerDigestBefore: string;
    readonly markerDigestAfter: string;
  };
  readonly cleanup: {
    readonly exportAbsent: boolean;
    readonly ownedProcessesZero: boolean;
    readonly listenersZero: boolean;
    readonly temporaryFilesZero: boolean;
    readonly fixtureRootRemoved: boolean;
  };
  readonly api: {
    readonly initializeStatus: number;
    readonly startStatus: number;
    readonly terminateStatus: number;
    readonly inspectStatus: number;
    readonly previewStatus: number;
    readonly applyStatus: number;
    readonly diagnosticPreviewStatus: number;
    readonly exportStatus: number;
    readonly deleteStatus: number;
    readonly wrongIdentityStatus: number;
  };
};

export async function runPhase17Drill(): Promise<Phase17DrillResult> {
  const root = await mkdtemp(join(tmpdir(), "aiw-phase17-drill-"));
  const repository = join(root, "repository");
  const worktrees = join(root, "worktrees");
  const fluff = join(worktrees, "mr-fluff");
  const beans = join(worktrees, "beans");
  const stateRoot = join(root, "world-state", "phase17");
  let server: ReturnType<typeof createLocalServer> | null = null;
  let service: Phase17Service | null = null;
  let result: Omit<Phase17DrillResult, "cleanup">;
  let cleanupEvidence: Omit<
    Phase17DrillResult["cleanup"],
    "fixtureRootRemoved"
  >;
  try {
    await mkdir(join(repository, "src"), { recursive: true });
    await mkdir(worktrees, { recursive: true });
    await git(root, ["init", "--initial-branch=main", repository]);
    await git(repository, ["config", "user.name", "Phase 17 Fixture"]);
    await git(repository, [
      "config",
      "user.email",
      "phase17-fixture@example.invalid",
    ]);
    await writeFile(
      join(repository, "src", "fixture.ts"),
      'export const fixture = "healthy";\n',
      "utf8",
    );
    await git(repository, ["add", "src/fixture.ts"]);
    await git(repository, ["commit", "-m", "fixture: healthy baseline"]);
    await git(repository, [
      "worktree",
      "add",
      "-b",
      "phase17/mr-fluff",
      fluff,
      "main",
    ]);
    await git(repository, [
      "worktree",
      "add",
      "-b",
      "phase17/beans",
      beans,
      "main",
    ]);
    await writeFile(join(fluff, "mr-fluff.marker"), "mr-fluff\n", "utf8");
    await writeFile(join(beans, "beans.marker"), "beans\n", "utf8");
    await git(fluff, ["add", "mr-fluff.marker"]);
    await git(fluff, ["commit", "-m", "fixture: Mr Fluff worktree"]);
    await git(beans, ["add", "beans.marker"]);
    await git(beans, ["commit", "-m", "fixture: Beans worktree"]);

    const repositoryHeadBefore = (
      await git(repository, ["rev-parse", "HEAD"])
    ).trim();
    const worktreeTopologyBefore = sha256(
      await git(repository, ["worktree", "list", "--porcelain"]),
    );
    const statusBefore = sha256(
      [
        await git(repository, ["status", "--porcelain=v2"]),
        await git(fluff, ["status", "--porcelain=v2"]),
        await git(beans, ["status", "--porcelain=v2"]),
      ].join("\n"),
    );
    const markerDigestBefore = sha256(
      `${await readFile(join(fluff, "mr-fluff.marker"), "utf8")}${await readFile(
        join(beans, "beans.marker"),
        "utf8",
      )}`,
    );

    service = new Phase17Service({ directory: stateRoot });
    server = createLocalServer({ phase17Service: service });
    const initialized = await inject<{ revision: number }>(server, {
      method: "POST",
      url: "/diagnostics/drill/initialize",
      payload: { ...identity, bindings },
    });
    const started = await inject<{ revision: number }>(server, {
      method: "POST",
      url: "/diagnostics/drill/operations",
      payload: {
        ...identity,
        expectedRevision: initialized.body.data.revision,
        operationId: "operation-recovery-drill",
        agentId: "beans",
        taskId: "task-beans-doc",
        worktreeId: "worktree-beans",
        capability: "tool",
        stage: "test",
        commandSummary: `bounded test ${repository} TOKEN=SECRET_CANARY_VALUE PERSONA_CANARY`,
        operatorApproval: "approved",
      },
    });
    const terminated = await inject<{
      killed: boolean;
      replayed: boolean;
    }>(server, {
      method: "POST",
      url: "/diagnostics/drill/operations/operation-recovery-drill/terminate",
      payload: {
        ...identity,
        expectedRevision: started.body.data.revision,
        operationId: "operation-recovery-drill",
        operatorApproval: "approved",
      },
    });
    await server.close();
    server = null;
    service = null;

    service = new Phase17Service({ directory: stateRoot });
    server = createLocalServer({ phase17Service: service });
    const inspected = await inject<{
      current: {
        revision: number;
        currentState: string;
        previousVerifiedState: string;
        lossWindow: string;
        readiness: readonly unknown[];
        incidents: readonly unknown[];
        operations: readonly {
          state: string;
          completionRecorded: false;
        }[];
      };
      previous: { revision: number };
      recoverySource: string;
    }>(server, {
      method: "GET",
      url: "/diagnostics/snapshot",
    });
    const currentBeforePlan = await readFile(
      join(stateRoot, "observability.current.json"),
      "utf8",
    );
    const previewed = await inject<{ mutation: string; digest: string }>(
      server,
      {
        method: "POST",
        url: "/diagnostics/recovery/preview",
        payload: {
          ...identity,
          expectedRevision: inspected.body.data.current.revision,
          operationId: "operation-recovery-drill",
        },
      },
    );
    const currentAfterPlan = await readFile(
      join(stateRoot, "observability.current.json"),
      "utf8",
    );
    const wrongIdentity = await server.inject({
      method: "POST",
      url: "/diagnostics/recovery/preview",
      payload: {
        repositoryId: "wrong-repository",
        sessionId: identity.sessionId,
        expectedRevision: inspected.body.data.current.revision,
        operationId: "operation-recovery-drill",
      },
    });
    const applied = await inject<{
      snapshot: { revision: number };
      replayed: boolean;
      mutatedGit: false;
      deletedWorktrees: false;
      fabricatedCompletion: false;
    }>(server, {
      method: "POST",
      url: "/diagnostics/recovery/apply",
      payload: {
        ...identity,
        expectedRevision: inspected.body.data.current.revision,
        operationId: "operation-recovery-drill",
        operatorApproval: "approved",
      },
    });
    const appliedAgain = await inject<{ replayed: boolean }>(server, {
      method: "POST",
      url: "/diagnostics/recovery/apply",
      payload: {
        ...identity,
        expectedRevision: inspected.body.data.current.revision,
        operationId: "operation-recovery-drill",
        operatorApproval: "approved",
      },
    });
    const diagnosticPreview = await inject<{
      previewId: string;
      redactionProof: Record<string, boolean>;
    }>(server, {
      method: "POST",
      url: "/diagnostics/preview",
      payload: {
        ...identity,
        expectedRevision: applied.body.data.snapshot.revision,
      },
    });
    const exported = await inject<{
      record: {
        exportId: string;
        relativePath: string;
        bytes: number;
      };
      replayed: boolean;
    }>(server, {
      method: "POST",
      url: "/diagnostics/exports",
      payload: {
        ...identity,
        expectedRevision: applied.body.data.snapshot.revision,
        previewId: diagnosticPreview.body.data.previewId,
        operatorApproval: "approved",
      },
    });
    const exportedAgain = await inject<{ replayed: boolean }>(server, {
      method: "POST",
      url: "/diagnostics/exports",
      payload: {
        ...identity,
        expectedRevision: applied.body.data.snapshot.revision,
        previewId: diagnosticPreview.body.data.previewId,
        operatorApproval: "approved",
      },
    });
    const exportJson = join(
      stateRoot,
      "exports",
      exported.body.data.record.relativePath,
    );
    const exportMarkdown = join(
      stateRoot,
      "exports",
      `${exported.body.data.record.exportId}.md`,
    );
    const diagnosticText = `${await readFile(exportJson, "utf8")}${await readFile(
      exportMarkdown,
      "utf8",
    )}`;
    const deleted = await inject<{
      deleted: boolean;
      absentAfterDelete: boolean;
      replayed: boolean;
    }>(server, {
      method: "DELETE",
      url: `/diagnostics/exports/${exported.body.data.record.exportId}`,
      payload: {
        ...identity,
        expectedRevision: applied.body.data.snapshot.revision + 1,
        exportId: exported.body.data.record.exportId,
        operatorApproval: "approved",
      },
    });
    const deletedAgain = await inject<{
      deleted: boolean;
      absentAfterDelete: boolean;
      replayed: boolean;
    }>(server, {
      method: "DELETE",
      url: `/diagnostics/exports/${exported.body.data.record.exportId}`,
      payload: {
        ...identity,
        expectedRevision: applied.body.data.snapshot.revision + 1,
        exportId: exported.body.data.record.exportId,
        operatorApproval: "approved",
      },
    });
    cleanupEvidence = {
      exportAbsent:
        !(await present(exportJson)) && !(await present(exportMarkdown)),
      ...((await service.residueForTest()).temporaryFiles.length === 0
        ? { temporaryFilesZero: true }
        : { temporaryFilesZero: false }),
      ownedProcessesZero: service.ownedProcessCount() === 0,
      listenersZero: !server.server.listening,
    };
    await server.close();
    server = null;
    service = null;

    service = new Phase17Service({ directory: stateRoot });
    server = createLocalServer({ phase17Service: service });
    const persisted = await inject<{
      current: {
        revision: number;
        currentState: string;
        previousVerifiedState: string;
        lossWindow: string;
        readiness: readonly unknown[];
        incidents: readonly unknown[];
        operations: readonly {
          state: string;
          completionRecorded: false;
        }[];
      };
      previous: { revision: number };
      recoverySource: string;
    }>(server, {
      method: "GET",
      url: "/diagnostics/snapshot",
    });
    const stateText = [
      await readFile(join(stateRoot, "observability.current.json"), "utf8"),
      await readFile(join(stateRoot, "observability.previous.json"), "utf8"),
      await readFile(join(stateRoot, "events.jsonl"), "utf8"),
      await readFile(
        join(stateRoot, "diagnostic-preview.current.json"),
        "utf8",
      ),
      diagnosticText,
      JSON.stringify(persisted.body.data),
    ].join("\n");
    const ledgerLines = (
      await readFile(join(stateRoot, "events.jsonl"), "utf8")
    )
      .trim()
      .split("\n");
    const repositoryHeadAfter = (
      await git(repository, ["rev-parse", "HEAD"])
    ).trim();
    const worktreeTopologyAfter = sha256(
      await git(repository, ["worktree", "list", "--porcelain"]),
    );
    const statusAfter = sha256(
      [
        await git(repository, ["status", "--porcelain=v2"]),
        await git(fluff, ["status", "--porcelain=v2"]),
        await git(beans, ["status", "--porcelain=v2"]),
      ].join("\n"),
    );
    const markerDigestAfter = sha256(
      `${await readFile(join(fluff, "mr-fluff.marker"), "utf8")}${await readFile(
        join(beans, "beans.marker"),
        "utf8",
      )}`,
    );
    const privacy = {
      absolutePathLeak: stateText.includes(root),
      secretCanaryLeak: stateText.includes("SECRET_CANARY"),
      personaCanaryLeak: stateText.includes("PERSONA_CANARY"),
      rawContentFields:
        /rawPrompt|transcript|personaContents|memoryContents|rawDiff|sourceContent/.test(
          stateText,
        ),
    };
    const checks = {
      exactlyTwoWorktrees:
        (await git(repository, ["worktree", "list", "--porcelain"]))
          .split("\n")
          .filter((line) => line.startsWith("worktree ")).length === 3,
      operationStarted: started.statusCode === 200,
      ownedChildKilled:
        terminated.statusCode === 200 && terminated.body.data.killed,
      orphanClassified:
        inspected.body.data.current.operations[0]?.state === "orphaned",
      noCompletionFabricated:
        persisted.body.data.current.operations[0]?.completionRecorded ===
          false &&
        !ledgerLines.some((line) =>
          /operation-completed|success-fabricated/.test(line),
        ),
      exactCurrentPreviousTruth:
        inspected.body.data.current.revision === 1 &&
        inspected.body.data.previous.revision === 0,
      noMutationPreview:
        previewed.body.data.mutation === "none" &&
        currentBeforePlan === currentAfterPlan,
      safeApply:
        applied.statusCode === 200 &&
        applied.body.data.mutatedGit === false &&
        applied.body.data.deletedWorktrees === false &&
        applied.body.data.fabricatedCompletion === false,
      applyIdempotent: appliedAgain.body.data.replayed,
      exportIdempotent: exportedAgain.body.data.replayed,
      deleteIdempotent: deletedAgain.body.data.replayed,
      privacySafe:
        !privacy.absolutePathLeak &&
        !privacy.secretCanaryLeak &&
        !privacy.personaCanaryLeak &&
        !privacy.rawContentFields,
      exportDeleted:
        deleted.body.data.absentAfterDelete &&
        deletedAgain.body.data.absentAfterDelete,
      restartPersistent:
        persisted.body.data.current.revision === 4 &&
        persisted.body.data.previous.revision === 3,
      wrongIdentityRejected: wrongIdentity.statusCode === 409,
      repositoryPreserved:
        repositoryHeadBefore === repositoryHeadAfter &&
        worktreeTopologyBefore === worktreeTopologyAfter &&
        statusBefore === statusAfter &&
        markerDigestBefore === markerDigestAfter,
      cleanupZero:
        cleanupEvidence.ownedProcessesZero &&
        cleanupEvidence.listenersZero &&
        cleanupEvidence.temporaryFilesZero,
    };
    result = {
      schema: "aiw.phase17-recovery-drill/0.17",
      verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
      checks,
      measurements: {
        currentRevision: persisted.body.data.current.revision,
        previousRevision: persisted.body.data.previous.revision,
        eventCount: ledgerLines.length,
        incidentCount: persisted.body.data.current.incidents.length,
        readinessRows: persisted.body.data.current.readiness.length,
        exportBytes: exported.body.data.record.bytes,
        ownedProcesses: service.ownedProcessCount(),
        listenerCount: server.server.listening ? 1 : 0,
        temporaryFiles: (await service.residueForTest()).temporaryFiles.length,
      },
      truth: {
        currentState: persisted.body.data.current.currentState,
        previousVerifiedState:
          persisted.body.data.current.previousVerifiedState,
        lossWindow: persisted.body.data.current.lossWindow,
        recoverySource: persisted.body.data.recoverySource,
        operationState:
          persisted.body.data.current.operations[0]?.state ?? "missing",
        completionRecorded: false,
        applyReplayed: appliedAgain.body.data.replayed,
        exportReplayed: exportedAgain.body.data.replayed,
        deleteReplayed: deletedAgain.body.data.replayed,
      },
      privacy,
      git: {
        repositoryHeadBefore,
        repositoryHeadAfter,
        worktreeTopologyBefore,
        worktreeTopologyAfter,
        statusBefore,
        statusAfter,
        markerDigestBefore,
        markerDigestAfter,
      },
      api: {
        initializeStatus: initialized.statusCode,
        startStatus: started.statusCode,
        terminateStatus: terminated.statusCode,
        inspectStatus: inspected.statusCode,
        previewStatus: previewed.statusCode,
        applyStatus: applied.statusCode,
        diagnosticPreviewStatus: diagnosticPreview.statusCode,
        exportStatus: exported.statusCode,
        deleteStatus: deleted.statusCode,
        wrongIdentityStatus: wrongIdentity.statusCode,
      },
    };
  } finally {
    await server?.close().catch(() => undefined);
    await service?.dispose().catch(() => undefined);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
  const fixtureRootRemoved = !(await present(root));
  return {
    ...result,
    cleanup: {
      ...cleanupEvidence,
      fixtureRootRemoved,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runPhase17Drill();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.verdict !== "PASS") process.exitCode = 1;
}

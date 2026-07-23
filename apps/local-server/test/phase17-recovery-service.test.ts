import {
  access,
  lstat,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { Phase17Service } from "../src/phase17-service.js";

const roots: string[] = [];
const identity = {
  repositoryId: "repo-fixture",
  sessionId: "phase17-fixture",
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
const approvedTermination = (
  operationId: string,
  expectedRevision: number,
) => ({
  ...identity,
  expectedRevision,
  operationId,
  operatorApproval: "approved",
});
const present = async (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true, maxRetries: 3 })),
  );
});

describe("Phase 17 recovery service", () => {
  it("persists an interrupted operation, classifies it after restart, and emits the exact orphan event", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-service-"));
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    const healthy = await service.initialize({ ...identity, bindings });
    const started = await service.startOperation({
      ...identity,
      expectedRevision: healthy.revision,
      operationId: "operation-fixture",
      agentId: "beans",
      taskId: "task-beans-doc",
      worktreeId: "worktree-beans",
      capability: "tool",
      stage: "test",
      commandSummary:
        "test /home/private/source TOKEN=SECRET_CANARY_VALUE PERSONA_CANARY",
      operatorApproval: "approved",
    });
    expect(started.operations[0]?.completionRecorded).toBe(false);
    expect(service.ownedProcessCount()).toBe(1);
    expect(
      await service.terminateOwnedOperation(
        approvedTermination("operation-fixture", started.revision),
      ),
    ).toEqual({ killed: true, replayed: false });
    await service.dispose();

    const restarted = new Phase17Service({ directory: root });
    const projection = await restarted.inspect(identity);
    expect(projection.current?.revision).toBe(1);
    expect(projection.previous?.revision).toBe(0);
    expect(projection.current?.operations[0]).toMatchObject({
      state: "orphaned",
      completionRecorded: false,
      reconciliation: "required",
    });
    expect(projection.current?.currentState).toContain("Degraded");
    expect(projection.current?.lossWindow).toContain("Non-derivable");
    expect(
      projection.current?.readiness.find((row) => row.capability === "tool"),
    ).toMatchObject({
      status: "recovery-needed",
      permittedAction: "recover",
    });
    const persisted = await readFile(restarted.pathsForTest().current, "utf8");
    expect(persisted).not.toMatch(
      /\/home\/private|SECRET_CANARY|PERSONA_CANARY|TOKEN=/,
    );

    const planBefore = await readFile(restarted.pathsForTest().current, "utf8");
    const plan = await restarted.previewRecovery({
      ...identity,
      expectedRevision: 1,
      operationId: "operation-fixture",
    });
    expect(plan.mutation).toBe("none");
    expect(plan.forbiddenActions).toContain("git-reset");
    expect(await readFile(restarted.pathsForTest().current, "utf8")).toBe(
      planBefore,
    );

    const applied = await restarted.applyRecovery({
      ...identity,
      expectedRevision: 1,
      operationId: "operation-fixture",
      operatorApproval: "approved",
    });
    expect(applied).toMatchObject({
      replayed: false,
      mutatedGit: false,
      deletedWorktrees: false,
      fabricatedCompletion: false,
    });
    expect(applied.snapshot.operations[0]).toMatchObject({
      state: "reconciled",
      completionRecorded: false,
    });
    const replay = await restarted.applyRecovery({
      ...identity,
      expectedRevision: 1,
      operationId: "operation-fixture",
      operatorApproval: "approved",
    });
    expect(replay.replayed).toBe(true);
    const afterApply = await readFile(restarted.pathsForTest().current, "utf8");
    await expect(
      restarted.applyRecovery({
        ...identity,
        expectedRevision: 999,
        operationId: "operation-fixture",
        operatorApproval: "approved",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await readFile(restarted.pathsForTest().current, "utf8")).toBe(
      afterApply,
    );

    const ledger = await readFile(restarted.pathsForTest().ledger, "utf8");
    const kinds = ledger
      .trim()
      .split("\n")
      .map((line) => (JSON.parse(line) as { kind: string }).kind);
    expect(kinds).toContain("operation-orphaned");
    await restarted.dispose();
  });

  it("fails closed before preview, exports only allowlisted summaries, and deletes with idempotent proof", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-export-"));
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    await service.initialize({ ...identity, bindings });
    await expect(
      service.exportDiagnostics({
        ...identity,
        expectedRevision: 0,
        previewId: "preview-missing",
        operatorApproval: "approved",
      }),
    ).rejects.toMatchObject({ code: "privacy" });
    const preview = await service.previewDiagnostics({
      ...identity,
      expectedRevision: 0,
    });
    expect(preview.redactionProof).toEqual({
      allowlisted: true,
      secretCanaryAbsent: true,
      personaCanaryAbsent: true,
      absolutePathsAbsent: true,
    });
    const exported = await service.exportDiagnostics({
      ...identity,
      expectedRevision: 0,
      previewId: preview.previewId,
      operatorApproval: "approved",
    });
    expect(exported.record.bytes).toBeLessThanOrEqual(1024 * 1024);
    const jsonPath = join(
      service.pathsForTest().exports,
      exported.record.relativePath,
    );
    const markdownPath = join(
      service.pathsForTest().exports,
      `${exported.record.exportId}.md`,
    );
    const exportedText = `${await readFile(jsonPath, "utf8")}${await readFile(
      markdownPath,
      "utf8",
    )}`;
    expect(exportedText).not.toMatch(
      /\/home\/|SECRET_CANARY|PERSONA_CANARY|rawPrompt|transcript/,
    );
    const repeatedExport = await service.exportDiagnostics({
      ...identity,
      expectedRevision: 0,
      previewId: preview.previewId,
      operatorApproval: "approved",
    });
    expect(repeatedExport.replayed).toBe(true);
    const deleted = await service.deleteExport({
      ...identity,
      expectedRevision: 1,
      exportId: exported.record.exportId,
      operatorApproval: "approved",
    });
    expect(deleted).toMatchObject({
      deleted: true,
      absentAfterDelete: true,
      replayed: false,
    });
    const repeatedDelete = await service.deleteExport({
      ...identity,
      expectedRevision: 1,
      exportId: exported.record.exportId,
      operatorApproval: "approved",
    });
    expect(repeatedDelete).toMatchObject({
      deleted: false,
      absentAfterDelete: true,
      replayed: true,
    });
    await expect(lstat(jsonPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await service.residueForTest()).toEqual({
      ownedProcesses: 0,
      temporaryFiles: [],
    });
    await service.dispose();
  });

  it("preserves corrupt current evidence and rejects a symlink state root", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-corrupt-"));
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    await service.initialize({ ...identity, bindings });
    await service.startOperation({
      ...identity,
      expectedRevision: 0,
      operationId: "operation-corrupt",
      agentId: "mr-fluff",
      taskId: "task-fluff-doc",
      worktreeId: "worktree-fluff",
      capability: "preview",
      stage: "preview",
      commandSummary: "bounded preview",
      operatorApproval: "approved",
    });
    await service.terminateOwnedOperation(
      approvedTermination("operation-corrupt", 1),
    );
    await service.dispose();
    await writeFile(
      join(root, "observability.current.json"),
      '{"corrupt":true}\n',
      "utf8",
    );
    const recovered = new Phase17Service({ directory: root });
    const projection = await recovered.inspect(identity);
    expect(projection.recoverySource).toBe("previous-recovered");
    expect(projection.truth).toBe("previous-recovered");
    expect(projection.preservedCorruptCurrent).toMatch(
      /^corrupt\/corrupt-current-[a-f0-9]{16}\.json$/,
    );
    await recovered.dispose();

    const outside = await mkdtemp(join(tmpdir(), "aiw-phase17-outside-"));
    roots.push(outside);
    const link = join(root, "linked-root");
    await symlink(outside, link, "dir");
    const unsafe = new Phase17Service({ directory: link });
    await expect(unsafe.inspect()).rejects.toMatchObject({
      code: "unsafe-path",
    });
  });

  it("rotates to three exports deterministically and reports the removed identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-retention-"));
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    await service.initialize({ ...identity, bindings });
    const records: string[] = [];
    let removed: readonly string[] = [];
    for (let revision = 0; revision < 4; revision += 1) {
      const preview = await service.previewDiagnostics({
        ...identity,
        expectedRevision: revision,
      });
      const exported = await service.exportDiagnostics({
        ...identity,
        expectedRevision: revision,
        previewId: preview.previewId,
        operatorApproval: "approved",
      });
      records.push(exported.record.exportId);
      removed = exported.removedExportIds;
    }
    const projection = await service.inspect(identity);
    expect(projection.current?.exports).toHaveLength(3);
    expect(removed).toEqual([records[0]]);
    expect(
      await lstat(
        join(service.pathsForTest().exports, `${records[0]}.json`),
      ).catch((error: unknown) => error),
    ).toMatchObject({ code: "ENOENT" });
    await service.dispose();
  });

  it("binds export replay to the original preview revision and rejects missing or corrupted bundle content", async () => {
    for (const damage of [
      "missing-json",
      "missing-markdown",
      "corrupt",
    ] as const) {
      const root = await mkdtemp(
        join(tmpdir(), `aiw-phase17-export-integrity-${damage}-`),
      );
      roots.push(root);
      const service = new Phase17Service({ directory: root });
      await service.initialize({ ...identity, bindings });
      const preview = await service.previewDiagnostics({
        ...identity,
        expectedRevision: 0,
      });
      const exported = await service.exportDiagnostics({
        ...identity,
        expectedRevision: 0,
        previewId: preview.previewId,
        operatorApproval: "approved",
      });
      await expect(
        service.exportDiagnostics({
          ...identity,
          expectedRevision: 0,
          previewId: preview.previewId,
          operatorApproval: "approved",
        }),
      ).resolves.toMatchObject({ replayed: true });
      await expect(
        service.exportDiagnostics({
          ...identity,
          expectedRevision: 999,
          previewId: preview.previewId,
          operatorApproval: "approved",
        }),
      ).rejects.toMatchObject({ code: "conflict" });
      await expect(
        service.exportDiagnostics({
          ...identity,
          repositoryId: "wrong-repository",
          expectedRevision: 0,
          previewId: preview.previewId,
          operatorApproval: "approved",
        }),
      ).rejects.toMatchObject({ code: "conflict" });
      await expect(
        service.exportDiagnostics({
          ...identity,
          sessionId: "wrong-session",
          expectedRevision: 0,
          previewId: preview.previewId,
          operatorApproval: "approved",
        }),
      ).rejects.toMatchObject({ code: "conflict" });
      const jsonPath = join(
        service.pathsForTest().exports,
        exported.record.relativePath,
      );
      const markdownPath = join(
        service.pathsForTest().exports,
        `${exported.record.exportId}.md`,
      );
      if (damage === "missing-json") await unlink(jsonPath);
      else if (damage === "missing-markdown") await unlink(markdownPath);
      else await writeFile(jsonPath, '{"corrupted":true}\n', "utf8");
      await expect(
        service.exportDiagnostics({
          ...identity,
          expectedRevision: 0,
          previewId: preview.previewId,
          operatorApproval: "approved",
        }),
      ).rejects.toMatchObject({ code: "conflict" });
      await service.dispose();
    }
  });

  it("deletes exact orphan pairs truthfully, rejects stale revisions before mutation, and binds recorded replay", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-delete-proof-"));
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    await service.initialize({ ...identity, bindings });
    const exportRoot = service.pathsForTest().exports;
    const orphanCases = [
      { exportId: "export-orphan-pair", extensions: ["json", "md"] },
      { exportId: "export-orphan-one", extensions: ["json"] },
    ] as const;
    for (const orphan of orphanCases) {
      for (const extension of orphan.extensions)
        await writeFile(
          join(exportRoot, `${orphan.exportId}.${extension}`),
          "orphan\n",
          "utf8",
        );
      const before = await readFile(service.pathsForTest().current, "utf8");
      for (const rejected of [
        {
          ...identity,
          repositoryId: "wrong-repository",
          expectedRevision: 0,
          exportId: orphan.exportId,
          operatorApproval: "approved",
        },
        {
          ...identity,
          sessionId: "wrong-session",
          expectedRevision: 0,
          exportId: orphan.exportId,
          operatorApproval: "approved",
        },
        {
          ...identity,
          expectedRevision: 0,
          exportId: orphan.exportId,
        },
      ]) {
        await expect(service.deleteExport(rejected)).rejects.toBeInstanceOf(
          Error,
        );
        for (const extension of orphan.extensions)
          expect(
            await present(join(exportRoot, `${orphan.exportId}.${extension}`)),
          ).toBe(true);
        expect(await readFile(service.pathsForTest().current, "utf8")).toBe(
          before,
        );
      }
      await expect(
        service.deleteExport({
          ...identity,
          expectedRevision: 999,
          exportId: orphan.exportId,
          operatorApproval: "approved",
        }),
      ).rejects.toMatchObject({ code: "conflict" });
      expect(await readFile(service.pathsForTest().current, "utf8")).toBe(
        before,
      );
      for (const extension of orphan.extensions)
        expect(
          await present(join(exportRoot, `${orphan.exportId}.${extension}`)),
        ).toBe(true);
      await expect(
        service.deleteExport({
          ...identity,
          expectedRevision: 0,
          exportId: orphan.exportId,
          operatorApproval: "approved",
        }),
      ).resolves.toMatchObject({
        deleted: true,
        absentAfterDelete: true,
        replayed: false,
      });
      expect(await present(join(exportRoot, `${orphan.exportId}.json`))).toBe(
        false,
      );
      expect(await present(join(exportRoot, `${orphan.exportId}.md`))).toBe(
        false,
      );
    }
    await expect(
      service.deleteExport({
        ...identity,
        expectedRevision: 0,
        exportId: "export-genuinely-absent",
        operatorApproval: "approved",
      }),
    ).resolves.toMatchObject({
      deleted: false,
      absentAfterDelete: true,
      replayed: true,
    });

    const preview = await service.previewDiagnostics({
      ...identity,
      expectedRevision: 0,
    });
    const exported = await service.exportDiagnostics({
      ...identity,
      expectedRevision: 0,
      previewId: preview.previewId,
      operatorApproval: "approved",
    });
    await service.deleteExport({
      ...identity,
      expectedRevision: 1,
      exportId: exported.record.exportId,
      operatorApproval: "approved",
    });
    await writeFile(
      join(exportRoot, `${exported.record.exportId}.md`),
      "reappeared\n",
      "utf8",
    );
    await expect(
      service.deleteExport({
        ...identity,
        expectedRevision: 999,
        exportId: exported.record.exportId,
        operatorApproval: "approved",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(
      await present(join(exportRoot, `${exported.record.exportId}.md`)),
    ).toBe(true);
    await expect(
      service.deleteExport({
        ...identity,
        expectedRevision: 1,
        exportId: exported.record.exportId,
        operatorApproval: "approved",
      }),
    ).resolves.toMatchObject({
      absentAfterDelete: true,
      replayed: true,
    });
    expect(
      await present(join(exportRoot, `${exported.record.exportId}.md`)),
    ).toBe(false);
    await service.dispose();
  });

  it("requires every termination and recovery authority dimension before mutation", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "aiw-phase17-terminate-authority-"),
    );
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    await service.initialize({ ...identity, bindings });
    const started = await service.startOperation({
      ...identity,
      expectedRevision: 0,
      operationId: "operation-authority",
      agentId: "beans",
      taskId: "task-beans-doc",
      worktreeId: "worktree-beans",
      capability: "tool",
      stage: "test",
      commandSummary: "bounded authority test",
      operatorApproval: "approved",
    });
    const before = await readFile(service.pathsForTest().current, "utf8");
    const rejected = [
      {
        ...approvedTermination("operation-authority", 1),
        repositoryId: "wrong",
      },
      { ...approvedTermination("operation-authority", 1), sessionId: "wrong" },
      approvedTermination("operation-authority", 999),
      approvedTermination("operation-other", 1),
      { ...identity, expectedRevision: 1, operationId: "operation-authority" },
    ];
    for (const input of rejected) {
      await expect(
        service.terminateOwnedOperation(input),
      ).rejects.toBeInstanceOf(Error);
      expect(service.ownedProcessCount()).toBe(1);
      expect(await readFile(service.pathsForTest().current, "utf8")).toBe(
        before,
      );
    }
    await expect(
      service.terminateOwnedOperation(
        approvedTermination("operation-authority", started.revision),
      ),
    ).resolves.toEqual({ killed: true, replayed: false });
    expect(service.ownedProcessCount()).toBe(0);
    const beforeApply = await readFile(service.pathsForTest().current, "utf8");
    const rejectedApply = [
      {
        ...identity,
        repositoryId: "wrong",
        expectedRevision: 1,
        operationId: "operation-authority",
        operatorApproval: "approved",
      },
      {
        ...identity,
        sessionId: "wrong",
        expectedRevision: 1,
        operationId: "operation-authority",
        operatorApproval: "approved",
      },
      {
        ...identity,
        expectedRevision: 999,
        operationId: "operation-authority",
        operatorApproval: "approved",
      },
      {
        ...identity,
        expectedRevision: 1,
        operationId: "operation-other",
        operatorApproval: "approved",
      },
      {
        ...identity,
        expectedRevision: 1,
        operationId: "operation-authority",
      },
    ];
    for (const input of rejectedApply) {
      await expect(service.applyRecovery(input)).rejects.toBeInstanceOf(Error);
      expect(await readFile(service.pathsForTest().current, "utf8")).toBe(
        beforeApply,
      );
    }
    await expect(
      service.applyRecovery({
        ...identity,
        expectedRevision: 1,
        operationId: "operation-authority",
        operatorApproval: "approved",
      }),
    ).resolves.toMatchObject({ replayed: false });
    await expect(
      service.applyRecovery({
        ...identity,
        expectedRevision: 999,
        operationId: "operation-authority",
        operatorApproval: "approved",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      service.applyRecovery({
        ...identity,
        expectedRevision: 1,
        operationId: "operation-authority",
        operatorApproval: "approved",
      }),
    ).resolves.toMatchObject({ replayed: true });
    await service.dispose();
  });

  it("rejects symlinks at every fixed persistence file without changing outside sentinels", async () => {
    const fixed = [
      "observability.current.json",
      "observability.previous.json",
      "events.jsonl",
      "diagnostic-preview.current.json",
    ] as const;
    for (const name of fixed) {
      const root = await mkdtemp(join(tmpdir(), `aiw-phase17-fixed-${name}-`));
      const outside = await mkdtemp(join(tmpdir(), "aiw-phase17-sentinel-"));
      roots.push(root, outside);
      const sentinel = join(outside, "sentinel.txt");
      await writeFile(sentinel, `sentinel-${name}\n`, "utf8");
      const service = new Phase17Service({ directory: root });
      await service.initialize({ ...identity, bindings });
      const target = join(root, name);
      if (await present(target)) await unlink(target);
      await symlink(sentinel, target, "file");
      const before = await readFile(sentinel, "utf8");
      if (name === "observability.previous.json") {
        await expect(
          service.startOperation({
            ...identity,
            expectedRevision: 0,
            operationId: "operation-fixed-path",
            agentId: "mr-fluff",
            taskId: "task-fluff-doc",
            worktreeId: "worktree-fluff",
            capability: "preview",
            stage: "preview",
            commandSummary: "bounded fixed path test",
            operatorApproval: "approved",
          }),
        ).rejects.toMatchObject({ code: "unsafe-path" });
      } else if (name === "diagnostic-preview.current.json") {
        await expect(
          service.previewDiagnostics({ ...identity, expectedRevision: 0 }),
        ).rejects.toMatchObject({ code: "unsafe-path" });
      } else {
        await service.dispose();
        const restarted = new Phase17Service({ directory: root });
        await expect(restarted.inspect(identity)).rejects.toMatchObject({
          code: "unsafe-path",
        });
        await restarted.dispose();
      }
      expect(await readFile(sentinel, "utf8")).toBe(before);
      await service.dispose();
    }
  });

  it("redacts comprehensive absolute paths and canaries from every persisted diagnostic surface", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-privacy-surfaces-"));
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    await service.initialize({ ...identity, bindings });
    const raw = [
      "/root/private/file",
      "/opt/agent/data",
      "/srv/world/state",
      "/mnt/operator/repository",
      "/home/operator/source",
      "/tmp/phase17/raw",
      "/var/private/log",
      "/etc/private/config",
      String.raw`C:\Users\operator\source.txt`,
      String.raw`\\server\share\source.txt`,
      "TOKEN=SECRET_CANARY_VALUE",
      "PERSONA_CANARY_PRIVATE",
      "MEMORY_CANARY_PRIVATE",
    ];
    const started = await service.startOperation({
      ...identity,
      expectedRevision: 0,
      operationId: "operation-privacy",
      agentId: "mr-fluff",
      taskId: "task-fluff-doc",
      worktreeId: "worktree-fluff",
      capability: "preview",
      stage: "preview",
      commandSummary: `safe-relative worktrees/mr-fluff ${raw.join(" ")}`,
      operatorApproval: "approved",
    });
    await service.terminateOwnedOperation(
      approvedTermination("operation-privacy", started.revision),
    );
    await service.applyRecovery({
      ...identity,
      expectedRevision: 1,
      operationId: "operation-privacy",
      operatorApproval: "approved",
    });
    const preview = await service.previewDiagnostics({
      ...identity,
      expectedRevision: 2,
    });
    const exported = await service.exportDiagnostics({
      ...identity,
      expectedRevision: 2,
      previewId: preview.previewId,
      operatorApproval: "approved",
    });
    const surfaces = [
      await readFile(service.pathsForTest().current, "utf8"),
      await readFile(service.pathsForTest().previous, "utf8"),
      await readFile(service.pathsForTest().ledger, "utf8"),
      await readFile(join(root, "diagnostic-preview.current.json"), "utf8"),
      JSON.stringify(await service.inspect(identity)),
      await readFile(
        join(service.pathsForTest().exports, exported.record.relativePath),
        "utf8",
      ),
      await readFile(
        join(service.pathsForTest().exports, `${exported.record.exportId}.md`),
        "utf8",
      ),
    ];
    for (const surface of surfaces) {
      expect(surface).toContain(
        surface.includes("commandSummary")
          ? "safe-relative worktrees/mr-fluff"
          : "",
      );
      for (const probe of raw) expect(surface).not.toContain(probe);
    }
    await service.dispose();
  });
});

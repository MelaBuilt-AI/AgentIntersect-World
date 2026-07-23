import { access, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runPhase17Cli } from "../../../tooling/scripts/phase17-recovery.js";
import { Phase17Service } from "../src/phase17-service.js";

const roots: string[] = [];
const identity = {
  repositoryId: "repo-cli",
  sessionId: "phase17-cli",
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

function args(
  root: string,
  command: string,
  additional: readonly string[] = [],
) {
  return [
    command,
    "--state-root",
    root,
    "--repository",
    identity.repositoryId,
    "--session",
    identity.sessionId,
    ...additional,
  ];
}

describe("Phase 17 thin recovery CLI", () => {
  it("uses the production service for inspect, recovery, preview/export, and delete", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-cli-"));
    roots.push(root);
    const setup = new Phase17Service({ directory: root });
    await setup.initialize({
      ...identity,
      bindings,
    });
    await setup.startOperation({
      ...identity,
      expectedRevision: 0,
      operationId: "operation-cli",
      agentId: "mr-fluff",
      taskId: "task-fluff-doc",
      worktreeId: "worktree-fluff",
      capability: "preview",
      stage: "preview",
      commandSummary: "bounded CLI preview",
      operatorApproval: "approved",
    });
    await setup.terminateOwnedOperation({
      ...identity,
      expectedRevision: 1,
      operationId: "operation-cli",
      operatorApproval: "approved",
    });
    await setup.dispose();

    let output = "";
    const write = (value: string) => {
      output += value;
    };
    await runPhase17Cli(args(root, "inspect"), write);
    expect(output).toContain('"state": "orphaned"');
    output = "";
    await runPhase17Cli(
      args(root, "preview-recovery", [
        "--revision",
        "1",
        "--operation",
        "operation-cli",
      ]),
      write,
    );
    expect(output).toContain('"mutation": "none"');
    output = "";
    await runPhase17Cli(
      args(root, "apply-recovery", [
        "--revision",
        "1",
        "--operation",
        "operation-cli",
      ]),
      write,
    );
    expect(output).toContain('"mutatedGit": false');
    output = "";
    const preview = (await runPhase17Cli(
      args(root, "preview-diagnostics", ["--revision", "2"]),
      write,
    )) as { previewId: string };
    expect(preview.previewId).toMatch(/^preview-r2-/);
    output = "";
    const exported = (await runPhase17Cli(
      args(root, "export-diagnostics", [
        "--revision",
        "2",
        "--preview",
        preview.previewId,
      ]),
      write,
    )) as { record: { exportId: string } };
    expect(exported.record.exportId).toBe(`export-${preview.previewId}`);
    output = "";
    const deleted = await runPhase17Cli(
      args(root, "delete-export", [
        "--revision",
        "3",
        "--export",
        exported.record.exportId,
      ]),
      write,
    );
    expect(deleted).toMatchObject({ absentAfterDelete: true });
    expect(output).not.toContain(root);
  });

  it("rejects wrong repository identity before mutation", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-cli-wrong-"));
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    await service.initialize({
      ...identity,
      bindings,
    });
    await service.dispose();
    await expect(
      runPhase17Cli([
        "inspect",
        "--state-root",
        root,
        "--repository",
        "wrong-repository",
        "--session",
        identity.sessionId,
      ]),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects unbound apply/export retries and damaged export content through the thin CLI", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-cli-integrity-"));
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    await service.initialize({ ...identity, bindings });
    await service.startOperation({
      ...identity,
      expectedRevision: 0,
      operationId: "operation-cli-integrity",
      agentId: "mr-fluff",
      taskId: "task-fluff-doc",
      worktreeId: "worktree-fluff",
      capability: "preview",
      stage: "preview",
      commandSummary: "bounded CLI integrity",
      operatorApproval: "approved",
    });
    await service.terminateOwnedOperation({
      ...identity,
      expectedRevision: 1,
      operationId: "operation-cli-integrity",
      operatorApproval: "approved",
    });
    await service.applyRecovery({
      ...identity,
      expectedRevision: 1,
      operationId: "operation-cli-integrity",
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
    await service.dispose();

    await expect(
      runPhase17Cli(
        args(root, "apply-recovery", [
          "--revision",
          "999",
          "--operation",
          "operation-cli-integrity",
        ]),
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      runPhase17Cli(
        args(root, "export-diagnostics", [
          "--revision",
          "999",
          "--preview",
          preview.previewId,
        ]),
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      runPhase17Cli(
        args(root, "export-diagnostics", [
          "--revision",
          "2",
          "--preview",
          preview.previewId,
        ]),
      ),
    ).resolves.toMatchObject({ replayed: true });
    await unlink(join(root, "exports", `${exported.record.exportId}.json`));
    await expect(
      runPhase17Cli(
        args(root, "export-diagnostics", [
          "--revision",
          "2",
          "--preview",
          preview.previewId,
        ]),
      ),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("requires delete revision and removes an exact orphan pair through the thin CLI", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-cli-delete-"));
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    await service.initialize({ ...identity, bindings });
    await service.dispose();
    const jsonPath = join(root, "exports", "export-cli-orphan.json");
    const markdownPath = join(root, "exports", "export-cli-orphan.md");
    await writeFile(jsonPath, "orphan-json\n", "utf8");
    await writeFile(markdownPath, "orphan-markdown\n", "utf8");
    await expect(
      runPhase17Cli(
        args(root, "delete-export", [
          "--revision",
          "999",
          "--export",
          "export-cli-orphan",
        ]),
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await present(jsonPath)).toBe(true);
    expect(await present(markdownPath)).toBe(true);
    await expect(
      runPhase17Cli(
        args(root, "delete-export", [
          "--revision",
          "0",
          "--export",
          "export-cli-orphan",
        ]),
      ),
    ).resolves.toMatchObject({
      deleted: true,
      absentAfterDelete: true,
    });
    expect(await present(jsonPath)).toBe(false);
    expect(await present(markdownPath)).toBe(false);
  });
});

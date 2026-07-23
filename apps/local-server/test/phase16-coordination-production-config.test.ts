import { mkdtemp, mkdir, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  loadProductionCoordinationGitConfig,
  PHASE16_REPOSITORY_ROOT_ENV,
  PHASE16_WORKTREE_PARENT_ENV,
} from "../src/coordination-production-config.js";
import { CoordinationService } from "../src/coordination-service.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Phase 16 production Git configuration", () => {
  it("allows an unconfigured read/API server while leaving Git mutations fail-closed", async () => {
    await expect(loadProductionCoordinationGitConfig({})).resolves.toBeNull();
    const directory = await mkdtemp(
      join(tmpdir(), "aiw-phase16-production-service-"),
    );
    roots.push(directory);
    const service = new CoordinationService({
      directory,
      requireApprovedGitBoundary: true,
    });
    await expect(
      service.action({
        schema: "aiw.coordination-action/0.16",
        coordinationSessionId: "phase16-production",
        actor: "operator",
        operatorApproval: "approved",
        expectedRevision: 0,
        correlationId: "initialize-without-approved-root",
        action: {
          kind: "session.initialize",
          repositoryId: "caller-derived-repository",
          repositoryDisplayName: "Caller-derived repository",
          operatorId: "operator-local",
        },
      }),
    ).rejects.toMatchObject({ code: "git-refused" });
    expect((await service.snapshot()).snapshot).toBeNull();
  });

  it("requires the approved root and parent together as absolute real directories", async () => {
    await expect(
      loadProductionCoordinationGitConfig({
        [PHASE16_REPOSITORY_ROOT_ENV]: "/tmp",
      }),
    ).rejects.toThrow(/configured together/);
    await expect(
      loadProductionCoordinationGitConfig({
        [PHASE16_REPOSITORY_ROOT_ENV]: "relative/repository",
        [PHASE16_WORKTREE_PARENT_ENV]: "/tmp",
      }),
    ).rejects.toThrow(/absolute/);

    const root = await mkdtemp(
      join(tmpdir(), "aiw-phase16-production-config-"),
    );
    roots.push(root);
    const repository = join(root, "repository");
    const linkedRepository = join(root, "repository-link");
    await mkdir(repository);
    await symlink(repository, linkedRepository);
    await expect(
      loadProductionCoordinationGitConfig({
        [PHASE16_REPOSITORY_ROOT_ENV]: linkedRepository,
        [PHASE16_WORKTREE_PARENT_ENV]: root,
      }),
    ).rejects.toThrow(/real directory/);
  });

  it("returns canonical approved paths for production service construction", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "aiw-phase16-production-config-"),
    );
    roots.push(root);
    const repository = join(root, "repository");
    await mkdir(repository);

    await expect(
      loadProductionCoordinationGitConfig({
        [PHASE16_REPOSITORY_ROOT_ENV]: repository,
        [PHASE16_WORKTREE_PARENT_ENV]: root,
      }),
    ).resolves.toEqual({
      approvedRepositoryRoot: await realpath(repository),
      allowedWorktreeParent: await realpath(root),
    });
  });
});

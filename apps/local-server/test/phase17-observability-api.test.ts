import {
  access,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { Phase17Service } from "../src/phase17-service.js";
import { createLocalServer } from "../src/server.js";

const roots: string[] = [];
const identity = {
  repositoryId: "repo-api",
  sessionId: "phase17-api",
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

describe("Phase 17 diagnostics and recovery API", () => {
  it("exposes production-backed snapshot inspection when the service is configured", async () => {
    const phase17Service = {
      inspect: vi.fn(async () => ({
        schema: "aiw.observability-projection/0.17",
        truth: "current",
        current: null,
        previous: null,
        recoverySource: "empty",
        preservedCorruptCurrent: null,
      })),
      dispose: vi.fn(async () => undefined),
    };
    const server = createLocalServer({ phase17Service } as never);
    const response = await server.inject({
      method: "GET",
      url: "/diagnostics/snapshot",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.schema).toBe(
      "aiw.observability-projection/0.17",
    );
    await server.close();
  });

  it("requires exact path/body identity, repository, session, revision, and approval before termination", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-api-terminate-"));
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    await service.initialize({ ...identity, bindings });
    await service.startOperation({
      ...identity,
      expectedRevision: 0,
      operationId: "operation-api",
      agentId: "beans",
      taskId: "task-beans-doc",
      worktreeId: "worktree-beans",
      capability: "tool",
      stage: "test",
      commandSummary: "bounded API operation",
      operatorApproval: "approved",
    });
    const server = createLocalServer({ phase17Service: service });
    const before = await readFile(service.pathsForTest().current, "utf8");
    const rejected = [
      {
        body: {
          ...identity,
          repositoryId: "wrong",
          expectedRevision: 1,
          operationId: "operation-api",
          operatorApproval: "approved",
        },
        status: 409,
      },
      {
        body: {
          ...identity,
          sessionId: "wrong",
          expectedRevision: 1,
          operationId: "operation-api",
          operatorApproval: "approved",
        },
        status: 409,
      },
      {
        body: {
          ...identity,
          expectedRevision: 999,
          operationId: "operation-api",
          operatorApproval: "approved",
        },
        status: 409,
      },
      {
        body: {
          ...identity,
          expectedRevision: 1,
          operationId: "operation-other",
          operatorApproval: "approved",
        },
        status: 409,
      },
      {
        body: {
          ...identity,
          expectedRevision: 1,
          operationId: "operation-api",
        },
        status: 403,
      },
    ];
    for (const candidate of rejected) {
      const response = await server.inject({
        method: "POST",
        url: "/diagnostics/drill/operations/operation-api/terminate",
        payload: candidate.body,
      });
      expect(response.statusCode).toBe(candidate.status);
      expect(service.ownedProcessCount()).toBe(1);
      expect(await readFile(service.pathsForTest().current, "utf8")).toBe(
        before,
      );
    }
    const accepted = await server.inject({
      method: "POST",
      url: "/diagnostics/drill/operations/operation-api/terminate",
      payload: {
        ...identity,
        expectedRevision: 1,
        operationId: "operation-api",
        operatorApproval: "approved",
      },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().data).toEqual({
      killed: true,
      replayed: false,
    });
    await server.close();
  });

  it("returns conflict for an unbound or incomplete export replay and success for the exact intact retry", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-api-export-"));
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
    const jsonPath = join(
      service.pathsForTest().exports,
      exported.record.relativePath,
    );
    const markdownPath = join(
      service.pathsForTest().exports,
      `${exported.record.exportId}.md`,
    );
    const originalJson = await readFile(jsonPath, "utf8");
    const originalMarkdown = await readFile(markdownPath, "utf8");
    const server = createLocalServer({ phase17Service: service });
    const exactBody = {
      ...identity,
      expectedRevision: 0,
      previewId: preview.previewId,
      operatorApproval: "approved",
    };
    const exact = await server.inject({
      method: "POST",
      url: "/diagnostics/exports",
      payload: exactBody,
    });
    expect(exact.statusCode).toBe(200);
    expect(exact.json().data.replayed).toBe(true);
    const wrongRevision = await server.inject({
      method: "POST",
      url: "/diagnostics/exports",
      payload: { ...exactBody, expectedRevision: 999 },
    });
    expect(wrongRevision.statusCode).toBe(409);
    await unlink(markdownPath);
    const incomplete = await server.inject({
      method: "POST",
      url: "/diagnostics/exports",
      payload: exactBody,
    });
    expect(incomplete.statusCode).toBe(409);
    await writeFile(markdownPath, originalMarkdown, "utf8");
    await unlink(jsonPath);
    const missingJson = await server.inject({
      method: "POST",
      url: "/diagnostics/exports",
      payload: exactBody,
    });
    expect(missingJson.statusCode).toBe(409);
    await writeFile(jsonPath, originalJson, "utf8");
    await writeFile(jsonPath, '{"corrupted":true}\n', "utf8");
    const corrupted = await server.inject({
      method: "POST",
      url: "/diagnostics/exports",
      payload: exactBody,
    });
    expect(corrupted.statusCode).toBe(409);
    await server.close();
  });

  it("validates revision before deleting exact orphan files and proves both absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase17-api-delete-"));
    roots.push(root);
    const service = new Phase17Service({ directory: root });
    await service.initialize({ ...identity, bindings });
    const jsonPath = join(
      service.pathsForTest().exports,
      "export-api-orphan.json",
    );
    const markdownPath = join(
      service.pathsForTest().exports,
      "export-api-orphan.md",
    );
    await writeFile(jsonPath, "orphan-json\n", "utf8");
    await writeFile(markdownPath, "orphan-markdown\n", "utf8");
    const server = createLocalServer({ phase17Service: service });
    const mismatched = await server.inject({
      method: "DELETE",
      url: "/diagnostics/exports/export-api-orphan",
      payload: {
        ...identity,
        expectedRevision: 0,
        exportId: "export-other",
        operatorApproval: "approved",
      },
    });
    expect(mismatched.statusCode).toBe(409);
    expect(await present(jsonPath)).toBe(true);
    expect(await present(markdownPath)).toBe(true);
    const stale = await server.inject({
      method: "DELETE",
      url: "/diagnostics/exports/export-api-orphan",
      payload: {
        ...identity,
        expectedRevision: 999,
        exportId: "export-api-orphan",
        operatorApproval: "approved",
      },
    });
    expect(stale.statusCode).toBe(409);
    expect(await present(jsonPath)).toBe(true);
    expect(await present(markdownPath)).toBe(true);
    const exact = await server.inject({
      method: "DELETE",
      url: "/diagnostics/exports/export-api-orphan",
      payload: {
        ...identity,
        expectedRevision: 0,
        exportId: "export-api-orphan",
        operatorApproval: "approved",
      },
    });
    expect(exact.statusCode).toBe(200);
    expect(exact.json().data).toMatchObject({
      deleted: true,
      absentAfterDelete: true,
    });
    expect(await present(jsonPath)).toBe(false);
    expect(await present(markdownPath)).toBe(false);
    await server.close();
  });
});

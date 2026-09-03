import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PreviewManagerService,
  type PreviewWorkstreamBinding,
} from "../src/preview-manager-service.js";

const roots: string[] = [];
const services: PreviewManagerService[] = [];

const repository = {
  repositoryId: "repo-current",
  revision: "repository-revision-1",
} as const;
const agent = {
  agentId: "codex-one",
  nativeSessionId: "codex-effective-one",
  rootNativeSessionId: "codex-root-one",
  revision: "8",
} as const;

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "aiw-preview-manager-"));
  roots.push(root);
  const worktree = join(root, "worktree");
  const store = join(root, "store");
  await mkdir(worktree);
  await writeFile(
    join(worktree, "preview.mjs"),
    `import http from "node:http";
const host = process.env.HOST;
const port = Number(process.env.PORT);
const mode = process.argv[2] ?? "healthy";
const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.statusCode = mode === "healthy" ? 200 : 503;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: mode === "healthy" }));
    return;
  }
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end("<!doctype html><title>Preview fixture</title><main>exact worktree preview</main>");
});
server.listen(port, host);
`,
  );
  const binding: PreviewWorkstreamBinding = {
    workstreamId: "workstream-one",
    workstreamRevision: 4,
    repository,
    agent,
    worktreeId: "worktree-one",
    worktreeState: "dirty",
    worktreePath: worktree,
  };
  const resolveWorkstream = vi.fn(async () => binding);
  const service = new PreviewManagerService({
    directory: store,
    resolveWorkstream,
    startupTimeoutMs: 1_000,
    healthPollMs: 20,
  });
  services.push(service);
  return { root, worktree, store, binding, resolveWorkstream, service };
}

function recipe(
  executable = process.execPath,
  args: readonly string[] = ["preview.mjs", "healthy"],
) {
  return {
    requestId: "approve-recipe-one",
    correlationId: "approve-correlation-one",
    recipeId: "preview-web",
    expectedRevision: null,
    repositoryId: repository.repositoryId,
    label: "Web development preview",
    executable,
    args,
    readinessPath: "/health",
    browserPath: "/",
  } as const;
}

function start(
  values: Partial<Parameters<PreviewManagerService["start"]>[0]> = {},
) {
  return {
    requestId: "start-preview-one",
    correlationId: "start-correlation-one",
    workstreamId: "workstream-one",
    expectedWorkstreamRevision: 4,
    repository,
    agent,
    recipeId: "preview-web",
    expectedRecipeRevision: 1,
    ...values,
  };
}

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.dispose()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("PreviewManagerService", () => {
  it("launches only an approved recipe in the exact Workstream worktree and stops its owned process", async () => {
    const value = await fixture();
    const approved = await value.service.approveRecipe(recipe());
    expect(approved).toMatchObject({
      replayed: false,
      recipe: {
        schema: "aiw.preview-recipe/1",
        recipeId: "preview-web",
        revision: 1,
        repositoryId: repository.repositoryId,
      },
    });

    const launched = await value.service.start(start());
    expect(value.resolveWorkstream).toHaveBeenCalledWith(
      expect.objectContaining({
        workstreamId: "workstream-one",
        expectedWorkstreamRevision: 4,
        repository,
        agent,
      }),
    );
    expect(launched).toMatchObject({
      replayed: false,
      preview: {
        schema: "aiw.preview-record/1",
        state: "ready",
        workstreamId: "workstream-one",
        workstreamRevision: 4,
        worktreeId: "worktree-one",
        worktreeState: "dirty",
        recipeId: "preview-web",
        recipeRevision: 1,
        host: "127.0.0.1",
        health: { ok: true, status: 200 },
      },
    });
    expect(launched.preview.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/u);
    expect(await (await fetch(launched.preview.url!)).text()).toContain(
      "exact worktree preview",
    );
    expect(JSON.stringify(await value.service.current())).not.toContain(
      value.worktree,
    );

    const stopped = await value.service.stop({
      requestId: "stop-preview-one",
      correlationId: "stop-correlation-one",
      workstreamId: "workstream-one",
      expectedPreviewRevision: launched.preview.revision,
    });
    expect(stopped).toMatchObject({
      replayed: false,
      preview: { state: "stopped", portClosed: true },
    });
    await expect(fetch(launched.preview.url!)).rejects.toThrow();
  });

  it("keeps a healthy preview as explicitly previous verified when a replacement fails", async () => {
    const value = await fixture();
    await value.service.approveRecipe(recipe());
    const first = await value.service.start(start());

    await value.service.approveRecipe({
      ...recipe(process.execPath, ["preview.mjs", "unhealthy"]),
      requestId: "approve-recipe-two",
      correlationId: "approve-correlation-two",
      expectedRevision: 1,
    });
    const failed = await value.service.start(
      start({
        requestId: "start-preview-two",
        correlationId: "start-correlation-two",
        expectedRecipeRevision: 2,
      }),
    );
    expect(failed.preview.state).toBe("failed");

    const projection = await value.service.current();
    expect(projection).toMatchObject({
      latestAttempt: { state: "failed", recipeRevision: 2 },
      display: {
        truth: "previous-verified",
        preview: { previewId: first.preview.previewId, state: "ready" },
      },
    });
    expect(await (await fetch(first.preview.url!)).text()).toContain(
      "exact worktree preview",
    );
  });

  it("rejects unapproved or stale recipe and Workstream authority before spawning", async () => {
    const value = await fixture();
    await expect(value.service.start(start())).rejects.toMatchObject({
      code: "recipe-not-found",
    });
    await value.service.approveRecipe(recipe());
    await expect(
      value.service.start(start({ expectedRecipeRevision: 2 })),
    ).rejects.toMatchObject({ code: "recipe-revision-conflict" });

    value.resolveWorkstream.mockRejectedValueOnce(
      Object.assign(new Error("Workstream revision changed"), {
        code: "workstream-mismatch",
      }),
    );
    await expect(value.service.start(start())).rejects.toMatchObject({
      code: "workstream-mismatch",
    });
    expect((await value.service.current()).latestAttempt).toBeNull();
  });

  it("reports an unavailable approved executable as a failed preview without hanging", async () => {
    const value = await fixture();
    await value.service.approveRecipe(
      recipe(join(value.root, "missing-preview-executable"), ["{port}"]),
    );

    await expect(value.service.start(start())).resolves.toMatchObject({
      preview: {
        state: "failed",
        portClosed: true,
        error: expect.stringMatching(/ENOENT|spawn|healthy/u),
      },
    });
  }, 3_000);

  it("stops an owned preview when its Workstream lifecycle closes", async () => {
    const value = await fixture();
    await value.service.approveRecipe(recipe());
    const launched = await value.service.start(start());

    await expect(
      value.service.stopForWorkstream("workstream-other"),
    ).resolves.toBe(false);
    expect((await value.service.current()).active?.state).toBe("ready");
    await expect(
      value.service.stopForWorkstream("workstream-one"),
    ).resolves.toBe(true);
    expect((await value.service.current()).active).toBeNull();
    await expect(fetch(launched.preview.url!)).rejects.toThrow();
  });

  it("recovers persisted running truth as interrupted without signaling the stale pid", async () => {
    const value = await fixture();
    await value.service.approveRecipe(recipe());
    const launched = await value.service.start(start());
    expect(await exists(value.store)).toBe(true);

    const restarted = new PreviewManagerService({
      directory: value.store,
      resolveWorkstream: value.resolveWorkstream,
    });
    services.push(restarted);
    const recovered = await restarted.current();
    expect(recovered.latestAttempt).toMatchObject({
      previewId: launched.preview.previewId,
      state: "failed",
      recovered: true,
      error: "Preview process ownership was interrupted by restart.",
    });
    await expect(restarted.start(start())).resolves.toMatchObject({
      replayed: true,
      preview: {
        previewId: launched.preview.previewId,
        state: "failed",
        recovered: true,
      },
    });
    expect(await (await fetch(launched.preview.url!)).text()).toContain(
      "exact worktree preview",
    );
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  PreviewManagerClient,
  type PreviewProjection,
  type PreviewRecipe,
} from "../src/world-entry/preview-manager-client.js";
import type { WorkstreamApiRecord } from "../src/world-entry/workstream-client.js";

const recipe: PreviewRecipe = {
  schema: "aiw.preview-recipe/1",
  recipeId: "web-preview",
  revision: 3,
  repositoryId: "repo-1",
  label: "Web preview",
  executable: "pnpm",
  args: ["preview", "--host", "{host}", "--port", "{port}"],
  readinessPath: "/",
  browserPath: "/result",
  approvedAt: "2026-09-03T20:00:00.000Z",
};

const preview = {
  schema: "aiw.preview-record/1" as const,
  previewId: "preview-1",
  revision: 5,
  state: "ready" as const,
  workstreamId: "workstream-1",
  workstreamRevision: 7,
  repository: { repositoryId: "repo-1", revision: "repo-r1" },
  agent: {
    agentId: "agent-1",
    nativeSessionId: "native-1",
    rootNativeSessionId: "root-1",
    revision: "agent-r1",
  },
  worktreeId: "worktree-1",
  worktreeState: "current" as const,
  recipeId: "web-preview",
  recipeRevision: 3,
  host: "127.0.0.1" as const,
  port: 43123,
  pid: 1234,
  url: "http://127.0.0.1:43123/result",
  health: {
    ok: true as const,
    status: 200,
    checkedAt: "2026-09-03T20:01:00.000Z",
  },
  logs: "ready",
  logsTruncated: false,
  startedAt: "2026-09-03T20:00:30.000Z",
  readyAt: "2026-09-03T20:01:00.000Z",
  stoppedAt: null,
  portClosed: null,
  recovered: false,
  error: null,
};

const projection: PreviewProjection = {
  schema: "aiw.preview-manager/1",
  active: preview,
  latestAttempt: preview,
  previousVerified: null,
  display: { truth: "current", preview },
};

const workstream: WorkstreamApiRecord = {
  schema: "aiw.workstream/1",
  workstreamId: "workstream-1",
  revision: 7,
  title: "World View",
  task: "Show it in World",
  repository: { repositoryId: "repo-1", revision: "repo-r1" },
  agent: {
    agentId: "agent-1",
    nativeSessionId: "native-1",
    rootNativeSessionId: "root-1",
    revision: "agent-r1",
  },
  authority: {
    schema: "aiw.worktree-authority-receipt/1",
    ownerId: "workstream-1",
    requestId: "create-1",
    worktreeId: "worktree-1",
    repositoryId: "repo-1",
    relativePath: ".worktrees/workstream-1",
    branch: "feat/world-view",
    head: "abc123",
    state: "current",
    statusSummary: "clean",
    validatedAt: "2026-09-03T20:00:00.000Z",
    attestation: "attestation-1",
  },
  worktreeState: "current",
  evidenceOperationRefs: [],
  projection: {
    currentActivity: "Ready",
    changedFiles: [],
    diff: { summary: "", patch: "", truncated: false },
    validation: [],
    evidenceRefs: [],
  },
  status: "working",
  createdAt: "2026-09-03T20:00:00.000Z",
  updatedAt: "2026-09-03T20:00:00.000Z",
  events: [],
};

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("World View Preview Manager client", () => {
  it("reads approved recipes and exact current display truth", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(ok([recipe]))
      .mockResolvedValueOnce(ok(projection));
    const client = new PreviewManagerClient(fetcher);

    await expect(client.recipes("repo-1")).resolves.toEqual([recipe]);
    await expect(client.current("workstream-1")).resolves.toEqual(projection);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/preview-recipes?repositoryId=repo-1",
      "/api/workstreams/workstream-1/previews/current",
    ]);
  });

  it("starts only the selected approved recipe with exact Workstream authority", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(ok({ preview, replayed: false }, 201));
    const client = new PreviewManagerClient(fetcher, () => "request-1");

    await expect(client.start(workstream, recipe)).resolves.toEqual({
      preview,
      replayed: false,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("/api/workstreams/workstream-1/previews");
    expect(JSON.parse(String(init?.body))).toEqual({
      requestId: "request-1",
      correlationId: "request-1",
      expectedWorkstreamRevision: 7,
      repository: workstream.repository,
      agent: workstream.agent,
      recipeId: "web-preview",
      expectedRecipeRevision: 3,
    });
    expect(String(init?.body)).not.toMatch(
      /executable|args|cwd|environment|relativePath|branch|head/,
    );
  });

  it("rejects a malformed external projection instead of inventing display truth", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      ok({
        ...projection,
        display: {
          truth: "current",
          preview: { ...preview, url: "https://example.com" },
        },
      }),
    );

    await expect(
      new PreviewManagerClient(fetcher).current("workstream-1"),
    ).rejects.toThrow("Invalid Preview Manager response");
  });
});

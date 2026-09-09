import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RepositoryAssetPalette } from "../src/world-entry/RepositoryAssetPalette.js";
import { WorldView } from "../src/world-entry/WorldView.js";
import { resolveWorldViewLauncher } from "../src/world-entry/world-view-model.js";
import { WorldWorkstreamStatus } from "../src/world-entry/WorkInspector.js";
import type { PreviewProjection } from "../src/world-entry/preview-manager-client.js";
import type { Workstream } from "../src/world-entry/workstream-tracer.js";

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

const workstream: Workstream = {
  workstreamId: "workstream-1",
  title: "Render World View",
  status: "working",
  plan: [],
  currentActivity: "Preview ready",
  changedFiles: [],
  validation: [],
  assetLinks: [],
  createdAt: "2026-09-03T20:00:00.000Z",
  updatedAt: "2026-09-03T20:01:00.000Z",
  authority: {
    schema: "aiw.workstream/1",
    workstreamId: "workstream-1",
    revision: 7,
    title: "Render World View",
    task: "Show it in World",
    repository: { repositoryId: "repo-1", revision: "repo-r1" },
    agent: preview.agent,
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
      currentActivity: "Preview ready",
      changedFiles: [],
      diff: { summary: "", patch: "", truncated: false },
      validation: [],
      evidenceRefs: [],
    },
    status: "working",
    createdAt: "2026-09-03T20:00:00.000Z",
    updatedAt: "2026-09-03T20:01:00.000Z",
    events: [],
  },
};

const projection = (
  truth: "current" | "previous-verified",
): PreviewProjection => ({
  schema: "aiw.preview-manager/1",
  active: preview,
  latestAttempt: preview,
  previousVerified: truth === "previous-verified" ? preview : null,
  display: { truth, preview },
});

describe("World View", () => {
  it("offers Refresh preview on the visible screen without another approval", () => {
    const html = renderToStaticMarkup(
      createElement(WorldView, {
        workstream,
        projection: projection("current"),
        onInputOwnerChange: () => undefined,
        onRefresh: () => undefined,
        refreshPending: false,
      }),
    );
    expect(html).toContain("Refresh preview");
    expect(html).toContain("Preview recipe already approved");
  });
  it("offers accessible spatial toggles for all three existing surfaces", () => {
    const surfaces = [
      {
        id: "director",
        label: "Live / Director",
        element: createElement(RepositoryAssetPalette, {
          mode: "live",
          selected: null,
          onMode: () => undefined,
          onPlace: () => undefined,
        }),
      },
      {
        id: "workbench",
        label: "Workbench",
        element: createElement(WorldWorkstreamStatus, {
          workstream,
          open: false,
          pending: false,
          message: null,
          onInspect: () => undefined,
          onCancel: () => undefined,
        }),
      },
      {
        id: "preview",
        label: "World View",
        element: createElement(WorldView, {
          workstream,
          projection: projection("current"),
          onInputOwnerChange: () => undefined,
        }),
      },
    ];
    for (const surface of surfaces) {
      const html = renderToStaticMarkup(surface.element);
      expect(html).toContain(`data-world-screen="${surface.id}"`);
      expect(html).toContain(`Place ${surface.label} in World`);
      expect(html).toContain('data-screen-mode="hud"');
    }
  });

  it("renders the exact current Preview Manager display as an embedded view-only screen", () => {
    const html = renderToStaticMarkup(
      createElement(WorldView, {
        workstream,
        projection: projection("current"),
        iterationStatus: {
          state: "updating",
          message:
            "Updating from visual feedback · preview revision 5 remains verified.",
        },
        onInputOwnerChange: () => undefined,
      }),
    );

    expect(html).toContain('aria-label="World View"');
    expect(html).toContain('data-preview-truth="current"');
    expect(html).toContain("Render World View");
    expect(html).toContain("repo-1");
    expect(html).toContain("feat/world-view");
    expect(html).toContain("worktree-1");
    expect(html).toContain("Preview revision 5");
    expect(html).toContain('dateTime="2026-09-03T20:01:00.000Z"');
    expect(html).toContain('src="http://127.0.0.1:43123/result"');
    expect(html).toContain('title="World View preview: Render World View"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('class="world-view__input-shield"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Expand World View");
    expect(html).toContain("Current verified preview");
    expect(html).toContain('data-iteration-state="updating"');
    expect(html).toContain(
      "Updating from visual feedback · preview revision 5 remains verified.",
    );
    expect(html).not.toContain("Interact with preview");
  });

  it("renders enabled-blue and disabled-grey World View launcher truth", () => {
    const base = {
      workstream,
      open: false,
      pending: false,
      message: null,
      onInspect: () => undefined,
      onCancel: () => undefined,
    };
    const enabled = renderToStaticMarkup(
      createElement(WorldWorkstreamStatus, {
        ...base,
        worldViewAction: {
          label: "Start World View",
          enabled: true,
          onStart: () => undefined,
        },
      }),
    );
    const unavailable = renderToStaticMarkup(
      createElement(WorldWorkstreamStatus, {
        ...base,
        worldViewAction: {
          label: "World View unavailable — no approved preview recipe.",
          enabled: false,
          onStart: () => undefined,
        },
      }),
    );

    expect(enabled).toMatch(
      /class="world-action--enabled"[^>]*>Start World View</,
    );
    expect(enabled).not.toMatch(/<button[^>]*disabled[^>]*>Start World View</);
    expect(unavailable).toMatch(
      /class="world-action--unavailable"[^>]*disabled=""[^>]*>World View unavailable/,
    );
  });

  it("derives truthful launcher states from exact preview and Workstream authority", () => {
    const input = {
      workstream,
      recipeCount: 1,
      projection: null,
      loading: false,
      pending: false,
      unavailableReason: null,
    } as const;

    expect(resolveWorldViewLauncher(input)).toEqual({
      enabled: true,
      label: "Start World View",
    });
    expect(resolveWorldViewLauncher({ ...input, recipeCount: 0 })).toEqual({
      enabled: false,
      label: "World View unavailable — no approved preview recipe.",
    });
    expect(resolveWorldViewLauncher({ ...input, recipeCount: 2 })).toEqual({
      enabled: false,
      label: "World View unavailable — multiple approved preview recipes.",
    });
    expect(resolveWorldViewLauncher({ ...input, pending: true })).toEqual({
      enabled: false,
      label: "World View unavailable — preview action pending.",
    });
    expect(
      resolveWorldViewLauncher({
        ...input,
        unavailableReason: "Preview Manager temporarily unavailable.",
      }),
    ).toEqual({
      enabled: false,
      label:
        "World View unavailable — Preview Manager temporarily unavailable.",
    });
    expect(
      resolveWorldViewLauncher({
        ...input,
        projection: projection("current"),
      }),
    ).toEqual({
      enabled: false,
      label: "World View attached — current verified preview.",
    });
    expect(
      resolveWorldViewLauncher({
        ...input,
        projection: projection("previous-verified"),
      }),
    ).toEqual({
      enabled: true,
      label: "Refresh World View",
    });
    expect(
      resolveWorldViewLauncher({
        ...input,
        workstream: {
          ...workstream,
          status: "cancelled",
          authority: {
            ...workstream.authority!,
            worktreeState: "removed",
          },
        },
      }),
    ).toEqual({
      enabled: false,
      label:
        "World View unavailable — current owned Workstream authority required.",
    });
  });

  it("keeps a failed first preview visible without requiring an iframe", () => {
    const failed: PreviewProjection = {
      schema: "aiw.preview-manager/1",
      active: null,
      previousVerified: null,
      display: null,
      latestAttempt: {
        ...preview,
        state: "failed",
        url: null,
        logs: "Static preview unavailable: create index.html in the owned Workstream and retry.\n",
        error: "Preview did not become healthy before timeout.",
      },
    };
    const action = resolveWorldViewLauncher({
      workstream,
      recipeCount: 1,
      projection: failed,
      loading: false,
      pending: false,
      unavailableReason: null,
    });
    expect(action).toMatchObject({
      enabled: true,
      label: "Retry World View",
      message:
        "World View could not start: index.html is missing from this Workstream. Complete the coding task, then retry.",
    });
    const html = renderToStaticMarkup(
      createElement(WorldWorkstreamStatus, {
        workstream,
        open: false,
        pending: false,
        message: null,
        onInspect: () => undefined,
        onCancel: () => undefined,
        worldViewAction: { ...action, onStart: () => undefined },
      }),
    );
    expect(html).toContain("index.html is missing from this Workstream");
    expect(html).toContain("Retry World View");
  });

  it("labels retained output as previous verified instead of current", () => {
    const html = renderToStaticMarkup(
      createElement(WorldView, {
        workstream,
        projection: projection("previous-verified"),
        onInputOwnerChange: () => undefined,
      }),
    );

    expect(html).toContain('data-preview-truth="previous-verified"');
    expect(html).toContain("Previous verified preview");
    expect(html).not.toContain("Current verified preview");
  });
});

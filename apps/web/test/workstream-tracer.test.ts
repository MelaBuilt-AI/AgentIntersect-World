import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  findWorkstreamForRepositorySelection,
  loadCurrentPhase14Workstream,
  replayWorkstreamEvents,
  workstreamTracerModeFromSearch,
  type WorkstreamEvent,
} from "../src/world-entry/workstream-tracer.js";
import { WorkInspector } from "../src/world-entry/WorkInspector.js";
import type { Phase14JourneyState } from "../src/phase14/phase14-client.js";
import { projectPhase14Journey } from "../src/world-entry/workstream-tracer.js";
import {
  WorkstreamClient,
  type WorkstreamApiRecord,
} from "../src/world-entry/workstream-client.js";
import { createLiveWorkstream } from "../src/world-entry/workstream-create.js";

const events: readonly WorkstreamEvent[] = [
  {
    eventId: "event-1",
    workstreamId: "workstream-world-inspector",
    occurredAt: "2026-08-06T21:30:00.000Z",
    type: "workstream.started",
    title: "Add an in-world work inspector",
    status: "planning",
    plan: ["Project existing work state", "Render a read-only inspector"],
    assetLinks: [
      {
        repositoryPath: "apps/web/src/world-entry/RepositoryAssetPalette.tsx",
        role: "changed-file",
      },
      {
        repositoryPath: "apps/web/test/repository-asset-palette.test.tsx",
        role: "validation",
      },
    ],
  },
  {
    eventId: "event-2",
    workstreamId: "workstream-world-inspector",
    occurredAt: "2026-08-06T21:31:00.000Z",
    type: "workstream.activity-updated",
    activity: "Binding repository selection to the read-only projection.",
  },
  {
    eventId: "event-3",
    workstreamId: "workstream-world-inspector",
    occurredAt: "2026-08-06T21:32:00.000Z",
    type: "workstream.file-changed",
    file: {
      path: "apps/web/src/world-entry/RepositoryAssetPalette.tsx",
      change: "modified",
      diffSummaryRef: "diff:repository-asset-palette",
    },
  },
  {
    eventId: "event-4",
    workstreamId: "workstream-world-inspector",
    occurredAt: "2026-08-06T21:33:00.000Z",
    type: "workstream.validation-updated",
    check: {
      id: "focused-tests",
      label: "Focused tests",
      state: "running",
      summary: "Repository inspector tests are running.",
    },
  },
  {
    eventId: "event-5",
    workstreamId: "workstream-world-inspector",
    occurredAt: "2026-08-06T21:34:00.000Z",
    type: "workstream.status-updated",
    status: "validating",
  },
];

describe("single-workstream event projection", () => {
  it("replays the narrow event journal deterministically", () => {
    const first = replayWorkstreamEvents(events);
    const second = replayWorkstreamEvents(events);

    expect(second).toEqual(first);
    expect(first).toEqual({
      workstreamId: "workstream-world-inspector",
      title: "Add an in-world work inspector",
      status: "validating",
      plan: ["Project existing work state", "Render a read-only inspector"],
      currentActivity:
        "Binding repository selection to the read-only projection.",
      changedFiles: [
        {
          path: "apps/web/src/world-entry/RepositoryAssetPalette.tsx",
          change: "modified",
          diffSummaryRef: "diff:repository-asset-palette",
        },
      ],
      validation: [
        {
          id: "focused-tests",
          label: "Focused tests",
          state: "running",
          summary: "Repository inspector tests are running.",
        },
      ],
      assetLinks: [
        {
          repositoryPath: "apps/web/src/world-entry/RepositoryAssetPalette.tsx",
          role: "changed-file",
        },
        {
          repositoryPath: "apps/web/test/repository-asset-palette.test.tsx",
          role: "validation",
        },
      ],
      createdAt: "2026-08-06T21:30:00.000Z",
      updatedAt: "2026-08-06T21:34:00.000Z",
    });
  });

  it("ignores repeated event ids during reconnect replay", () => {
    expect(replayWorkstreamEvents([...events, events[2]!])).toEqual(
      replayWorkstreamEvents(events),
    );
  });

  it("fails closed when a journal mixes workstream ids", () => {
    expect(() =>
      replayWorkstreamEvents([
        ...events,
        {
          ...events[4]!,
          eventId: "event-other",
          workstreamId: "workstream-other",
        },
      ]),
    ).toThrow("Workstream event journal mixed workstream ids");
  });

  it("maps only a linked repository-city selection to its workstream", () => {
    const workstream = replayWorkstreamEvents(events)!;
    expect(
      findWorkstreamForRepositorySelection([workstream], {
        instanceId: "repository:file-palette",
        assetId: "01-code-slab",
        position: { x: 4, z: 4 },
        status: "idle",
        lifecycle: "idle",
        pinned: false,
        manual: false,
        linkedRepoData: {
          ref: "file-palette",
          path: "apps/web/src/world-entry/RepositoryAssetPalette.tsx",
        },
        sourceEvent: "file.updated",
      }),
    ).toBe(workstream);
    expect(
      findWorkstreamForRepositorySelection([workstream], {
        instanceId: "manual:1",
        assetId: "01-code-slab",
        position: { x: 4, z: 4 },
        status: "idle",
        lifecycle: "idle",
        pinned: false,
        manual: true,
        linkedRepoData: null,
        sourceEvent: null,
      }),
    ).toBeNull();
  });

  it("renders truthful workstream details in the regular-DOM inspector", () => {
    const html = renderToStaticMarkup(
      createElement(WorkInspector, {
        workstream: replayWorkstreamEvents(events)!,
        fixture: true,
      }),
    );

    expect(html).toContain("Work Inspector");
    expect(html).toContain("Deterministic demo fixture");
    expect(html).toContain(
      "No live branch, preview, push, approval, or check result",
    );
    expect(html).toContain("Add an in-world work inspector");
    expect(html).toContain("Binding repository selection");
    expect(html).toContain("Project existing work state");
    expect(html).toContain("RepositoryAssetPalette.tsx");
    expect(html).toContain("diff:repository-asset-palette");
    expect(html).toContain("Focused tests");
    expect(html).toContain("running");
  });

  it("keeps demo and live activation explicit", () => {
    expect(workstreamTracerModeFromSearch("?workstreamTracer=demo")).toBe(
      "demo",
    );
    expect(workstreamTracerModeFromSearch("?workstreamTracer=live")).toBe(
      "live",
    );
    expect(workstreamTracerModeFromSearch("?workstreamTracer=phase14")).toBe(
      "phase14",
    );
    expect(
      workstreamTracerModeFromSearch("?workstreamTracer=other"),
    ).toBeNull();
    expect(workstreamTracerModeFromSearch("")).toBeNull();
  });
});

const apiWorkstream: WorkstreamApiRecord = {
  schema: "aiw.workstream/1",
  workstreamId: "workstream-api-one",
  revision: 1,
  title: "Bounded live Workstream",
  repository: { repositoryId: "repo-current", revision: "repo-revision-1" },
  agent: {
    agentId: "mr-fluff",
    nativeSessionId: "hermes-session-current",
    revision: "agent-revision-1",
  },
  authority: {
    schema: "aiw.worktree-authority-receipt/1",
    ownerId: "workstream/owner",
    requestId: "workstream/request",
    worktreeId: "worktree-one",
    repositoryId: "repo-current",
    relativePath: "workstream-one",
    branch: "workstream/workstream-one",
    head: "a".repeat(40),
    state: "current",
    statusSummary: "clean",
    validatedAt: "2026-08-07T00:00:00.000Z",
    attestation: "b".repeat(64),
  },
  worktreeState: "current",
  evidenceOperationRefs: [],
  status: "working",
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:01.000Z",
  events: [
    {
      eventId: "workstream-api-one/event/1",
      status: "working",
      summary: "Owned worktree is current and ready.",
      occurredAt: "2026-08-07T00:00:01.000Z",
    },
  ],
};

describe("authoritative Workstream client", () => {
  it("reads the current envelope and preserves an explicit absent state", async () => {
    const fetcher = async (input: string | URL | Request) =>
      String(input).endsWith("/current")
        ? new Response(
            JSON.stringify({
              ok: true,
              data: apiWorkstream,
              meta: {
                correlationId: "00000000-0000-4000-8000-000000000001",
                schema: "aiw.api/0.3",
              },
            }),
            { status: 200 },
          )
        : new Response(
            JSON.stringify({
              ok: false,
              error: { code: "not_found", message: "No current Workstream" },
            }),
            { status: 404 },
          );
    const client = new WorkstreamClient(fetcher as typeof fetch);

    expect(await client.current()).toEqual(apiWorkstream);
    expect(
      await new WorkstreamClient(
        (async () =>
          new Response(
            JSON.stringify({
              ok: false,
              error: { code: "not_found", message: "No current Workstream" },
            }),
            { status: 404 },
          )) as typeof fetch,
      ).current(),
    ).toBeNull();
  });

  it("sends only bounded create and ownership-bound cancel references", async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const fetcher = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      requests.push({ url: String(input), init });
      return new Response(
        JSON.stringify({
          ok: true,
          data: { workstream: apiWorkstream, replayed: false },
          meta: {
            correlationId: "00000000-0000-4000-8000-000000000002",
            schema: "aiw.api/0.3",
          },
        }),
        { status: init?.method === "POST" ? 200 : 201 },
      );
    };
    const client = new WorkstreamClient(fetcher as typeof fetch);
    await client.create({
      requestId: "request-create",
      correlationId: "correlation-create",
      title: "Bounded live Workstream",
      repository: apiWorkstream.repository,
      agent: apiWorkstream.agent,
    });
    await client.cancel(apiWorkstream, {
      requestId: "request-cancel",
      correlationId: "correlation-cancel",
    });

    expect(requests.map(({ url }) => url)).toEqual([
      "/api/workstreams",
      "/api/workstreams/workstream-api-one/cancel",
    ]);
    expect(JSON.parse(String(requests[1]!.init?.body))).toEqual({
      requestId: "request-cancel",
      correlationId: "correlation-cancel",
      expectedRevision: 1,
      repository: apiWorkstream.repository,
      agent: apiWorkstream.agent,
    });
  });

  it("maps exact authority into fresh bounded create IDs and truthful success or error state", async () => {
    const requests: unknown[] = [];
    const ids = [
      "00000000-0000-4000-8000-000000000021",
      "00000000-0000-4000-8000-000000000022",
    ];
    const success = await createLiveWorkstream(
      { repository: apiWorkstream.repository, agent: apiWorkstream.agent },
      {
        create: async (input) => {
          requests.push(input);
          return { workstream: apiWorkstream, replayed: false };
        },
      },
      () => ids.shift()!,
    );

    expect(requests).toEqual([
      {
        requestId: "create-00000000-0000-4000-8000-000000000021",
        correlationId: "00000000-0000-4000-8000-000000000022",
        title: "Repository Workstream",
        repository: apiWorkstream.repository,
        agent: apiWorkstream.agent,
      },
    ]);
    expect(success.workstream?.authority).toEqual(apiWorkstream);
    expect(success.message).toBe("Current Workstream is working.");

    const failure = await createLiveWorkstream(
      { repository: apiWorkstream.repository, agent: apiWorkstream.agent },
      {
        create: async () => Promise.reject(new Error("Exact binding is stale")),
      },
      () => "00000000-0000-4000-8000-000000000023",
    );
    expect(failure).toEqual({
      workstream: null,
      message: "Workbench error · Exact binding is stale.",
    });
  });
});

const phase14Journey: Phase14JourneyState = {
  operationId: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-08-06T20:00:00.000Z",
  updatedAt: "2026-08-06T20:05:00.000Z",
  status: "completed",
  step: 10,
  session: {
    adapterSessionRef: "phase14-hermes-fixture-session",
    continuity: "fixture-existing",
  },
  disposable: {
    repositoryId: "aiw://object/repository-phase14-magic-slice",
    fixtureRevision: "phase14-magic-slice/1",
    target: "src/greeting.mjs",
    symbol: "greeting",
  },
  events: [
    {
      eventId: "22222222-2222-4222-8222-222222222222",
      operation: "test",
      state: "succeeded",
      sequence: 8,
      occurredAt: "2026-08-06T20:04:00.000Z",
    },
  ],
  explanation: null,
  edit: {
    outcome: "applied",
    diff: "--- previous/src/greeting.mjs\n+++ current/src/greeting.mjs",
    patchDigest: "3".repeat(64),
    previousHash: "8".repeat(64),
    currentHash: "a".repeat(64),
    previousEvidenceRef: "aiw://evidence/source-previous",
    currentEvidenceRef: "aiw://evidence/diff-current",
    error: null,
  },
  approval: null,
  test: {
    state: "succeeded",
    argv: ["/usr/bin/node", "--test", "test/greeting.test.mjs"],
    stdout: "# pass 1",
    stderr: "",
    stdoutTruncated: false,
    stderrTruncated: false,
    exitCode: 0,
    signal: null,
    timedOut: false,
    startedAt: "2026-08-06T20:03:00.000Z",
    finishedAt: "2026-08-06T20:04:00.000Z",
    evidenceRef: "aiw://evidence/test-current",
  },
  preview: null,
  evidenceRefs: ["aiw://evidence/diff-current", "aiw://evidence/test-current"],
};

describe("Phase 14 current journey projection", () => {
  it("projects only authoritative edit and validation facts", () => {
    expect(projectPhase14Journey(phase14Journey)).toEqual({
      workstreamId: "11111111-1111-4111-8111-111111111111",
      title: "Phase 14 bounded journey · src/greeting.mjs",
      status: "completed",
      plan: [
        "Phase 14 bounded stages · attach, read, and explain the fixture target.",
        "Phase 14 bounded stages · preview and explicitly approve the exact edit.",
        "Phase 14 bounded stages · apply the edit and run the focused test.",
        "Phase 14 bounded stages · verify, stop, and correlate loopback preview evidence.",
      ],
      currentActivity: "Phase 14 test succeeded.",
      changedFiles: [
        {
          path: "src/greeting.mjs",
          change: "modified",
          diffSummaryRef: "aiw://evidence/diff-current",
        },
      ],
      validation: [
        {
          id: "phase14-focused-test",
          label: "Phase 14 focused test",
          state: "passed",
          summary: "State succeeded · exit 0 · timed out no.",
        },
      ],
      assetLinks: [{ repositoryPath: "src/greeting.mjs", role: "workstream" }],
      createdAt: "2026-08-06T20:00:00.000Z",
      updatedAt: "2026-08-06T20:05:00.000Z",
    });
  });

  it("shows active test execution without inferring completion", () => {
    const projected = projectPhase14Journey({
      ...phase14Journey,
      status: "active",
      updatedAt: "2026-08-06T20:03:30.000Z",
      events: [
        {
          ...phase14Journey.events[0]!,
          state: "running",
          occurredAt: "2026-08-06T20:03:30.000Z",
        },
      ],
      edit: { ...phase14Journey.edit!, currentEvidenceRef: null },
      test: {
        ...phase14Journey.test!,
        state: "running",
        exitCode: null,
        timedOut: false,
        finishedAt: null,
        evidenceRef: null,
      },
    });

    expect(projected?.status).toBe("validating");
    expect(projected?.currentActivity).toBe("Phase 14 test running.");
    expect(projected?.changedFiles).toEqual([]);
    expect(projected?.validation).toEqual([
      {
        id: "phase14-focused-test",
        label: "Phase 14 focused test",
        state: "running",
        summary: "State running · exit unavailable · timed out no.",
      },
    ]);
  });

  it("returns no workstream when current journey identity is absent", () => {
    expect(
      projectPhase14Journey({
        ...phase14Journey,
        operationId: null,
        createdAt: null,
        updatedAt: null,
        disposable: null,
      }),
    ).toBeNull();
  });

  it("loads through only the supplied read-only current journey function", async () => {
    let reads = 0;
    const projected = await loadCurrentPhase14Workstream(async () => {
      reads += 1;
      return phase14Journey;
    });

    expect(reads).toBe(1);
    expect(projected?.workstreamId).toBe(phase14Journey.operationId);
  });

  it("preserves current-endpoint failures for truthful UI handling", async () => {
    await expect(
      loadCurrentPhase14Workstream(async () => {
        throw new Error("Phase 14 endpoint disabled");
      }),
    ).rejects.toThrow("Phase 14 endpoint disabled");
  });

  it("labels the authoritative live inspector separately from demo", () => {
    const html = renderToStaticMarkup(
      createElement(WorkInspector, {
        workstream: projectPhase14Journey(phase14Journey)!,
        source: "phase14",
      }),
    );

    expect(html).toContain("Authoritative Phase 14 read-only projection");
    expect(html).toContain("No Phase 14 action is available here");
    expect(html).not.toContain("Deterministic demo fixture");
  });
});

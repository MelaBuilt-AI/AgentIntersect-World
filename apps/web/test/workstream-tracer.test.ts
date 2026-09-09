import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  findWorkstreamForRepositorySelection,
  loadCurrentPhase14Workstream,
  projectAuthoritativeWorkstream,
  replayWorkstreamEvents,
  workstreamTracerModeFromSearch,
  type WorkstreamEvent,
} from "../src/world-entry/workstream-tracer.js";
import { WorkInspector } from "../src/world-entry/WorkInspector.js";
import * as workInspectorModule from "../src/world-entry/WorkInspector.js";
import type { Phase14JourneyState } from "../src/phase14/phase14-client.js";
import { projectPhase14Journey } from "../src/world-entry/workstream-tracer.js";
import {
  WorkstreamClient,
  type WorkstreamApiRecord,
} from "../src/world-entry/workstream-client.js";
import {
  createLiveWorkstream,
  resolveWorkstreamTask,
} from "../src/world-entry/workstream-create.js";
import * as workstreamCreateModule from "../src/world-entry/workstream-create.js";

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
    rootNativeSessionId: "hermes-session-root",
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
  task: "Make repository-city collisions non-blocking for the agent avatar.",
  projection: {
    currentActivity: "Running the focused collision regression.",
    changedFiles: [
      {
        path: "apps/web/src/world-entry/WorldRoom.tsx",
        change: "modified",
        diffSummary: "12 insertions, 4 deletions",
      },
    ],
    diff: {
      summary: "1 file changed, 12 insertions(+), 4 deletions(-)",
      patch: "@@ -10,2 +10,4 @@",
      truncated: false,
    },
    validation: [
      {
        command: "pnpm vitest run collision.test.ts",
        exitCode: 0,
        summary: "1 test passed",
      },
    ],
    evidenceRefs: ["agent-event:event-1", "report:validation-1"],
  },
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
  it("executes create, exact-bound continue, inspect, and cancel through existing authority", async () => {
    type Execute = (
      action:
        | { readonly action: "inspect" | "cancel"; readonly text: string }
        | {
            readonly action: "request";
            readonly text: string;
            readonly task: string;
          },
      authority: {
        repository: WorkstreamApiRecord["repository"];
        agent: WorkstreamApiRecord["agent"];
      } | null,
      client: Pick<
        WorkstreamClient,
        "current" | "create" | "iterate" | "cancel"
      >,
      enqueue: (text: string, agentId: string) => void,
      id: () => string,
    ) => Promise<{
      readonly workstream: ReturnType<
        typeof projectAuthoritativeWorkstream
      > | null;
      readonly message: string | null;
      readonly openInspector: boolean;
      readonly continued: boolean;
    }>;
    const execute = (
      workstreamCreateModule as typeof workstreamCreateModule & {
        executeWorkstreamConversation?: Execute;
      }
    ).executeWorkstreamConversation;
    expect(execute).toBeTypeOf("function");
    if (!execute) return;

    let current: WorkstreamApiRecord | null = null;
    const create = vi.fn(async () => ({
      workstream: apiWorkstream,
      replayed: false,
    }));
    const cancel = vi.fn(async () => ({
      workstream: { ...apiWorkstream, status: "cancelled" as const },
      replayed: false,
    }));
    const iterate = vi.fn(async () => ({
      workstream: { ...apiWorkstream, revision: apiWorkstream.revision + 1 },
      replayed: false,
    }));
    const client = {
      current: vi.fn(async () => current),
      create,
      iterate,
      cancel,
    };
    const enqueue = vi.fn();
    let nextId = 0;
    const id = () =>
      `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`;
    const authority = {
      repository: apiWorkstream.repository,
      agent: apiWorkstream.agent,
    };

    const created = await execute(
      { action: "request", text: "Build it", task: "Build it" },
      authority,
      client,
      enqueue,
      id,
    );
    expect(created).toMatchObject({
      workstream: { workstreamId: apiWorkstream.workstreamId },
      message: "Current Workstream is working.",
      openInspector: false,
      continued: false,
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(enqueue).not.toHaveBeenCalled();

    current = apiWorkstream;
    const continued = await execute(
      { action: "request", text: "Change it", task: "Change it" },
      authority,
      client,
      enqueue,
      id,
    );
    expect(continued).toMatchObject({
      workstream: { workstreamId: apiWorkstream.workstreamId },
      message: null,
      openInspector: false,
      continued: true,
    });
    expect(enqueue).toHaveBeenCalledWith(
      "Change it",
      apiWorkstream.agent.agentId,
    );
    expect(iterate).toHaveBeenCalledWith(
      apiWorkstream,
      "Change it",
      expect.objectContaining({
        requestId: expect.stringMatching(/^iterate-/u),
        correlationId: expect.any(String),
      }),
    );
    expect(create).toHaveBeenCalledTimes(1);

    const inspected = await execute(
      { action: "inspect", text: "inspect current workstream" },
      authority,
      client,
      enqueue,
      id,
    );
    expect(inspected).toMatchObject({
      workstream: { workstreamId: apiWorkstream.workstreamId },
      message: "Current Workstream is working.",
      openInspector: true,
      continued: false,
    });

    const cancelled = await execute(
      { action: "cancel", text: "cancel current workstream" },
      authority,
      client,
      enqueue,
      id,
    );
    expect(cancel).toHaveBeenCalledWith(
      apiWorkstream,
      expect.objectContaining({
        requestId: expect.stringMatching(/^cancel-/u),
        correlationId: expect.any(String),
      }),
    );
    expect(cancelled).toMatchObject({
      workstream: { status: "cancelled" },
      message: "Current Workstream is cancelled.",
      openInspector: true,
      continued: false,
    });
  });

  it("renders one compact normal-World Workstream surface and optional Inspector", () => {
    const Status = (
      workInspectorModule as typeof workInspectorModule & {
        WorldWorkstreamStatus?: typeof WorkInspector;
      }
    ).WorldWorkstreamStatus;
    expect(Status).toBeTypeOf("function");
    if (!Status) return;

    const compact = renderToStaticMarkup(
      createElement(Status as never, {
        workstream: projectAuthoritativeWorkstream(apiWorkstream),
        open: false,
        pending: false,
        message: "Current Workstream is working.",
        onInspect: () => undefined,
        onCancel: () => undefined,
      }),
    );
    expect(compact).toContain('aria-label="Current Workstream"');
    expect(compact).toContain("Workbench · working");
    expect(compact).toContain("Inspect current Workstream");
    expect(compact).toContain('aria-expanded="false"');
    expect(compact).not.toContain("Work Inspector</h2>");
    expect(compact).not.toContain("Authoritative Workbench");
    expect(compact).not.toContain("Repository Asset Palette");

    const expanded = renderToStaticMarkup(
      createElement(Status as never, {
        workstream: projectAuthoritativeWorkstream(apiWorkstream),
        open: true,
        pending: false,
        message: null,
        onInspect: () => undefined,
        onCancel: () => undefined,
      }),
    );
    expect(expanded).toContain('aria-expanded="true"');
    expect(expanded).toContain("Close Work Inspector");
    expect(expanded).toContain("Work Inspector</h2>");
    expect(expanded).toContain("Cancel Workstream");
  });

  it("resolves a feature request to one create or exact-bound continuation", () => {
    const resolve = (
      workstreamCreateModule as typeof workstreamCreateModule & {
        resolveWorkstreamConversationRequest?: (
          workstream: WorkstreamApiRecord | null,
          authority: {
            repository: WorkstreamApiRecord["repository"];
            agent: WorkstreamApiRecord["agent"];
          } | null,
          task: string,
        ) => unknown;
      }
    ).resolveWorkstreamConversationRequest;
    expect(resolve).toBeTypeOf("function");
    if (!resolve) return;

    const authority = {
      repository: apiWorkstream.repository,
      agent: apiWorkstream.agent,
    };
    expect(resolve(null, authority, "Add keyboard navigation.")).toEqual({
      kind: "create",
      task: "Add keyboard navigation.",
    });
    expect(
      resolve(
        apiWorkstream,
        {
          ...authority,
          agent: {
            ...authority.agent,
            agentId: "new-world-agent",
            rootNativeSessionId: "new-root",
          },
        },
        "Create a new homepage.",
      ),
    ).toEqual({ kind: "create", task: "Create a new homepage." });
    expect(resolve(apiWorkstream, authority, "Change it to blue.")).toEqual({
      kind: "continue",
      task: "Change it to blue.",
      agentId: apiWorkstream.agent.agentId,
    });
    expect(
      resolve(
        apiWorkstream,
        {
          ...authority,
          repository: { ...authority.repository, revision: "stale" },
        },
        "Change it to blue.",
      ),
    ).toEqual({
      kind: "unavailable",
      message:
        "Current Workstream authority is stale. Reload the repository or reconnect its agent.",
    });
    expect(
      resolve(
        { ...apiWorkstream, status: "cleanup-required" },
        authority,
        "Start another change.",
      ),
    ).toEqual({
      kind: "unavailable",
      message: "Current Workstream needs cleanup before more work can start.",
    });
    expect(
      resolve(
        { ...apiWorkstream, status: "cancelled" },
        authority,
        "Start another change.",
      ),
    ).toEqual({ kind: "create", task: "Start another change." });
    expect(resolve(null, null, "Add keyboard navigation.")).toEqual({
      kind: "unavailable",
      message:
        "Load a repository and connect one agent before starting a Workstream.",
    });
  });

  it("captures only the latest bounded World user task after its turn finishes", () => {
    const transcript = [
      { id: "u1", kind: "user" as const, text: "Explain the repository." },
      { id: "a1", kind: "assistant" as const, text: "It is a monorepo." },
      {
        id: "u2",
        kind: "user" as const,
        text: "  Make the agent avatar stop colliding with repository objects.  ",
      },
      { id: "a2", kind: "assistant" as const, text: "I can inspect that." },
    ];

    expect(resolveWorkstreamTask(transcript, false)).toEqual({
      task: "Make the agent avatar stop colliding with repository objects.",
      unavailableReason: null,
    });
    expect(resolveWorkstreamTask(transcript, true)).toEqual({
      task: null,
      unavailableReason: "Wait for the current agent turn to finish.",
    });
    expect(
      resolveWorkstreamTask(
        [{ id: "a", kind: "assistant", text: "No user task." }],
        false,
      ),
    ).toEqual({
      task: null,
      unavailableReason: "Send a feature request in World chat first.",
    });
    expect(
      resolveWorkstreamTask(
        [{ id: "u", kind: "user", text: "x".repeat(2_001) }],
        false,
      ),
    ).toEqual({
      task: null,
      unavailableReason:
        "The latest feature request is too long for a Workstream.",
    });
  });

  it("projects authoritative Git, validation, and evidence facts", () => {
    const projected = projectAuthoritativeWorkstream(apiWorkstream);

    expect(projected).toMatchObject({
      title: "Bounded live Workstream",
      plan: [
        "Task: Make repository-city collisions non-blocking for the agent avatar.",
      ],
      currentActivity: "Running the focused collision regression.",
      changedFiles: [
        {
          path: "apps/web/src/world-entry/WorldRoom.tsx",
          change: "modified",
          diffSummaryRef: "12 insertions, 4 deletions",
        },
      ],
      validation: [
        {
          label: "pnpm vitest run collision.test.ts",
          state: "passed",
          summary: "Exit 0 · 1 test passed",
        },
      ],
      diff: apiWorkstream.projection.diff,
      evidenceRefs: apiWorkstream.projection.evidenceRefs,
    });
  });

  it("renders cancelled and removed authority as terminal and unavailable", () => {
    const html = renderToStaticMarkup(
      createElement(WorkInspector, {
        workstream: {
          ...replayWorkstreamEvents(events)!,
          status: "cancelled",
          authority: {
            ...apiWorkstream,
            status: "cancelled",
            worktreeState: "removed",
          },
        },
        source: "live",
        onCancel: () => undefined,
      }),
    );

    expect(html).toContain(
      "Workstream cancelled. The owned worktree was removed.",
    );
    expect(html).toContain("Cancel unavailable — Workstream is cancelled.");
    expect(html).toContain('disabled=""');
  });

  it("uses the browser receiver for its default fetch", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "not_found", message: "No current Workstream" },
          }),
          { status: 404 },
        ),
      );
    } as typeof fetch;

    try {
      await expect(new WorkstreamClient().current()).resolves.toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

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
      task: "Make repository-city collisions non-blocking.",
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
      "Make the agent avatar stop colliding with repository objects.",
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
        title: "Make the agent avatar stop colliding with repository objects.",
        task: "Make the agent avatar stop colliding with repository objects.",
        repository: apiWorkstream.repository,
        agent: apiWorkstream.agent,
      },
    ]);
    expect(success.workstream?.authority).toEqual(apiWorkstream);
    expect(success.message).toBe("Current Workstream is working.");

    const failure = await createLiveWorkstream(
      { repository: apiWorkstream.repository, agent: apiWorkstream.agent },
      "Make the agent avatar stop colliding with repository objects.",
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

  it("uses the browser receiver for default Workstream IDs", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      crypto,
      "randomUUID",
    );
    const ids = [
      "00000000-0000-4000-8000-000000000024",
      "00000000-0000-4000-8000-000000000025",
    ];
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: function (this: unknown) {
        if (this !== crypto) throw new TypeError("Illegal invocation");
        return ids.shift()!;
      },
    });

    try {
      await expect(
        createLiveWorkstream(
          { repository: apiWorkstream.repository, agent: apiWorkstream.agent },
          "Make the agent avatar stop colliding with repository objects.",
          {
            create: async () => ({
              workstream: apiWorkstream,
              replayed: false,
            }),
          },
        ),
      ).resolves.toMatchObject({
        message: "Current Workstream is working.",
      });
    } finally {
      if (originalDescriptor)
        Object.defineProperty(crypto, "randomUUID", originalDescriptor);
      else delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
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

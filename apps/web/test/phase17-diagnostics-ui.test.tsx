import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WORLD_CATEGORIES } from "../src/shell/categories.js";
import { DiagnosticsPanel } from "../src/diagnostics/DiagnosticsPanel.js";
import {
  deleteDiagnosticExport,
  type DiagnosticProjection,
} from "../src/diagnostics/diagnostics-client.js";

const capabilities = [
  "session",
  "tool",
  "world-action",
  "preview",
  "voice",
  "worktree",
  "yjs",
  "sqlite",
] as const;
const projection: DiagnosticProjection = {
  schema: "aiw.observability-projection/0.17",
  truth: "current",
  recoverySource: "current",
  preservedCorruptCurrent: null,
  previous: null,
  current: {
    schema: "aiw.observability/0.17",
    revision: 1,
    truth: "current",
    repositoryId: "repo-fixture",
    sessionId: "phase17-fixture",
    generatedAt: "2026-07-23T00:00:01.000Z",
    currentState:
      "Degraded: World-owned operation interrupted/orphaned; no completion fabricated.",
    previousVerifiedState: "Healthy exactly-two-agent coordination verified.",
    lossWindow:
      "Non-derivable work may be lost after operation-started and before termination.",
    readiness: capabilities.map((capability) => ({
      capability,
      status:
        capability === "tool"
          ? ("recovery-needed" as const)
          : capability === "voice"
            ? ("unavailable" as const)
            : ("ready" as const),
      lastVerifiedAt: "2026-07-23T00:00:01.000Z",
      lastVerifiedRevision: 1,
      evidence:
        capability === "voice"
          ? "Phase 15 local STT provider is staged but unactivated."
          : `${capability} boundary evidence.`,
      permittedAction:
        capability === "tool"
          ? ("recover" as const)
          : capability === "voice"
            ? ("none" as const)
            : ("inspect" as const),
    })),
    operations: [
      {
        operationId: "operation-fixture",
        state: "orphaned",
        completionRecorded: false,
        reconciliation: "required",
        correlation: {
          repositoryId: "repo-fixture",
          sessionId: "phase17-fixture",
          agentId: "beans",
          taskId: "task-beans-doc",
          worktreeId: "worktree-beans",
          operationId: "operation-fixture",
          capability: "tool",
          revision: 1,
        },
      },
    ],
    incidents: [
      {
        incidentId: "incident-operation-fixture",
        kind: "operation-orphaned",
        status: "open",
        summary:
          "World-owned operation has no living owner and no completion evidence.",
        occurredAt: "2026-07-23T00:00:01.000Z",
        revision: 1,
        completionEvidence: false,
        correlation: {
          repositoryId: "repo-fixture",
          sessionId: "phase17-fixture",
          agentId: "beans",
          taskId: "task-beans-doc",
          worktreeId: "worktree-beans",
          operationId: "operation-fixture",
          capability: "tool",
          revision: 1,
        },
      },
    ],
  },
};

describe("Phase 17 Diagnostics & Recovery shell entry", () => {
  it("adds the lazy diagnostics category to the existing World shell", () => {
    expect(WORLD_CATEGORIES).toContain("Diagnostics");
    expect(
      renderToStaticMarkup(
        <button type="button">{WORLD_CATEGORIES.at(-2)}</button>,
      ),
    ).toContain("Diagnostics");
  });

  it("renders eight rows, exact truth labels, correlation, and six numbered controls without WebGL", () => {
    const html = renderToStaticMarkup(
      <DiagnosticsPanel
        projection={projection}
        result="Current and previous authoritative truth loaded."
        recoveryPreviewed={false}
        diagnosticPreviewId={null}
        exportId={null}
        onAction={() => undefined}
      />,
    );
    expect(html).toContain("Diagnostics &amp; Recovery");
    expect(html).toContain("Overall readiness:");
    expect(html).toContain("recovery-needed");
    expect(html).toContain("Current state");
    expect(html).toContain("Previous verified state");
    expect(html).toContain("Loss window");
    expect(
      html.match(/readiness-status readiness-status--/g) ?? [],
    ).toHaveLength(8);
    expect(html.match(/data-step="/g) ?? []).toHaveLength(6);
    for (const key of [
      "repositoryId",
      "sessionId",
      "agentId",
      "taskId",
      "worktreeId",
      "operationId",
      "capability",
      "revision",
    ])
      expect(html).toContain(key);
    expect(html).toContain("diagnostics-primary--enabled");
    expect(html).toContain("diagnostics-primary--disabled");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toMatch(/canvas|webgl/i);
  });

  it("binds UI deletion to the exact snapshot revision and export identity", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            deleted: true,
            absentAfterDelete: true,
            replayed: false,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await deleteDiagnosticExport(
        projection.current as NonNullable<DiagnosticProjection["current"]>,
        "export-preview-r1-fixture",
      );
      const [path, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(path).toBe("/api/diagnostics/exports/export-preview-r1-fixture");
      expect(JSON.parse(init.body as string)).toMatchObject({
        repositoryId: "repo-fixture",
        sessionId: "phase17-fixture",
        expectedRevision: 1,
        exportId: "export-preview-r1-fixture",
        operatorApproval: "approved",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

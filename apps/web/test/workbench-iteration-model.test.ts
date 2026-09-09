import { describe, expect, it } from "vitest";

import {
  previewIterationKey,
  resolveIterationRefresh,
} from "../src/world-entry/workbench-iteration-model.js";
import type { Workstream } from "../src/world-entry/workstream-tracer.js";

const workstream = (states: readonly ("passed" | "failed")[]): Workstream => ({
  workstreamId: "workstream-1",
  title: "Improve the preview",
  status: "working",
  plan: [],
  currentActivity: "Iteration finished",
  changedFiles: [
    {
      path: "src/App.tsx",
      change: "modified",
      diffSummaryRef: "M src/App.tsx",
    },
  ],
  validation: states.map((state, index) => ({
    id: `validation-${index}`,
    label: `pnpm test ${index}`,
    state,
    summary: state === "passed" ? "Passed" : "Failed",
  })),
  assetLinks: [],
  createdAt: "2026-09-04T12:00:00.000Z",
  updatedAt: "2026-09-04T12:01:00.000Z",
});

describe("Workbench continuous iteration", () => {
  it("detects a newer authoritative chat turn without a prose classifier or seeing its working poll", () => {
    const work = {
      ...workstream(["passed"]),
      status: "ready-for-review",
      authority: {
        revision: 9,
        events: [
          {
            eventId: "turn-2",
            status: "working",
            occurredAt: "2026-09-04T12:02:00.000Z",
          },
        ],
      },
    } as Workstream;
    expect(
      previewIterationKey(work, {
        startedAt: "2026-09-04T12:01:00.000Z",
        workstreamRevision: 7,
      }),
    ).toBe("workstream-1:turn-2");
    expect(
      previewIterationKey(work, {
        startedAt: "2026-09-04T12:03:00.000Z",
        workstreamRevision: 9,
      }),
    ).toBeNull();
  });
  it("refreshes only after reported validation passes", () => {
    expect(resolveIterationRefresh(workstream(["passed", "passed"]))).toEqual({
      ready: true,
      message: "Validation passed · refreshing World View.",
    });
    expect(resolveIterationRefresh(workstream(["passed", "failed"]))).toEqual({
      ready: false,
      message:
        "Iteration blocked · validation failed. Verified preview retained.",
    });
    expect(resolveIterationRefresh(workstream([]))).toEqual({
      ready: false,
      message:
        "Iteration finished without validation evidence. Verified preview retained.",
    });
  });
});

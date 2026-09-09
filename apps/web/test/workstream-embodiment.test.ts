import { describe, expect, it } from "vitest";
import {
  createAgentMovementState,
  requestAgentMovement,
} from "../src/world-entry/world-agent-movement-model.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RepositoryCodeScreen } from "../src/world-entry/RepositoryCodeScreen.js";
import {
  createWorkstreamSlab,
  createWorkstreamObjects,
  workstreamEmbodiment,
} from "../src/world-entry/workstream-embodiment.js";
import { deriveAgentRepositoryWorkState } from "../src/world-entry/agent-work-focus-model.js";
import { projectAuthoritativeWorkstream } from "../src/world-entry/workstream-tracer.js";
import type { WorkstreamApiRecord } from "../src/world-entry/workstream-client.js";

const record = {
  workstreamId: "work-one",
  title: "Homepage",
  status: "working",
  repository: { repositoryId: "repo-one", revision: "one" },
  agent: { agentId: "session-one", nativeSessionId: "native-one" },
  authority: { worktreeId: "tree-one" },
  worktreeState: "current",
  projection: {
    currentActivity: "Writing index.html",
    changedFiles: [],
    diff: { summary: "", patch: "", truncated: false },
    validation: [],
    evidenceRefs: [],
  },
  events: [
    {
      eventId: "turn-one",
      status: "working",
      summary: "Started",
      occurredAt: "2026-09-07T14:00:00Z",
    },
  ],
  createdAt: "2026-09-07T14:00:00Z",
  updatedAt: "2026-09-07T14:00:00Z",
} as unknown as WorkstreamApiRecord;
const work = projectAuthoritativeWorkstream(record);

describe("Workstream embodiment", () => {
  it("admits generated slab and nested-file targets through the real movement controller", () => {
    const current = projectAuthoritativeWorkstream({
      ...record,
      projection: {
        ...record.projection,
        changedFiles: [{ path: "src/餐厅.tsx", change: "added" }],
        activeFile: { path: "src/餐厅.tsx", activityId: "tool-one" },
      },
    });
    const objects = createWorkstreamObjects(current, []);
    for (const candidate of [work, current]) {
      const intent = workstreamEmbodiment(
        candidate,
        objects[0]!,
        "session-one",
        "layout-one",
        objects,
      )!;
      const result = requestAgentMovement(
        createAgentMovementState("session-one", { x: 2, z: 1 }),
        intent.request!,
        {
          bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
          userPosition: { x: 0, z: 0 },
          layoutGeneration: "layout-one",
          resolveRepositoryObject: (objectId) => ({
            objectId,
            layoutGeneration: "layout-one",
            position: { x: -6, z: -4 },
            hidden: false,
            reachable: true,
          }),
        },
      );
      expect(result.events.map((event) => event.state)).toContain("accepted");
      expect(result.state.animationSemantic).toBe("Run");
    }
  });
  it("retargets live file objects and gives follow-up turns fresh arrival authority", () => {
    const first = projectAuthoritativeWorkstream({
      ...record,
      projection: {
        ...record.projection,
        activeFile: { path: "index.html", activityId: "edit-heading" },
        changedFiles: [
          { path: "index.html", change: "added", diffSummary: "new" },
          { path: "style.css", change: "added", diffSummary: "new" },
        ],
      },
    });
    const objects = createWorkstreamObjects(first, []);
    const slab = objects.find(
      (object) => object.linkedRepoData?.kind === "workstream",
    )!;
    const a = workstreamEmbodiment(
      first,
      slab,
      "session-one",
      "layout-one",
      objects,
    )!;
    expect(a.focus.repositoryPath).toBe("index.html");
    const second = projectAuthoritativeWorkstream({
      ...first.authority!,
      projection: {
        ...first.authority!.projection,
        activeFile: { path: "style.css", activityId: "edit-style" },
      },
    });
    const b = workstreamEmbodiment(
      second,
      slab,
      "session-one",
      "layout-one",
      objects,
    )!;
    expect(b.focus.repositoryPath).toBe("style.css");
    expect(b.request?.requestId).not.toBe(a.request?.requestId);
    const done = workstreamEmbodiment(
      { ...second, status: "ready-for-review" },
      slab,
      "session-one",
      "layout-one",
      objects,
    )!;
    expect(done.request).toBeNull();
    expect(
      deriveAgentRepositoryWorkState(done.focus, null, "layout-one")
        .codingSemantic,
    ).toBeNull();
  });
  it("never substitutes a work report for source code in a slab", () => {
    const slab = createWorkstreamSlab(work, [])!;
    const html = renderToStaticMarkup(
      createElement(RepositoryCodeScreen, {
        instance: slab,
        workstream: work,
        openingYaw: 0,
        reducedMotion: true,
        onClose() {},
        onInspectionChange() {},
      }),
    );
    expect(html).not.toContain("Waiting for the first worktree change");
    expect(html).toContain("Loading repository source");
  });
  it("creates an owned code slab before a new file exists and runs only the assigned agent to it", () => {
    const slab = createWorkstreamSlab(work, []);
    expect(slab?.assetId).toBe("01-code-slab");
    expect(slab?.linkedRepoData?.workstreamId).toBe("work-one");
    const embodiment = workstreamEmbodiment(
      work,
      slab,
      "session-one",
      "layout-one",
    );
    expect(embodiment?.request?.target).toEqual({
      kind: "repository-object",
      objectId: slab?.linkedRepoData?.ref,
      layoutGeneration: "layout-one",
    });
    expect(embodiment?.request?.speed).toBe(5);
    expect(
      workstreamEmbodiment(work, slab, "other-session", "layout-one"),
    ).toBeNull();
    const focus = embodiment!.focus;
    expect(
      deriveAgentRepositoryWorkState(focus, null, "layout-one").codingSemantic,
    ).toBeNull();
    const arrival = {
      activityId: focus.activityId,
      requestId: focus.movementRequestId!,
      actorId: focus.worldSessionId,
      objectRef: focus.objectRef,
      layoutGeneration: focus.layoutGeneration,
      atSafeApproachPoint: true,
    };
    expect(
      deriveAgentRepositoryWorkState(focus, arrival, "layout-one")
        .codingSemantic,
    ).toBe("Dig");
    expect(
      deriveAgentRepositoryWorkState(
        focus,
        { ...arrival, requestId: "old" },
        "layout-one",
      ).codingSemantic,
    ).toBeNull();
    const done = workstreamEmbodiment(
      { ...work, status: "ready-for-review" },
      slab,
      "session-one",
      "layout-one",
    )!;
    expect(done.request).toBeNull();
    expect(
      deriveAgentRepositoryWorkState(done.focus, arrival, "layout-one").state,
    ).toBe("idle");
  });
});

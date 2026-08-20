import { describe, expect, it } from "vitest";
import type { AgentSession } from "@agentintersect-world/agent-session-protocol";
import type {
  RepositoryGeneration,
  WorldObject,
  WorldSnapshot,
} from "@agentintersect-world/world-schema";

import {
  RepositoryWorkFocusCoordinator,
  advanceRepositoryWorkFocus,
  resolveRepositoryWorkTarget,
} from "../src/repository-work-focus.js";

const ROOT = "/private/operator/repository";
const FINGERPRINT = "a".repeat(64);
const repositoryRef = "aiw://object/repository-main" as const;

function object(
  kind: "repository" | "directory" | "file" | "package" | "tombstone",
  id: string,
  repositoryPath?: string,
): WorldObject {
  const base = {
    id,
    ref: `aiw://object/${id}` as const,
    name: repositoryPath?.split("/").at(-1) ?? "repository",
    parentRef: repositoryRef,
    childRefs: [],
    position: { x: 0, y: 0, z: 0 },
    bounds: { x: 0, z: 0, width: 1, depth: 1 },
  };
  if (kind === "repository") return { ...base, kind, parentRef: null };
  if (kind === "directory")
    return { ...base, kind, path: repositoryPath ?? "", fileCount: 1 };
  if (kind === "file")
    return {
      ...base,
      kind,
      path: repositoryPath ?? "src/index.ts",
      size: 1,
      fileKind: "source",
      language: "TypeScript",
      contentHash: "b".repeat(64),
      pathHistory: [],
    };
  if (kind === "package")
    return {
      ...base,
      kind,
      path: repositoryPath ?? "package.json",
      packageKind: "npm",
      packageName: "fixture",
    };
  return {
    ...base,
    kind,
    originalKind: "file",
    lastKnownPath: repositoryPath ?? "old.ts",
    contentHash: null,
    pathHistory: [],
  };
}

function selection(extra: readonly WorldObject[] = []) {
  const generation = {
    id: "11111111-1111-4111-8111-111111111111",
    fingerprint: FINGERPRINT,
    rootPath: ROOT,
    repositoryName: "fixture",
  } as RepositoryGeneration;
  const snapshot = {
    repositoryRef,
    generationFingerprint: FINGERPRINT,
    objects: [
      object("repository", "repository-main"),
      object("directory", "directory-root", ""),
      object("directory", "directory-src", "src"),
      object("directory", "directory-lib", "src/lib"),
      object("file", "file-index", "src/index.ts"),
      object("file", "file-helper", "src/lib/helper.ts"),
      object("package", "package-root", "package.json"),
      object("tombstone", "tombstone-old", "src/old.ts"),
      ...extra,
    ],
  } as WorldSnapshot;
  return { generation, snapshot };
}

describe("Phase 19 Task 12 repository target resolution", () => {
  it("resolves exact files and canonicalizes the layout generation", () => {
    expect(
      resolveRepositoryWorkTarget({
        locator: {
          operation: "edit",
          paths: [`${ROOT}/src/index.ts`],
          symbol: { name: "main", line: 4 },
        },
        repositoryRef,
        selection: selection(),
      }),
    ).toEqual({
      ok: true,
      target: {
        repositoryRef,
        objectRef: "aiw://object/file-index",
        objectKind: "file",
        repositoryPath: "src/index.ts",
        layoutGeneration: `layout-${FINGERPRINT}`,
      },
    });
  });

  it("uses the nearest live directory and deepest common live ancestor", () => {
    const current = selection();
    expect(
      resolveRepositoryWorkTarget({
        locator: { operation: "edit", paths: ["src/lib/new.ts"] },
        repositoryRef,
        selection: current,
      }),
    ).toMatchObject({ ok: true, target: { repositoryPath: "src/lib" } });
    expect(
      resolveRepositoryWorkTarget({
        locator: {
          operation: "tool",
          paths: ["src/index.ts", "src/lib/helper.ts"],
        },
        repositoryRef,
        selection: current,
      }),
    ).toMatchObject({ ok: true, target: { repositoryPath: "src" } });
    expect(
      resolveRepositoryWorkTarget({
        locator: {
          operation: "tool",
          paths: ["src/index.ts", "README.md"],
        },
        repositoryRef,
        selection: current,
      }),
    ).toMatchObject({ ok: true, target: { repositoryPath: "." } });
  });

  it.each([
    ["outside root", [`${ROOT}-other/secret.ts`]],
    ["traversal", ["../secret.ts"]],
    ["control character", ["src/secret\0.ts"]],
    ["tombstone", ["src/old.ts"]],
  ])("refuses %s evidence", (_label, paths) => {
    expect(
      resolveRepositoryWorkTarget({
        locator: { operation: "read", paths },
        repositoryRef,
        selection: selection(),
      }).ok,
    ).toBe(false);
  });

  it("refuses repository mismatch, hidden/unreachable targets, and ambiguity", () => {
    expect(
      resolveRepositoryWorkTarget({
        locator: { operation: "read", paths: ["src/index.ts"] },
        repositoryRef: "aiw://object/another-repository",
        selection: selection(),
      }).ok,
    ).toBe(false);
    for (const blocked of [
      "hiddenObjectRefs",
      "unreachableObjectRefs",
    ] as const)
      expect(
        resolveRepositoryWorkTarget({
          locator: { operation: "read", paths: ["src/index.ts"] },
          repositoryRef,
          selection: selection(),
          [blocked]: new Set(["aiw://object/file-index"]),
        }).ok,
      ).toBe(false);
    expect(
      resolveRepositoryWorkTarget({
        locator: { operation: "read", paths: ["src/index.ts"] },
        repositoryRef,
        selection: selection([object("file", "duplicate", "src/index.ts")]),
      }).ok,
    ).toBe(false);
  });

  it("gates coding on exact active-tool arrival and makes terminal states sticky", () => {
    const focus = {
      schema: "aiw.agent-work-focus/0.19" as const,
      activityId: "activity-a",
      rosterId: "roster-a",
      worldSessionId: "session-a",
      repositoryRef,
      objectRef: "aiw://object/file-index",
      objectKind: "file" as const,
      repositoryPath: "src/index.ts",
      layoutGeneration: `layout-${FINGERPRINT}`,
      movementRequestId: "movement-a",
      source: "structured-tool-event" as const,
      state: "navigating" as const,
    };
    expect(
      advanceRepositoryWorkFocus(focus, {
        type: "arrived",
        activityId: "activity-a",
        requestId: "movement-b",
        actorId: "session-a",
        objectRef: focus.objectRef,
        layoutGeneration: focus.layoutGeneration,
        currentLayoutGeneration: focus.layoutGeneration,
        actorIsAtSafeApproachPoint: true,
        toolActive: true,
      }).state,
    ).toBe("navigating");
    const coding = advanceRepositoryWorkFocus(focus, {
      type: "arrived",
      activityId: "activity-a",
      requestId: "movement-a",
      actorId: "session-a",
      objectRef: focus.objectRef,
      layoutGeneration: focus.layoutGeneration,
      currentLayoutGeneration: focus.layoutGeneration,
      actorIsAtSafeApproachPoint: true,
      toolActive: true,
    });
    expect(coding.state).toBe("coding");
    expect(
      advanceRepositoryWorkFocus(coding, {
        type: "terminal",
        state: "completed",
      }).state,
    ).toBe("completed");
  });

  it("submits one existing repository-object movement without raw locator data", async () => {
    const submitted: unknown[] = [];
    const cancelled: unknown[] = [];
    const coordinator = new RepositoryWorkFocusCoordinator({
      selectedRepository: () => selection(),
      submitMovement: async (request) => {
        submitted.push(request);
        return { movementRequestId: "movement-activity-a" };
      },
      cancelMovement: async (request) => {
        cancelled.push(request);
      },
    });
    const focus = await coordinator.start({
      session: {
        sessionId: "session-a",
        repositoryRef,
      },
      rosterId: "roster-a",
      activityId: "activity-a",
      locator: { operation: "edit", paths: [`${ROOT}/src/index.ts`] },
    });
    expect(focus).toMatchObject({
      rosterId: "roster-a",
      worldSessionId: "session-a",
      objectRef: "aiw://object/file-index",
      movementRequestId: "movement-activity-a",
      state: "navigating",
    });
    expect(submitted).toEqual([
      {
        worldSessionId: "session-a",
        activityId: "activity-a",
        sequence: 1,
        objectRef: "aiw://object/file-index",
        layoutGeneration: `layout-${FINGERPRINT}`,
      },
    ]);
    expect(JSON.stringify(submitted)).not.toContain(ROOT);
    expect(await coordinator.stop(focus!, "completed")).toMatchObject({
      state: "completed",
    });
    expect(cancelled).toEqual([
      { worldSessionId: "session-a", movementRequestId: "movement-activity-a" },
    ]);
  });

  it("accepts only exact active changed-files recovery evidence", async () => {
    const submitted: unknown[] = [];
    const coordinator = new RepositoryWorkFocusCoordinator({
      selectedRepository: () => selection(),
      submitMovement: async (request) => {
        submitted.push(request);
        return { movementRequestId: `movement-${request.activityId}` };
      },
    });
    const session = {
      schema: "aiw.agent-session/0.12",
      sessionId: "11111111-2222-4333-8444-555555555555",
      adapterId: "claude-code",
      adapterSessionRef: "native-session",
      adapterRootSessionRef: "native-root",
      profile: "default",
      workspaceId: "workspace-a",
      repositoryRef,
      worktreeRef: "worktree-a",
      mode: "collaborate",
      permissionRevision: 1,
      capabilitySnapshotHash: "c".repeat(64),
      avatarProfileRef: null,
      status: "ready",
      continuity: "current",
      currentFocusObjectIds: [],
      currentTaskRef: "task-a",
      activeRunId: null,
      lastEventSequence: 0,
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T00:00:00.000Z",
    } satisfies AgentSession;
    const workstream = {
      workstreamId: "task-a",
      revision: 4,
      repository: {
        repositoryId: repositoryRef,
        revision: selection().generation.id,
      },
      agent: {
        agentId: session.sessionId,
        nativeSessionId: "native-session",
        rootNativeSessionId: "native-root",
      },
      authority: {
        repositoryId: repositoryRef,
        worktreeId: "worktree-a",
      },
      worktreeState: "dirty",
      projection: {
        changedFiles: [{ path: "src/index.ts" }, { path: "src/lib/helper.ts" }],
      },
      status: "working",
    } as const;
    await expect(
      coordinator.recover({
        session,
        rosterId: session.sessionId,
        workstream,
      }),
    ).resolves.toMatchObject({
      source: "workstream-binding",
      repositoryPath: "src",
      state: "navigating",
    });
    expect(submitted).toHaveLength(1);

    const refused = [
      { ...workstream, status: "cancelled" },
      { ...workstream, worktreeState: "missing" },
      { ...workstream, workstreamId: "task-other" },
      {
        ...workstream,
        agent: { ...workstream.agent, agentId: "other-agent" },
      },
      {
        ...workstream,
        repository: {
          ...workstream.repository,
          repositoryId: "aiw://object/repository-other",
        },
      },
      {
        ...workstream,
        authority: { ...workstream.authority, worktreeId: "worktree-other" },
      },
      {
        ...workstream,
        projection: {
          changedFiles: [],
          currentActivity: "Editing src/index.ts from prose only",
        },
      },
    ];
    for (const candidate of refused)
      await expect(
        coordinator.recover({
          session,
          rosterId: session.sessionId,
          workstream: candidate,
        }),
      ).resolves.toBeNull();
    expect(submitted).toHaveLength(1);
  });
});

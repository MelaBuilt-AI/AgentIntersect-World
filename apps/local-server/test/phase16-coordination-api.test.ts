import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CoordinationSnapshotSchema,
  createEmptyCoordinationSnapshot,
} from "@agentintersect-world/multi-agent-coordination";

import { CoordinationService } from "../src/coordination-service.js";
import { createLocalServer } from "../src/server.js";

describe("Phase 16 coordination API", () => {
  it("exposes strict loopback coordination snapshot and operator actions", async () => {
    const coordinationService = new CoordinationService({
      directory: await mkdtemp(join(tmpdir(), "aiw-phase16-api-")),
    });
    const server = createLocalServer({ coordinationService });
    const initial = await server.inject({
      method: "GET",
      url: "/coordination/snapshot",
    });
    expect(initial.statusCode).toBe(200);
    expect(initial.json().data.truth).toBe("current");
    expect(initial.json().data.revision).toBeNull();

    const denied = await server.inject({
      method: "POST",
      url: "/coordination/actions",
      payload: {
        schema: "aiw.coordination-action/0.16",
        coordinationSessionId: "phase16-fixture",
        actor: "operator",
        operatorApproval: "missing",
        expectedRevision: 0,
        correlationId: "correlation-denied",
        action: {
          kind: "session.initialize",
          repositoryId: "repo-fixture",
          repositoryDisplayName: "Fixture",
          operatorId: "operator-local",
        },
      },
    });
    expect(denied.statusCode).toBe(403);

    const accepted = await server.inject({
      method: "POST",
      url: "/coordination/actions",
      payload: {
        schema: "aiw.coordination-action/0.16",
        coordinationSessionId: "phase16-fixture",
        actor: "operator",
        operatorApproval: "approved",
        expectedRevision: 0,
        correlationId: "correlation-init",
        action: {
          kind: "session.initialize",
          repositoryId: "repo-fixture",
          repositoryDisplayName: "Fixture",
          operatorId: "operator-local",
        },
      },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().data.revision).toBe(1);
    await server.close();
  });

  it("preserves stable protocol error distinctions and truthful statuses", async () => {
    const directory = await mkdtemp(join(tmpdir(), "aiw-phase16-api-errors-"));
    const coordinationService = new CoordinationService({ directory });
    const server = createLocalServer({ coordinationService });
    const post = (payload: unknown) =>
      server.inject({
        method: "POST",
        url: "/coordination/actions",
        payload,
      });
    const base = {
      schema: "aiw.coordination-action/0.16",
      coordinationSessionId: "phase16-api-errors",
      actor: "operator",
      operatorApproval: "approved",
    } as const;
    const initialize = {
      ...base,
      expectedRevision: 0,
      correlationId: "initialize",
      action: {
        kind: "session.initialize",
        repositoryId: "repo-fixture",
        repositoryDisplayName: "Fixture",
        operatorId: "operator-local",
      },
    } as const;
    expect((await post(initialize)).statusCode).toBe(200);

    const invalid = await post({
      ...initialize,
      expectedRevision: 1,
      correlationId: "initialize-again",
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("invalid");

    const notFound = await post({
      ...base,
      expectedRevision: 1,
      correlationId: "candidate-missing",
      action: {
        kind: "merge-candidate.approve",
        candidateId: "candidate-missing",
      },
    });
    expect(notFound.statusCode).toBe(404);
    expect(notFound.json().error.code).toBe("not_found");

    const revision = await post({
      ...base,
      expectedRevision: 99,
      correlationId: "revision-conflict",
      action: { kind: "coordination.cancel", reason: "stale revision" },
    });
    expect(revision.statusCode).toBe(409);
    expect(revision.json().error.code).toBe("revision_conflict");
    const correlation = await post({
      ...initialize,
      action: {
        ...initialize.action,
        repositoryDisplayName: "Different fixture",
      },
    });
    expect(correlation.statusCode).toBe(409);
    expect(correlation.json().error.code).toBe("correlation_conflict");

    const bound = await post({
      ...base,
      expectedRevision: 1,
      correlationId: "bind-fluff",
      action: {
        kind: "agent.bind",
        binding: {
          agentId: "mr-fluff",
          adapter: "hermes",
          displayName: "Mr Fluff",
          avatarId: "mr-fluff",
          nativeSessionId: "hermes-api-errors",
          model: "gpt-5.6-sol",
          toolStreamId: "tools-api-errors",
          evidenceStreamId: "evidence-api-errors",
          status: "ready",
        },
      },
    });
    expect(bound.statusCode).toBe(200);
    const binding = await post({
      ...base,
      expectedRevision: 2,
      correlationId: "binding-mismatch",
      action: {
        kind: "agent.bind",
        binding: {
          agentId: "beans",
          adapter: "openclaw",
          displayName: "Beans",
          avatarId: "beans",
          nativeSessionId: "hermes-api-errors",
          model: "gpt-5.6-sol",
          toolStreamId: "tools-beans-api-errors",
          evidenceStreamId: "evidence-beans-api-errors",
          status: "ready",
        },
      },
    });
    expect(binding.statusCode).toBe(422);
    expect(binding.json().error.code).toBe("binding_mismatch");

    let revisionNumber = 2;
    for (let index = 0; index < 32; index += 1) {
      const response = await post({
        ...base,
        expectedRevision: revisionNumber,
        correlationId: `task-${index}`,
        action: {
          kind: "task.upsert",
          task: {
            taskId: `task-${index}`,
            title: `Task ${index}`,
            status: "ready",
            dependencyTaskIds: [],
            ownerAgentId: null,
          },
        },
      });
      expect(response.statusCode).toBe(200);
      revisionNumber += 1;
    }
    const ceiling = await post({
      ...base,
      expectedRevision: revisionNumber,
      correlationId: "task-over-ceiling",
      action: {
        kind: "task.upsert",
        task: {
          taskId: "task-over-ceiling",
          title: "Over ceiling",
          status: "ready",
          dependencyTaskIds: [],
          ownerAgentId: null,
        },
      },
    });
    expect(ceiling.statusCode).toBe(413);
    expect(ceiling.json().error.code).toBe("resource_limit");

    const assigned = await post({
      ...base,
      expectedRevision: revisionNumber,
      correlationId: "assign-task-zero",
      action: {
        kind: "task.assign",
        taskId: "task-0",
        agentId: "mr-fluff",
        nativeSessionId: "hermes-api-errors",
      },
    });
    expect(assigned.statusCode).toBe(200);
    revisionNumber += 1;
    const gitRefused = await post({
      ...base,
      expectedRevision: revisionNumber,
      correlationId: "git-refused",
      action: {
        kind: "worktree.attach",
        worktreeId: "worktree-relative",
        agentId: "mr-fluff",
        nativeSessionId: "hermes-api-errors",
        taskId: "task-0",
        repositoryRoot: "relative-repository",
        worktreePath: "relative-worktree",
        branch: "phase16/relative",
        displayPath: "worktrees/relative",
      },
    });
    expect(gitRefused.statusCode).toBe(422);
    expect(gitRefused.json().error.code).toBe("git_refused");

    const cancelled = await post({
      ...base,
      expectedRevision: revisionNumber,
      correlationId: "cancel",
      action: { kind: "coordination.cancel", reason: "bounded cancellation" },
    });
    expect(cancelled.statusCode).toBe(200);
    const afterCancellation = await post({
      ...base,
      expectedRevision: revisionNumber + 1,
      correlationId: "after-cancel",
      action: {
        kind: "task.upsert",
        task: {
          taskId: "after-cancel",
          title: "After cancellation",
          status: "ready",
          dependencyTaskIds: [],
          ownerAgentId: null,
        },
      },
    });
    expect(afterCancellation.statusCode).toBe(422);
    expect(afterCancellation.json().error.code).toBe("cancelled");
    await server.close();

    const corruptDirectory = await mkdtemp(
      join(tmpdir(), "aiw-phase16-api-corrupt-"),
    );
    const corruptService = new CoordinationService({
      directory: corruptDirectory,
    });
    await corruptService.action(initialize);
    await writeFile(corruptService.pathsForTest().current, "corrupt-current");
    await writeFile(corruptService.pathsForTest().previous, "corrupt-previous");
    const unavailableServer = createLocalServer({
      coordinationService: new CoordinationService({
        directory: corruptDirectory,
      }),
    });
    const unavailable = await unavailableServer.inject({
      method: "POST",
      url: "/coordination/reconcile",
      payload: {
        coordinationSessionId: "phase16-api-errors",
        actor: "operator",
        operatorApproval: "approved",
      },
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json().error.code).toBe("unavailable");
    for (const response of [
      invalid,
      notFound,
      revision,
      correlation,
      binding,
      ceiling,
      gitRefused,
      afterCancellation,
      unavailable,
    ]) {
      const encoded = response.body;
      expect(encoded).not.toMatch(/\/(?:home|tmp)\//);
      expect(encoded).not.toContain("PATH=");
      expect(encoded).not.toContain(directory);
      expect(encoded).not.toContain(corruptDirectory);
    }
    await unavailableServer.close();
  });

  it("projects every browser response without raw diffs, paths, or tool output", async () => {
    const rawDiff = "PHASE16_RAW_DIFF_SENTINEL";
    const absolutePath = "/tmp/phase16-browser-secret";
    const toolOutput = "PHASE16_UNRESTRICTED_TOOL_OUTPUT";
    const digest = "a".repeat(64);
    const now = "2026-07-23T00:00:00.000Z";
    const snapshot = CoordinationSnapshotSchema.parse({
      ...createEmptyCoordinationSnapshot({
        coordinationSessionId: "phase16-browser-safe",
        repositoryId: "repo-browser-safe",
      }),
      revision: 7,
      repositoryDisplayName: "Browser-safe fixture",
      operatorId: "operator-local",
      agents: [
        {
          agentId: "beans",
          adapter: "openclaw",
          displayName: "Beans",
          avatarId: "beans",
          nativeSessionId: "openclaw-safe",
          model: "gpt-5.6-sol",
          toolStreamId: "tool-safe",
          evidenceStreamId: "evidence-safe",
          status: "active",
          assignedTaskId: "task-safe",
          worktreeId: "worktree-beans",
        },
      ],
      tasks: [
        {
          taskId: "task-safe",
          title: `Inspect ${absolutePath}`,
          status: "active",
          dependencyTaskIds: [],
          ownerAgentId: "beans",
        },
      ],
      interests: [
        {
          interestId: "interest-safe",
          agentId: "beans",
          nativeSessionId: "openclaw-safe",
          taskId: "task-safe",
          targetKind: "file",
          target: "src/shared.ts",
          state: "active",
        },
      ],
      messages: [
        {
          messageId: "message-safe",
          senderAgentId: "beans",
          recipientAgentId: "mr-fluff",
          nativeSessionId: "openclaw-safe",
          taskId: "task-beans",
          text: `${toolOutput} at ${absolutePath}`,
          authority: "none",
          contentKind: "inert-visible-record",
          createdAt: now,
        },
      ],
      handoffs: [
        {
          handoffId: "handoff-safe",
          senderAgentId: "beans",
          recipientAgentId: "mr-fluff",
          nativeSessionId: "openclaw-safe",
          taskId: "task-beans",
          repositoryId: "repo-browser-safe",
          worktreeId: "worktree-beans",
          sourceBranch: "phase16/safe-beans",
          sourceHead: "b".repeat(40),
          summary: "Bounded handoff summary",
          evidenceIds: ["test-safe"],
          createdAt: now,
        },
      ],
      mergeCandidates: [
        {
          candidateId: "candidate-safe",
          sourceAgentId: "beans",
          targetAgentId: "mr-fluff",
          sourceTaskId: "task-beans",
          targetTaskId: "task-fluff",
          repositoryId: "repo-browser-safe",
          sourceWorktreeId: "worktree-beans",
          targetWorktreeId: "worktree-fluff",
          sourceBranch: "phase16/safe-beans",
          targetBranch: "phase16/safe-fluff",
          sourceHead: "b".repeat(40),
          targetHead: "f".repeat(40),
          diff: `diff --git a/shared.txt b/shared.txt\n${rawDiff}\n${absolutePath}\n`,
          diffDigest: digest,
          changedPaths: ["shared.txt"],
          testEvidenceIds: ["test-safe"],
          conflictIds: [],
          uncertainties: [],
          cleanupState: "not-planned",
          state: "candidate",
          mergeRun: false,
          preparedAt: now,
          approvedAt: null,
        },
      ],
      testEvidence: [
        {
          testId: "test-safe",
          agentId: "beans",
          nativeSessionId: "openclaw-safe",
          taskId: "task-beans",
          worktreeId: "worktree-beans",
          branch: "phase16/safe-beans",
          head: "b".repeat(40),
          command: `node ${absolutePath} ${toolOutput}`,
          exitCode: 0,
          summary: "Focused test passed",
          digest,
          recordedAt: now,
        },
      ],
      cleanupPlans: [
        {
          cleanupPlanId: "cleanup-safe",
          agentId: "beans",
          worktreeId: "worktree-beans",
          displayPath: "worktrees/beans",
          branch: "phase16/safe-beans",
          recommendation: "allowed",
          reasons: ["Clean registered worktree; preview only."],
          previewOnly: true,
          createdAt: now,
        },
      ],
    });
    const projection = {
      schema: "aiw.coordination-projection/0.16" as const,
      truth: "current" as const,
      snapshot,
      unavailableReason: null,
    };
    const coordinationService = {
      snapshot: async () => projection,
      action: async () => ({ snapshot, replayed: false }),
      reconcile: async () => projection,
      dispose: async () => undefined,
    } as unknown as CoordinationService;
    const server = createLocalServer({ coordinationService });

    const responses = [
      await server.inject({
        method: "GET",
        url: "/coordination/snapshot",
      }),
      await server.inject({
        method: "POST",
        url: "/coordination/actions",
        payload: {},
      }),
      await server.inject({
        method: "POST",
        url: "/coordination/reconcile",
        payload: {
          coordinationSessionId: "phase16-browser-safe",
          actor: "operator",
          operatorApproval: "approved",
        },
      }),
    ];
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain(rawDiff);
      expect(response.body).not.toContain(absolutePath);
      expect(response.body).not.toContain(toolOutput);
      expect(response.json().data.mergeCandidates[0]).toMatchObject({
        candidateId: "candidate-safe",
        state: "candidate",
        diffDigest: digest,
        changedPathCount: 1,
      });
      expect(response.json().data.messages[0]).toMatchObject({
        senderAgentId: "beans",
        recipientAgentId: "mr-fluff",
      });
      expect(response.json().data.agents[0]).toMatchObject({
        nativeSessionId: "openclaw-safe",
        toolStreamId: "tool-safe",
        evidenceStreamId: "evidence-safe",
      });
      expect(response.json().data.interests[0]).toMatchObject({
        agentId: "beans",
        target: "src/shared.ts",
        state: "active",
      });
      expect(response.json().data.cleanupPlans[0]).toMatchObject({
        cleanupPlanId: "cleanup-safe",
        displayPath: "worktrees/beans",
        previewOnly: true,
      });
      expect(response.json().data.tasks[0]).toMatchObject({
        taskId: "task-safe",
        title: "[redacted]",
        status: "active",
      });
      expect(response.json().data.testEvidence[0]).toMatchObject({
        testId: "test-safe",
        exitCode: 0,
        statusSummary: "Test passed",
      });
    }
    await server.close();
  });
});

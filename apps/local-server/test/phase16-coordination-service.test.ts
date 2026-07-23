import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CoordinationService,
  CoordinationServiceError,
} from "../src/coordination-service.js";

async function storeRoot() {
  return mkdtemp(join(tmpdir(), "aiw-phase16-store-"));
}

describe("Phase 16 coordination service persistence", () => {
  it("recovers the checksummed previous generation and preserves truth", async () => {
    const directory = await storeRoot();
    const service = new CoordinationService({ directory });
    await service.action({
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
    });
    await service.action({
      schema: "aiw.coordination-action/0.16",
      coordinationSessionId: "phase16-fixture",
      actor: "operator",
      operatorApproval: "approved",
      expectedRevision: 1,
      correlationId: "correlation-task",
      action: {
        kind: "task.upsert",
        task: {
          taskId: "task-fluff-doc",
          title: "Mr Fluff fixture task",
          status: "ready",
          dependencyTaskIds: [],
          ownerAgentId: null,
        },
      },
    });
    const paths = service.pathsForTest();
    expect(await readFile(paths.current, "utf8")).toContain('"checksum"');
    await writeFile(paths.current, '{"corrupt":true}\n', "utf8");

    const recovered = new CoordinationService({ directory });
    const projection = await recovered.snapshot();
    expect(projection.truth).toBe("previous-recovered");
    expect(projection.snapshot?.revision).toBe(1);
    await recovered.action({
      schema: "aiw.coordination-action/0.16",
      coordinationSessionId: "phase16-fixture",
      actor: "operator",
      operatorApproval: "approved",
      expectedRevision: 1,
      correlationId: "correlation-recovered-mutation",
      action: {
        kind: "coordination.cancel",
        reason: "operator acknowledges recovered truth",
      },
    });
    expect((await recovered.snapshot()).truth).toBe("current");
  });

  it("fails closed when both generations are corrupt", async () => {
    const directory = await storeRoot();
    const service = new CoordinationService({ directory });
    await service.action({
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
    });
    const paths = service.pathsForTest();
    await writeFile(paths.current, "bad-current", "utf8");
    await writeFile(paths.previous, "bad-previous", "utf8");
    const unavailable = new CoordinationService({ directory });
    expect((await unavailable.snapshot()).truth).toBe("unavailable");
    await expect(
      unavailable.action({
        schema: "aiw.coordination-action/0.16",
        coordinationSessionId: "phase16-fixture",
        actor: "operator",
        operatorApproval: "approved",
        expectedRevision: 0,
        correlationId: "correlation-refused",
        action: {
          kind: "coordination.cancel",
          reason: "must not mutate corrupt truth",
        },
      }),
    ).rejects.toBeInstanceOf(CoordinationServiceError);
  });

  it("replays identical correlations and refuses correlation reuse", async () => {
    const service = new CoordinationService({ directory: await storeRoot() });
    const request = {
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
    } as const;
    const first = await service.action(request);
    const replay = await service.action(request);
    expect(replay.snapshot.revision).toBe(first.snapshot.revision);
    await expect(
      service.action({
        ...request,
        action: { ...request.action, repositoryDisplayName: "Different" },
      }),
    ).rejects.toMatchObject({ code: "correlation_conflict" });
  });
});

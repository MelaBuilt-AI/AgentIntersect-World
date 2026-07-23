import { describe, expect, it } from "vitest";

import { runPhase16Fixture } from "../../../tooling/scripts/phase16-fixture.js";

describe("Phase 16 disposable Git acceptance fixture", () => {
  it("proves isolation, real conflict, attribution, refusals, recovery, and teardown", async () => {
    const result = await runPhase16Fixture();
    process.stdout.write(`${result.transcript.join("\n")}\n`);
    expect(result.label).toBe("phase16-deterministic-fixture");
    expect(result.snapshot.agents.map((agent) => agent.agentId).sort()).toEqual(
      ["beans", "mr-fluff"],
    );
    expect(result.snapshot.worktrees).toHaveLength(2);
    expect(result.snapshot.contentions[0]?.classification).toBe(
      "interest-only",
    );
    expect(result.snapshot.conflicts[0]?.classification).toBe("git-conflict");
    expect(result.snapshot.mergeCandidates[0]).toMatchObject({
      state: "conflicting",
      mergeRun: false,
    });
    expect(result.isolation).toEqual({
      fluffHasBeansFile: false,
      beansHasFluffFile: false,
    });
    expect(result.snapshot.messages[0]).toMatchObject({
      senderAgentId: "beans",
      authority: "none",
    });
    expect(result.snapshot.handoffs[0]?.recipientAgentId).toBe("mr-fluff");
    expect(result.wrongBinding).toEqual({
      code: "git-refused",
      revisionUnchanged: true,
    });
    expect(result.thirdAgent.revisionUnchanged).toBe(true);
    expect(result.overLimit.revisionUnchanged).toBe(true);
    expect(result.deletedClassification).toBe("deleted");
    expect(result.staleClassification).toBe("stale");
    expect(result.recovered.truth).toBe("previous-recovered");
    expect(result.measurements.ownedProcessesAfterCancellation).toBe(0);
    expect(result.transcript).toEqual([
      "CURRENT session phase16-fixture initialized for one operator",
      "BOUND mr-fluff hermes task-fluff-doc phase16/fixture-fluff",
      "BOUND beans openclaw task-beans-doc phase16/fixture-beans",
      "CONTENTION src/shared.ts interest-only agents=mr-fluff,beans",
      "ISOLATED bounded edits remain in their assigned worktrees",
      "MESSAGE beans attributed inert no-authority",
      "HANDOFF beans -> mr-fluff evidence-bound",
      "CANDIDATE conflict=git-conflict diff=exact tests=exact merge=not-run",
      "REFUSED wrong-session/worktree before mutation",
      "RECOVERY previous-recovered and missing/deleted classified",
      "LIMIT refused third-agent and over-limit record",
      "CANCELLED cleanup=preview-only owned-processes=0",
    ]);
  }, 30_000);
});

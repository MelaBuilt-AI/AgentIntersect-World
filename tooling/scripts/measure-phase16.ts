import {
  COORDINATION_LIMITS,
  CoordinationSnapshotSchema,
} from "@agentintersect-world/multi-agent-coordination";

import { runPhase16Fixture } from "./phase16-fixture.js";

const result = await runPhase16Fixture();
const failures: string[] = [];
const measure = result.measurements;
const check = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

CoordinationSnapshotSchema.parse(result.snapshot);
check(measure.agentCount === 2, "exactly two agents");
check(measure.worktreeCount === 2, "at most two worktrees");
check(measure.taskCount <= COORDINATION_LIMITS.tasks, "task ceiling");
check(measure.messageCount <= COORDINATION_LIMITS.messages, "message ceiling");
check(
  measure.eventCount <= COORDINATION_LIMITS.lifecycleEvents,
  "event ceiling",
);
check(
  measure.interestCount <= COORDINATION_LIMITS.interests,
  "interest ceiling",
);
check(
  measure.snapshotBytes <= COORDINATION_LIMITS.snapshotBytes,
  "snapshot byte ceiling",
);
check(
  measure.diffBytes <= COORDINATION_LIMITS.candidateDiffBytes,
  "candidate diff byte ceiling",
);
check(
  measure.messageBytes <= COORDINATION_LIMITS.messageBytes,
  "message byte ceiling",
);
check(!measure.absolutePathLeak, "no absolute fixture path in snapshot");
check(
  measure.ownedProcessesAfterCancellation === 0,
  "zero owned processes after cancellation",
);
check(
  result.wrongBinding.revisionUnchanged,
  "wrong binding failed pre-mutation",
);
check(result.thirdAgent.revisionUnchanged, "third agent failed pre-mutation");
check(result.overLimit.revisionUnchanged, "over-limit failed pre-mutation");
check(
  result.recovered.truth === "previous-recovered",
  "restart recovery truth",
);
check(result.deletedClassification === "deleted", "deleted worktree truth");
check(result.staleClassification === "stale", "stale worktree truth");

process.stdout.write(
  `${JSON.stringify(
    {
      schema: "aiw.phase16-measurement/0.16",
      label: result.label,
      limits: COORDINATION_LIMITS,
      measurements: measure,
      verdict: failures.length === 0 ? "PASS" : "FAIL",
      failures,
    },
    null,
    2,
  )}\n`,
);
if (failures.length > 0) process.exitCode = 1;

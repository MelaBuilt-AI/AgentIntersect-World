import { expect, it } from "vitest";
import * as library from "../src/repository-intake.js";
import type { Workstream } from "../src/workstream-service.js";

it("projects unfinished dirty work and conversation identity separately from completed milestones", () => {
  const work = {
    workstreamId: "saved-1",
    title: "Unfinished page",
    status: "blocked",
    updatedAt: "2026-09-17T12:00:00Z",
    agent: { agentId: "agent-1", nativeSessionId: "native-1" },
    authority: { branch: "feat/page", relativePath: "owned/page" },
    worktreeState: "dirty",
    projection: { changedFiles: [] },
    events: [
      {
        eventId: "done-1",
        status: "ready-for-review",
        summary: "Completed one turn",
        occurredAt: "2026-09-16T12:00:00Z",
      },
    ],
  } as unknown as Workstream;
  expect(library).toHaveProperty("projectSavedWork");
  const result = library.projectSavedWork([work]);
  expect(result.workstreams[0]).toMatchObject({
    workstreamId: "saved-1",
    status: "blocked",
    nativeSessionId: "native-1",
    worktreeState: "dirty",
  });
  expect(result.milestones[0]).toMatchObject({
    id: "done-1",
    kind: "work",
    label: "Completed one turn",
  });
});

import { describe, expect, it } from "vitest";

import { AgentRepositoryWorkFocusSchema } from "../src/index.js";

const focus = {
  schema: "aiw.agent-work-focus/0.19",
  activityId: "activity-12",
  rosterId: "roster-codex",
  worldSessionId: "world-session-codex",
  repositoryRef: "aiw://object/repository-main",
  objectRef: "aiw://object/file-index",
  objectKind: "file",
  repositoryPath: "src/index.ts",
  layoutGeneration: `layout-${"a".repeat(64)}`,
  movementRequestId: "movement-12",
  source: "structured-tool-event",
  state: "navigating",
} as const;

describe("Phase 19 Task 12 work-focus protocol", () => {
  it("accepts only a bounded public focus projection", () => {
    expect(AgentRepositoryWorkFocusSchema.parse(focus)).toEqual(focus);
    expect(
      AgentRepositoryWorkFocusSchema.safeParse({
        ...focus,
        repositoryLocator: { paths: ["/private/operator/repo/src/index.ts"] },
      }).success,
    ).toBe(false);
    expect(
      AgentRepositoryWorkFocusSchema.safeParse({ ...focus, rawArgs: {} })
        .success,
    ).toBe(false);
  });

  it("explicitly permits only the bounded workstream recovery source", () => {
    expect(
      AgentRepositoryWorkFocusSchema.parse({
        ...focus,
        source: "workstream-binding",
      }).source,
    ).toBe("workstream-binding");
    expect(
      AgentRepositoryWorkFocusSchema.safeParse({
        ...focus,
        source: "assistant-prose",
      }).success,
    ).toBe(false);
  });

  it("requires canonical layout generations and exact movement correlation", () => {
    expect(
      AgentRepositoryWorkFocusSchema.safeParse({
        ...focus,
        layoutGeneration: "a".repeat(64),
      }).success,
    ).toBe(false);
    expect(
      AgentRepositoryWorkFocusSchema.parse({
        ...focus,
        state: "targeted",
        movementRequestId: null,
      }).movementRequestId,
    ).toBeNull();
  });
});

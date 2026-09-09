import { expect, it } from "vitest";
import {
  createWorldChatState,
  reduceWorldChat,
  workstreamChatReports,
} from "../src/world-entry/world-chat-model.js";
import type { Workstream } from "../src/world-entry/workstream-tracer.js";

it("adds one start and one done report per saved work turn without interrupting streaming chat", () => {
  const work = {
    workstreamId: "work-1",
    title: "Homepage",
    authority: {
      authority: { branch: "feat/home" },
      events: [
        { eventId: "start-1", status: "working", summary: "Build a homepage" },
        {
          eventId: "done-1",
          status: "ready-for-review",
          summary: "Changed index.html. Validation: node --test — passed.",
        },
        {
          eventId: "restore-1",
          status: "ready-for-review",
          summary: "Continued saved work; no coding turn",
        },
        {
          eventId: "start-2",
          status: "working",
          summary: "Change the heading",
        },
        {
          eventId: "done-2",
          status: "blocked",
          summary: "Check failed; previous preview retained",
        },
      ],
    },
  } as unknown as Workstream;
  const reports = workstreamChatReports(work, "Codex");
  expect(reports.map((report) => report.text.split("\n")[0])).toEqual([
    "### Starting report",
    "### Completion report",
    "### Starting report",
    "### Blocked report",
  ]);
  expect(reports[1]?.text).toContain("Validation: node --test — passed.");
  expect(reports[2]?.text).toContain("**Task:** Change the heading");
  expect(reports[3]?.text).toContain("**Task:** Change the heading");
  expect(reports[2]?.text).not.toContain("Homepage");
  expect(reports[3]?.text).toContain("\n\n**Outcome:**");
  expect(reports.every((report) => report.recipient === "Codex")).toBe(true);
  const streaming = reduceWorldChat(
    reduceWorldChat(createWorldChatState(), {
      type: "QUEUE_MESSAGE",
      id: "chat-1",
      text: "Task",
    }),
    { type: "SEND_STARTED", id: "chat-1" },
  );
  const after = reduceWorldChat(streaming, {
    type: "WORKSTREAM_REPORTS",
    reports,
  });
  expect(after.activeAssistantId).toBe(streaming.activeAssistantId);
  expect(after.activity).toEqual(streaming.activity);
  expect(reduceWorldChat(after, { type: "WORKSTREAM_REPORTS", reports })).toBe(
    after,
  );
});

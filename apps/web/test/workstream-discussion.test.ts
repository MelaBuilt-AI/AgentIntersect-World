import { expect, it } from "vitest";
import { classifyWorldMessage } from "../src/world-entry/world-chat-model.js";
it("keeps workstream discussion natural and execution explicit", () => {
  for (const text of [
    "hi codex",
    "Why did you choose this?",
    "change the title to food is good",
    "Could you explain the last change?",
  ]) {
    expect(classifyWorldMessage(text, true)).toEqual({
      kind: "remote-chat",
      text,
    });
  }
  for (const prefix of ["/work ", "/work continue ", "/work start "]) {
    expect(
      classifyWorldMessage(prefix + "change the title to food is good", true),
    ).toMatchObject({
      kind: "local-workstream",
      action: "request",
      task: "change the title to food is good",
    });
  }
  expect(classifyWorldMessage("/work status", true)).toMatchObject({
    action: "inspect",
  });
  expect(classifyWorldMessage("/work cancel", true)).toMatchObject({
    action: "cancel",
  });
  expect(classifyWorldMessage("Build a settings panel")).toMatchObject({
    action: "request",
  });
});

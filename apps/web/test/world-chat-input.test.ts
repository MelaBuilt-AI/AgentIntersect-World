import { describe, expect, it } from "vitest";

import {
  createWorldChatInputHistory,
  recallWorldChatHistory,
  recordWorldChatSubmission,
  shouldConsumeWorldChatShortcut,
} from "../src/world-entry/world-chat-model.js";

describe("active World chat input keyboard behavior", () => {
  it("consumes slash only in the active World outside editable or modal surfaces", () => {
    expect(
      shouldConsumeWorldChatShortcut({
        key: "/",
        target: { tagName: "DIV" },
        worldActive: true,
        dialogOpen: false,
      }),
    ).toBe(true);
    expect(
      shouldConsumeWorldChatShortcut({
        key: "/",
        target: { tagName: "DIV" },
        worldActive: false,
        dialogOpen: false,
      }),
    ).toBe(false);
    for (const target of [
      { tagName: "INPUT" },
      { tagName: "TEXTAREA" },
      { tagName: "SELECT" },
      { tagName: "DIV", isContentEditable: true },
    ])
      expect(
        shouldConsumeWorldChatShortcut({
          key: "/",
          target,
          worldActive: true,
          dialogOpen: false,
        }),
      ).toBe(false);
    expect(
      shouldConsumeWorldChatShortcut({
        key: "/",
        target: { tagName: "DIV" },
        worldActive: true,
        dialogOpen: true,
      }),
    ).toBe(false);
  });

  it("keeps five exact non-empty submissions, including duplicates", () => {
    let history = createWorldChatInputHistory();
    for (const submission of [
      "one",
      "two",
      "repeat",
      "repeat",
      "/agent follow",
      "six",
      "   ",
    ])
      history = recordWorldChatSubmission(history, submission);

    expect(history.entries).toEqual([
      "six",
      "/agent follow",
      "repeat",
      "repeat",
      "two",
    ]);
  });

  it("recalls newest to oldest and restores the exact unsent draft", () => {
    let history = createWorldChatInputHistory();
    for (const submission of ["first", "second", "/agent move left 5"])
      history = recordWorldChatSubmission(history, submission);

    let recalled = recallWorldChatHistory(history, "up", "unsent draft");
    history = recalled.history;
    expect(recalled.message).toBe("/agent move left 5");
    recalled = recallWorldChatHistory(history, "up", recalled.message);
    history = recalled.history;
    expect(recalled.message).toBe("second");
    recalled = recallWorldChatHistory(history, "up", recalled.message);
    history = recalled.history;
    expect(recalled.message).toBe("first");
    recalled = recallWorldChatHistory(history, "down", recalled.message);
    history = recalled.history;
    expect(recalled.message).toBe("second");
    recalled = recallWorldChatHistory(history, "down", recalled.message);
    history = recalled.history;
    expect(recalled.message).toBe("/agent move left 5");
    recalled = recallWorldChatHistory(history, "down", recalled.message);
    expect(recalled.message).toBe("unsent draft");
    expect(recalled.history.index).toBeNull();
  });
});

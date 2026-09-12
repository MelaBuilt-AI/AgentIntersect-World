import { expect, it, vi } from "vitest";
import { createWorldEntryClient } from "../src/world-entry/world-entry-client.js";
it("carries a selected saved connection into the native World session request", async () => {
  const createWorldSession = vi
    .fn()
    .mockRejectedValue(new Error("stop before native execution"));
  const client = createWorldEntryClient({
    sessionClient: { createWorldSession } as never,
  });
  await client.connectWorldOwnedAgent(
    "codex",
    "test-world",
    "Work Codex",
    "6b160d9e-299f-42d5-90a6-5468451e485c",
  );
  expect(createWorldSession).toHaveBeenCalledWith(
    expect.objectContaining({
      connectionId: "6b160d9e-299f-42d5-90a6-5468451e485c",
    }),
  );
});

import fs from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Execute the actual component callback with its closure ports. This is not a
// browser journey or React scheduling proof; manual product acceptance remains.
const source = fs.readFileSync(
  new URL("../src/world-entry/WorldEntryExperience.tsx", import.meta.url),
  "utf8",
);
const callback = source.slice(
  source.indexOf("  const resetWorldSession ="),
  source.indexOf("  const inWorld ="),
);
const javascript = ts.transpile(callback, { target: ts.ScriptTarget.ES2022 });

function setup() {
  const setters = Object.fromEntries(
    [...callback.matchAll(/\b(set[A-Z]\w*)\(/g)].map((match) => [
      match[1]!,
      vi.fn(),
    ]),
  );
  const context = {
    ...setters,
    resetInFlight: { current: false },
    resetRequest: { current: null },
    chatBusy: false,
    processingChat: { current: false },
    client: {
      currentConstellation: vi.fn().mockResolvedValue({
        projection: { worldInstanceId: "old", revision: 8 },
      }),
      resetSession: vi.fn().mockResolvedValue({
        projection: { worldInstanceId: "fresh", agents: [], revision: 0 },
      }),
    },
    state: { sessionMode: "multi" },
    session: { sessionId: "single" },
    processedRosterMovementOutcomes: { current: new Map([["old", "outcome"]]) },
    leaveWorld: vi.fn(),
    crypto: { randomUUID: () => "reset-id" },
  };
  const run = new Function(
    ...Object.keys(context),
    `${javascript}; return resetWorldSession;`,
  )(...Object.values(context)) as () => Promise<void>;
  return { context, setters, run };
}

describe("World reset component callback", () => {
  it("does not leave or free local seats until backend teardown succeeds; coalesces double clicks", async () => {
    const { context, setters, run } = setup();
    let complete!: (value: unknown) => void;
    context.client.resetSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const pending = run();
    await vi.waitFor(() =>
      expect(context.client.resetSession).toHaveBeenCalledTimes(1),
    );
    await run();
    expect(context.leaveWorld).not.toHaveBeenCalled();
    expect(setters.setConstellation).not.toHaveBeenCalled();
    const projection = { worldInstanceId: "fresh", agents: [], revision: 0 };
    complete({ projection });
    await pending;
    expect(setters.setConstellation).toHaveBeenCalledWith(projection);
    expect(setters.setAcceptedAgentAvatars).toHaveBeenCalledWith({});
    expect(setters.setSelectedRecipientId).toHaveBeenCalledWith(null);
    expect(setters.setSelectedConnectionId).toHaveBeenCalledWith("");
    expect(context.processedRosterMovementOutcomes.current.size).toBe(0);
    expect(context.leaveWorld).toHaveBeenCalledExactlyOnceWith(
      "session_select",
    );
    expect(context.resetRequest.current).toBeNull();
    expect(context.resetInFlight.current).toBe(false);
  });

  it("retains the same request identity after failure and only leaves after a successful retry", async () => {
    const { context, setters, run } = setup();
    context.client.resetSession.mockRejectedValueOnce(new Error("busy"));
    await run();
    const failedRequest = context.resetRequest.current;
    expect(failedRequest).not.toBeNull();
    expect(context.leaveWorld).not.toHaveBeenCalled();
    expect(setters.setConstellation).not.toHaveBeenCalled();
    expect(setters.setError).toHaveBeenLastCalledWith(
      expect.stringContaining("retry Reset Session"),
    );
    await run();
    expect(context.client.currentConstellation).toHaveBeenCalledTimes(1);
    expect(context.client.resetSession.mock.calls[1]?.[0]).toBe(failedRequest);
    expect(context.leaveWorld).toHaveBeenCalledOnce();
  });

  it("includes single-session ownership cleanup and blocks known active chat before teardown", async () => {
    const single = setup();
    single.context.state.sessionMode = "single";
    await single.run();
    expect(single.context.client.resetSession).toHaveBeenCalledWith(
      expect.any(Object),
      single.context.session,
    );
    const busy = setup();
    busy.context.processingChat.current = true;
    await busy.run();
    expect(busy.context.client.currentConstellation).not.toHaveBeenCalled();
    expect(busy.context.leaveWorld).not.toHaveBeenCalled();
  });
});

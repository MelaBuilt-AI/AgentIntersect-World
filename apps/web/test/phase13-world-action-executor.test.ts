import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildNavigationMesh } from "../../../packages/navigation/src/index.js";

import { readPluginWorldActionProposal } from "../../local-server/src/agent-sessions.js";
import {
  WorldActionService,
  importWorldActionProposal,
} from "../../local-server/src/world-actions.js";
import { createWorldActionExecutor } from "../src/world-actions/world-action-executor.js";

const roots: string[] = [];
afterEach(() => {
  for (const value of roots.splice(0)) fs.rmSync(value, { recursive: true });
});

const fixture = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-executor-"));
  roots.push(directory);
  const sessionId = "00000000-0000-4000-8000-000000000001";
  const repositoryRef = "aiw://object/repository-a";
  const sourceRef = "aiw://object/package-spatial-code-graph";
  const destinationRef = "aiw://object/package-renderer-r3f";
  const nativeSessionRef = "effective-native-session-a";
  const context = {
    binding: {
      sessionId,
      adapterSessionRef: nativeSessionRef,
      repositoryRef,
      worldGeneration: "world-a",
      layoutGeneration: "layout-a",
      graphGeneration: "00000000-0000-4000-8000-000000000099",
      capabilitySnapshotHash: "a".repeat(64),
    },
    worldActionsEnabled: true,
    targets: [
      { objectRef: sourceRef, repositoryRef, state: "current" as const },
      { objectRef: destinationRef, repositoryRef, state: "current" as const },
    ],
    navigationMesh: buildNavigationMesh({
      worldGeneration: "world-a",
      layoutGeneration: "layout-a",
      navigationBounds: { x: 0, z: 0, width: 20, depth: 10 },
      avatarRadius: 0.35,
      clearance: 0.15,
      obstacles: [],
    }),
    positions: new Map([
      [sourceRef, { x: 2, z: 5, interactionRadius: 0.75 }],
      [destinationRef, { x: 18, z: 5, interactionRadius: 0.75 }],
    ]),
    actorPosition: { x: 2, z: 5 },
    relationships: [],
  };
  return {
    directory,
    sessionId,
    repositoryRef,
    sourceRef,
    destinationRef,
    nativeSessionRef,
    context,
  };
};

function writeHelperProposal(input: ReturnType<typeof fixture>) {
  const proposalId = "40000000-0000-4000-8000-000000000001";
  const proposalPath = path.join(input.directory, `${proposalId}.json`);
  fs.writeFileSync(
    proposalPath,
    JSON.stringify({
      schema: "aiw.hermes-world-action-proposal/0.13",
      proposalId,
      nativeSessionHash: createHash("sha256")
        .update(input.nativeSessionRef)
        .digest("hex"),
      sequence: 1,
      createdAt: "2026-07-21T12:00:00.000Z",
      ttlMs: 30_000,
      actions: [
        {
          kind: "focus",
          target: {
            repositoryRef: input.repositoryRef,
            objectRef: input.sourceRef,
          },
        },
        {
          kind: "trace",
          target: {
            repositoryRef: input.repositoryRef,
            objectRef: input.sourceRef,
          },
          destination: {
            repositoryRef: input.repositoryRef,
            objectRef: input.destinationRef,
          },
        },
        {
          kind: "navigate",
          target: {
            repositoryRef: input.repositoryRef,
            objectRef: input.destinationRef,
          },
        },
        {
          kind: "inspect",
          target: {
            repositoryRef: input.repositoryRef,
            objectRef: input.destinationRef,
          },
        },
      ],
    }),
    { mode: 0o600 },
  );
  return proposalPath;
}

describe("ordered World Action executor", () => {
  it("drives a helper-spool proposal through focus, trace, canonical navigation, arrival, and inspect in order", async () => {
    const input = fixture();
    const imported = readPluginWorldActionProposal(
      writeHelperProposal(input),
      input.nativeSessionRef,
    );
    expect(imported).not.toBeNull();
    const service = new WorldActionService(
      path.join(input.directory, "state"),
      {
        now: () => Date.parse("2026-07-21T12:00:10.000Z"),
      },
    );
    const accepted = await importWorldActionProposal(
      service,
      input.sessionId,
      imported!,
      input.context,
    );
    expect(accepted.result.accepted).toBe(true);
    if (!accepted.result.accepted) return;

    const presented: string[] = [];
    const positions: Array<{ x: number; z: number }> = [];
    let frame = 0;
    const executor = createWorldActionExecutor({
      noWebGL: false,
      reducedMotion: false,
      requestFrame: (callback) => {
        const id = ++frame;
        queueMicrotask(() => callback(id));
        return id;
      },
      cancelFrame: vi.fn(),
      onSelect: vi.fn(),
      onFocus: vi.fn(),
      onPresent: (kind) => presented.push(kind),
      onPosition: (position) => positions.push(position),
      onTransition: async (actionId, event, actorPosition) => {
        service.transition(
          input.sessionId,
          actionId,
          event,
          actorPosition ? { ...input.context, actorPosition } : input.context,
        );
      },
      onInterrupt: (reason) => service.interrupt(input.sessionId, reason),
    });

    await executor.execute(accepted.result);

    expect(presented).toEqual(["focus", "trace", "navigate", "inspect"]);
    expect(positions.at(-1)).toEqual({ x: 18, z: 5 });
    const navigationId = accepted.result.envelope.actions[2]!.actionId;
    expect(
      service
        .timeline(input.sessionId)
        .find(({ actionId }) => actionId === navigationId),
    ).toMatchObject({ state: "arrived", arrived: true });
  });

  it("uses semantic focus without movement or arrival when WebGL is unavailable", async () => {
    const input = fixture();
    const service = new WorldActionService(
      path.join(input.directory, "state"),
      {
        now: () => Date.parse("2026-07-21T12:00:10.000Z"),
      },
    );
    const accepted = await service.propose(
      input.sessionId,
      {
        actions: [
          {
            kind: "navigate",
            target: {
              repositoryRef: input.repositoryRef,
              objectRef: input.destinationRef,
            },
          },
        ],
      },
      input.context,
    );
    if (!accepted.accepted) throw new Error("fixture proposal rejected");
    const onFocus = vi.fn();
    const onPosition = vi.fn();
    const onTransition = vi.fn((actionId: string, event: "semantic-focus") =>
      service.transition(input.sessionId, actionId, event, input.context),
    );
    const executor = createWorldActionExecutor({
      noWebGL: true,
      reducedMotion: false,
      requestFrame: vi.fn(),
      cancelFrame: vi.fn(),
      onSelect: vi.fn(),
      onFocus,
      onPresent: vi.fn(),
      onPosition,
      onTransition,
      onInterrupt: vi.fn(),
    });

    await executor.execute(accepted);

    expect(onFocus).toHaveBeenCalledWith(input.destinationRef);
    expect(onPosition).not.toHaveBeenCalled();
    expect(onTransition).toHaveBeenCalledWith(
      accepted.envelope.actions[0]!.actionId,
      "semantic-focus",
    );
    expect(service.timeline(input.sessionId)[0]).toMatchObject({
      state: "attention",
      arrived: false,
      reason: "semantic-only",
    });
  });

  it("cancels local frames and posts an authoritative interrupt during movement", async () => {
    const input = fixture();
    const service = new WorldActionService(path.join(input.directory, "state"));
    const accepted = await service.propose(
      input.sessionId,
      {
        actions: [
          {
            kind: "navigate",
            target: {
              repositoryRef: input.repositoryRef,
              objectRef: input.destinationRef,
            },
          },
        ],
      },
      input.context,
    );
    if (!accepted.accepted) throw new Error("fixture proposal rejected");
    let pending: FrameRequestCallback | undefined;
    const cancelFrame = vi.fn();
    const executor = createWorldActionExecutor({
      noWebGL: false,
      reducedMotion: false,
      requestFrame: (callback) => {
        pending = callback;
        return 41;
      },
      cancelFrame,
      onSelect: vi.fn(),
      onFocus: vi.fn(),
      onPresent: vi.fn(),
      onPosition: vi.fn(),
      onTransition: async (actionId, event, actorPosition) =>
        service.transition(
          input.sessionId,
          actionId,
          event,
          actorPosition ? { ...input.context, actorPosition } : input.context,
        ),
      onInterrupt: (reason) => service.interrupt(input.sessionId, reason),
    });
    const executing = executor.execute(accepted);
    await vi.waitFor(() => expect(pending).toBeTypeOf("function"));

    executor.interrupt("cancel");
    await executing;

    expect(cancelFrame).toHaveBeenCalledWith(41);
    expect(service.timeline(input.sessionId)[0]).toMatchObject({
      state: "interrupted",
      arrived: false,
      reason: "cancel",
    });
  });

  it("claims each polled batch once while pending and after completion", async () => {
    const actionId = "50000000-0000-4000-8000-000000000001";
    const execution = {
      accepted: true as const,
      envelope: {
        batchId: "60000000-0000-4000-8000-000000000001",
        sequence: 1,
        actions: [{ actionId, kind: "navigate" }],
      },
      outcomes: [{ actionId, state: "path-planned" }],
      paths: {
        [actionId]: [
          { x: 0, z: 0 },
          { x: 1, z: 1 },
        ],
      },
    };
    let pending: FrameRequestCallback | undefined;
    const cancelFrame = vi.fn();
    const onPresent = vi.fn();
    const onPosition = vi.fn();
    const onTransition = vi.fn();
    const executor = createWorldActionExecutor({
      noWebGL: false,
      reducedMotion: false,
      requestFrame: (callback) => {
        pending = callback;
        return 71;
      },
      cancelFrame,
      onSelect: vi.fn(),
      onFocus: vi.fn(),
      onPresent,
      onPosition,
      onTransition,
      onInterrupt: vi.fn(),
    });

    const first = executor.execute(execution);
    await vi.waitFor(() => expect(pending).toBeTypeOf("function"));
    await executor.execute(execution);

    expect(cancelFrame).not.toHaveBeenCalled();
    expect(onPresent).toHaveBeenCalledTimes(1);
    expect(onTransition).toHaveBeenCalledTimes(1);

    pending!(17);
    await first;
    await executor.execute(execution);

    expect(onPresent).toHaveBeenCalledTimes(1);
    expect(onPosition).toHaveBeenCalledTimes(2);
    expect(onTransition).toHaveBeenCalledTimes(2);

    await executor.execute({
      ...execution,
      envelope: {
        ...execution.envelope,
        batchId: "60000000-0000-4000-8000-000000000002",
        sequence: 2,
      },
      paths: { [actionId]: [{ x: 2, z: 2 }] },
    });

    expect(onPresent).toHaveBeenCalledTimes(2);
  });
});

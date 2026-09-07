import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildNavigationMesh } from "@agentintersect-world/navigation";

import { registerWorldActionRoutes } from "../src/world-action-routes.js";
import { WorldActionService } from "../src/world-actions.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

describe("World Action HTTP boundary", () => {
  it("accepts structured proposals, lists semantic timeline, interrupts, and rejects unknown fields", async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "aiw-phase13-api-"),
    );
    roots.push(directory);
    const sessionId = "00000000-0000-4000-8000-000000000001";
    const repositoryRef = "aiw://object/repository-a";
    const objectRef = "aiw://object/package-a";
    const context = {
      binding: {
        sessionId,
        adapterSessionRef: "native-session-a",
        repositoryRef,
        worldGeneration: "world-a",
        layoutGeneration: "layout-a",
        graphGeneration: null,
        capabilitySnapshotHash: "a".repeat(64),
      },
      worldActionsEnabled: true,
      targets: [
        {
          objectRef,
          repositoryRef,
          state: "current" as const,
          path: "packages/a",
        },
      ],
      navigationMesh: buildNavigationMesh({
        worldGeneration: "world-a",
        layoutGeneration: "layout-a",
        navigationBounds: { x: 0, z: 0, width: 10, depth: 10 },
        avatarRadius: 0.35,
        clearance: 0.15,
        obstacles: [],
      }),
      positions: new Map([
        [objectRef, { x: 8, z: 8, interactionRadius: 0.75 }],
      ]),
    };
    const service = new WorldActionService(directory);
    const server = Fastify();
    registerWorldActionRoutes(server, service, async (requested) =>
      requested === sessionId ? context : null,
    );
    const proposal = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/proposals`,
      payload: {
        actions: [{ kind: "navigate", target: { repositoryRef, objectRef } }],
      },
    });
    expect(proposal.statusCode).toBe(202);
    expect(proposal.json()).toMatchObject({
      accepted: true,
      envelope: { schema: "aiw.world-action/0.13" },
    });
    const actionId = proposal.json().envelope.actions[0].actionId as string;

    const timeline = await server.inject({
      method: "GET",
      url: `/world-actions/${sessionId}`,
    });
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json().actions[0]).toMatchObject({
      state: "path-planned",
      arrived: false,
    });

    const cancel = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/actions/${actionId}/cancel`,
      payload: {},
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json()).toMatchObject({
      cancelled: true,
      idempotent: false,
      actions: [expect.objectContaining({ state: "cancelled" })],
    });
    const cancelAgain = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/actions/${actionId}/cancel`,
      payload: {},
    });
    expect(cancelAgain.json()).toMatchObject({
      cancelled: true,
      idempotent: true,
    });

    const secondProposal = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/proposals`,
      payload: {
        actions: [{ kind: "navigate", target: { repositoryRef, objectRef } }],
      },
    });
    expect(secondProposal.statusCode).toBe(202);
    const movingActionId = secondProposal.json().envelope.actions[0]
      .actionId as string;
    const moving = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/actions/${movingActionId}/transition`,
      payload: { event: "moving" },
    });
    expect(moving.statusCode).toBe(200);
    expect(moving.json().actions[0]).toMatchObject({ state: "moving" });
    const arrived = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/actions/${movingActionId}/transition`,
      payload: { event: "arrived", actorPosition: { x: 8, z: 8 } },
    });
    expect(arrived.statusCode).toBe(200);
    expect(arrived.json().actions[0]).toMatchObject({
      state: "arrived",
      arrived: true,
    });

    const thirdProposal = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/proposals`,
      payload: {
        actions: [{ kind: "navigate", target: { repositoryRef, objectRef } }],
      },
    });
    expect(thirdProposal.statusCode).toBe(202);

    const interrupt = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/interrupt`,
      payload: { reason: "escape" },
    });
    expect(interrupt.statusCode).toBe(200);
    expect(interrupt.json().actions[0]).toMatchObject({
      state: "interrupted",
      reason: "escape",
    });

    const hostile = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/proposals`,
      payload: {
        actions: [{ kind: "focus", target: { repositoryRef, objectRef } }],
        command: "rm -rf",
      },
    });
    expect(hostile.statusCode).toBe(400);
    // User-owned presentation movement does not require native autonomous tools.
    context.worldActionsEnabled = false;
    const manualAction = {
      kind: "move-agent",
      schema: "aiw.agent-movement/1",
      actorId: sessionId,
      source: "user-directed",
      speed: 4,
      target: { kind: "follow-user", stoppingRadius: 1.5 },
    };
    const manual = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/proposals`,
      payload: { actions: [manualAction] },
    });
    expect(manual.statusCode).toBe(202);
    const autonomous = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/proposals`,
      payload: { actions: [{ ...manualAction, source: "agent-autonomous" }] },
    });
    expect(autonomous.statusCode).toBe(409);
    const wrongActor = await server.inject({
      method: "POST",
      url: `/world-actions/${sessionId}/proposals`,
      payload: {
        actions: [
          { ...manualAction, actorId: "00000000-0000-4000-8000-000000000099" },
        ],
      },
    });
    expect(wrongActor.statusCode).toBe(409);
    await server.close();
  });
});

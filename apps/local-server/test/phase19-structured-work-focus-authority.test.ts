import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AdapterRegistry,
  AgentSessionGateway,
  AgentSessionStore,
  type AgentAdapter,
} from "../src/agent-sessions.js";
import { createLocalServer } from "../src/server.js";
import type {
  WorldActionContext,
  WorldActionService,
} from "../src/world-actions.js";

const roots: string[] = [];
const servers: ReturnType<typeof createLocalServer>[] = [];

async function indexRepository(
  server: ReturnType<typeof createLocalServer>,
  rootPath: string,
) {
  const created = await server.inject({
    method: "POST",
    url: "/repository-indexes",
    headers: { "idempotency-key": "phase19-structured-focus" },
    payload: { rootPath },
  });
  expect(created.statusCode).toBe(202);
  const operationId = created.json().data.id as string;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const operation = await server.inject({
      method: "GET",
      url: `/repository-indexes/${operationId}`,
    });
    if (operation.json().data.status !== "running") {
      expect(operation.json().data.status).toBe("succeeded");
      const world = await server.inject({
        method: "GET",
        url: "/world/current",
      });
      expect(world.statusCode).toBe(200);
      return world.json().data.snapshot as {
        repositoryRef: string;
        generationFingerprint: string;
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("repository index did not settle");
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

describe("Phase 19 structured work-focus production composition", () => {
  it.each([
    { adapterId: "codex", repositoryPath: "codex/Task15Codex.md" },
    {
      adapterId: "claude-code",
      repositoryPath: "claude-code/Task15Claude.md",
    },
  ])(
    "$adapterId authorizes only server-owned structured-evidence movement",
    async ({ adapterId, repositoryPath }) => {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "aiw-focus-authority-"),
      );
      roots.push(root);
      fs.mkdirSync(path.dirname(path.join(root, repositoryPath)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(root, repositoryPath), "# Task 15 area\n");

      const adapter: AgentAdapter = {
        id: adapterId,
        attest: async () => ({
          schema: "aiw.agent-capabilities/0.12",
          adapterId,
          adapterVersion: "1",
          transport: "loopback-http-sse",
          origin: "local",
          auth: "server-bearer",
          supportedModes: ["explore"],
          ordering: "per-session-strict",
          resume: "session-api",
          shutdownOwner: "external",
          maxInputBytes: 16_384,
          maxEventBytes: 32_768,
          capabilities: {
            attach: true,
            sendText: true,
            streamDeltas: false,
            toolStatus: true,
            approvals: false,
            interrupt: false,
            avatarProposal: false,
            skillsDisclosure: false,
            worldActions: false,
          },
          unavailable: {
            streamDeltas: "fixture",
            approvals: "fixture",
            interrupt: "fixture",
            avatarProposal: "fixture",
            skillsDisclosure: "fixture",
          },
        }),
        listSessions: async () => [],
        attach: async (id) => ({
          id,
          rootId: id,
          source: "fixture",
          title: "Fixture",
        }),
        sendText: async (_session, _text, context) => {
          await context?.onEvent?.({
            type: "tool.started",
            toolName: "Read",
            activityId: `activity-read-${adapterId}`,
            repositoryLocator: { operation: "read", paths: [repositoryPath] },
            redaction: { applied: true, count: 1 },
          });
          return { finalText: "done", deltas: [] };
        },
      };
      const registry = new AdapterRegistry([adapter]);
      const gateway = new AgentSessionGateway({
        registry,
        store: new AgentSessionStore(path.join(root, ".agent-sessions")),
      });
      const observedAuthorities: boolean[] = [];
      const worldActionService = {
        propose: async (
          _sessionId: string,
          _proposal: unknown,
          context: WorldActionContext,
        ) => {
          observedAuthorities.push(context.worldActionsEnabled);
          return context.worldActionsEnabled
            ? {
                accepted: true,
                outcomes: [
                  { kind: "move-agent", actionId: `movement-${adapterId}` },
                ],
              }
            : { accepted: false, outcomes: [] };
        },
        cancel: () => undefined,
      } as unknown as WorldActionService;
      const server = createLocalServer({
        agentSessionGateway: gateway,
        agentAdapterRegistry: registry,
        worldActionService,
        worldActionContext: (sessionId) =>
          ({
            binding: {
              sessionId,
              adapterSessionRef: `native-${adapterId}`,
              repositoryRef: gateway.status(sessionId).repositoryRef,
              worldGeneration: "world-current",
              layoutGeneration: "layout-current",
              graphGeneration: null,
              capabilitySnapshotHash:
                gateway.status(sessionId).capabilitySnapshotHash,
            },
            worldActionsEnabled: false,
            targets: [],
            navigationMesh: {},
            positions: new Map(),
            relationships: [],
          }) as unknown as WorldActionContext,
      });
      servers.push(server);

      const snapshot = await indexRepository(server, root);
      const session = await gateway.attach({
        adapterId: adapter.id,
        adapterSessionRef: `native-${adapterId}`,
        profile: "default",
        workspaceId: "workspace-read-only",
        repositoryRef: snapshot.repositoryRef,
        mode: "explore",
      });
      expect(
        (await registry.capabilities())[0]?.capabilities.worldActions,
      ).toBe(false);

      await gateway.sendText(session.sessionId, {
        text: `Inspect ${repositoryPath}`,
        binding: session,
      });

      expect(observedAuthorities).toEqual([true]);
      expect(gateway.currentWorkFocus(session.sessionId)).toMatchObject({
        activityId: `activity-read-${adapterId}`,
        objectKind: "file",
        repositoryPath,
        movementRequestId: `movement-${adapterId}`,
        state: "navigating",
      });
    },
  );
});

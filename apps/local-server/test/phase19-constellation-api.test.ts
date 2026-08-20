import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConstellationService,
  type ConstellationLifecyclePort,
} from "../src/constellation-service.js";
import { createLocalServer, type LocalServer } from "../src/server.js";

const roots: string[] = [];
const servers: LocalServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

function directory(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-constellation-api-"));
  roots.push(root);
  return path.join(root, "constellation");
}

function lifecyclePort(
  overrides: Partial<ConstellationLifecyclePort> = {},
): ConstellationLifecyclePort {
  return {
    validateBinding: async (binding) => ({
      ...binding,
      continuity: "current",
    }),
    endWorldSession: async () => undefined,
    ...overrides,
  };
}

const identity = (expectedRevision: number, idempotencyKey: string) => ({
  worldInstanceId: "world-api",
  expectedRevision,
  idempotencyKey,
});

const agent = (
  index: number,
  adapterId: "hermes" | "openclaw" | "codex" | "claude-code",
) => ({
  ...identity(index - 1, `api-add-${index}`),
  agent: {
    rosterId: `api-roster-${index}`,
    adapterId,
    sessionOwnership:
      adapterId === "hermes" ? "operator-persistent" : "world-owned",
    worldSessionId: `api-world-session-${index}`,
    nativeRootSessionRef: `api-native-root-${index}`,
    displayName: `API Agent ${index}`,
  },
});

async function serverWith(
  lifecycle: ConstellationLifecyclePort = lifecyclePort(),
  stateDirectory = directory(),
): Promise<{ server: LocalServer; service: ConstellationService }> {
  const service = await ConstellationService.open({
    directory: stateDirectory,
    lifecycle,
    worldInstanceId: "world-api",
  });
  const server = createLocalServer({ constellationService: service });
  servers.push(server);
  return { server, service };
}

describe("Phase 19 constellation API", () => {
  it("exposes all six routes with normal envelopes and side-effect-free repeated GET", async () => {
    const validateBinding = vi.fn(async (binding) => ({
      ...binding,
      continuity: "previous-recovered" as const,
    }));
    const endWorldSession = vi.fn(async () => undefined);
    const { server } = await serverWith(
      lifecyclePort({ validateBinding, endWorldSession }),
    );

    const empty = await server.inject({
      method: "GET",
      url: "/constellation/current",
      headers: {
        "x-correlation-id": "10000000-0000-4000-8000-000000000019",
      },
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.headers["x-correlation-id"]).toBe(
      "10000000-0000-4000-8000-000000000019",
    );
    expect(empty.json()).toMatchObject({
      ok: true,
      data: { projection: { agents: [], revision: 0 } },
      meta: {
        correlationId: "10000000-0000-4000-8000-000000000019",
        schema: "aiw.api/0.3",
      },
    });

    const created = await server.inject({
      method: "POST",
      url: "/constellation/agents",
      payload: agent(1, "hermes"),
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.projection.agents[0]).toMatchObject({
      rosterId: "api-roster-1",
      addedOrder: 0,
    });

    const avatar = await server.inject({
      method: "POST",
      url: "/constellation/agents/api-roster-1/avatar",
      payload: {
        ...identity(1, "api-avatar"),
        avatar: {
          status: "accepted",
          profileId: "api-avatar-profile",
          sessionId: "api-avatar-session",
        },
      },
    });
    expect(avatar.statusCode).toBe(200);
    expect(avatar.json().data.projection.agents[0].avatar.status).toBe(
      "accepted",
    );

    const reconnected = await server.inject({
      method: "POST",
      url: "/constellation/agents/api-roster-1/reconnect",
      payload: identity(2, "api-reconnect"),
    });
    expect(reconnected.statusCode).toBe(200);
    expect(reconnected.json().data.projection.agents[0]).toMatchObject({
      continuity: "previous-recovered",
      connection: "connected",
    });

    const removed = await server.inject({
      method: "DELETE",
      url: "/constellation/agents/api-roster-1",
      payload: identity(3, "api-remove"),
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().data.projection.agents).toEqual([]);

    const ended = await server.inject({
      method: "POST",
      url: "/constellation/end",
      payload: identity(4, "api-end"),
    });
    expect(ended.statusCode).toBe(200);
    expect(ended.json().data.projection).toMatchObject({
      lifecycle: "ended",
      entryReady: false,
    });
    expect(endWorldSession).not.toHaveBeenCalled();

    const firstRead = await server.inject({
      method: "GET",
      url: "/constellation/current",
    });
    const secondRead = await server.inject({
      method: "GET",
      url: "/constellation/current",
    });
    expect(secondRead.json().data).toEqual(firstRead.json().data);
    expect(validateBinding).toHaveBeenCalledTimes(1);
    expect(endWorldSession).not.toHaveBeenCalled();
  });

  it("maps bounded validation, not-found, conflict, limit, and unavailable failures", async () => {
    const { server } = await serverWith();
    const invalid = await server.inject({
      method: "POST",
      url: "/constellation/agents",
      payload: { ...agent(1, "hermes"), executableArgs: ["SECRET"] },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("validation");
    expect(JSON.stringify(invalid.json())).not.toContain("SECRET");

    const missing = await server.inject({
      method: "DELETE",
      url: "/constellation/agents/missing-roster",
      payload: identity(0, "missing"),
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("not_found");

    const first = await server.inject({
      method: "POST",
      url: "/constellation/agents",
      payload: agent(1, "hermes"),
    });
    expect(first.statusCode).toBe(201);
    const stale = await server.inject({
      method: "POST",
      url: "/constellation/agents",
      payload: { ...agent(2, "codex"), expectedRevision: 0 },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe("revision_conflict");

    for (const [index, adapterId] of [
      [2, "openclaw"],
      [3, "codex"],
      [4, "claude-code"],
    ] as const) {
      const response = await server.inject({
        method: "POST",
        url: "/constellation/agents",
        payload: agent(index, adapterId),
      });
      expect(response.statusCode).toBe(201);
    }
    const limited = await server.inject({
      method: "POST",
      url: "/constellation/agents",
      payload: agent(5, "openclaw"),
    });
    expect(limited.statusCode).toBe(413);
    expect(limited.json().error.code).toBe("resource_limit");

    const unavailableDirectory = directory();
    fs.mkdirSync(unavailableDirectory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      path.join(unavailableDirectory, "constellation.current.json"),
      "corrupt",
      { mode: 0o600 },
    );
    const unavailableService = await ConstellationService.open({
      directory: unavailableDirectory,
      lifecycle: lifecyclePort(),
    });
    const unavailableServer = createLocalServer({
      constellationService: unavailableService,
    });
    servers.push(unavailableServer);
    const unavailable = await unavailableServer.inject({
      method: "GET",
      url: "/constellation/current",
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toMatchObject({
      ok: false,
      error: {
        code: "authority_unavailable",
        message: "Constellation state is unavailable",
      },
    });
  });

  it("exposes no execution, worktree, repository, or message authority", async () => {
    const { server } = await serverWith();
    for (const url of [
      "/constellation/messages",
      "/constellation/worktrees",
      "/constellation/repositories",
      "/constellation/commands",
    ]) {
      const response = await server.inject({
        method: "POST",
        url,
        payload: {},
      });
      expect(response.statusCode).toBe(404);
    }
    const current = await server.inject({
      method: "GET",
      url: "/constellation/current",
    });
    expect(JSON.stringify(current.json())).not.toMatch(
      /sendText|message|worktree|repositoryMutation|command|executable/i,
    );
  });
});

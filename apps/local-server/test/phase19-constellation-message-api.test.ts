import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ConstellationMessageService } from "../src/constellation-message-service.js";
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

async function fixture() {
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-message-api-"));
  roots.push(stateRoot);
  const lifecycle: ConstellationLifecyclePort = {
    validateBinding: async (binding) => ({ ...binding, continuity: "current" }),
    endWorldSession: async () => undefined,
  };
  const constellation = await ConstellationService.open({
    directory: path.join(stateRoot, "constellation"),
    lifecycle,
    worldInstanceId: "world-api",
  });
  await constellation.addAgent({
    worldInstanceId: "world-api",
    expectedRevision: 0,
    idempotencyKey: "add",
    agent: {
      rosterId: "roster-hermes",
      adapterId: "hermes",
      sessionOwnership: "operator-persistent",
      worldSessionId: "session-hermes",
      nativeRootSessionRef: "native-hermes",
      displayName: "Hermes",
    },
  });
  await constellation.setAvatar({
    worldInstanceId: "world-api",
    expectedRevision: 1,
    idempotencyKey: "avatar",
    rosterId: "roster-hermes",
    avatar: {
      status: "accepted",
      profileId: "profile-hermes",
      sessionId: "avatar-hermes",
    },
  });
  const sendText = vi.fn(async () => ({ finalText: "Hermes reply" }));
  const messages = await ConstellationMessageService.open({
    directory: path.join(stateRoot, "messages"),
    constellation,
    gateway: {
      status: (sessionId: string) => ({ sessionId }),
      sendText,
    },
  });
  const server = createLocalServer({
    constellationService: constellation,
    constellationMessageService: messages,
  });
  servers.push(server);
  return { server, sendText };
}

describe("Phase 19 constellation message API", () => {
  it("creates one server-owned grouped request and reads its durable result", async () => {
    const { server, sendText } = await fixture();
    const requestId = "20000000-0000-4000-8000-000000000001";
    const created = await server.inject({
      method: "POST",
      url: "/constellation/messages",
      headers: {
        "x-correlation-id": "20000000-0000-4000-8000-000000000019",
      },
      payload: {
        requestId,
        idempotencyKey: "api-message-1",
        text: "hello everyone",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      ok: true,
      data: {
        requestId,
        recipientRosterIds: ["roster-hermes"],
        recipients: [{ state: "completed", finalText: "Hermes reply" }],
      },
      meta: {
        correlationId: "20000000-0000-4000-8000-000000000019",
        schema: "aiw.api/0.3",
      },
    });
    expect(sendText).toHaveBeenCalledTimes(1);

    const restored = await server.inject({
      method: "GET",
      url: `/constellation/messages/${requestId}`,
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().data).toEqual(created.json().data);

    const listed = await server.inject({
      method: "GET",
      url: "/constellation/messages",
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toEqual([created.json().data]);
  });

  it("strictly validates bounded input and sends nothing for invalid exact targets", async () => {
    const { server, sendText } = await fixture();
    const unsupported = await server.inject({
      method: "POST",
      url: "/constellation/messages",
      payload: {
        requestId: "20000000-0000-4000-8000-000000000002",
        idempotencyKey: "api-message-2",
        text: "hello",
        recipientRosterIds: ["roster-hermes"],
      },
    });
    expect(unsupported.statusCode).toBe(400);

    const unknownClick = await server.inject({
      method: "POST",
      url: "/constellation/messages",
      payload: {
        requestId: "20000000-0000-4000-8000-000000000003",
        idempotencyKey: "api-message-3",
        text: "hello",
        targetRosterId: "missing-roster",
      },
    });
    expect(unknownClick.statusCode).toBe(404);

    const unknownName = await server.inject({
      method: "POST",
      url: "/constellation/messages",
      payload: {
        requestId: "20000000-0000-4000-8000-000000000004",
        idempotencyKey: "api-message-4",
        text: "@Missing hello",
      },
    });
    expect(unknownName.statusCode).toBe(404);
    expect(sendText).not.toHaveBeenCalled();
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConstellationService,
  type ConstellationLifecyclePort,
} from "../src/constellation-service.js";
import {
  ConstellationMessageService,
  ConstellationMessageServiceError,
} from "../src/constellation-message-service.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

function root(): string {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-message-group-"));
  roots.push(value);
  return value;
}

const lifecycle: ConstellationLifecyclePort = {
  validateBinding: async (binding) => ({ ...binding, continuity: "current" }),
  endWorldSession: async () => undefined,
};

async function readyConstellation(
  directory: string,
  names: readonly string[] = ["Hermes", "Codex"],
): Promise<ConstellationService> {
  const service = await ConstellationService.open({
    directory: path.join(directory, "constellation"),
    lifecycle,
    worldInstanceId: "world-messages",
  });
  let revision = 0;
  for (const [index, displayName] of names.entries()) {
    const number = index + 1;
    await service.addAgent({
      worldInstanceId: "world-messages",
      expectedRevision: revision++,
      idempotencyKey: `add-${number}`,
      agent: {
        rosterId: `roster-${number}`,
        adapterId: number === 1 ? "hermes" : "codex",
        sessionOwnership: number === 1 ? "operator-persistent" : "world-owned",
        worldSessionId: `session-${number}`,
        nativeRootSessionRef: `native-${number}`,
        displayName,
      },
    });
    await service.setAvatar({
      worldInstanceId: "world-messages",
      expectedRevision: revision++,
      idempotencyKey: `avatar-${number}`,
      rosterId: `roster-${number}`,
      avatar: {
        status: "accepted",
        profileId: `profile-${number}`,
        sessionId: `avatar-session-${number}`,
      },
    });
  }
  return service;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

const request = (number: number, text = "hello", targetRosterId?: string) => ({
  requestId: `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
  idempotencyKey: `message-${number}`,
  text,
  ...(targetRosterId ? { targetRosterId } : {}),
});

describe("Phase 19 durable constellation message service", () => {
  it("captures the ready accepted roster once, dispatches concurrently, and retains captured order", async () => {
    const stateRoot = root();
    const constellation = await readyConstellation(stateRoot);
    const turns = [
      deferred<{ finalText: string }>(),
      deferred<{ finalText: string }>(),
    ];
    const sendText = vi.fn(
      (sessionId: string) => turns[sessionId === "session-1" ? 0 : 1]!.promise,
    );
    const service = await ConstellationMessageService.open({
      directory: path.join(stateRoot, "messages"),
      constellation,
      gateway: { status: (sessionId: string) => ({ sessionId }), sendText },
    });

    const pending = service.send(request(1));
    await vi.waitFor(() => expect(sendText).toHaveBeenCalledTimes(2));
    await constellation.removeAgent({
      worldInstanceId: "world-messages",
      expectedRevision: 4,
      idempotencyKey: "remove-after-capture",
      rosterId: "roster-2",
    });
    turns[1]!.resolve({ finalText: "second finished first" });
    turns[0]!.resolve({ finalText: "first finished second" });

    const group = await pending;
    expect(sendText.mock.calls.every((call) => call.length === 2)).toBe(true);
    expect(group.recipientRosterIds).toEqual(["roster-1", "roster-2"]);
    expect(group.recipients).toEqual([
      expect.objectContaining({
        rosterId: "roster-1",
        state: "completed",
        finalText: "first finished second",
      }),
      expect.objectContaining({
        rosterId: "roster-2",
        state: "completed",
        finalText: "second finished first",
      }),
    ]);
  });

  it("serializes turns for the same native World session", async () => {
    const stateRoot = root();
    const constellation = await readyConstellation(stateRoot, ["Hermes"]);
    const first = deferred<{ finalText: string }>();
    const sendText = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ finalText: "second" });
    const service = await ConstellationMessageService.open({
      directory: path.join(stateRoot, "messages"),
      constellation,
      gateway: { status: (sessionId: string) => ({ sessionId }), sendText },
    });

    const firstSend = service.send(request(2, "first", "roster-1"));
    const secondSend = service.send(request(3, "second", "roster-1"));
    await vi.waitFor(() => expect(sendText).toHaveBeenCalledTimes(1));
    first.resolve({ finalText: "first" });
    await expect(firstSend).resolves.toMatchObject({
      recipients: [{ state: "completed", finalText: "first" }],
    });
    await expect(secondSend).resolves.toMatchObject({
      recipients: [{ state: "completed", finalText: "second" }],
    });
    expect(sendText).toHaveBeenCalledTimes(2);
  });

  it("preserves successful replies alongside bounded recipient failures", async () => {
    const stateRoot = root();
    const constellation = await readyConstellation(stateRoot);
    const sendText = vi.fn((sessionId: string) =>
      sessionId === "session-1"
        ? Promise.resolve({ finalText: "safe success" })
        : Promise.reject(new Error("SECRET /private/upstream detail")),
    );
    const service = await ConstellationMessageService.open({
      directory: path.join(stateRoot, "messages"),
      constellation,
      gateway: { status: (sessionId: string) => ({ sessionId }), sendText },
    });

    const group = await service.send(request(4));
    expect(group.recipients[0]).toMatchObject({
      state: "completed",
      finalText: "safe success",
      errorLabel: null,
    });
    expect(group.recipients[1]).toMatchObject({
      state: "failed",
      finalText: null,
      errorLabel: "Agent turn failed",
    });
    expect(JSON.stringify(group)).not.toMatch(
      /SECRET|private|upstream detail/u,
    );
  });

  it("rejects unknown and ambiguous leading @name targets without gateway calls", async () => {
    const stateRoot = root();
    const constellation = await readyConstellation(stateRoot, ["Same", "Same"]);
    const sendText = vi.fn();
    const service = await ConstellationMessageService.open({
      directory: path.join(stateRoot, "messages"),
      constellation,
      gateway: { status: (sessionId: string) => ({ sessionId }), sendText },
    });

    await expect(
      service.send(request(5, "@Missing hello")),
    ).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(service.send(request(6, "@Same hello"))).rejects.toMatchObject(
      {
        code: "conflict",
      },
    );
    expect(sendText).not.toHaveBeenCalled();
  });

  it("resolves avatar roster ID and exact normalized @name to the same roster", async () => {
    const stateRoot = root();
    const constellation = await readyConstellation(stateRoot, [
      "Mr Fluff",
      "Codex",
    ]);
    const sendText = vi.fn(async () => ({ finalText: "done" }));
    const service = await ConstellationMessageService.open({
      directory: path.join(stateRoot, "messages"),
      constellation,
      gateway: { status: (sessionId: string) => ({ sessionId }), sendText },
    });

    const clicked = await service.send(request(7, "clicked", "roster-1"));
    const mentioned = await service.send(request(8, "@Ｍｒ Fluff mentioned"));
    expect(clicked.recipientRosterIds).toEqual(["roster-1"]);
    expect(mentioned.recipientRosterIds).toEqual(["roster-1"]);
    expect(sendText.mock.calls.map((call) => call[1].text)).toEqual([
      "clicked",
      "mentioned",
    ]);
  });

  it("replays byte-equivalent idempotent requests without resend and conflicts on reuse", async () => {
    const stateRoot = root();
    const constellation = await readyConstellation(stateRoot, ["Hermes"]);
    const sendText = vi.fn(async () => ({ finalText: "once" }));
    const service = await ConstellationMessageService.open({
      directory: path.join(stateRoot, "messages"),
      constellation,
      gateway: { status: (sessionId: string) => ({ sessionId }), sendText },
    });
    const input = request(9, "same bytes");

    const first = await service.send(input);
    await expect(service.send({ ...input })).resolves.toEqual(first);
    await expect(
      service.send({ ...input, text: "different bytes" }),
    ).rejects.toBeInstanceOf(ConstellationMessageServiceError);
    expect(sendText).toHaveBeenCalledTimes(1);
  });

  it("restores ambiguous in-flight rows as interrupted without guessing completion", async () => {
    const stateRoot = root();
    const constellation = await readyConstellation(stateRoot, ["Hermes"]);
    const never = deferred<{ finalText: string }>();
    const service = await ConstellationMessageService.open({
      directory: path.join(stateRoot, "messages"),
      constellation,
      gateway: {
        status: (sessionId: string) => ({ sessionId }),
        sendText: () => never.promise,
      },
    });
    void service.send(request(10, "in flight"));
    await vi.waitFor(() =>
      expect(service.get(request(10).requestId).recipients[0]?.state).toBe(
        "streaming",
      ),
    );

    const restored = await ConstellationMessageService.open({
      directory: path.join(stateRoot, "messages"),
      constellation,
      gateway: {
        status: (sessionId: string) => ({ sessionId }),
        sendText: vi.fn(),
      },
    });
    expect(restored.get(request(10).requestId).recipients).toEqual([
      expect.objectContaining({
        state: "interrupted",
        finalText: null,
        errorLabel: "Agent turn interrupted",
      }),
    ]);
  });

  it("uses checksummed private current/previous generations", async () => {
    const stateRoot = root();
    const constellation = await readyConstellation(stateRoot, ["Hermes"]);
    const directory = path.join(stateRoot, "messages");
    const service = await ConstellationMessageService.open({
      directory,
      constellation,
      gateway: {
        status: (sessionId: string) => ({ sessionId }),
        sendText: async () => ({ finalText: "stored" }),
      },
    });
    await service.send(request(11));

    for (const name of [
      "constellation-messages.current.json",
      "constellation-messages.previous.json",
    ]) {
      const filePath = path.join(directory, name);
      const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
      expect(stored.checksum).toMatch(/^[a-f0-9]{64}$/u);
      expect(fs.statSync(filePath).mode & 0o777).toBe(0o600);
    }
    expect(fs.statSync(directory).mode & 0o777).toBe(0o700);
  });
});

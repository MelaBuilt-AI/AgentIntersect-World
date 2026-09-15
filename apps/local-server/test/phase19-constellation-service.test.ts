import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConstellationService,
  ConstellationServiceError,
  type ConstellationLifecyclePort,
} from "../src/constellation-service.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

function directory(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-constellation-"));
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

const mutation = (expectedRevision: number, idempotencyKey: string) => ({
  worldInstanceId: "world-one",
  expectedRevision,
  idempotencyKey,
});

const agent = (
  index: number,
  adapterId: "hermes" | "openclaw" | "codex" | "claude-code",
  overrides: Record<string, unknown> = {},
) => ({
  rosterId: `roster-${index}`,
  adapterId,
  sessionOwnership:
    adapterId === "hermes" ? "operator-persistent" : "world-owned",
  worldSessionId: `world-session-${index}`,
  nativeRootSessionRef: `native-root-${index}`,
  displayName: `Agent ${index}`,
  ...overrides,
});

async function add(
  service: ConstellationService,
  index: number,
  adapterId: "hermes" | "openclaw" | "codex" | "claude-code",
  expectedRevision = index - 1,
) {
  return service.addAgent({
    ...mutation(expectedRevision, `add-${index}`),
    agent: agent(index, adapterId),
  });
}

describe("Phase 19 durable constellation service", () => {
  it("projects a failed member unavailable without losing healthy bindings or accepted avatars", async () => {
    let failed = false;
    const service = await ConstellationService.open({
      directory: directory(),
      worldInstanceId: "world-one",
      lifecycle: lifecyclePort({
        isBindingAvailable: (binding) =>
          !(failed && binding.adapterId === "claude-code"),
      }),
    });
    for (const [index, adapterId] of [
      [1, "codex"],
      [2, "claude-code"],
      [3, "openclaw"],
    ] as const) {
      await add(service, index, adapterId, (index - 1) * 2);
      await service.setAvatar({
        ...mutation((index - 1) * 2 + 1, `avatar-${index}`),
        rosterId: `roster-${index}`,
        avatar: {
          status: "accepted",
          profileId: `avatar-${index}`,
          sessionId: `world-session-${index}`,
        },
      });
    }
    const before = service.current().projection!;
    expect(before.entryReady).toBe(true);
    failed = true;
    const after = service.current().projection!;
    expect(after.entryReady).toBe(false);
    expect(after.agents[1]).toMatchObject({
      connection: "unavailable",
      continuity: "unavailable",
      avatar: before.agents[1]!.avatar,
    });
    expect(after.agents.filter((a) => a.adapterId !== "claude-code")).toEqual(
      before.agents.filter((a) => a.adapterId !== "claude-code"),
    );
    const removed = await service.removeAgent({
      ...mutation(after.revision, "remove-failed"),
      rosterId: "roster-2",
    });
    expect(removed.projection.entryReady).toBe(true);
    expect(removed.projection.agents.map((a) => a.rosterId)).toEqual([
      "roster-1",
      "roster-3",
    ]);
  });
  it("rejects operator-persistent ownership for non-Hermes adapters", async () => {
    const service = await ConstellationService.open({
      directory: directory(),
      lifecycle: lifecyclePort(),
      worldInstanceId: "world-one",
    });

    const operation = service.addAgent({
      ...mutation(0, "invalid-ownership"),
      agent: agent(1, "codex", {
        sessionOwnership: "operator-persistent",
      }),
    });

    await expect(operation).rejects.toBeInstanceOf(ConstellationServiceError);
    await expect(operation).rejects.toMatchObject({
      code: "validation",
      message: "Session ownership is invalid",
    });
  });

  it("creates an empty projection, preserves order, derives readiness, limits four, and rejects duplicate native bindings", async () => {
    const service = await ConstellationService.open({
      directory: directory(),
      lifecycle: lifecyclePort(),
      worldInstanceId: "world-one",
    });
    expect(service.current().projection).toMatchObject({
      schema: "aiw.constellation/0.19",
      worldInstanceId: "world-one",
      revision: 0,
      agents: [],
      entryReady: false,
    });

    await add(service, 1, "hermes");
    await service.setAvatar({
      ...mutation(1, "avatar-1"),
      rosterId: "roster-1",
      avatar: {
        status: "accepted",
        profileId: "avatar-profile-1",
        sessionId: "avatar-session-1",
      },
    });
    await add(service, 2, "codex", 2);
    const ready = await service.setAvatar({
      ...mutation(3, "avatar-2"),
      rosterId: "roster-2",
      avatar: {
        status: "accepted",
        profileId: "avatar-profile-2",
        sessionId: "avatar-session-2",
      },
    });
    expect(ready.projection.entryReady).toBe(true);

    await add(service, 3, "codex", 4);
    await add(service, 4, "claude-code", 5);
    expect(
      service.current().projection.agents.map((row) => row.rosterId),
    ).toEqual(["roster-1", "roster-2", "roster-3", "roster-4"]);
    await expect(add(service, 5, "openclaw", 6)).rejects.toMatchObject({
      code: "resource_limit",
    });

    const duplicateService = await ConstellationService.open({
      directory: directory(),
      lifecycle: lifecyclePort(),
      worldInstanceId: "world-one",
    });
    await add(duplicateService, 1, "codex");
    await expect(
      duplicateService.addAgent({
        ...mutation(1, "duplicate"),
        agent: agent(2, "codex", {
          nativeRootSessionRef: "native-root-1",
        }),
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("enforces expected revision and byte-equivalent idempotency replay", async () => {
    const service = await ConstellationService.open({
      directory: directory(),
      lifecycle: lifecyclePort(),
      worldInstanceId: "world-one",
    });
    const request = {
      ...mutation(0, "same-request"),
      agent: agent(1, "hermes"),
    };
    const created = await service.addAgent(request);
    const replayed = await service.addAgent({
      agent: { ...request.agent },
      idempotencyKey: request.idempotencyKey,
      expectedRevision: request.expectedRevision,
      worldInstanceId: request.worldInstanceId,
    });
    expect(replayed).toEqual(created);
    expect(service.current().projection.revision).toBe(1);

    await expect(
      service.addAgent({
        ...request,
        agent: { ...request.agent, displayName: "Different" },
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      service.addAgent({
        ...mutation(0, "stale-revision"),
        agent: agent(2, "codex"),
      }),
    ).rejects.toMatchObject({ code: "revision_conflict" });
  });

  it("persists checksummed 0600 generations and restores retained entries stale from current or previous", async () => {
    const stateDirectory = directory();
    const service = await ConstellationService.open({
      directory: stateDirectory,
      lifecycle: lifecyclePort(),
      worldInstanceId: "world-one",
    });
    await add(service, 1, "hermes");
    await service.setAvatar({
      ...mutation(1, "avatar"),
      rosterId: "roster-1",
      avatar: { status: "editing", profileId: null, sessionId: null },
    });

    const currentPath = path.join(stateDirectory, "constellation.current.json");
    const previousPath = path.join(
      stateDirectory,
      "constellation.previous.json",
    );
    const current = JSON.parse(fs.readFileSync(currentPath, "utf8"));
    expect(current).toMatchObject({
      schema: "aiw.constellation-store/0.19",
      generation: 2,
    });
    expect(current.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(fs.statSync(currentPath).mode & 0o777).toBe(0o600);
    expect(fs.statSync(previousPath).mode & 0o777).toBe(0o600);
    expect(fs.statSync(stateDirectory).mode & 0o777).toBe(0o700);

    const restoredCurrent = await ConstellationService.open({
      directory: stateDirectory,
      lifecycle: lifecyclePort(),
    });
    expect(restoredCurrent.current().projection).toMatchObject({
      truth: "current",
      entryReady: false,
      agents: [{ continuity: "stale", connection: "stale" }],
    });

    fs.writeFileSync(currentPath, "corrupt", { mode: 0o600 });
    const recoveredPrevious = await ConstellationService.open({
      directory: stateDirectory,
      lifecycle: lifecyclePort(),
    });
    expect(recoveredPrevious.current().projection).toMatchObject({
      truth: "previous-recovered",
      revision: 1,
      agents: [{ continuity: "stale", connection: "stale" }],
    });

    fs.writeFileSync(previousPath, "also corrupt", { mode: 0o600 });
    const unavailable = await ConstellationService.open({
      directory: stateDirectory,
      lifecycle: lifecyclePort(),
    });
    expect(unavailable.current()).toMatchObject({
      projection: null,
      unavailableReason: "Constellation state is unavailable",
    });
    await expect(
      unavailable.addAgent({
        ...mutation(0, "blocked"),
        agent: agent(1, "hermes"),
      }),
    ).rejects.toBeInstanceOf(ConstellationServiceError);
  });

  it("requires explicit exact reconnect validation and refuses identity replacement", async () => {
    const validateBinding = vi.fn(async (binding) => ({
      ...binding,
      continuity: "previous-recovered" as const,
    }));
    const stateDirectory = directory();
    const initial = await ConstellationService.open({
      directory: stateDirectory,
      lifecycle: lifecyclePort({ validateBinding }),
      worldInstanceId: "world-one",
    });
    await add(initial, 1, "codex");
    const restored = await ConstellationService.open({
      directory: stateDirectory,
      lifecycle: lifecyclePort({ validateBinding }),
    });
    const reconnected = await restored.reconnect({
      ...mutation(1, "reconnect"),
      rosterId: "roster-1",
    });
    expect(validateBinding).toHaveBeenCalledWith({
      rosterId: "roster-1",
      adapterId: "codex",
      sessionOwnership: "world-owned",
      worldSessionId: "world-session-1",
      nativeRootSessionRef: "native-root-1",
      worldInstanceId: "world-one",
    });
    expect(reconnected.projection.agents[0]).toMatchObject({
      continuity: "previous-recovered",
      connection: "connected",
    });

    const mismatched = await ConstellationService.open({
      directory: stateDirectory,
      lifecycle: lifecyclePort({
        validateBinding: async (binding) => ({
          ...binding,
          nativeRootSessionRef: "replacement-root",
          continuity: "current",
        }),
      }),
    });
    await expect(
      mismatched.reconnect({
        ...mutation(2, "mismatch"),
        rosterId: "roster-1",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("removes only the roster association without native lifecycle calls", async () => {
    const endWorldSession = vi.fn(async () => undefined);
    const service = await ConstellationService.open({
      directory: directory(),
      lifecycle: lifecyclePort({ endWorldSession }),
      worldInstanceId: "world-one",
    });
    await add(service, 1, "codex");
    const removed = await service.removeAgent({
      ...mutation(1, "remove"),
      rosterId: "roster-1",
    });
    expect(removed.projection.agents).toEqual([]);
    expect(endWorldSession).not.toHaveBeenCalled();
  });

  it("ends each world-owned binding once, skips Hermes, and resumes safely after a partial failure", async () => {
    const calls: string[] = [];
    let failOnce = true;
    const endWorldSession = vi.fn(async (worldSessionId: string) => {
      calls.push(worldSessionId);
      if (worldSessionId === "world-session-3" && failOnce) {
        failOnce = false;
        throw new Error("SECRET /native/path upstream failure");
      }
    });
    const stateDirectory = directory();
    const service = await ConstellationService.open({
      directory: stateDirectory,
      lifecycle: lifecyclePort({ endWorldSession }),
      worldInstanceId: "world-one",
    });
    await add(service, 1, "hermes");
    await add(service, 2, "openclaw");
    await add(service, 3, "codex");
    await add(service, 4, "claude-code");
    const request = mutation(4, "end-world");

    await expect(service.end(request)).rejects.toMatchObject({
      code: "upstream",
      message: "A World-owned session could not be ended",
    });
    expect(calls).toEqual(["world-session-2", "world-session-3"]);
    expect(JSON.stringify(service.current())).not.toContain("/native/path");

    const ended = await service.end(request);
    expect(calls).toEqual([
      "world-session-2",
      "world-session-3",
      "world-session-3",
      "world-session-4",
    ]);
    expect(ended.projection).toMatchObject({
      lifecycle: "ended",
      entryReady: false,
    });
    expect(ended.terminalOutcomes).toEqual([
      { rosterId: "roster-1", status: "skipped-operator-persistent" },
      { rosterId: "roster-2", status: "ended" },
      { rosterId: "roster-3", status: "ended" },
      { rosterId: "roster-4", status: "ended" },
    ]);

    const replay = await service.end(request);
    expect(replay).toEqual(ended);
    expect(endWorldSession).toHaveBeenCalledTimes(4);
  });

  it("keeps repeated browser-equivalent reads side-effect free", async () => {
    const endWorldSession = vi.fn(async () => undefined);
    const service = await ConstellationService.open({
      directory: directory(),
      lifecycle: lifecyclePort({ endWorldSession }),
      worldInstanceId: "world-one",
    });
    await add(service, 1, "hermes");
    const before = service.current();
    expect(service.current()).toEqual(before);
    expect(service.current()).toEqual(before);
    expect(endWorldSession).not.toHaveBeenCalled();
  });
});

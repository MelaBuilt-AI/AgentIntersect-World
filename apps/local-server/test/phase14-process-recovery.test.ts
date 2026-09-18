import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, writeFile: vi.fn(actual.writeFile) };
});
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});

import {
  PHASE14_DISPOSABLE_ROOT,
  Phase14Service,
} from "../src/phase14-service.js";

const fixtureRoot = resolve("examples/phase14-magic-slice");
let services: Phase14Service[] = [];

function make(
  options: ConstructorParameters<typeof Phase14Service>[0] = {},
): Phase14Service {
  const instance = new Phase14Service({
    fixtureRoot,
    storePath: resolve(
      PHASE14_DISPOSABLE_ROOT,
      "state",
      `process-recovery-${randomUUID()}.json`,
    ),
    ...options,
  });
  services.push(instance);
  return instance;
}

async function applied(service: Phase14Service) {
  const journey = await service.createJourney();
  await service.inspect(journey.operationId);
  const edit = await service.prepareEdit(journey.operationId);
  const approval = await service.approve(journey.operationId, {
    patchDigest: edit.patchDigest,
  });
  await service.apply(journey.operationId, { approvalId: approval.approvalId });
  return journey.operationId;
}

async function tested(service: Phase14Service) {
  const operationId = await applied(service);
  await service.runTest(operationId);
  return operationId;
}

afterEach(async () => {
  await Promise.all(services.map((service) => service.dispose()));
  services = [];
});

describe("Phase 14 focused-test adapter truth", () => {
  it("reports a real nonzero node:test exit", async () => {
    const service = make({ testingTestMode: "fail" });
    const result = await service.runTest(await applied(service));
    expect(result).toMatchObject({
      state: "failed",
      timedOut: false,
      signal: null,
      exitCode: 1,
    });
    expect(result.stderr + result.stdout).toContain(
      "intentional Phase 14 failure",
    );
  });

  it("times out and awaits a real hanging node:test process tree", async () => {
    const service = make({ testingTestMode: "hang", testTimeoutMs: 100 });
    const result = await service.runTest(await applied(service));
    expect(result.state).toBe("failed");
    expect(result.timedOut).toBe(true);
    expect(result.exitCode !== null || result.signal !== null).toBe(true);
  });

  it("cancels and awaits a running real node:test process tree", async () => {
    const service = make({ testingTestMode: "hang" });
    const operationId = await applied(service);
    const running = service.runTest(operationId);
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    await expect(service.cancel(operationId)).resolves.toMatchObject({
      state: "cancelled",
    });
    await expect(running).resolves.toMatchObject({
      state: "cancelled",
      timedOut: false,
    });
  });

  it("visibly truncates each real 128 KiB output stream at 64 KiB", async () => {
    const service = make({ testingTestMode: "output" });
    const result = await service.runTest(await applied(service));
    expect(result.stdoutTruncated).toBe(true);
    // Node's test runner projects fixture fd2 into its TAP stdout stream.
    expect(result.stderrTruncated).toBe(false);
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(64 * 1024);
    expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(64 * 1024);
  });
});

describe("Phase 14 loopback preview failure and cancellation truth", () => {
  it("reports unhealthy and closes the owned port when strict health never matches", async () => {
    const service = make({
      previewReadyTargetMs: 50,
      previewTimeoutMs: 500,
      fetch: async () =>
        new Response(JSON.stringify({ ok: false }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    const result = await service.startPreview(await tested(service));
    expect(result.state).toBe("unhealthy");
    expect(result.portClosed).toBe(true);
  });

  it("hard-times out preview startup and cleans the owned process tree", async () => {
    const service = make({
      testingPreviewMode: "hang-startup",
      previewReadyTargetMs: 50,
      previewTimeoutMs: 150,
    });
    const result = await service.startPreview(await tested(service));
    expect(result.state).toBe("failed");
    expect(result.portClosed).toBe(true);
  });

  it("does not spawn after cancellation during preview persistence", async () => {
    const service = make({
      testingPreviewMode: "hang-startup",
      previewTimeoutMs: 150,
    });
    const operationId = await tested(service);
    const actual =
      await vi.importActual<typeof import("node:fs/promises")>(
        "node:fs/promises",
      );
    let release!: () => void;
    let reached!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      reached = resolve;
    });
    vi.mocked(writeFile).mockImplementationOnce(async (...args) => {
      await actual.writeFile(...args);
      reached();
      await held;
    });
    const starting = service.startPreview(operationId);
    const spawnedBefore = vi.mocked(spawn).mock.calls.length;
    // Observe the former failure without letting a late failed spawn escape.
    const nativeSpawn =
      await vi.importActual<typeof import("node:child_process")>(
        "node:child_process",
      );
    vi.mocked(spawn).mockImplementationOnce(
      (...args: Parameters<typeof spawn>) => {
        const child = nativeSpawn.spawn(...args);
        child.on("error", () => undefined);
        return child;
      },
    );
    try {
      await entered;
      await service.cancel(operationId);
    } finally {
      release();
    }
    await expect(starting).resolves.toMatchObject({
      state: "cancelled",
      portClosed: true,
    });
    expect(vi.mocked(spawn).mock.calls).toHaveLength(spawnedBefore);
    expect(service.snapshot(operationId).status).toBe("cancelled");
    vi.mocked(spawn).mockReset().mockImplementation(nativeSpawn.spawn);
  });

  it("cancels during preview startup", async () => {
    const service = make({
      testingPreviewMode: "hang-startup",
      previewTimeoutMs: 5_000,
    });
    const operationId = await tested(service);
    const starting = service.startPreview(operationId);
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    await expect(service.cancel(operationId)).resolves.toMatchObject({
      state: "cancelled",
    });
    await expect(starting).resolves.toMatchObject({ state: "cancelled" });
  });
});

describe("Phase 14 persistence, restart, and retention", () => {
  it("recovers a nonterminal real test as interrupted without signaling stale PID identity", async () => {
    const storePath = resolve(
      PHASE14_DISPOSABLE_ROOT,
      "state",
      `restart-${randomUUID()}.json`,
    );
    const first = make({ storePath, testingTestMode: "hang" });
    const operationId = await applied(first);
    const running = first.runTest(operationId);
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));

    const restarted = make({ storePath });
    const recovered = await restarted.recover();
    expect(
      recovered.find((entry) => entry.operationId === operationId)?.test,
    ).toMatchObject({
      state: "failed",
      recovered: true,
    });
    await first.cancel(operationId);
    await running;
  });

  it("uses checksum-protected last-good truth when current persistence is corrupt", async () => {
    const storePath = resolve(
      PHASE14_DISPOSABLE_ROOT,
      "state",
      `last-good-${randomUUID()}.json`,
    );
    const first = make({ storePath });
    const operation = await first.createJourney();
    await writeFile(storePath, "{corrupt\n");
    const restarted = make({ storePath });
    const recovered = await restarted.recover();
    expect(
      recovered.find((entry) => entry.operationId === operation.operationId),
    ).toMatchObject({
      recovered: true,
    });
  });

  it("retains only the newest 20 operations and evicts oldest first", async () => {
    let now = Date.parse("2026-07-22T12:00:00.000Z");
    const service = make({ now: () => now });
    for (let index = 0; index < 21; index += 1) {
      await service.createJourney();
      now += 1_000;
    }
    expect(service.list()).toHaveLength(20);
    expect(service.list().map(({ createdAt }) => createdAt)).toEqual(
      [...service.list().map(({ createdAt }) => createdAt)].sort().reverse(),
    );
  });
});

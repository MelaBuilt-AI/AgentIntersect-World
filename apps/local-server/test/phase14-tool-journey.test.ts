import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  PHASE14_DISPOSABLE_ROOT,
  Phase14Service,
  Phase14ServiceError,
} from "../src/phase14-service.js";

const fixtureRoot = resolve("examples/phase14-magic-slice");
const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

let services: Phase14Service[] = [];

function service(
  options: ConstructorParameters<typeof Phase14Service>[0] = {},
) {
  const created = new Phase14Service({
    fixtureRoot,
    storePath: resolve(
      PHASE14_DISPOSABLE_ROOT,
      "state",
      `tool-journey-${randomUUID()}.json`,
    ),
    ...options,
  });
  services.push(created);
  return created;
}

afterEach(async () => {
  await Promise.all(services.map((entry) => entry.dispose()));
  services = [];
});

describe("Phase 14 real disposable tool journey", () => {
  it("uses the canonical /tmp root and never mutates the tracked fixture", async () => {
    const trackedBefore = await readFile(
      resolve(fixtureRoot, "src/greeting.mjs"),
    );
    const phase14 = service();
    const created = await phase14.createJourney();

    expect(created.step).toBe(1);
    expect(created.session.adapterSessionRef).toBe(
      "phase14-hermes-fixture-session",
    );
    expect(created.disposable.rootAttestation).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(phase14.testingCopyRoot(created.operationId)).toMatch(
      new RegExp(`^${PHASE14_DISPOSABLE_ROOT.replaceAll("/", "\\/")}\\/`),
    );

    const inspected = await phase14.inspect(created.operationId);
    expect(inspected.step).toBe(3);
    expect(inspected.source).toBe(
      'export const greeting = "Hello from the Phase 14 fixture.";\n',
    );
    expect(inspected.search.matches).toEqual([{ line: 1, column: 14 }]);
    expect(inspected.explanation.symbol).toBe("greeting");
    expect(inspected.explanation.claims.sourceFacts[0]?.label).toBe(
      "source-fact",
    );

    const proposed = await phase14.prepareEdit(created.operationId);
    expect(proposed.step).toBe(4);
    expect(proposed.outcome).toBe("not-applied");
    expect(proposed.diff).toContain(
      '-export const greeting = "Hello from the Phase 14 fixture.";',
    );
    expect(proposed.diff).toContain(
      '+export const greeting = "Hello from the approved Phase 14 edit.";',
    );

    const approval = await phase14.approve(created.operationId, {
      patchDigest: proposed.patchDigest,
    });
    expect(approval.step).toBe(5);
    expect(approval.singleUse).toBe(true);

    const applied = await phase14.apply(created.operationId, {
      approvalId: approval.approvalId,
    });
    expect(applied.step).toBe(7);
    expect(applied.outcome).toBe("applied");
    expect(applied.currentHash).not.toBe(applied.previousHash);
    await expect(
      phase14.apply(created.operationId, { approvalId: approval.approvalId }),
    ).rejects.toMatchObject({ code: "approval-used" });

    const tested = await phase14.runTest(created.operationId);
    expect(tested.step).toBe(8);
    expect(tested.state).toBe("succeeded");
    expect(tested.exitCode).toBe(0);
    expect(tested.signal).toBeNull();
    expect(tested.timedOut).toBe(false);
    expect(tested.stdout).toContain("pass 1");

    const preview = await phase14.startPreview(created.operationId);
    expect(preview.step).toBe(9);
    expect(preview.state).toBe("ready");
    expect(preview.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    await expect(
      fetch(`${preview.url}health`).then((response) => response.json()),
    ).resolves.toEqual({
      ok: true,
      schema: "aiw.phase14-preview/1",
    });

    const stopped = await phase14.stopPreview(created.operationId);
    expect(stopped.step).toBe(10);
    expect(stopped.state).toBe("stopped");
    expect(stopped.portClosed).toBe(true);
    expect(stopped.correlatedEvidence).toEqual(
      expect.arrayContaining([expect.stringMatching(/^aiw:\/\/evidence\//)]),
    );
    await expect(
      lstat(phase14.testingCopyRoot(created.operationId)),
    ).rejects.toThrow();

    const trackedAfter = await readFile(
      resolve(fixtureRoot, "src/greeting.mjs"),
    );
    expect(sha256(trackedAfter)).toBe(sha256(trackedBefore));
    const events = phase14.events(created.operationId);
    expect(events.length).toBeGreaterThanOrEqual(15);
    expect(events.map(({ sequence }) => sequence)).toEqual(
      events.map((_, index) => index + 1),
    );
    expect(new Set(events.map(({ operation }) => operation))).toEqual(
      new Set(["read", "search", "edit", "test", "preview"]),
    );
  }, 20_000);

  it("rejects dirty, stale, symlinked, traversing, absolute, binary, and NUL targets", async () => {
    const phase14 = service();
    for (const scenario of [
      "dirty",
      "stale",
      "symlink",
      "binary",
      "nul",
    ] as const) {
      const created = await phase14.createJourney();
      await phase14.inspect(created.operationId);
      const proposed = await phase14.prepareEdit(created.operationId);
      const target = resolve(
        phase14.testingCopyRoot(created.operationId),
        "src/greeting.mjs",
      );
      if (scenario === "dirty") await writeFile(target, "unexpected change\n");
      if (scenario === "stale")
        phase14.testingOverrideFixtureRevision(
          created.operationId,
          "stale-revision",
        );
      if (scenario === "symlink")
        await phase14.testingReplaceTargetWithSymlink(created.operationId);
      if (scenario === "binary")
        await writeFile(target, new Uint8Array([0xff, 0xfe, 0xfd]));
      if (scenario === "nul")
        await writeFile(target, 'export const greeting = "bad\\0source";\n');
      const approval = await phase14.approve(created.operationId, {
        patchDigest: proposed.patchDigest,
      });
      await expect(
        phase14.apply(created.operationId, { approvalId: approval.approvalId }),
      ).rejects.toBeInstanceOf(Phase14ServiceError);
      const rejected = phase14.snapshot(created.operationId);
      expect(rejected.edit?.outcome).toBe("failed");
      expect(rejected.explanation?.continuity).toMatchObject({
        state: "stale",
      });
    }
    await expect(
      phase14.validateTargetPath("../src/greeting.mjs"),
    ).rejects.toMatchObject({ code: "target-path" });
    await expect(
      phase14.validateTargetPath("/tmp/src/greeting.mjs"),
    ).rejects.toMatchObject({ code: "target-path" });
  });

  it("enforces approval revoke and five-minute expiry before execution", async () => {
    let now = Date.parse("2026-07-22T12:00:00.000Z");
    const phase14 = service({ now: () => now });
    const first = await phase14.createJourney();
    await phase14.inspect(first.operationId);
    const firstEdit = await phase14.prepareEdit(first.operationId);
    const revoked = await phase14.approve(first.operationId, {
      patchDigest: firstEdit.patchDigest,
    });
    await phase14.revokeApproval(first.operationId, revoked.approvalId);
    await expect(
      phase14.apply(first.operationId, { approvalId: revoked.approvalId }),
    ).rejects.toMatchObject({ code: "approval-revoked" });

    const second = await phase14.createJourney();
    await phase14.inspect(second.operationId);
    const secondEdit = await phase14.prepareEdit(second.operationId);
    const expired = await phase14.approve(second.operationId, {
      patchDigest: secondEdit.patchDigest,
    });
    now += 5 * 60 * 1000 + 1;
    await expect(
      phase14.apply(second.operationId, { approvalId: expired.approvalId }),
    ).rejects.toMatchObject({ code: "approval-expired" });
  });

  it("cancels before approval and while a real preview is running", async () => {
    const phase14 = service();
    const beforeApproval = await phase14.createJourney();
    await phase14.inspect(beforeApproval.operationId);
    await phase14.prepareEdit(beforeApproval.operationId);
    expect(await phase14.cancel(beforeApproval.operationId)).toMatchObject({
      state: "cancelled",
      outcome: "cancelled",
    });

    const running = await phase14.createJourney();
    await phase14.inspect(running.operationId);
    const edit = await phase14.prepareEdit(running.operationId);
    const approval = await phase14.approve(running.operationId, {
      patchDigest: edit.patchDigest,
    });
    await phase14.apply(running.operationId, {
      approvalId: approval.approvalId,
    });
    await phase14.runTest(running.operationId);
    const preview = await phase14.startPreview(running.operationId);
    expect(preview.state).toBe("ready");
    expect(await phase14.cancel(running.operationId)).toMatchObject({
      state: "cancelled",
      portClosed: true,
    });
  }, 20_000);
});

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createSafeTemporaryWorkspace,
  safeTemporaryEnvironment,
} from "../src/safe-temporary-root.ts";

import {
  AttestationError,
  DAEMON_ROUTES,
  DASHBOARD_ROUTES,
  attestHealth,
  observeCheckout,
  validateCompatibility,
  validatePhase0Evidence,
} from "../src/index.ts";

const pinned = "14c620271cd02e455d3244241de951e00ef77a4d";

test("compatibility fails closed when the AgentIntersect commit drifts", () => {
  const result = validateCompatibility({
    commit: `${pinned.slice(0, -1)}e`,
    originMain: pinned,
    branch: "main",
    clean: true,
    packageName: "@contextloop/manager",
    packageVersion: "0.1.0",
    packagePrivate: true,
    packageType: "module",
    nodeRange: ">=24",
    nodeMajor: 24,
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.mismatches, ["commit"]);
});

test("aggregate compatibility fails closed on protocol drift", async () => {
  const checkout = process.env.AGENTINTERSECT_CHECKOUT;
  assert.ok(checkout, "AGENTINTERSECT_CHECKOUT is required");
  const observed = await observeCheckout(checkout);
  const result = validatePhase0Evidence({
    checkout: observed,
    healthAttested: true,
    healthKeys: [
      "ok",
      "pid",
      "processStartTime",
      "protocol",
      "service",
      "workspaceIdentity",
    ],
    mcp: {
      initializeId: 1,
      protocolVersion: "2099-01-01",
      serverName: "agentintersect-clm",
      serverVersion: "0.1.0",
      capabilityKeys: ["tools"],
      hasResourcesCapability: false,
      listId: 2,
      toolNames: [
        "clm_get_current_phase",
        "clm_report_telemetry",
        "clm_request_handoff",
        "clm_get_resume_packet",
        "clm_record_evidence",
      ],
      failureId: 3,
      failureCode: -32000,
      interactionsBeforeClose: 3,
      exitedCleanly: true,
      workspaceDisposed: true,
    },
  });

  assert.equal(result.ok, false);
  assert.ok(result.mismatches.includes("mcp.protocol"));
});

test("checkout observation pins package, runtime, Git, hashes, and route catalogs", async () => {
  const checkout = process.env.AGENTINTERSECT_CHECKOUT;
  assert.ok(checkout, "AGENTINTERSECT_CHECKOUT is required");
  const observed = await observeCheckout(checkout);

  assert.deepEqual(validateCompatibility(observed.compatibility), {
    ok: true,
    mismatches: [],
  });
  assert.deepEqual(observed.daemonRoutes, DAEMON_ROUTES);
  assert.deepEqual(observed.dashboardRoutes, DASHBOARD_ROUTES);
  assert.equal(observed.daemonRoutes.length, 11);
  assert.equal(observed.dashboardRoutes.length, 34);
  assert.deepEqual(observed.sourceHashes, {
    "src/daemon.mjs":
      "a8893c0b18418f3ea81808e9d7010ef5dc32543c1bb8c5a853aa2967c12d477b",
    "src/dashboard-server.mjs":
      "a77a2100d0f3571e746da0ba4f253f790262f639e83fc4e9cab4f9af3c0f241b",
    "src/mcp-surface.mjs":
      "0c7cf7539921cd68bf1ede2dde89524eff1225cfb0501708a79c3e21ad3aa516",
    "src/worker-queue.mjs":
      "5099a9748b6c23609df1ea1a9cdb1c4249fe903f28f94982e507bb7fd9b1bd71",
    "src/workspace-identity.mjs":
      "0d8383d3ba6e296206734d45c34fb6dfe5d5b2a8f9d095b6b8b87a307f13f11d",
    "src/owned-processes.mjs":
      "b78a7eb6aa72a55d4f27b622e181e44167dcd08ff5396e3f9a4ed6b3fcb83d52",
  });
});

test("health attestation accepts only the exact live canonical workspace identity", async (t) => {
  const checkout = process.env.AGENTINTERSECT_CHECKOUT;
  assert.ok(checkout, "AGENTINTERSECT_CHECKOUT is required");
  const { temporaryRoot, workspace } = await createSafeTemporaryWorkspace(
    checkout,
    "aiw-attest-",
  );
  const alias = `${workspace}-alias`;
  await fs.symlink(workspace, alias);
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    env: safeTemporaryEnvironment(temporaryRoot),
    stdio: "ignore",
  });
  assert.ok(child.pid);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const stat = await fs.readFile(`/proc/${child.pid}/stat`, "utf8");
  const processStartTime = stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
  assert.ok(processStartTime);
  const payload = {
    ok: true,
    pid: child.pid,
    processStartTime,
    protocol: 1,
    service: "agentintersect-daemon/v1",
    workspaceIdentity: `sha256:${createHash("sha256")
      .update(path.normalize(workspace))
      .digest("hex")}`,
  } as const;

  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
    await new Promise((resolve) => child.once("close", resolve));
    await fs.rm(alias, { force: true });
    await fs.rm(workspace, { recursive: true, force: true });
  });

  assert.deepEqual(
    await attestHealth({
      workspace,
      status: 200,
      contentType: "application/json; charset=utf-8",
      payload,
      expectedPid: child.pid,
    }),
    payload,
  );
  assert.deepEqual(
    await attestHealth({
      workspace: alias,
      status: 200,
      contentType: "application/json",
      payload,
    }),
    payload,
  );

  const rejects = async (
    override: Partial<Parameters<typeof attestHealth>[0]>,
    mismatch: string,
  ) => {
    await assert.rejects(
      attestHealth({
        workspace,
        status: 200,
        contentType: "application/json",
        payload,
        ...override,
      }),
      (error: unknown) =>
        error instanceof AttestationError &&
        error.mismatches.includes(mismatch),
    );
  };

  await rejects(
    { payload: { ...payload, workspaceIdentity: `${workspace}-wrong` } },
    "workspace",
  );
  await rejects(
    { payload: { ...payload, processStartTime: "reused-process" } },
    "process_identity_mismatch",
  );
  await rejects({ payload: { ok: true } }, "malformed_payload");
  await rejects(
    { payload: { ...payload, unexpected: true } },
    "malformed_payload",
  );
  await rejects({ expectedPid: child.pid + 1 }, "unexpected_pid");
  await rejects({ protectedPids: [child.pid] }, "protected_pid");
  await rejects({ status: 503 }, "http_status");
  await rejects({ contentType: "text/plain" }, "content_type");

  const exited = spawn(process.execPath, ["-e", "process.exit(0)"], {
    env: safeTemporaryEnvironment(temporaryRoot),
    stdio: "ignore",
  });
  assert.ok(exited.pid);
  await new Promise((resolve) => exited.once("close", resolve));
  await rejects({ payload: { ...payload, pid: exited.pid } }, "pid_not_alive");
});

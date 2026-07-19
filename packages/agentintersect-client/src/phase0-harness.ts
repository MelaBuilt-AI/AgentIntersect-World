import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

import { preflightCheckout } from "./checkout-preflight.ts";
import {
  createSafeTemporaryWorkspace,
  safeTemporaryEnvironment,
} from "./safe-temporary-root.ts";

export {
  DAEMON_ROUTES,
  DASHBOARD_ROUTES,
  type CheckoutObservation,
} from "./checkout-preflight.ts";

const execFileAsync = promisify(execFile);

export interface HttpSseCapture {
  daemonReady: boolean;
  dashboardReady: boolean;
  attested: boolean;
  daemonStateStatus: number;
  daemonNotFoundStatus: number;
  healthKeys: string[];
  snapshotKeys: string[];
  eventFeedKeys: string[];
  sse: {
    contentType: string;
    cacheControl: string;
    event: string;
    hasData: boolean;
    hasId: boolean;
    lastEventIdHonored: boolean;
    reconnectObservedNewEvent: boolean;
  };
  servicesTerminated: boolean;
  workspaceDisposed: boolean;
}

export interface McpCapture {
  initializeId: number | string | null;
  protocolVersion: string;
  serverName: string;
  serverVersion: string;
  capabilityKeys: string[];
  hasResourcesCapability: boolean;
  listId: number | string | null;
  toolNames: string[];
  failureId: number | string | null;
  failureCode: number;
  interactionsBeforeClose: number;
  exitedCleanly: boolean;
  workspaceDisposed: boolean;
}

export interface LifecycleCapture {
  createStatus: number;
  createdJobStatus: string;
  claimStatus: number;
  claimedJobStatus: string;
  claimedBy: string;
  wrongWorkerStatus: number;
  completionStatus: number;
  completedJobStatus: string;
  duplicateStatus: number;
  reconciledJobStatus: string;
  failedResultStatus: number;
  failedJobStatus: string;
  durableCompletionEvents: number;
  handoff: {
    phaseId: string;
    validationOk: boolean;
    integrityAlgorithm: string;
  };
  evidence: {
    phaseId: string;
    relativePath: string;
    durableEventCount: number;
  };
  safePauseRequested: string;
  safePauseReached: string;
  nextPhaseStarted: boolean;
  servicesTerminated: boolean;
  workspaceDisposed: boolean;
}

export interface EmergencyStopCapture {
  boundaryKind: "current-private-implementation-candidate";
  ownedAliveBefore: boolean;
  unownedAliveBefore: boolean;
  responseStatus: number;
  scope: string;
  ignoredCallerPid: boolean;
  terminatedCount: number;
  rejectedCount: number;
  ownedHandled: boolean;
  unownedAliveAfter: boolean;
  durableEventCount: number;
  cleanupComplete: boolean;
  serviceTerminated: boolean;
  workspaceDisposed: boolean;
}

function processAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "EPERM"
    );
  }
}

async function stopExactTestChild(
  child: ChildProcess | null,
): Promise<boolean> {
  if (!child) return true;
  if (child.exitCode !== null || child.signalCode !== null) return true;
  const closed = new Promise<void>((resolve) =>
    child.once("close", () => resolve()),
  );
  child.kill("SIGKILL");
  await closed;
  return !processAlive(child.pid);
}

export async function captureEmergencyStopContract(
  checkout: string,
): Promise<EmergencyStopCapture> {
  const { checkoutRoot: root, temporaryRoot } =
    await preflightCheckout(checkout);
  const { workspace } = await createSafeTemporaryWorkspace(
    root,
    "aiw-emergency-",
  );
  const cli = path.join(root, "bin", "clm.mjs");
  let dashboard: ChildProcess | null = null;
  let owned: ChildProcess | null = null;
  let unowned: ChildProcess | null = null;
  let cleanupComplete = false;
  let serviceTerminated = false;
  let capture: Omit<
    EmergencyStopCapture,
    "cleanupComplete" | "serviceTerminated" | "workspaceDisposed"
  >;

  try {
    await execFileAsync(
      process.execPath,
      [cli, "init", "--project", "phase0-contract"],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        encoding: "utf8",
      },
    );
    owned = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      cwd: workspace,
      env: childEnvironment(temporaryRoot),
      stdio: "ignore",
    });
    unowned = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      cwd: workspace,
      env: childEnvironment(temporaryRoot),
      stdio: "ignore",
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!owned.pid || !unowned.pid)
      throw new Error("test children did not start");

    const ownedModule = (await import(
      pathToFileURL(path.join(root, "src", "owned-processes.mjs")).href
    )) as {
      createOwnedProcessRunDir(input: {
        workspace: string;
        prefix: string;
      }): Promise<string>;
      writeOwnedProcessManifest(input: {
        workspace: string;
        runDir: string;
        pid: number;
        child: ChildProcess;
        phaseId: string;
        command: string;
        args: string[];
      }): Promise<unknown>;
    };
    const runDir = await ownedModule.createOwnedProcessRunDir({
      workspace,
      prefix: "phase0-owned",
    });
    await ownedModule.writeOwnedProcessManifest({
      workspace,
      runDir,
      pid: owned.pid,
      child: owned,
      phaseId: "phase_0",
      command: process.execPath,
      args: ["-e", "setInterval(() => {}, 1000)"],
    });

    dashboard = spawn(
      process.execPath,
      [cli, "dash", "--host", "127.0.0.1", "--port", "0", "--no-open"],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const dashboardUrl = await waitForServiceUrl(
      dashboard,
      /http:\/\/127\.0\.0\.1:\d+/,
      "emergency dashboard",
    );
    const html = await (await fetch(dashboardUrl)).text();
    const csrfToken = html.match(/const csrfToken = '([^']+)'/)?.[1];
    if (!csrfToken) throw new Error("dashboard CSRF token unavailable");
    const response = await fetch(`${dashboardUrl}/api/emergency-stop`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agentintersect-csrf": csrfToken,
      },
      body: JSON.stringify({ pid: unowned.pid, pids: [unowned.pid] }),
    });
    const body = (await response.json()) as Record<string, unknown>;
    const emergency = body.emergencyStop as Record<string, unknown>;
    for (
      let attempt = 0;
      attempt < 40 && processAlive(owned.pid);
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const eventsBody = (await (
      await fetch(`${dashboardUrl}/api/events`)
    ).json()) as Record<string, unknown>;
    const events = eventsBody.events as Array<Record<string, unknown>>;
    capture = {
      boundaryKind: "current-private-implementation-candidate",
      ownedAliveBefore: true,
      unownedAliveBefore: true,
      responseStatus: response.status,
      scope: String(emergency.scope),
      ignoredCallerPid: emergency.ignoredCallerPid === true,
      terminatedCount: (emergency.terminated as unknown[]).length,
      rejectedCount: (emergency.rejected as unknown[]).length,
      ownedHandled: !processAlive(owned.pid),
      unownedAliveAfter: processAlive(unowned.pid),
      durableEventCount: events.filter(
        (event) => event.type === "emergency_stop.requested",
      ).length,
    };
  } finally {
    serviceTerminated = await terminateService(dashboard);
    const ownedStopped = await stopExactTestChild(owned);
    const unownedStopped = await stopExactTestChild(unowned);
    cleanupComplete = ownedStopped && unownedStopped;
    await fs.rm(workspace, { recursive: true, force: true });
  }

  let workspaceDisposed = false;
  try {
    await fs.access(workspace);
  } catch {
    workspaceDisposed = true;
  }
  return {
    ...capture,
    cleanupComplete,
    serviceTerminated,
    workspaceDisposed,
  };
}

export async function captureLifecycleContract(
  checkout: string,
): Promise<LifecycleCapture> {
  const { checkoutRoot: root, temporaryRoot } =
    await preflightCheckout(checkout);
  const { workspace } = await createSafeTemporaryWorkspace(
    root,
    "aiw-lifecycle-",
  );
  const cli = path.join(root, "bin", "clm.mjs");
  const design = path.join(workspace, "PHASE0_DESIGN.md");
  let daemon: ChildProcess | null = null;
  let dashboard: ChildProcess | null = null;
  let servicesTerminated = false;
  let capture: Omit<
    LifecycleCapture,
    "servicesTerminated" | "workspaceDisposed"
  >;

  const asRecord = (value: unknown) => value as Record<string, unknown>;
  const json = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    return { response, body: asRecord(await response.json()) };
  };

  try {
    await execFileAsync(
      process.execPath,
      [cli, "init", "--project", "phase0-contract"],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        encoding: "utf8",
      },
    );
    await fs.writeFile(
      design,
      "# Phase 0 contract fixture\n\n## Phase 1 — Complete lifecycle\n\n**Goal:** Prove completion.\n\n**Acceptance:**\n- Completion is durable.\n\n## Phase 2 — Failed lifecycle\n\n**Goal:** Prove failure.\n\n**Acceptance:**\n- Failure is durable.\n",
      "utf8",
    );
    await execFileAsync(
      process.execPath,
      [cli, "design", "add", design, "--title", "phase0-contract"],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        encoding: "utf8",
      },
    );

    daemon = spawn(
      process.execPath,
      [cli, "daemon", "--host", "127.0.0.1", "--port", "0"],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const daemonUrl = await waitForServiceUrl(
      daemon,
      /http:\/\/127\.0\.0\.1:\d+/,
      "lifecycle daemon",
    );
    dashboard = spawn(
      process.execPath,
      [cli, "dash", "--host", "127.0.0.1", "--port", "0", "--no-open"],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const dashboardUrl = await waitForServiceUrl(
      dashboard,
      /http:\/\/127\.0\.0\.1:\d+/,
      "lifecycle dashboard",
    );

    const pause = await json(`${dashboardUrl}/api/pause/safe`, {
      method: "POST",
    });
    const pauseSummary = asRecord(pause.body.safePause);
    const created = await json(`${daemonUrl}/v1/worker/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "phase_run",
        harness: "openclaw",
        phase_id: "phase_1",
      }),
    });
    const createdJob = asRecord(created.body.job);
    const jobId = String(createdJob.id);
    const claimed = await json(
      `${daemonUrl}/v1/worker/jobs/next?harness=openclaw&worker_id=phase0-owner&job_id=${encodeURIComponent(jobId)}`,
    );
    const claimedJob = asRecord(claimed.body.job);
    const resultUrl = `${daemonUrl}/v1/worker/jobs/${encodeURIComponent(jobId)}/result`;
    const wrong = await json(resultUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workerId: "phase0-wrong-owner",
        status: "complete",
      }),
    });
    const completionBody = {
      workerId: "phase0-owner",
      status: "complete",
      telemetry: {
        phase_id: "phase_1",
        completed_work: ["phase contract verified"],
        remaining_work: [],
        files_changed: [],
        commands_run: ["phase0-contract"],
        blockers: [],
        risks: [],
        next_actions: [],
      },
    };
    const completed = await json(resultUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(completionBody),
    });
    const completedJob = asRecord(completed.body.job);
    const duplicate = await json(resultUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(completionBody),
    });
    const reached = await json(
      `${dashboardUrl}/api/phases/phase_1/mark-complete`,
      { method: "POST" },
    );
    const reachedSafePause = asRecord(reached.body.safePause);
    const reachedSnapshot = (await json(`${dashboardUrl}/api/snapshot`)).body;
    const reachedTimeline = reachedSnapshot.phaseTimeline as Array<
      Record<string, unknown>
    >;

    const failedCreated = await json(`${daemonUrl}/v1/worker/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "phase_run",
        harness: "openclaw",
        phase_id: "phase_2",
      }),
    });
    const failedJobId = String(asRecord(failedCreated.body.job).id);
    await json(
      `${daemonUrl}/v1/worker/jobs/next?harness=openclaw&worker_id=phase0-fail-owner&job_id=${encodeURIComponent(failedJobId)}`,
    );
    const failed = await json(
      `${daemonUrl}/v1/worker/jobs/${encodeURIComponent(failedJobId)}/result`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workerId: "phase0-fail-owner",
          status: "failed",
          stderr: "sanitized controlled failure",
        }),
      },
    );

    const mcp = spawn(
      process.execPath,
      [cli, "mcp", "serve", "--workspace", workspace],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    if (!mcp.stdin || !mcp.stdout)
      throw new Error("lifecycle MCP pipes unavailable");
    const lines = readline.createInterface({
      input: mcp.stdout,
      crlfDelay: Infinity,
    });
    const iterator = lines[Symbol.asyncIterator]();
    const mcpRequest = async (message: Record<string, unknown>) => {
      mcp.stdin?.write(`${JSON.stringify(message)}\n`);
      const next = await iterator.next();
      if (next.done) throw new Error("lifecycle MCP closed early");
      return asRecord(JSON.parse(next.value));
    };
    await mcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });
    const evidenceResponse = await mcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "clm_record_evidence",
        arguments: {
          phase_id: "phase_1",
          name: "phase0/result.json",
          content: '{"ok":true}',
          media_type: "application/json",
        },
      },
    });
    mcp.stdin.end();
    await new Promise((resolve) => mcp.once("close", resolve));
    lines.close();
    const evidenceResult = asRecord(
      asRecord(evidenceResponse.result).structuredContent,
    );

    const state = (await json(`${daemonUrl}/v1/state`)).body;
    const jobs = state.workerJobs as Array<Record<string, unknown>>;
    const handoffs = state.handoffs as Array<Record<string, unknown>>;
    const handoff = handoffs.find((item) => item.phaseId === "phase_1");
    if (!handoff) throw new Error("phase handoff was not persisted");
    const validation = asRecord(handoff.validation);
    const integrity = asRecord(handoff.integrity);
    const eventFeed = (await json(`${dashboardUrl}/api/events`)).body;
    const events = eventFeed.events as Array<Record<string, unknown>>;

    capture = {
      createStatus: created.response.status,
      createdJobStatus: String(createdJob.status),
      claimStatus: claimed.response.status,
      claimedJobStatus: String(claimedJob.status),
      claimedBy: String(claimedJob.claimedBy),
      wrongWorkerStatus: wrong.response.status,
      completionStatus: completed.response.status,
      completedJobStatus: String(completedJob.status),
      duplicateStatus: duplicate.response.status,
      reconciledJobStatus: String(jobs.find((job) => job.id === jobId)?.status),
      failedResultStatus: failed.response.status,
      failedJobStatus: String(
        jobs.find((job) => job.id === failedJobId)?.status,
      ),
      durableCompletionEvents: events.filter(
        (event) => event.type === "worker.job.completed",
      ).length,
      handoff: {
        phaseId: String(handoff.phaseId),
        validationOk: validation.ok === true,
        integrityAlgorithm: String(integrity.algorithm),
      },
      evidence: {
        phaseId: String(evidenceResult.phaseId ?? evidenceResult.phase_id),
        relativePath: path.relative(
          path.join(workspace, ".context-loop", "evidence"),
          String(evidenceResult.path),
        ),
        durableEventCount: events.filter(
          (event) => event.type === "mcp.evidence_recorded",
        ).length,
      },
      safePauseRequested: String(pauseSummary.status),
      safePauseReached: String(reachedSafePause.status),
      nextPhaseStarted: reachedTimeline.some(
        (phase) => phase.id === "phase_2" && phase.status === "running",
      ),
    };
  } finally {
    const dashboardStopped = await terminateService(dashboard);
    const daemonStopped = await terminateService(daemon);
    servicesTerminated = dashboardStopped && daemonStopped;
    await fs.rm(workspace, { recursive: true, force: true });
  }

  let workspaceDisposed = false;
  try {
    await fs.access(workspace);
  } catch {
    workspaceDisposed = true;
  }
  return { ...capture, servicesTerminated, workspaceDisposed };
}

export async function captureMcpContract(
  checkout: string,
): Promise<McpCapture> {
  const { checkoutRoot: root, temporaryRoot } =
    await preflightCheckout(checkout);
  const { workspace } = await createSafeTemporaryWorkspace(root, "aiw-mcp-");
  const cli = path.join(root, "bin", "clm.mjs");
  let child: ChildProcess | null = null;
  let exitedCleanly = false;
  let capture: Omit<McpCapture, "exitedCleanly" | "workspaceDisposed">;

  try {
    await execFileAsync(
      process.execPath,
      [cli, "init", "--project", "phase0-contract"],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        encoding: "utf8",
      },
    );
    child = spawn(
      process.execPath,
      [cli, "mcp", "serve", "--workspace", workspace],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    if (!child.stdin || !child.stdout) throw new Error("MCP pipes unavailable");
    const lines = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });
    const iterator = lines[Symbol.asyncIterator]();
    const request = async (message: Record<string, unknown>) => {
      child?.stdin?.write(`${JSON.stringify(message)}\n`);
      const response = await Promise.race([
        iterator.next(),
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error("MCP response timeout")), 5_000),
        ),
      ]);
      if (response.done) throw new Error("MCP stdout closed before response");
      return JSON.parse(response.value) as Record<string, unknown>;
    };

    const initialize = await request({
      jsonrpc: "2.0",
      id: 41,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {} },
    });
    const listed = await request({
      jsonrpc: "2.0",
      id: "tools-2",
      method: "tools/list",
    });
    const failed = await request({
      jsonrpc: "2.0",
      id: 77,
      method: "resources/list",
    });
    child.stdin.end();
    const closed = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve) =>
      child?.once("close", (code, signal) => resolve({ code, signal })),
    );
    exitedCleanly = closed.code === 0 && closed.signal === null;
    lines.close();

    const initResult = initialize.result as Record<string, unknown>;
    const serverInfo = initResult.serverInfo as Record<string, unknown>;
    const capabilities = initResult.capabilities as Record<string, unknown>;
    const listResult = listed.result as Record<string, unknown>;
    const tools = listResult.tools as Array<Record<string, unknown>>;
    const failure = failed.error as Record<string, unknown>;
    capture = {
      initializeId: initialize.id as number | string | null,
      protocolVersion: String(initResult.protocolVersion),
      serverName: String(serverInfo.name),
      serverVersion: String(serverInfo.version),
      capabilityKeys: Object.keys(capabilities).sort(),
      hasResourcesCapability: Object.hasOwn(capabilities, "resources"),
      listId: listed.id as number | string | null,
      toolNames: tools.map((tool) => String(tool.name)),
      failureId: failed.id as number | string | null,
      failureCode: Number(failure.code),
      interactionsBeforeClose: 3,
    };
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      await terminateService(child);
    }
    await fs.rm(workspace, { recursive: true, force: true });
  }

  let workspaceDisposed = false;
  try {
    await fs.access(workspace);
  } catch {
    workspaceDisposed = true;
  }
  return { ...capture, exitedCleanly, workspaceDisposed };
}

function childEnvironment(temporaryRoot: string): NodeJS.ProcessEnv {
  return safeTemporaryEnvironment(temporaryRoot);
}

function waitForServiceUrl(
  child: ChildProcess,
  pattern: RegExp,
  label: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const finish = (error?: Error, url?: string) => {
      clearTimeout(timer);
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
      child.off("close", onClose);
      if (error) reject(error);
      else resolve(url ?? "");
    };
    const onData = (chunk: Buffer | string) => {
      output += String(chunk);
      const match = output.match(pattern);
      if (match?.[0]) finish(undefined, match[0]);
    };
    const onClose = (code: number | null, signal: NodeJS.Signals | null) =>
      finish(
        new Error(
          `${label} exited before readiness (code=${code}, signal=${signal})`,
        ),
      );
    const timer = setTimeout(
      () => finish(new Error(`${label} readiness timeout`)),
      10_000,
    );
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("close", onClose);
  });
}

async function terminateService(child: ChildProcess | null): Promise<boolean> {
  if (!child) return true;
  if (child.exitCode !== null || child.signalCode !== null) return true;
  const closed = new Promise<boolean>((resolve) =>
    child.once("close", (_code, signal) => resolve(signal === "SIGTERM")),
  );
  child.kill("SIGTERM");
  const terminated = await Promise.race([
    closed,
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!terminated && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("close", resolve));
  }
  return terminated;
}

async function firstSseFrame(
  url: string,
  lastEventId?: string,
): Promise<{ response: Response; frame: string }> {
  const controller = new AbortController();
  const response = await fetch(url, {
    headers: {
      accept: "text/event-stream",
      ...(lastEventId ? { "last-event-id": lastEventId } : {}),
    },
    signal: controller.signal,
  });
  if (!response.body) throw new Error("SSE response has no body");
  const reader = response.body.getReader();
  const { value } = await reader.read();
  const frame = Buffer.from(value ?? []).toString("utf8");
  await reader.cancel();
  controller.abort();
  return { response, frame };
}

export async function captureHttpSseContract(
  checkout: string,
): Promise<HttpSseCapture> {
  const { checkoutRoot: root, temporaryRoot } =
    await preflightCheckout(checkout);
  const { workspace } = await createSafeTemporaryWorkspace(
    root,
    "aiw-http-sse-",
  );
  const cli = path.join(root, "bin", "clm.mjs");
  let daemon: ChildProcess | null = null;
  let dashboard: ChildProcess | null = null;
  let servicesTerminated = false;
  let capture: Omit<HttpSseCapture, "servicesTerminated" | "workspaceDisposed">;

  try {
    await execFileAsync(
      process.execPath,
      [cli, "init", "--project", "phase0-contract"],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        encoding: "utf8",
      },
    );
    daemon = spawn(
      process.execPath,
      [cli, "daemon", "--host", "127.0.0.1", "--port", "0"],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const daemonUrl = await waitForServiceUrl(
      daemon,
      /http:\/\/127\.0\.0\.1:\d+/,
      "daemon",
    );
    dashboard = spawn(
      process.execPath,
      [cli, "dash", "--host", "127.0.0.1", "--port", "0", "--no-open"],
      {
        cwd: workspace,
        env: childEnvironment(temporaryRoot),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const dashboardUrl = await waitForServiceUrl(
      dashboard,
      /http:\/\/127\.0\.0\.1:\d+/,
      "dashboard",
    );

    const healthResponse = await fetch(`${daemonUrl}/health`);
    const health = (await healthResponse.json()) as Record<string, unknown>;
    const daemonPid = daemon.pid;
    if (!daemonPid) throw new Error("daemon process identity unavailable");
    const { attestHealth } = await import("./index.ts");
    await attestHealth({
      workspace,
      status: healthResponse.status,
      contentType: healthResponse.headers.get("content-type"),
      payload: health,
      expectedPid: daemonPid,
      protectedPids: [process.pid, process.ppid],
    });
    const daemonState = await fetch(`${daemonUrl}/v1/state`);
    const daemonNotFound = await fetch(`${daemonUrl}/phase0-not-a-route`);
    const dashboardHealth = await fetch(`${dashboardUrl}/api/health`);
    const snapshot = (await (
      await fetch(`${dashboardUrl}/api/snapshot`)
    ).json()) as Record<string, unknown>;
    const eventFeed = (await (
      await fetch(`${dashboardUrl}/api/events`)
    ).json()) as Record<string, unknown>;
    const initial = await firstSseFrame(
      `${dashboardUrl}/api/events/stream`,
      "phase0-unsupported-cursor",
    );

    await fetch(`${daemonUrl}/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "phase0.reconnect.observed",
        source: "phase0",
      }),
    });
    const reconnected = await firstSseFrame(
      `${dashboardUrl}/api/events/stream`,
      "phase0-unsupported-cursor",
    );

    capture = {
      daemonReady: healthResponse.status === 200,
      dashboardReady: dashboardHealth.status === 200,
      attested: true,
      daemonStateStatus: daemonState.status,
      daemonNotFoundStatus: daemonNotFound.status,
      healthKeys: Object.keys(health).sort(),
      snapshotKeys: Object.keys(snapshot).sort(),
      eventFeedKeys: Object.keys(eventFeed).sort(),
      sse: {
        contentType: initial.response.headers.get("content-type") ?? "",
        cacheControl: initial.response.headers.get("cache-control") ?? "",
        event: initial.frame.match(/^event: (.+)$/m)?.[1] ?? "",
        hasData: /^data: /m.test(initial.frame),
        hasId: /^id: /m.test(initial.frame),
        lastEventIdHonored: /^id: phase0-unsupported-cursor$/m.test(
          initial.frame,
        ),
        reconnectObservedNewEvent: reconnected.frame.includes(
          "phase0.reconnect.observed",
        ),
      },
    };
  } finally {
    const dashboardStopped = await terminateService(dashboard);
    const daemonStopped = await terminateService(daemon);
    servicesTerminated = dashboardStopped && daemonStopped;
    await fs.rm(workspace, { recursive: true, force: true });
  }

  let workspaceDisposed = false;
  try {
    await fs.access(workspace);
  } catch {
    workspaceDisposed = true;
  }
  return { ...capture, servicesTerminated, workspaceDisposed };
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { InitialReadObservation } from "@agentintersect-world/agentintersect-client/read";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AgentIntersectCommandClient,
  CommandIntentService,
  CommandIntentStore,
  PHASE7_REAL_JOB_FIXTURE,
} from "../src/command-intents.js";
import { createLocalServer } from "../src/server.js";

const roots: string[] = [];
const temporaryRoot = () => {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase7-"));
  roots.push(value);
  return value;
};

const revision = "ce8495fcd0963165a9c68b98414a203c4dc25ace";
const token = "phase7-command-token";
const request = {
  schema: "aiw.command-intent.request/0.7" as const,
  kind: "worker.enqueue-phase" as const,
  phaseId: "phase_7",
  harness: "codex" as const,
  expectedRevision: revision,
  fixture: "phase7-disposable-artifact-v1" as const,
};

function observation(
  overrides: Record<string, unknown> = {},
): InitialReadObservation {
  const base = {
    health: {
      ok: true as const,
      pid: process.pid,
      processStartTime: "fixture",
      protocol: 1 as const,
      service: "agentintersect-daemon/v1" as const,
      workspaceIdentity: "sha256:fixture",
    },
    state: {
      currentPhase: { id: "phase_7", status: "running", revision },
      session: { id: "session-7" },
      workerJobs: [],
      phases: [],
    },
    snapshot: {
      currentPhase: { id: "phase_7", status: "running", revision },
      session: { id: "session-7" },
      phaseTimeline: [],
      workerJobs: [],
      agents: [],
    },
    feed: { ok: true as const, events: [] },
    observedAt: "2026-07-20T12:00:00.000Z",
  } satisfies InitialReadObservation;
  return { ...base, ...overrides } as InitialReadObservation;
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function service(
  root: string,
  fetcher: typeof fetch,
  now: () => number = () => Date.parse("2026-07-20T12:00:00.000Z"),
  evidenceService?: {
    prepare: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
    finalize: ReturnType<typeof vi.fn>;
  },
) {
  return new CommandIntentService({
    store: new CommandIntentStore(root),
    client: new AgentIntersectCommandClient({
      daemonUrl: "http://127.0.0.1:3761",
      readClient: { readInitial: async () => observation() },
      fetcher,
      rawLogDirectory: path.join(root, "raw-command-logs"),
    }),
    expectedPhaseId: "phase_7",
    expectedRevision: revision,
    now,
    ...(evidenceService ? { evidenceService: evidenceService as never } : {}),
  });
}

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe("Phase 7 durable command intents", () => {
  it("fails closed before external mutation when the Phase 8 baseline cannot be sealed", async () => {
    const root = temporaryRoot();
    const fetcher = vi.fn<typeof fetch>();
    const evidenceService = {
      prepare: vi.fn(() => {
        throw new Error("baseline unavailable");
      }),
      abort: vi.fn(),
      finalize: vi.fn(),
    };
    const commands = new CommandIntentService({
      store: new CommandIntentStore(root),
      client: new AgentIntersectCommandClient({
        daemonUrl: "http://127.0.0.1:3761",
        readClient: { readInitial: async () => observation() },
        fetcher,
        rawLogDirectory: path.join(root, "raw-command-logs"),
      }),
      expectedPhaseId: "phase_7",
      expectedRevision: revision,
      evidenceService,
    });

    const submitted = await commands.submit(
      "evidence-fail-closed",
      request,
      "correlation-evidence",
    );

    expect(submitted.intent.state).toBe("failed");
    expect(submitted.intent.diagnostics).toContain(
      "Repository evidence baseline could not be sealed; external dispatch was not attempted.",
    );
    expect(evidenceService.prepare).toHaveBeenCalledWith(submitted.intent.id);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("dispatches one strict create and replays the same fingerprint without redispatch", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      expect(String(url)).toBe("http://127.0.0.1:3761/v1/worker/jobs");
      expect(init?.method).toBe("POST");
      expect(init?.headers).not.toMatchObject({
        "idempotency-key": expect.anything(),
      });
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        type: "phase_run",
        harness: "codex",
        phase_id: "phase_7",
        payload: {
          fixture: "phase7-disposable-artifact-v1",
          hardTimeoutMs: 600_000,
          maxDispatchAttempts: 1,
          requestedModelTokenLimit: 80_000,
          requestedCostLimitUsd: 1,
          usageLimitEnforcement: "unsupported-by-pinned-create-contract",
        },
      });
      return response({
        ok: true,
        job: {
          id: "job-7",
          type: "phase_run",
          harness: "codex",
          status: "queued",
          phaseId: "phase_7",
          attempts: 0,
        },
      });
    });
    const root = temporaryRoot();
    const commands = service(root, fetcher);
    const first = await commands.submit("same-key", request, "correlation-7");
    const second = await commands.submit("same-key", request, "correlation-8");

    expect(first.intent).toMatchObject({
      schema: "aiw.command-intent/0.7",
      state: "confirmed",
      jobId: "job-7",
      lifecycle: "queued",
      sessionId: "session-7",
    });
    expect(second.replay).toBe(true);
    expect(second.intent.id).toBe(first.intent.id);
    await expect(
      commands.submit("different-active-key", request, "correlation-9"),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new CommandIntentStore(root).list()[0]).toMatchObject({
      jobId: "job-7",
      state: "confirmed",
    });
    expect(PHASE7_REAL_JOB_FIXTURE.expectedArtifact.after).toEqual({
      message: "AgentIntersect World Phase 7 fixture complete",
      verified: true,
    });
  });

  it("conflicts on a reused key with a different canonical request", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      response({
        ok: true,
        job: {
          id: "job-7",
          type: "phase_run",
          harness: "codex",
          status: "queued",
          phaseId: "phase_7",
          attempts: 0,
        },
      }),
    );
    const commands = service(temporaryRoot(), fetcher);
    await commands.submit("same-key", request, "correlation-7");
    await expect(
      commands.submit(
        "same-key",
        { ...request, harness: "hermes" },
        "correlation-8",
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("persists post-send uncertainty as ambiguous and never resends after retry or restart", async () => {
    const root = temporaryRoot();
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new TypeError(
        "socket closed after secret-token /home/operator/repo",
      );
    });
    const commands = service(root, fetcher);
    const first = await commands.submit(
      "lost-response",
      request,
      "correlation-7",
    );
    expect(first.intent.state).toBe("ambiguous");
    expect(first.intent).not.toHaveProperty("jobId");
    expect(JSON.stringify(first.intent)).not.toContain("secret-token");
    expect(JSON.stringify(first.intent)).not.toContain("/home/operator/repo");

    const restarted = service(root, fetcher);
    const replay = await restarted.submit(
      "lost-response",
      request,
      "correlation-8",
    );
    expect(replay.replay).toBe(true);
    expect(replay.intent.state).toBe("ambiguous");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails closed before mutation for stale/mismatched attestation and rejects malformed create responses", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      response({ job: { id: 7 } }),
    );
    const root = temporaryRoot();
    const wrongPhaseClient = new AgentIntersectCommandClient({
      daemonUrl: "http://127.0.0.1:3761",
      readClient: {
        readInitial: async () =>
          observation({
            state: {
              currentPhase: { id: "phase_6", status: "running", revision },
              session: { id: "session-7" },
              workerJobs: [],
              phases: [],
            },
          }),
      },
      fetcher,
      rawLogDirectory: path.join(root, "raw"),
    });
    const wrongPhaseService = new CommandIntentService({
      store: new CommandIntentStore(root),
      client: wrongPhaseClient,
      expectedPhaseId: "phase_7",
      expectedRevision: revision,
    });
    const rejected = await wrongPhaseService.submit(
      "wrong-phase",
      request,
      "correlation-7",
    );
    expect(rejected.intent.state).toBe("rejected");
    expect(fetcher).not.toHaveBeenCalled();

    const malformed = service(temporaryRoot(), fetcher);
    const failed = await malformed.submit(
      "malformed",
      request,
      "correlation-8",
    );
    expect(failed.intent.state).toBe("failed");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects revision, harness, session, and offline readiness before the create route", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      response({ ok: true, job: {} }),
    );
    const cases: Array<InitialReadObservation | Error> = [
      observation({
        state: {
          currentPhase: {
            id: "phase_7",
            status: "running",
            revision: "wrong-revision",
          },
          session: { id: "session-7" },
          workerJobs: [],
          phases: [],
        },
      }),
      observation({
        state: {
          currentPhase: { id: "phase_7", status: "running", revision },
          session: { id: "session-7" },
          workerJobs: [{ id: "job-1", harness: "hermes" }],
          phases: [],
        },
      }),
      observation({
        snapshot: {
          currentPhase: { id: "phase_7", status: "running", revision },
          session: { id: "different-session" },
          phaseTimeline: [],
          workerJobs: [],
          agents: [],
        },
      }),
      observation({
        state: {
          currentPhase: { id: "phase_7", status: "running" },
          session: { id: "session-7" },
          workerJobs: [],
          phases: [],
        },
        snapshot: {
          currentPhase: { id: "phase_7", status: "running" },
          session: { id: "session-7" },
          phaseTimeline: [],
          workerJobs: [],
          agents: [],
        },
      }),
      observation({
        snapshot: {
          currentPhase: { id: "phase_7", status: "complete", revision },
          session: { id: "session-7" },
          phaseTimeline: [],
          workerJobs: [],
          agents: [],
        },
      }),
      new Error("offline or stale authority"),
    ];
    for (const [index, value] of cases.entries()) {
      const root = temporaryRoot();
      const commands = new CommandIntentService({
        store: new CommandIntentStore(root),
        client: new AgentIntersectCommandClient({
          daemonUrl: "http://127.0.0.1:3761",
          readClient: {
            readInitial: async () => {
              if (value instanceof Error) throw value;
              return value;
            },
          },
          fetcher,
          rawLogDirectory: path.join(root, "raw"),
        }),
        expectedPhaseId: "phase_7",
        expectedRevision: revision,
      });
      const outcome = await commands.submit(
        `readiness-${index}`,
        request,
        `correlation-${index}`,
      );
      expect(outcome.intent.state, String(index)).toBe("rejected");
    }
    const wrongRevision = service(temporaryRoot(), fetcher);
    expect(
      (
        await wrongRevision.submit(
          "wrong-request-revision",
          { ...request, expectedRevision: "wrong" },
          "correlation-revision",
        )
      ).intent.state,
    ).toBe("rejected");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("bounds oversized create-response raw logs before durable reference", async () => {
    const root = temporaryRoot();
    const commands = service(
      root,
      async () =>
        new Response("x".repeat(400_000), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const outcome = await commands.submit(
      "oversized-create-response",
      request,
      "correlation-oversized",
    );
    expect(outcome.intent.state).toBe("failed");
    expect(outcome.intent.rawLogRef).toBeTruthy();
    const rawLog = fs.readFileSync(
      path.join(root, outcome.intent.rawLogRef as string),
    );
    expect(rawLog.byteLength).toBeLessThanOrEqual(262_144);
    expect(rawLog.toString("utf8")).toContain("[TRUNCATED]");
  });

  it("reconciles ambiguous intent only from Phase 6 read evidence and keeps raw final data local", async () => {
    const root = temporaryRoot();
    let clock = Date.parse("2026-07-20T12:00:00.000Z");
    const evidenceService = {
      prepare: vi.fn(),
      abort: vi.fn(),
      finalize: vi.fn(),
    };
    const commands = service(
      root,
      async () => {
        throw new TypeError("lost response");
      },
      () => (clock += 1_000),
      evidenceService,
    );
    const ambiguous = await commands.submit(
      "read-only-reconcile",
      request,
      "correlation-7",
    );
    const projection = {
      timeline: [
        {
          mapping: { jobId: "job-reconciled", runId: "run-reconciled" },
          payload: {
            worldIntentId: ambiguous.intent.id,
            status: "complete",
            reportedPaths: ["src/main.ts"],
            testEvidence: {
              path: ".agentintersect-world/test-evidence.json",
              hash: "f".repeat(64),
              state: "passed",
            },
            harnessLog: "raw harness log /home/operator/private/repo",
            result: {
              token: "raw-secret-value",
              path: "/home/operator/private/repo",
              verification: "passed",
            },
          },
        },
      ],
      roster: [],
    } as never;
    const reconciled = commands.reconcile(projection);
    const intent = reconciled.find((item) => item.id === ambiguous.intent.id);
    expect(intent).toMatchObject({
      state: "confirmed",
      jobId: "job-reconciled",
      runId: "run-reconciled",
      lifecycle: "complete",
      artifact: { verification: "passed" },
    });
    expect(JSON.stringify(intent)).not.toContain("raw-secret-value");
    expect(JSON.stringify(intent)).not.toContain("/home/operator");
    expect(evidenceService.prepare).toHaveBeenCalledWith(ambiguous.intent.id);
    expect(evidenceService.finalize).toHaveBeenCalledWith({
      intentId: ambiguous.intent.id,
      jobId: "job-reconciled",
      runId: "run-reconciled",
      lifecycle: "complete",
      reportedPaths: ["src/main.ts"],
      testEvidence: {
        path: ".agentintersect-world/test-evidence.json",
        hash: "f".repeat(64),
        state: "passed",
      },
    });
    const rawFinal = fs.readFileSync(
      path.join(
        root,
        "raw-command-logs",
        ambiguous.intent.id,
        "final-job.json",
      ),
      "utf8",
    );
    expect(rawFinal).toContain("raw-secret-value");
    expect(rawFinal).toContain("raw harness log");
    expect(rawFinal).toContain("/home/operator/private/repo");
    if (!intent) throw new Error("reconciled intent missing");
    const storeFilename = path.join(root, "phase7-command-intents.json");
    const durableBefore = fs.readFileSync(storeFilename, "utf8");
    const repeated = commands
      .reconcile(projection)
      .find((item) => item.id === ambiguous.intent.id);
    expect(repeated?.updatedAt).toBe(intent.updatedAt);
    expect(fs.readFileSync(storeFilename, "utf8")).toBe(durableBefore);
  });

  it("recovers a prior verified generation and fails closed when all generations are corrupt", async () => {
    const root = temporaryRoot();
    const commands = service(root, async () =>
      response({
        ok: true,
        job: {
          id: "job-7",
          type: "phase_run",
          harness: "codex",
          status: "queued",
          phaseId: "phase_7",
          attempts: 0,
        },
      }),
    );
    await commands.submit("verified", request, "correlation-7");
    const filename = path.join(root, "phase7-command-intents.json");
    fs.writeFileSync(filename, "{corrupt", "utf8");
    expect(new CommandIntentStore(root).list()).toHaveLength(1);
    fs.writeFileSync(`${filename}.previous`, "{also-corrupt", "utf8");
    expect(() => new CommandIntentStore(root)).toThrow(/corrupt.*fail-closed/i);
  });

  it("treats a definite upstream rejection as rejected and contains no claim, completion, or spawn authority", async () => {
    const commands = service(temporaryRoot(), async () =>
      response({ ok: false, error: "unsupported" }, 422),
    );
    expect(
      (await commands.submit("upstream-rejection", request, "correlation-7"))
        .intent.state,
    ).toBe("rejected");
    const source = fs.readFileSync(
      path.join(process.cwd(), "apps/local-server/src/command-intents.ts"),
      "utf8",
    );
    expect(source).not.toContain("/v1/worker/jobs/next");
    expect(source).not.toMatch(/\/v1\/worker\/jobs\/[^"`]+\/result/);
    expect(source).not.toMatch(/child_process|\bspawn\s*\(/);
  });

  it("authorizes loopback and explicit trusted-LAN clients before store mutation", async () => {
    const intent = {
      schema: "aiw.command-intent/0.7" as const,
      id: "7e8f8590-4d7a-45d5-9ada-e8aa735d60af",
      idempotencyKey: "one",
      requestFingerprint: "0".repeat(64),
      request,
      state: "confirmed" as const,
      correlationId: "correlation-7",
      phaseId: "phase_7",
      jobId: "job-7",
      lifecycle: "queued" as const,
      diagnostics: [],
      createdAt: "2026-07-20T12:00:00.000Z",
      updatedAt: "2026-07-20T12:00:00.000Z",
    };
    const commands = {
      submit: vi.fn(async () => ({
        replay: false,
        intent,
      })),
      list: vi.fn(() => []),
      reconcile: vi.fn(() => []),
      require: vi.fn(),
      close: vi.fn(),
    };
    const baseConfig = {
      networkScope: "loopback" as const,
      host: "127.0.0.1",
      port: 3770,
      instanceName: "Phase 7 test",
      demoOperationMaxMs: 5_000,
      repositoryMaxFiles: 100,
      agentIntersectRead: {
        daemonUrl: "http://127.0.0.1:3761",
        dashboardUrl: "http://127.0.0.1:3762",
        expectedWorkspace: temporaryRoot(),
        dataDir: temporaryRoot(),
        staleAfterMs: 15_000,
        maxQueuedFrames: 32,
      },
      agentIntersectCommands: {
        token,
        expectedPhaseId: "phase_7",
        expectedRevision: revision,
      },
      presentationSync: {
        dataDir: temporaryRoot(),
        allowedOrigin: "http://127.0.0.1:5173",
        allowedHost: "127.0.0.1:5173",
      },
    };
    const server = createLocalServer({
      config: baseConfig,
      commandIntentService: commands as never,
    });
    const missing = await server.inject({
      method: "POST",
      url: "/commands/intents",
      headers: { "idempotency-key": "one" },
      payload: request,
    });
    const wrong = await server.inject({
      method: "POST",
      url: "/commands/intents",
      headers: {
        authorization: "Bearer wrong",
        "idempotency-key": "one",
      },
      payload: request,
    });
    const valid = await server.inject({
      method: "POST",
      url: "/commands/intents",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": "one",
      },
      payload: request,
      remoteAddress: "127.0.0.1",
    });
    expect(missing.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect(valid.statusCode).toBe(202);
    expect(commands.submit).toHaveBeenCalledTimes(1);
    expect(
      (await server.inject({ method: "GET", url: "/config" })).json().data,
    ).toMatchObject({ agentIntersectCommandsEnabled: true });
    expect(
      JSON.stringify(
        (await server.inject({ method: "GET", url: "/config" })).json(),
      ),
    ).not.toContain(token);
    await server.close();

    const lan = createLocalServer({
      config: { ...baseConfig, networkScope: "lan", host: "0.0.0.0" },
      commandIntentService: commands as never,
    });
    expect(
      (
        await lan.inject({
          method: "POST",
          url: "/commands/intents",
          remoteAddress: "192.168.1.20",
          headers: {
            authorization: `Bearer ${token}`,
            "idempotency-key": "lan-one",
          },
          payload: request,
        })
      ).statusCode,
    ).toBe(202);
    expect(
      (
        await lan.inject({
          method: "POST",
          url: "/commands/intents",
          remoteAddress: "203.0.113.9",
          headers: {
            authorization: `Bearer ${token}`,
            "idempotency-key": "public",
          },
          payload: request,
        })
      ).statusCode,
    ).toBe(403);
    await lan.close();
  });
});

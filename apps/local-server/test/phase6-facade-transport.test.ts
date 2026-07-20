import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { AttestationError } from "@agentintersect-world/agentintersect-client";
import {
  AgentIntersectReadClient,
  ContractReadError,
} from "@agentintersect-world/agentintersect-client/read";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "aiw-phase6-workspace-"),
  );
  roots.push(workspace);
  const workspaceIdentity = `sha256:${createHash("sha256")
    .update(path.normalize(fs.realpathSync(workspace)))
    .digest("hex")}`;
  const processStat = fs.readFileSync(`/proc/${process.pid}/stat`, "utf8");
  const processStartTime = processStat
    .slice(processStat.lastIndexOf(")") + 2)
    .split(" ")[19];
  let mode: "ready" | "fake-health" | "malformed" | "offline" = "ready";
  const fetcher = (async (input: string | URL | Request) => {
    if (mode === "offline") throw new TypeError("connection refused");
    const route = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input
          : input.url,
    ).pathname;
    const headers = { "content-type": "application/json; charset=utf-8" };
    if (route === "/health") {
      return new Response(
        JSON.stringify(
          mode === "fake-health"
            ? {
                ok: true,
                pid: process.pid,
                processStartTime,
                protocol: 999,
                service: "fake-service",
                workspaceIdentity: "wrong",
              }
            : {
                ok: true,
                pid: process.pid,
                processStartTime,
                protocol: 1,
                service: "agentintersect-daemon/v1",
                workspaceIdentity,
              },
        ),
        { status: 200, headers },
      );
    }
    if (mode === "malformed")
      return new Response("{", { status: 200, headers });
    if (route === "/v1/state")
      return new Response(
        JSON.stringify({
          currentPhase: { id: "phase_6", status: "running" },
          workerJobs: [],
          phases: [],
        }),
        { status: 200, headers },
      );
    if (route === "/api/snapshot")
      return new Response(
        JSON.stringify({
          currentPhase: { id: "phase_6", status: "running" },
          phaseTimeline: [],
          workerJobs: [],
          agents: [],
        }),
        { status: 200, headers },
      );
    if (route === "/api/events")
      return new Response(JSON.stringify({ ok: true, events: [] }), {
        status: 200,
        headers,
      });
    return new Response(JSON.stringify({ ok: false }), {
      status: 404,
      headers,
    });
  }) as typeof fetch;
  return {
    workspace,
    fetcher,
    setMode: (next: typeof mode) => {
      mode = next;
    },
  };
}

describe("Phase 6 read compatibility facade transport", () => {
  it("reads the pinned health/state/snapshot/feed contract", async () => {
    const transport = fixture();
    const client = new AgentIntersectReadClient({
      daemonUrl: "http://127.0.0.1:3761",
      dashboardUrl: "http://127.0.0.1:3762",
      expectedWorkspace: transport.workspace,
      expectedPid: process.pid,
      fetcher: transport.fetcher,
    });
    const result = await client.readInitial();
    expect(result.health.service).toBe("agentintersect-daemon/v1");
    expect(result.state.currentPhase?.id).toBe("phase_6");
    expect(result.feed.events).toEqual([]);
  });

  it("parses only pinned events SSE frames without claiming source resume IDs", async () => {
    const transport = fixture();
    const encoder = new TextEncoder();
    const sseFetcher = (async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'event: events\ndata: {"sequence":7,"events":[{"type":"phase.updated","phaseId":"phase_6"}]}\n\n',
              ),
            );
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      )) as typeof fetch;
    const client = new AgentIntersectReadClient({
      daemonUrl: "http://127.0.0.1:3761",
      dashboardUrl: "http://127.0.0.1:3762",
      expectedWorkspace: transport.workspace,
      fetcher: sseFetcher,
    });
    const frames: unknown[] = [];
    await client.streamEvents((frame) => {
      frames.push(frame);
    }, new AbortController().signal);
    expect(frames).toEqual([
      { sequence: 7, events: [{ type: "phase.updated", phaseId: "phase_6" }] },
    ]);
  });

  it("rejects malformed SSE wrappers without invoking callbacks", async () => {
    const transport = fixture();
    const encoder = new TextEncoder();
    const client = new AgentIntersectReadClient({
      daemonUrl: "http://127.0.0.1:3761",
      dashboardUrl: "http://127.0.0.1:3762",
      expectedWorkspace: transport.workspace,
      fetcher: (async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'event: events\ndata: {"events":"not-an-array"}\n\n',
                ),
              );
              controller.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        )) as typeof fetch,
    });
    let callbacks = 0;
    await expect(
      client.streamEvents(() => {
        callbacks += 1;
      }, new AbortController().signal),
    ).rejects.toMatchObject({ code: "unsupported" });
    expect(callbacks).toBe(0);
  });

  it("cancels oversized streamed HTTP responses before parsing", async () => {
    const transport = fixture();
    let cancelled = false;
    let pulls = 0;
    const client = new AgentIntersectReadClient({
      daemonUrl: "http://127.0.0.1:3761",
      dashboardUrl: "http://127.0.0.1:3762",
      expectedWorkspace: transport.workspace,
      fetcher: (async () =>
        new Response(
          new ReadableStream(
            {
              pull(controller) {
                pulls += 1;
                if (pulls <= 3) controller.enqueue(new Uint8Array(200_000));
                if (pulls === 3) controller.close();
              },
              cancel() {
                cancelled = true;
              },
            },
            { highWaterMark: 0 },
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        )) as typeof fetch,
    });
    await expect(client.readInitial()).rejects.toMatchObject({
      code: "oversized",
    });
    expect(pulls).toBe(2);
    expect(cancelled).toBe(true);
  });

  it("cancels oversized SSE chunks with zero callbacks", async () => {
    const transport = fixture();
    let cancelled = false;
    let pulls = 0;
    const client = new AgentIntersectReadClient({
      daemonUrl: "http://127.0.0.1:3761",
      dashboardUrl: "http://127.0.0.1:3762",
      expectedWorkspace: transport.workspace,
      fetcher: (async () =>
        new Response(
          new ReadableStream(
            {
              pull(controller) {
                pulls += 1;
                if (pulls <= 3) controller.enqueue(new Uint8Array(40_000));
                if (pulls === 3) controller.close();
              },
              cancel() {
                cancelled = true;
              },
            },
            { highWaterMark: 0 },
          ),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        )) as typeof fetch,
    });
    let callbacks = 0;
    await expect(
      client.streamEvents(() => {
        callbacks += 1;
      }, new AbortController().signal),
    ).rejects.toMatchObject({ code: "oversized" });
    expect(callbacks).toBe(0);
    expect(pulls).toBe(2);
    expect(cancelled).toBe(true);
  });

  it("fails closed for fake health/workspace/process contract and malformed/offline responses", async () => {
    const transport = fixture();
    const client = new AgentIntersectReadClient({
      daemonUrl: "http://127.0.0.1:3761",
      dashboardUrl: "http://127.0.0.1:3762",
      expectedWorkspace: transport.workspace,
      expectedPid: process.pid,
      fetcher: transport.fetcher,
    });
    transport.setMode("fake-health");
    await expect(client.readInitial()).rejects.toBeInstanceOf(AttestationError);
    transport.setMode("malformed");
    await expect(client.readInitial()).rejects.toBeInstanceOf(
      ContractReadError,
    );
    transport.setMode("offline");
    await expect(client.readInitial()).rejects.toMatchObject({
      code: "offline",
    });
  });
});

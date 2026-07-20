import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  DAEMON_ROUTES,
  DASHBOARD_ROUTES,
  EXPECTED_SOURCE_HASHES,
  observeCheckout,
  validateCompatibility,
  type AgentIntersectCompatibilityObservation,
  type CheckoutObservation,
  type CompatibilityResult,
} from "./checkout-preflight.js";
import type { McpCapture } from "./phase0-harness.js";

export {
  sanitizeEvidence,
  scanCommittedEvidence,
  type EvidenceScan,
  type SanitizationContext,
} from "./sanitization.js";

export interface Phase0EvidenceObservation {
  checkout: CheckoutObservation;
  healthAttested: boolean;
  healthKeys: readonly string[];
  mcp: McpCapture;
}

export function validatePhase0Evidence(
  observation: Phase0EvidenceObservation,
): CompatibilityResult {
  const mismatches = validateCompatibility(
    observation.checkout.compatibility,
  ).mismatches.map((field) => `checkout.${field}`);
  if (
    JSON.stringify(observation.checkout.sourceHashes) !==
    JSON.stringify(EXPECTED_SOURCE_HASHES)
  ) {
    mismatches.push("checkout.source_hashes");
  }
  if (
    JSON.stringify(observation.checkout.daemonRoutes) !==
    JSON.stringify(DAEMON_ROUTES)
  ) {
    mismatches.push("routes.daemon");
  }
  if (
    JSON.stringify(observation.checkout.dashboardRoutes) !==
    JSON.stringify(DASHBOARD_ROUTES)
  ) {
    mismatches.push("routes.dashboard");
  }
  const expectedHealthKeys = [
    "ok",
    "pid",
    "processStartTime",
    "protocol",
    "service",
    "workspaceIdentity",
  ];
  if (!observation.healthAttested) mismatches.push("health.attestation");
  if (
    JSON.stringify(observation.healthKeys) !==
    JSON.stringify(expectedHealthKeys)
  ) {
    mismatches.push("health.schema");
  }
  if (observation.mcp.protocolVersion !== "2024-11-05") {
    mismatches.push("mcp.protocol");
  }
  if (
    observation.mcp.serverName !== "agentintersect-clm" ||
    observation.mcp.serverVersion !== "0.1.0"
  ) {
    mismatches.push("mcp.server");
  }
  if (
    JSON.stringify(observation.mcp.capabilityKeys) !== JSON.stringify(["tools"])
  ) {
    mismatches.push("mcp.capabilities");
  }
  if (observation.mcp.hasResourcesCapability) mismatches.push("mcp.resources");
  const expectedTools = [
    "clm_get_current_phase",
    "clm_report_telemetry",
    "clm_request_handoff",
    "clm_get_resume_packet",
    "clm_record_evidence",
  ];
  if (
    JSON.stringify(observation.mcp.toolNames) !== JSON.stringify(expectedTools)
  ) {
    mismatches.push("mcp.tools");
  }
  return { ok: mismatches.length === 0, mismatches: [...new Set(mismatches)] };
}

export interface AgentIntersectHealth {
  ok: true;
  pid: number;
  processStartTime: string;
  protocol: 1;
  service: "agentintersect-daemon/v1";
  workspaceIdentity: string;
}

export type AgentIntersectHarness =
  | "codex"
  | "claude-code"
  | "hermes"
  | "openclaw";

export interface CurrentWorkerJobInput {
  type: "phase_run" | "design_doc_request";
  harness: AgentIntersectHarness;
  phase_id?: string;
  designDocName?: string;
  transportMode?: "local" | "lan";
  baseUrl?: string;
  payload?: Record<string, unknown>;
}

export interface CurrentWorkerJob {
  id: string;
  type: CurrentWorkerJobInput["type"];
  harness: AgentIntersectHarness;
  status: "queued" | "running" | "complete" | "failed";
  phaseId?: string;
  claimedBy?: string;
  completedBy?: string;
  attempts: number;
  result?: unknown;
}

export interface AgentIntersectClient {
  attest(signal?: AbortSignal): Promise<AgentIntersectHealth>;
  getState(signal?: AbortSignal): Promise<unknown>;
  getInstructions(phaseId: string, signal?: AbortSignal): Promise<unknown>;
  getResumePacket(phaseId: string, signal?: AbortSignal): Promise<unknown>;
  createWorkerJob(input: CurrentWorkerJobInput): Promise<CurrentWorkerJob>;
  getNextWorkerJob(query: {
    harness?: AgentIntersectHarness;
    workerId?: string;
    jobId?: string;
  }): Promise<CurrentWorkerJob | null>;
  completeWorkerJob(jobId: string, body: unknown): Promise<unknown>;
  postEvent(body: unknown): Promise<void>;
  postTelemetry(body: unknown): Promise<void>;
  postClaudeHook(body: unknown): Promise<unknown>;
  postHandoff(body: unknown): Promise<void>;
}

export interface HealthAttestationInput {
  workspace: string;
  status: number;
  contentType: string | null;
  payload: unknown;
  expectedPid?: number;
  protectedPids?: readonly number[];
}

export class AttestationError extends Error {
  readonly mismatches: string[];

  constructor(mismatches: string[]) {
    super(`AgentIntersect attestation failed: ${mismatches.join(", ")}`);
    this.name = "AttestationError";
    this.mismatches = mismatches;
  }
}

export async function attestHealth(
  input: HealthAttestationInput,
): Promise<AgentIntersectHealth> {
  const mismatches: string[] = [];
  if (input.status !== 200) mismatches.push("http_status");
  if (
    input.contentType?.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/json"
  ) {
    mismatches.push("content_type");
  }

  const payload = input.payload;
  const healthKeys = [
    "ok",
    "pid",
    "processStartTime",
    "protocol",
    "service",
    "workspaceIdentity",
  ].sort();
  const plain =
    payload !== null && typeof payload === "object" && !Array.isArray(payload);
  const record = plain ? (payload as Record<string, unknown>) : null;
  const exactKeys =
    record !== null &&
    JSON.stringify(Object.keys(record).sort()) === JSON.stringify(healthKeys);

  if (!record || !exactKeys) {
    mismatches.push("malformed_payload");
  } else {
    if (record.ok !== true) mismatches.push("health_not_ok");
    if (record.service !== "agentintersect-daemon/v1")
      mismatches.push("service");
    if (record.protocol !== 1) mismatches.push("protocol");

    let canonicalWorkspace: string | null = null;
    try {
      const realWorkspace = await fs.realpath(path.resolve(input.workspace));
      const stat = await fs.stat(realWorkspace);
      if (!stat.isDirectory()) throw new Error("workspace is not a directory");
      canonicalWorkspace = `sha256:${createHash("sha256")
        .update(path.normalize(realWorkspace))
        .digest("hex")}`;
    } catch {
      mismatches.push("workspace_identity_unavailable");
    }
    if (
      !canonicalWorkspace ||
      record.workspaceIdentity !== canonicalWorkspace
    ) {
      mismatches.push("workspace");
    }

    if (!Number.isSafeInteger(record.pid) || Number(record.pid) <= 0) {
      mismatches.push("pid");
    } else {
      const pid = Number(record.pid);
      if (input.expectedPid !== undefined && pid !== input.expectedPid) {
        mismatches.push("unexpected_pid");
      }
      if (input.protectedPids?.includes(pid)) mismatches.push("protected_pid");
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch (error) {
        alive =
          error instanceof Error &&
          "code" in error &&
          (error as NodeJS.ErrnoException).code === "EPERM";
      }
      if (!alive) {
        mismatches.push("pid_not_alive");
      } else {
        let observedStartTime: string | null = null;
        try {
          const stat = await fs.readFile(`/proc/${pid}/stat`, "utf8");
          observedStartTime =
            stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] ?? null;
        } catch {
          mismatches.push("process_identity_unavailable");
        }
        if (
          observedStartTime &&
          (typeof record.processStartTime !== "string" ||
            record.processStartTime !== observedStartTime)
        ) {
          mismatches.push("process_identity_mismatch");
        }
      }
    }
  }

  if (mismatches.length > 0) {
    throw new AttestationError([...new Set(mismatches)]);
  }
  return payload as AgentIntersectHealth;
}

export {
  DAEMON_ROUTES,
  DASHBOARD_ROUTES,
  observeCheckout,
  validateCompatibility,
  type AgentIntersectCompatibilityObservation,
  type CheckoutObservation,
  type CompatibilityResult,
} from "./checkout-preflight.js";
export {
  captureHttpSseContract,
  captureMcpContract,
  captureLifecycleContract,
  captureEmergencyStopContract,
  type HttpSseCapture,
  type McpCapture,
  type LifecycleCapture,
  type EmergencyStopCapture,
} from "./phase0-harness.js";

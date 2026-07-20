import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  attestFixedTemporaryRoot,
  safeTemporaryEnvironment,
} from "./safe-temporary-root.js";

const execFileAsync = promisify(execFile);

export const DAEMON_ROUTES = [
  "GET /health",
  "GET /v1/state",
  "GET /v1/instructions",
  "GET /v1/resume-packet",
  "POST /v1/worker/jobs",
  "GET /v1/worker/jobs/next",
  "POST /v1/worker/jobs/:jobId/result",
  "POST /v1/events",
  "POST /v1/telemetry",
  "POST /v1/claude-code/hooks",
  "POST /v1/handoffs",
] as const;

export const DASHBOARD_ROUTES = [
  "GET /assets/dashboard/:filename",
  "GET /",
  "GET /demo",
  "GET /api/health",
  "GET /api/snapshot",
  "GET /api/events",
  "GET /api/events/stream",
  "GET /api/dashboard-state",
  "POST /api/setup/avatar",
  "POST /api/setup/workspace",
  "POST /api/setup/harness",
  "GET /api/setup/wizard",
  "GET /api/connectors/hermes/config-preview",
  "POST /api/connectors/hermes/test",
  "GET /api/connectors/:connectorId/config-preview",
  "POST /api/connectors/:connectorId/test",
  "GET /api/onboarding/prompt",
  "POST /api/onboarding/complete",
  "POST /api/design-doc/request",
  "POST /api/worker/local-daemon",
  "POST /api/worker/run-once",
  "GET /api/worker/remote-script",
  "POST /api/worker/jobs",
  "POST /api/design-doc/handoff",
  "POST /api/design-doc/paste",
  "POST /api/design-doc/import-local",
  "GET /api/design-doc/validation",
  "GET /api/design-doc/active",
  "POST /api/progress/reconcile",
  "POST /api/design-doc/activate",
  "POST /api/auto-advance/:action",
  "POST /api/pause/:action",
  "POST /api/emergency-stop",
  "POST /api/phases/:phaseId/:action",
] as const;

export interface AgentIntersectCompatibilityObservation {
  commit: string;
  originMain: string;
  branch: string;
  clean: boolean;
  packageName: string;
  packageVersion: string;
  packagePrivate: boolean;
  packageType: string;
  nodeRange: string;
  nodeMajor: number;
}

export interface CompatibilityResult {
  ok: boolean;
  mismatches: string[];
}

export interface CheckoutObservation {
  compatibility: AgentIntersectCompatibilityObservation;
  daemonRoutes: readonly string[];
  dashboardRoutes: readonly string[];
  sourceHashes: Record<string, string>;
}

const EXPECTED_COMPATIBILITY: AgentIntersectCompatibilityObservation = {
  commit: "14c620271cd02e455d3244241de951e00ef77a4d",
  originMain: "14c620271cd02e455d3244241de951e00ef77a4d",
  branch: "main",
  clean: true,
  packageName: "@contextloop/manager",
  packageVersion: "0.1.0",
  packagePrivate: true,
  packageType: "module",
  nodeRange: ">=24",
  nodeMajor: 24,
};

export const EXPECTED_SOURCE_HASHES: Readonly<Record<string, string>> = {
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
};

export class CheckoutPreflightError extends Error {
  readonly mismatches: string[];

  constructor(mismatches: string[], options?: ErrorOptions) {
    super(
      `AgentIntersect checkout preflight failed: ${mismatches.join(", ")}`,
      {
        ...options,
      },
    );
    this.name = "CheckoutPreflightError";
    this.mismatches = mismatches;
  }
}

async function git(
  checkout: string,
  args: string[],
  temporaryRoot: string,
): Promise<string> {
  const env = {
    ...safeTemporaryEnvironment(temporaryRoot),
    GIT_OPTIONAL_LOCKS: "0",
  };
  const { stdout } = await execFileAsync("git", ["-C", checkout, ...args], {
    encoding: "utf8",
    env,
  });
  return stdout.trim();
}

async function sha256(filename: string): Promise<string> {
  return createHash("sha256")
    .update(await fs.readFile(filename))
    .digest("hex");
}

export function validateCompatibility(
  observation: AgentIntersectCompatibilityObservation,
): CompatibilityResult {
  const fields = Object.keys(EXPECTED_COMPATIBILITY) as Array<
    keyof AgentIntersectCompatibilityObservation
  >;
  const mismatches = fields.filter(
    (field) => observation[field] !== EXPECTED_COMPATIBILITY[field],
  );
  return { ok: mismatches.length === 0, mismatches };
}

export async function observeCheckout(
  checkout: string,
): Promise<CheckoutObservation> {
  const root = await fs.realpath(checkout);
  const { temporaryRoot } = await attestFixedTemporaryRoot();
  const packageJson = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  ) as Record<string, unknown>;
  const engines = packageJson.engines as Record<string, unknown> | undefined;
  const sourceFiles = Object.keys(EXPECTED_SOURCE_HASHES);
  const hashEntries = await Promise.all(
    sourceFiles.map(
      async (file) => [file, await sha256(path.join(root, file))] as const,
    ),
  );
  return {
    compatibility: {
      commit: await git(root, ["rev-parse", "HEAD"], temporaryRoot),
      originMain: await git(root, ["rev-parse", "origin/main"], temporaryRoot),
      branch: await git(root, ["branch", "--show-current"], temporaryRoot),
      clean:
        (await git(root, ["status", "--porcelain=v1"], temporaryRoot)) === "",
      packageName: String(packageJson.name ?? ""),
      packageVersion: String(packageJson.version ?? ""),
      packagePrivate: packageJson.private === true,
      packageType: String(packageJson.type ?? ""),
      nodeRange: String(engines?.node ?? ""),
      nodeMajor: Number(process.versions.node.split(".")[0]),
    },
    daemonRoutes: DAEMON_ROUTES,
    dashboardRoutes: DASHBOARD_ROUTES,
    sourceHashes: Object.fromEntries(hashEntries),
  };
}

export async function preflightCheckout(
  checkout: string,
): Promise<{ checkoutRoot: string; temporaryRoot: string }> {
  let checkoutRoot: string;
  let observation: CheckoutObservation;
  try {
    checkoutRoot = await fs.realpath(checkout);
    observation = await observeCheckout(checkoutRoot);
  } catch (error) {
    throw new CheckoutPreflightError(["checkout.observation_unavailable"], {
      cause: error,
    });
  }

  const mismatches = validateCompatibility(
    observation.compatibility,
  ).mismatches.map((field) => `checkout.${field}`);
  if (
    JSON.stringify(observation.sourceHashes) !==
    JSON.stringify(EXPECTED_SOURCE_HASHES)
  ) {
    mismatches.push("checkout.source_hashes");
  }
  if (mismatches.length > 0) throw new CheckoutPreflightError(mismatches);

  try {
    const { temporaryRoot } = await attestFixedTemporaryRoot(checkoutRoot);
    return { checkoutRoot, temporaryRoot };
  } catch (error) {
    const mismatch =
      error instanceof Error && "mismatch" in error
        ? String(error.mismatch)
        : "temporary_root.unavailable";
    throw new CheckoutPreflightError([mismatch], { cause: error });
  }
}

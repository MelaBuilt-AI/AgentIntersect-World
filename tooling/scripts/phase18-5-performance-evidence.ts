import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Phase18_5CadenceAuthority = "hardware" | "software-emulation";

export const PHASE18_5_HARDWARE_EVIDENCE_PATH =
  "artifacts/phase18-5/phase18-5-hardware-measurement.json";

export const PHASE18_5_PRODUCTION_INPUTS = [
  "packages/renderer-r3f/src/avatar-kit-canvas.tsx",
  "packages/renderer-r3f/src/world-room-canvas.tsx",
  "packages/renderer-r3f/src/index.ts",
  "packages/avatar-system/src/index.ts",
  "apps/web/public/assets/avatar/aiw-avatar-kit.glb",
] as const;

export type Phase18_5HardwareEvidence = {
  schema: string;
  measuredAt: string;
  authority: Phase18_5CadenceAuthority;
  passed: boolean;
  browser: {
    name: string;
    version: string;
    renderer: string;
    errors: string[];
  };
  viewport: { width: number; height: number };
  observability: {
    userLod: string;
    agentLod: string;
    renderLoop: string;
    renderLoopMode: string;
    cosmeticQuality: string;
    renderDpr: string;
    antialias: boolean;
  };
  sampling: {
    warmupFrames: number;
    cadenceSamples: number;
    renderSamples: number;
  };
  metrics: {
    cadence: {
      minMs: number;
      medianMs: number;
      p90Ms: number;
      p95Ms: number;
      maxMs: number;
      samplesOverThreshold: number;
    };
    renderWork: { p95Ms: number };
    longTasks: { count: number; maxMs: number };
  };
  thresholds: {
    renderWorkP95Ms: number;
    cadenceP95Ms: number;
    longestTaskMs: number;
  };
  productionInputs: Record<string, { sha256: string }>;
  screenshot: { path: string; sha256: string };
  visualQa: { passed: boolean; notes: string[] };
};

export type Phase18_5HardwareEvidenceValidation = {
  passed: boolean;
  errors: string[];
};

const SOFTWARE_RENDERER_PATTERNS = [
  /swiftshader/u,
  /llvmpipe/u,
  /lavapipe/u,
  /softpipe/u,
  /software raster/u,
  /microsoft basic render driver/u,
  /software emulation/u,
];

const EDGE_VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/u;
const APPROVED_HARDWARE_RENDERER_PATTERN =
  /nvidia geforce rtx 5070 ti.*(?:direct3d11|d3d11)/iu;

const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

export function classifyPhase18_5Renderer(
  renderer: string | null | undefined,
): Phase18_5CadenceAuthority {
  if (!renderer?.trim()) return "software-emulation";
  const normalized = renderer.toLocaleLowerCase();
  return SOFTWARE_RENDERER_PATTERNS.some((pattern) => pattern.test(normalized))
    ? "software-emulation"
    : "hardware";
}

export function readPhase18_5HardwareEvidence(
  workspaceRoot = process.cwd(),
): Phase18_5HardwareEvidence {
  return JSON.parse(
    readFileSync(
      resolve(workspaceRoot, PHASE18_5_HARDWARE_EVIDENCE_PATH),
      "utf8",
    ),
  ) as Phase18_5HardwareEvidence;
}

function validatePhase18_5EvidenceIntegrity(
  evidence: Phase18_5HardwareEvidence,
  workspaceRoot: string,
): Phase18_5HardwareEvidenceValidation {
  const errors: string[] = [];
  if (evidence.schema !== "aiw.phase18-5.hardware-measurement/1")
    errors.push("hardware evidence schema is invalid");
  if (evidence.authority !== "hardware")
    errors.push("hardware evidence authority is not hardware");
  if (!evidence.passed) errors.push("hardware evidence is not marked passed");
  if (evidence.browser?.name !== "Microsoft Edge")
    errors.push("hardware evidence browser is not Microsoft Edge");
  if (!EDGE_VERSION_PATTERN.test(evidence.browser?.version ?? ""))
    errors.push("hardware evidence browser version is invalid");
  if (classifyPhase18_5Renderer(evidence.browser?.renderer) !== "hardware")
    errors.push("hardware evidence renderer is software-emulated");
  if (
    !APPROVED_HARDWARE_RENDERER_PATTERN.test(evidence.browser?.renderer ?? "")
  )
    errors.push(
      "hardware evidence renderer is not the approved NVIDIA RTX 5070 Ti D3D11 path",
    );
  if (evidence.browser?.errors?.length !== 0)
    errors.push("hardware browser errors are not empty");
  if (
    evidence.observability?.userLod !== "LOD0" ||
    evidence.observability?.agentLod !== "LOD0"
  )
    errors.push("hardware evidence does not prove both avatars at LOD0");
  if (evidence.observability?.renderLoop !== "continuous")
    errors.push("hardware evidence does not prove the continuous render loop");
  if (evidence.observability?.renderLoopMode !== "continuous-native")
    errors.push("hardware evidence does not prove continuous-native mode");
  if (evidence.observability?.cosmeticQuality !== "full")
    errors.push("hardware evidence does not prove full cosmetic quality");
  if (evidence.observability?.renderDpr !== "1")
    errors.push("hardware evidence does not prove DPR 1");
  if (evidence.observability?.antialias !== true)
    errors.push("hardware evidence does not prove antialiasing");
  if (
    evidence.thresholds?.renderWorkP95Ms !== 16.7 ||
    evidence.thresholds?.cadenceP95Ms !== 16.8 ||
    evidence.thresholds?.longestTaskMs !== 100
  )
    errors.push("hardware evidence thresholds differ from the frozen contract");
  if (
    !Number.isFinite(evidence.metrics?.renderWork?.p95Ms) ||
    evidence.metrics.renderWork.p95Ms > 16.7
  )
    errors.push("hardware render-work p95 exceeds 16.7 ms");
  if (
    !Number.isFinite(evidence.metrics?.cadence?.p95Ms) ||
    evidence.metrics.cadence.p95Ms > 16.8
  )
    errors.push("hardware cadence p95 exceeds 16.8 ms");
  if (
    !Number.isFinite(evidence.metrics?.longTasks?.maxMs) ||
    evidence.metrics.longTasks.maxMs > 100
  )
    errors.push("hardware Long Task maximum exceeds 100 ms");
  if (evidence.sampling?.warmupFrames !== 45)
    errors.push("hardware evidence warmup is not 45 frames");
  if (evidence.sampling?.cadenceSamples !== 120)
    errors.push("hardware evidence cadence sample count is not 120");
  if (evidence.sampling?.renderSamples !== 24)
    errors.push("hardware evidence render sample count is not 24");
  if (evidence.metrics?.cadence?.samplesOverThreshold !== 0)
    errors.push("hardware evidence has cadence samples above 16.8 ms");
  if (evidence.visualQa?.passed !== true)
    errors.push("hardware visual QA is not marked passed");

  const fingerprints = evidence.productionInputs;
  const fingerprintKeys =
    fingerprints && typeof fingerprints === "object"
      ? Object.keys(fingerprints).sort()
      : [];
  if (
    JSON.stringify(fingerprintKeys) !==
    JSON.stringify([...PHASE18_5_PRODUCTION_INPUTS].sort())
  )
    errors.push(
      "historical production input fingerprint keys differ from the frozen contract",
    );
  for (const relativePath of fingerprintKeys) {
    const recorded = fingerprints?.[relativePath]?.sha256;
    if (typeof recorded !== "string" || !/^[a-f0-9]{64}$/u.test(recorded))
      errors.push(
        `historical production input fingerprint is invalid: ${relativePath}`,
      );
  }
  const screenshotPath = evidence.screenshot?.path;
  const absoluteScreenshot =
    typeof screenshotPath === "string"
      ? resolve(workspaceRoot, screenshotPath)
      : "";
  if (
    !absoluteScreenshot ||
    !existsSync(absoluteScreenshot) ||
    evidence.screenshot.sha256 !== sha256(absoluteScreenshot)
  )
    errors.push("hardware screenshot fingerprint mismatch");

  return { passed: errors.length === 0, errors };
}

export function validatePhase18_5HistoricalEvidence(
  evidence: Phase18_5HardwareEvidence,
  workspaceRoot = process.cwd(),
): Phase18_5HardwareEvidenceValidation {
  return validatePhase18_5EvidenceIntegrity(evidence, workspaceRoot);
}

export function validatePhase18_5HardwareEvidence(
  evidence: Phase18_5HardwareEvidence,
  workspaceRoot = process.cwd(),
): Phase18_5HardwareEvidenceValidation {
  // Retained hardware results are milestone evidence, not a source-byte lock on
  // later development. Their recorded fingerprints remain historical metadata.
  return validatePhase18_5EvidenceIntegrity(evidence, workspaceRoot);
}

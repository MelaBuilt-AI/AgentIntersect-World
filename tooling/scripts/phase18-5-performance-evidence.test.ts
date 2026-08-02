import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  classifyPhase18_5Renderer,
  validatePhase18_5HistoricalEvidence,
  validatePhase18_5HardwareEvidence,
  type Phase18_5HardwareEvidence,
} from "./phase18-5-performance-evidence.js";

const hardwareEvidencePath = resolve(
  "artifacts/phase18-5/phase18-5-hardware-measurement.json",
);

const loadEvidence = (): Phase18_5HardwareEvidence =>
  JSON.parse(readFileSync(hardwareEvidencePath, "utf8"));

const cloneEvidence = (
  evidence: Phase18_5HardwareEvidence,
): Phase18_5HardwareEvidence => structuredClone(evidence);

describe("historical Phase 18.5 performance evidence authority", () => {
  it("classifies hardware and common software-emulation renderers", () => {
    expect(
      classifyPhase18_5Renderer(
        "ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Ti, Direct3D11)",
      ),
    ).toBe("hardware");
    for (const renderer of [
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))",
      "Google SwiftShader",
      "llvmpipe (LLVM 19.1.1, 256 bits)",
      "Mesa lavapipe",
      "softpipe",
      "Microsoft Basic Render Driver",
      "Software Rasterizer",
      null,
    ]) {
      expect(classifyPhase18_5Renderer(renderer)).toBe("software-emulation");
    }
  });

  it("accepts the internally intact July 26 record as historical", () => {
    expect(validatePhase18_5HistoricalEvidence(loadEvidence())).toEqual({
      passed: true,
      errors: [],
    });
    expect(validatePhase18_5HardwareEvidence(loadEvidence()).passed).toBe(
      false,
    );
  });

  it("rejects malformed historical fingerprints and screenshot drift", () => {
    const evidence = cloneEvidence(loadEvidence());
    delete evidence.productionInputs["packages/renderer-r3f/src/index.ts"];
    evidence.productionInputs["unexpected.ts"] = { sha256: "A".repeat(64) };
    evidence.screenshot.sha256 = "0".repeat(64);
    const validation = validatePhase18_5HistoricalEvidence(evidence);
    expect(validation.passed).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "historical production input fingerprint keys differ from the frozen contract",
        "historical production input fingerprint is invalid: unexpected.ts",
        "hardware screenshot fingerprint mismatch",
      ]),
    );
  });

  it("fails closed when a production input fingerprint drifts", () => {
    const evidence = cloneEvidence(loadEvidence());
    const input =
      evidence.productionInputs[
        "packages/renderer-r3f/src/avatar-kit-canvas.tsx"
      ];
    expect(input).toBeDefined();
    if (!input) return;
    input.sha256 = "0".repeat(64);
    const validation = validatePhase18_5HardwareEvidence(evidence);
    expect(validation.passed).toBe(false);
    expect(validation.errors).toContain(
      "production input fingerprint mismatch: packages/renderer-r3f/src/avatar-kit-canvas.tsx",
    );
  });

  it("rejects hardware evidence that exceeds an unchanged threshold", () => {
    const evidence = cloneEvidence(loadEvidence());
    evidence.metrics.cadence.p95Ms = 16.9;
    const validation = validatePhase18_5HardwareEvidence(evidence);
    expect(validation.passed).toBe(false);
    expect(validation.errors).toContain("hardware cadence p95 exceeds 16.8 ms");
  });

  it("rejects failed or browser-error hardware evidence", () => {
    const evidence = cloneEvidence(loadEvidence());
    evidence.passed = false;
    evidence.browser.errors.push("page error");
    const validation = validatePhase18_5HardwareEvidence(evidence);
    expect(validation.passed).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "hardware evidence is not marked passed",
        "hardware browser errors are not empty",
      ]),
    );
  });

  it("rejects generic non-Edge and non-RTX hardware evidence", () => {
    const evidence = cloneEvidence(loadEvidence());
    evidence.browser.name = "Chromium";
    evidence.browser.version = "0";
    evidence.browser.renderer = "ANGLE (Intel, Generic GPU, D3D11)";
    const validation = validatePhase18_5HardwareEvidence(evidence);
    expect(validation.passed).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "hardware evidence browser is not Microsoft Edge",
        "hardware evidence browser version is invalid",
        "hardware evidence renderer is not the approved NVIDIA RTX 5070 Ti D3D11 path",
      ]),
    );
  });

  it("rejects hardware evidence missing structured full-native policy", () => {
    const evidence = cloneEvidence(loadEvidence());
    const observability = evidence.observability as unknown as Record<
      string,
      unknown
    >;
    delete observability.cosmeticQuality;
    delete observability.renderDpr;
    delete observability.antialias;
    delete observability.renderLoopMode;
    const validation = validatePhase18_5HardwareEvidence(evidence);
    expect(validation.passed).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "hardware evidence does not prove full cosmetic quality",
        "hardware evidence does not prove DPR 1",
        "hardware evidence does not prove antialiasing",
        "hardware evidence does not prove continuous-native mode",
      ]),
    );
  });
});

import { describe, expect, it } from "vitest";

import { evaluatePhase15Metrics } from "./phase15-measurement-verdict.js";

describe("Phase 15 capability-aware performance verdict", () => {
  it("labels supplemental synthetic control samples truthfully and requires attestation", () => {
    const evaluated = evaluatePhase15Metrics({
      captureStateTransitionMs: [12, 14],
      wavEncodeAndBindingMs: [400, 600],
      ttsStateTransitionMs: [30, 40],
      stopPlaybackStateTransitionMs: [4, 6],
      incrementalHeapMiB: 4,
      providerAttestation: { available: true, reason: null },
    });
    expect(evaluated).toMatchObject({
      evidenceKind: "synthetic-control-microbenchmark",
      acceptanceEvidence: false,
      verdict: true,
      capability: { providerAttested: true },
    });
    expect(evaluated.metrics.map(({ name }) => name).join(" ")).not.toMatch(
      /local-stt|tts-request-to-speaking|capture-control-visible-response/,
    );
    expect(
      evaluatePhase15Metrics({
        captureStateTransitionMs: [251],
        wavEncodeAndBindingMs: [10_001],
        ttsStateTransitionMs: [5_001],
        stopPlaybackStateTransitionMs: [101],
        incrementalHeapMiB: 32.01,
        providerAttestation: { available: true, reason: null },
      }),
    ).toMatchObject({ verdict: false });
    expect(() =>
      evaluatePhase15Metrics({
        captureStateTransitionMs: [],
        wavEncodeAndBindingMs: [],
        ttsStateTransitionMs: [],
        stopPlaybackStateTransitionMs: [],
        incrementalHeapMiB: 0,
        providerAttestation: { available: false, reason: "not configured" },
      }),
    ).toThrow(/raw samples/i);
  });
});

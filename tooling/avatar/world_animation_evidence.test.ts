import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const root = new URL(
  "../../artifacts/avatar-replacement-evidence/world-animation-completion-v1/",
  import.meta.url,
);

describe("bounded complete-avatar animation evidence", () => {
  it("preserves the historical 23 x 12 structural, temporal, and visual record", () => {
    const summaryUrl = new URL("evidence-summary.json", root);
    expect(existsSync(summaryUrl)).toBe(true);
    if (!existsSync(summaryUrl)) return;
    const summary = JSON.parse(readFileSync(summaryUrl, "utf8")) as {
      readonly schema: string;
      readonly modelCount: number;
      readonly mappingCount: number;
      readonly samplesPerMapping: number;
      readonly browserTemporalProof: {
        readonly status: string;
        readonly verification: string;
        readonly trace: { readonly path: string; readonly sha256: string };
        readonly captures: readonly {
          readonly path: string;
          readonly sha256: string;
        }[];
      };
      readonly semanticReview: {
        readonly schema: string;
        readonly totals: Readonly<Record<string, number>>;
        readonly runtimePolicy: string;
      };
      readonly mappings: readonly {
        readonly modelId: string;
        readonly semantic: string;
        readonly clipIndex: number;
        readonly clipName: string;
        readonly durationSeconds: number;
        readonly channelCount: number;
        readonly targetCount: number;
        readonly motionChannelSha256: string;
        readonly temporalProof: string;
        readonly visualProof: string;
        readonly structuralVerification: string;
        readonly semanticReview: {
          readonly verdict: string;
          readonly reviewedClipIndex: number;
          readonly expectedClipIndex: number | null;
          readonly rationale: string;
          readonly evidenceRefs: readonly string[];
        };
      }[];
    };
    expect(summary).toMatchObject({
      schema: "aiw.world-avatar-animation-evidence/2",
      modelCount: 23,
      mappingCount: 276,
      samplesPerMapping: 3,
      browserTemporalProof: {
        status: "verified",
        verification:
          "representative-human-cat-dog-robot-production-mixer-bone-progression",
      },
    });
    expect(summary.semanticReview).toEqual({
      schema: "aiw.world-animation-semantic-review/2",
      path: "../world-animation-semantic-review-v2/semantic-review-phase18-5.json",
      totals: {
        pass: 69,
        wrong_clip: 0,
        ambiguous: 207,
        unsupported: 0,
      },
      runtimePolicy: "pass-only-all-other-verdicts-refused",
    });
    const browserFiles = [
      summary.browserTemporalProof.trace,
      ...summary.browserTemporalProof.captures,
    ];
    expect(browserFiles).toHaveLength(10);
    for (const artifact of browserFiles) {
      const artifactUrl = new URL(artifact.path, root);
      expect(existsSync(artifactUrl)).toBe(true);
      if (!existsSync(artifactUrl)) continue;
      expect(
        createHash("sha256").update(readFileSync(artifactUrl)).digest("hex"),
      ).toBe(artifact.sha256);
    }
    const trace = JSON.parse(
      readFileSync(
        new URL(summary.browserTemporalProof.trace.path, root),
        "utf8",
      ),
    ) as {
      readonly schema: string;
      readonly samples: readonly {
        readonly state: string;
        readonly user: {
          readonly actionTime: number;
          readonly boneName: string;
          readonly mixerRoot: string;
        };
        readonly agent: { readonly mixerRoot: string };
      }[];
    };
    expect(trace.schema).toBe("aiw.browser-model-local-motion-trace/1");
    expect(trace.samples.map(({ state }) => state)).toEqual([
      "idle-1",
      "idle-2",
      "walk",
      "run",
      "returned-idle",
    ]);
    expect(trace.samples[2]!.user.actionTime).toBeGreaterThan(0.2);
    expect(trace.samples[3]!.user.actionTime).toBeGreaterThan(0.2);
    expect(trace.samples.every(({ user }) => user.boneName === "L_Thigh")).toBe(
      true,
    );
    expect(trace.samples[0]!.user.mixerRoot).not.toBe(
      trace.samples[0]!.agent.mixerRoot,
    );
    expect(
      new Set(summary.mappings.map(({ modelId }) => modelId)),
    ).toHaveLength(23);
    expect(
      summary.mappings.every(
        (mapping) =>
          mapping.clipIndex >= 0 &&
          mapping.durationSeconds > 0 &&
          mapping.channelCount > 0 &&
          mapping.targetCount > 0 &&
          /^[a-f0-9]{64}$/u.test(mapping.motionChannelSha256) &&
          mapping.temporalProof ===
            "deterministic-duration-channel-motion-plus-three-position-visual-evidence" &&
          mapping.visualProof ===
            `temporal-review/${mapping.modelId}.png#${mapping.semantic}` &&
          mapping.structuralVerification === "structural-temporal-evidence" &&
          mapping.semanticReview.reviewedClipIndex === mapping.clipIndex &&
          mapping.semanticReview.rationale.length > 20 &&
          mapping.semanticReview.evidenceRefs.length > 0 &&
          (mapping.semanticReview.verdict === "pass"
            ? mapping.semanticReview.expectedClipIndex === mapping.clipIndex
            : mapping.semanticReview.expectedClipIndex === null),
      ),
    ).toBe(true);
    for (const modelId of new Set(
      summary.mappings.map(({ modelId }) => modelId),
    ))
      expect(existsSync(new URL(`temporal-review/${modelId}.png`, root))).toBe(
        true,
      );
  });
});

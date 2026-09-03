import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import * as replacement from "../src/imported-avatar.js";

const approvedAnnotationUrl = new URL(
  "../../../artifacts/avatar-replacement-evidence/world-animation-operator-review-v2/avatar-gesture-annotations.json",
  import.meta.url,
);

type ApprovedAnnotation = {
  readonly modelCount: number;
  readonly vocabulary: readonly string[];
  readonly progress: {
    readonly resolvedDecisionCount: number;
    readonly remainingDecisionCount: number;
  };
  readonly models: readonly {
    readonly modelId: string;
    readonly clips: readonly {
      readonly clipIndex: number;
      readonly annotation: {
        readonly decision: string;
        readonly evidenceReference: string;
        readonly notes: string;
      };
    }[];
  }[];
};

describe("approved Animation Confirmations runtime integration", () => {
  it("resolves every one of Aaron's 230 exact model-local gesture selections", () => {
    expect(existsSync(approvedAnnotationUrl)).toBe(true);
    if (!existsSync(approvedAnnotationUrl)) return;

    const document = JSON.parse(
      readFileSync(approvedAnnotationUrl, "utf8"),
    ) as ApprovedAnnotation;
    expect(document).toMatchObject({
      modelCount: 23,
      progress: { resolvedDecisionCount: 230, remainingDecisionCount: 0 },
    });
    expect(replacement.IMPORTED_AVATAR_SEMANTICS).toEqual([
      "Idle",
      "Walk",
      "Run",
      ...document.vocabulary,
    ]);

    let resolved = 0;
    for (const model of document.models) {
      const assignments = model.clips.filter((clip) =>
        document.vocabulary.includes(clip.annotation.decision),
      );
      expect(assignments).toHaveLength(10);
      for (const clip of assignments) {
        const semantic = clip.annotation
          .decision as replacement.ImportedAvatarSemantic;
        const modelId = model.modelId as replacement.ImportedAvatarAssetId;
        expect(
          replacement.resolveImportedAvatarWorldClip(modelId, semantic),
        ).toMatchObject({
          assetId: model.modelId,
          semantic,
          clipIndex: clip.clipIndex,
          verification: "semantic-review-pass",
        });
        expect(
          replacement.importedAvatarSemanticReview(modelId, semantic),
        ).toMatchObject({
          verdict: "pass",
          reviewedClipIndex: clip.clipIndex,
          expectedClipIndex: clip.clipIndex,
        });
        resolved += 1;
      }
    }
    expect(resolved).toBe(230);
  });

  it("loops the approved model-local Dig clip instead of completing it as a one-shot", () => {
    expect(
      replacement.resolveImportedAvatarWorldClip("cat-agent-01", "Dig"),
    ).toMatchObject({
      semantic: "Dig",
      clipIndex: 0,
      locomotion: "Idle",
      oneShot: false,
      verification: "semantic-review-pass",
    });
  });
});

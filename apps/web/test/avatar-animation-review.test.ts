import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  importedAvatarSemanticReview,
  resolveImportedAvatarWorldClip,
} from "@agentintersect-world/avatar-system/imported-avatar";
import { describe, expect, it } from "vitest";

import {
  AVATAR_REVIEW_SEMANTICS,
  createAvatarReviewReceipt,
  reviewClipReuse,
  serializeAvatarReviewReceipt,
  unresolvedAvatarReviewVerdicts,
  validateAvatarReviewReceipt,
  validateImportedAvatarReviewManifest,
} from "../src/avatar/avatar-animation-review-contract.js";
import { hasAvatarReviewWebGl } from "../src/avatar/avatar-review-webgl.js";

const manifestText = readFileSync(
  new URL("../public/assets/imported-avatars/manifest.json", import.meta.url),
  "utf8",
);
const manifest = validateImportedAvatarReviewManifest(
  JSON.parse(manifestText),
  createHash("sha256").update(manifestText).digest("hex"),
);

const completedVerdicts = () =>
  Object.fromEntries(
    AVATAR_REVIEW_SEMANTICS.map((semantic) => [
      semantic,
      { verdict: "ambiguous" as const, clipIndex: null },
    ]),
  );

describe("avatar animation semantic review contract", () => {
  it("starts every required semantic unresolved without guessed answers", () => {
    expect(AVATAR_REVIEW_SEMANTICS).toEqual([
      "Jump",
      "Dance",
      "Clap",
      "Cheer",
      "Wave",
      "Bow",
      "Agree",
      "Angry",
      "Laugh",
    ]);
    expect(unresolvedAvatarReviewVerdicts()).toEqual(
      Object.fromEntries(
        AVATAR_REVIEW_SEMANTICS.map((semantic) => [
          semantic,
          { verdict: "unresolved", clipIndex: null },
        ]),
      ),
    );
  });

  it("exposes every exact role-valid model and defaults to the accepted agent", () => {
    expect(manifest.defaultAgentAsset.id).toBe("cat-agent-01");
    expect(manifest.agentAssets).toHaveLength(17);
    expect(
      manifest.agentAssets.every((asset) =>
        asset.allowedRoles.includes("agent"),
      ),
    ).toBe(true);
    expect(manifest.userAssets.map((asset) => asset.id)).toEqual([
      "user-male-01",
      "user-male-02",
      "user-male-03",
      "user-female-01",
      "user-female-02",
      "user-female-03",
    ]);
    expect(() => manifest.selectAsset("cat-agent-01", "user")).toThrow(
      /role-valid user model/u,
    );
    expect(() => manifest.selectAsset("user-male-01", "agent")).toThrow(
      /role-valid agent model/u,
    );
    expect(manifest.selectAsset("robot-agent-05", "agent").id).toBe(
      "robot-agent-05",
    );
    expect(manifest.selectAsset("user-female-03", "user").id).toBe(
      "user-female-03",
    );
  });

  it("serializes a deterministic sanitized receipt for exactly nine verdicts", () => {
    const receipt = createAvatarReviewReceipt(
      manifest,
      "cat-agent-01",
      "agent",
      completedVerdicts(),
    );
    const first = serializeAvatarReviewReceipt(receipt);
    const second = serializeAvatarReviewReceipt(
      createAvatarReviewReceipt(
        manifest,
        "cat-agent-01",
        "agent",
        completedVerdicts(),
      ),
    );
    expect(first).toBe(second);
    expect(receipt.verdicts).toHaveLength(9);
    expect(receipt.clips).toHaveLength(21);
    expect(receipt.modelId).toBe("cat-agent-01");
    expect(receipt.sourceGlbSha256).toBe(
      "92cfc38bf44186c4ab9abd4612a07c7ce9204cba2207cb03eed698bec8f7616d",
    );
    expect(first).not.toMatch(
      /transcript|sessionId|credential|authorization|\/home\/|\/tmp\//iu,
    );
  });

  it("refuses unresolved, stale, tampered, wrong-model, and unknown-semantic receipts", () => {
    expect(() =>
      createAvatarReviewReceipt(
        manifest,
        "cat-agent-01",
        "agent",
        unresolvedAvatarReviewVerdicts(),
      ),
    ).toThrow(/all nine semantic verdicts/u);
    const receipt = createAvatarReviewReceipt(
      manifest,
      "cat-agent-01",
      "agent",
      completedVerdicts(),
    );
    expect(
      validateAvatarReviewReceipt(receipt, manifest, "cat-agent-01", "agent"),
    ).toEqual(receipt);
    expect(() =>
      validateAvatarReviewReceipt(
        { ...receipt, manifestSha256: "0".repeat(64) },
        manifest,
        "cat-agent-01",
        "agent",
      ),
    ).toThrow(/manifest hash/u);
    expect(() =>
      validateAvatarReviewReceipt(
        { ...receipt, role: "user" },
        manifest,
        "cat-agent-01",
        "agent",
      ),
    ).toThrow(/model role/u);
    expect(() =>
      validateAvatarReviewReceipt(
        {
          ...receipt,
          clips: receipt.clips.map((clip, index) =>
            index === 0 ? { ...clip, durationSeconds: 0.5 } : clip,
          ),
        },
        manifest,
        "cat-agent-01",
        "agent",
      ),
    ).toThrow(/clip inventory/u);
    expect(() =>
      validateAvatarReviewReceipt(receipt, manifest, "user-male-01", "user"),
    ).toThrow(/model/u);
    expect(() =>
      validateAvatarReviewReceipt(
        {
          ...receipt,
          verdicts: [
            ...receipt.verdicts.slice(0, 8),
            { semantic: "Spin", verdict: "ambiguous", clipIndex: null },
          ],
        },
        manifest,
        "cat-agent-01",
        "agent",
      ),
    ).toThrow(/semantic vocabulary/u);
  });

  it("allows explicit clip reuse, reports it conspicuously, and never activates runtime semantics", () => {
    const verdicts = completedVerdicts();
    verdicts.Jump = { verdict: "selected", clipIndex: 2 };
    verdicts.Dance = { verdict: "selected", clipIndex: 2 };
    expect(reviewClipReuse(verdicts)).toEqual([
      { clipIndex: 2, semantics: ["Jump", "Dance"] },
    ]);
    const receipt = createAvatarReviewReceipt(
      manifest,
      "cat-agent-01",
      "agent",
      verdicts,
    );
    const before = resolveImportedAvatarWorldClip("cat-agent-01", "Jump");
    validateAvatarReviewReceipt(receipt, manifest, "cat-agent-01", "agent");
    expect(importedAvatarSemanticReview("cat-agent-01", "Jump").verdict).toBe(
      "pass",
    );
    expect(resolveImportedAvatarWorldClip("cat-agent-01", "Jump")).toEqual(
      before,
    );
  });

  it("refuses to fabricate playback proof when WebGL is unavailable", () => {
    expect(
      hasAvatarReviewWebGl(() => ({ getContext: () => null }) as never),
    ).toBe(false);
    expect(
      hasAvatarReviewWebGl(
        () => ({ getContext: () => ({}) }) as unknown as HTMLCanvasElement,
      ),
    ).toBe(true);
  });
});

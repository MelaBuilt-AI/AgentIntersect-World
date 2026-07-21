import {
  createAvatarProfile,
  DEFAULT_AVATAR_DRAFT,
} from "@agentintersect-world/avatar-system";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AvatarBuilder } from "../src/avatar/AvatarBuilder.js";
import { AvatarRoster } from "../src/avatar/AvatarRoster.js";
import { integrationFixture } from "../src/integration/integration-fixtures.js";

const profile = createAvatarProfile(
  { ...DEFAULT_AVATAR_DRAFT, agentName: "Codex" },
  null,
  "2026-07-20T12:00:00.000Z",
  "avatar_0123456789abcdef0123456789abcdef",
);
describe("Phase 11 semantic avatar UI", () => {
  it("renders the six numbered, fully labeled, name-gated editor sections", () => {
    const html = renderToStaticMarkup(
      <AvatarBuilder initialProfile={DEFAULT_AVATAR_DRAFT} onSave={vi.fn()} />,
    );
    for (const text of [
      "1</b> Name",
      "2</b> Species/head",
      "3</b> Body parts",
      "4</b> Color/markings",
      "5</b> Tee shirt",
      "6</b> Review and save",
      "Codex",
      "Claude",
      "Hermes",
      "OpenClaw",
      "Text-only mode",
      "Automatic Phase 6 roster label mapping is off",
    ])
      expect(html).toContain(text);
    expect(html).toContain("disabled");
    expect(html).not.toMatch(/SECRET_CANARY|\/home\//);
    expect(html).toContain('<fieldset class="avatar-option-group"');
    expect(html).toContain("<legend>Hands</legend>");
    expect(html).toContain('id="avatar-species-dog"');
    expect(html).toContain('for="avatar-species-dog"');
    expect(html).not.toMatch(/<label[^>]*>(?:(?!<\/label>).)*<label/s);
  });
  it("keeps generated geometry, fitted labels, connections, and action signatures structural", () => {
    const inspection = JSON.parse(
      readFileSync(
        new URL(
          "../../../assets/avatar/aiw-avatar-blend-inspection.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      checks: Record<string, boolean>;
      actionDetails: Record<string, { bones: string[]; signature: string }>;
    };
    for (const check of [
      "skeletonBoundMeshes",
      "distinctModuleGeometry",
      "curvedTailGeometry",
      "shirtLabelsInsideFront",
      "connectedStandingBiped",
      "multiBoneActions",
      "distinctActionSignatures",
      "facialFeatureInventory",
      "poseEvidenceMetadata",
      "evidenceBoardMetadata",
    ])
      expect(inspection.checks[check], check).toBe(true);
    expect(
      new Set(
        Object.values(inspection.actionDetails).map((item) => item.signature),
      ).size,
    ).toBe(7);
    expect(
      Object.values(inspection.actionDetails).every(
        (item) => item.bones.length >= 3,
      ),
    ).toBe(true);
  });
  it("keeps unconfigured roster records text-only without invented identity", () => {
    const state = integrationFixture("ready");
    const html = renderToStaticMarkup(
      <AvatarRoster
        roster={state.projection.roster}
        integrationStatus="ready"
        profile={profile}
        onProfileSave={vi.fn()}
      />,
    );
    expect(html).toContain("Unconfigured — no fake avatar assigned");
    expect(html).toContain("Current: running");
    expect(html).toContain("Previous: none observed in this view");
  });
});

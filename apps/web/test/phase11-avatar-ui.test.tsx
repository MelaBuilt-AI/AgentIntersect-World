import {
  createAvatarProfile,
  DEFAULT_AVATAR_DRAFT,
} from "@agentintersect-world/avatar-system";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AvatarBuilder } from "../src/avatar/AvatarBuilder.js";
import { AvatarPreview } from "../src/avatar/AvatarPreview.js";
import { AvatarRoster } from "../src/avatar/AvatarRoster.js";
import { integrationFixture } from "../src/integration/integration-fixtures.js";

const profile = createAvatarProfile(
  { ...DEFAULT_AVATAR_DRAFT, agentName: "Codex" },
  null,
  "2026-07-20T12:00:00.000Z",
  "avatar_0123456789abcdef0123456789abcdef",
);
describe("Phase 11 semantic avatar UI", () => {
  it("renders the three numbered, role-filtered, name-gated imported editor sections", () => {
    const html = renderToStaticMarkup(
      <AvatarBuilder initialProfile={DEFAULT_AVATAR_DRAFT} onSave={vi.fn()} />,
    );
    for (const text of [
      "1</b> Name",
      "2</b> Imported model",
      "3</b> Review and save",
      "User Male 1",
      "anonymous source clips",
      "Use Complete Avatar",
      "Text-only mode",
      "Automatic Phase 6 roster label mapping is off",
    ])
      expect(html).toContain(text);
    expect(html).toContain("disabled");
    expect(html).not.toMatch(/SECRET_CANARY|\/home\//);
    expect(html).toContain('class="imported-avatar-option"');
    expect(html).toContain('aria-label="Open User Male 1 3D preview"');
    expect(html).toContain("Loading User Male 1 GLB");
    expect(html).toContain("previewed from its actual GLB");
    expect(html).not.toContain("Stance-card preview");
    expect(html).not.toContain("Modular (verification pending)");
    expect(html).not.toContain("Custom Kit");
    expect(html).not.toContain("Species/head");
    expect(html).not.toContain("Body parts");
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
  it("keeps optional compact 3D cosmetics static in dashboard panels", () => {
    const html = renderToStaticMarkup(
      <AvatarPreview profile={profile} compact action="Work" animate={false} />,
    );
    expect(html).toContain("Compact static preview");
    expect(html).toContain("Rendered contact sheet fallback");
    expect(html).not.toContain("Loading optional 3D preview");
    expect(html).toContain("Animation: Work");
  });
});

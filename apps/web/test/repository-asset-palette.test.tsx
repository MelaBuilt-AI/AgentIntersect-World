import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RepositoryAssetPalette } from "../src/world-entry/RepositoryAssetPalette.js";
import { SCREEN_LABELS } from "../src/world-entry/world-screen-context.js";
import type { Workstream } from "../src/world-entry/workstream-tracer.js";

const work = {
  workstreamId: "w1",
  title: "Improve homepage",
  status: "blocked",
  currentActivity: "Test failed",
  changedFiles: [{ path: "index.html", change: "modified" }],
  validation: [
    {
      id: "test1",
      label: "Homepage test",
      state: "failed",
      summary: "Expected title",
    },
  ],
  authority: { authority: { branch: "feat/homepage" } },
} as unknown as Workstream;
const base = {
  mode: "live" as const,
  selected: null,
  onMode() {},
  onPlace() {},
};

describe("project/current-work overview", () => {
  it("starts compact with project and work truth, not the asset grid or a duplicate inspector", () => {
    const html = renderToStaticMarkup(
      <RepositoryAssetPalette
        {...base}
        projectName="Website"
        agentName="Beans"
        availableWorkstream={work}
      />,
    );
    expect(SCREEN_LABELS.director).toBe("Project / Current Work");
    for (const text of [
      "Website",
      "Improve homepage",
      "blocked",
      "feat/homepage",
      "Beans",
      "Test failed",
      "Arrange workspace",
      "Open work details",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("repository-assets__thumbnail");
    expect(html).not.toContain('id="work-inspector"');
    expect(html).not.toContain("demo fixture");
    expect(html).not.toContain("Asset Inspector");
  });
  it("keeps empty work honest and tucks props behind arrangement", () => {
    const html = renderToStaticMarkup(
      <RepositoryAssetPalette {...base} projectName="Website" />,
    );
    expect(html).toContain("No current Workstream");
    expect(html).toContain("New Workstream");
    expect(html).not.toContain("Place on grid");
    const arranged = renderToStaticMarkup(
      <RepositoryAssetPalette
        {...base}
        mode="director"
        projectName="Website"
      />,
    );
    expect(arranged).toContain("Visual-only props");
    expect(arranged).toContain("Live work keeps updating");
    expect(arranged).not.toContain("repository-assets__thumbnail");
  });
});

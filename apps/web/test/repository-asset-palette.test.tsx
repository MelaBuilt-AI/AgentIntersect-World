import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RepositoryAssetPalette } from "../src/world-entry/RepositoryAssetPalette.js";

describe("RepositoryAssetPalette", () => {
  it("renders the shared 26-asset catalog with truthful director controls", () => {
    const html = renderToStaticMarkup(
      <RepositoryAssetPalette
        mode="director"
        selected={null}
        onMode={() => undefined}
        onPlace={() => undefined}
      />,
    );
    expect(html.match(/class="repository-assets__thumbnail"/gu)).toHaveLength(
      26,
    );
    expect(html).toContain("Repository Asset Palette");
    expect(html).toContain("Director");
    expect(html).toContain("Drag to the repository grid");
  });

  it("shows an honest live tracer unavailable state without a workstream", () => {
    const html = renderToStaticMarkup(
      <RepositoryAssetPalette
        mode="live"
        selected={null}
        onMode={() => undefined}
        onPlace={() => undefined}
        workstreamSource="live"
        tracerMessage="No current Workstream."
      />,
    );

    expect(html).toContain("Authoritative Workbench");
    expect(html).toContain("No current Workstream");
    expect(html).not.toContain("Inspect current Workstream");
  });

  it.each([
    "Loading current Workstream…",
    "Workbench error · Workstream request failed.",
  ])("preserves the live source message: %s", (tracerMessage) => {
    const html = renderToStaticMarkup(
      <RepositoryAssetPalette
        mode="live"
        selected={null}
        onMode={() => undefined}
        onPlace={() => undefined}
        workstreamSource="live"
        tracerMessage={tracerMessage}
      />,
    );

    expect(html).toContain(tracerMessage);
  });

  it("shows create only with a completed user task and explains unavailable or busy state", () => {
    const create = renderToStaticMarkup(
      <RepositoryAssetPalette
        mode="live"
        selected={null}
        onMode={() => undefined}
        onPlace={() => undefined}
        workstreamSource="live"
        tracerMessage="No current Workstream."
        onCreateWorkstream={() => undefined}
        workstreamTask="Make the avatar stop colliding with repository objects."
      />,
    );
    expect(create).toContain("Create Workstream");

    const withoutAuthority = renderToStaticMarkup(
      <RepositoryAssetPalette
        mode="live"
        selected={null}
        onMode={() => undefined}
        onPlace={() => undefined}
        workstreamSource="live"
        tracerMessage="No current Workstream."
      />,
    );
    expect(withoutAuthority).toContain("Create Workstream");
    expect(withoutAuthority).toContain(
      "Send a feature request in World chat first.",
    );
    expect(withoutAuthority).toContain('disabled=""');

    const whilePending = renderToStaticMarkup(
      <RepositoryAssetPalette
        mode="live"
        selected={null}
        onMode={() => undefined}
        onPlace={() => undefined}
        workstreamSource="live"
        tracerMessage="No current Workstream."
        onCreateWorkstream={() => undefined}
        workstreamTask="Make the avatar stop colliding with repository objects."
        workstreamCreateUnavailableReason="Wait for the current agent turn to finish."
        workstreamActionPending
      />,
    );
    expect(whilePending).toContain("Creating Workstream…");
    expect(whilePending).toContain(
      "Wait for the current agent turn to finish.",
    );
    expect(whilePending).toContain('disabled=""');
  });
});

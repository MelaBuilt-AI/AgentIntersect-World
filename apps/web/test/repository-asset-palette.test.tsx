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
});

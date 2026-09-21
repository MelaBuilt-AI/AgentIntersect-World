import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
it("offers read-only saved-file inspection independently of Continue", async () => {
  const module =
    await import("../src/world-entry/SavedWorkstreamFiles.js").catch(
      () => null,
    );
  expect(module?.SavedWorkstreamFiles).toBeTypeOf("function");
  if (!module) return;
  const html = renderToStaticMarkup(
    <module.SavedWorkstreamFiles workstreamId="saved-work" />,
  );
  expect(html).toContain("Inspect saved files");
  expect(html).not.toContain("Continue saved work");
});

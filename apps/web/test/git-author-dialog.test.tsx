import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

it("offers a separate author dialog with explicit local-only scope and no sign-in", async () => {
  const component = await import("../src/world-entry/GitAuthorDialog.js").catch(
    () => null,
  );
  expect(component?.GitAuthorDialog).toBeTypeOf("function");
  if (!component) return;
  const html = renderToStaticMarkup(
    <component.GitAuthorDialog
      initial={{ name: "", email: "" }}
      busy={false}
      error={null}
      onSave={async () => {}}
      onCancel={() => {}}
    />,
  );
  expect(html).toContain("<dialog");
  expect(html).toContain('aria-modal="true"');
  expect(html).toContain("Set up your commit author");
  expect(html).toContain("Commit author name");
  expect(html).toContain("Commit author email");
  expect(html).toContain("Save and continue");
  expect(html).toContain("Cancel");
  expect(html).toContain("this repository only");
  expect(html).toContain("does not sign you in or publish anything");
  expect(html).toContain("visible to others if you publish");
  expect(html).toMatch(/type="submit" disabled=""/);
});

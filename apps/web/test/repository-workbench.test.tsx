import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RepositoryWorkbench } from "../src/world-entry/RepositoryWorkbench.js";
import { NewWorkstreamDialog } from "../src/world-entry/NewWorkstreamDialog.js";

it("renders distinct accessible empty Workbench and confirmed new-task surfaces", () => {
  const html = renderToStaticMarkup(
    <RepositoryWorkbench
      repositoryId={null}
      agentName={null}
      onClose={() => {}}
      onContinue={async () => {}}
      onInspect={() => {}}
      onNew={() => {}}
    />,
  );
  expect(html).toContain('aria-label="Repository Workbench"');
  expect(html).toContain("Load a repository first");
  expect(html).not.toContain('aria-label="New Workstream task"');
  const loaded = renderToStaticMarkup(
    <RepositoryWorkbench
      repositoryId="repo"
      agentName="Agent"
      onClose={() => {}}
      onContinue={async () => {}}
      onInspect={() => {}}
      onNew={() => {}}
    />,
  );
  expect(loaded.indexOf("Step 1 · Repository checkpoint")).toBeGreaterThan(-1);
  expect(loaded.indexOf("Step 1 · Repository checkpoint")).toBeLessThan(
    loaded.indexOf(">New Workstream<"),
  );
  expect(loaded).toMatch(
    /<button[^>]*disabled=""[^>]*>Open current work \/ World View<\/button>/,
  );
  const create = renderToStaticMarkup(
    <NewWorkstreamDialog
      repositoryId={null}
      agentName={null}
      startPoint="HEAD"
      onStart={async () => {}}
      onClose={() => {}}
      onWorkbench={() => {}}
    />,
  );
  expect(create).toContain('aria-label="New Workstream task"');
  expect(create).toContain("Feature / draft PR intended");
  expect(create).toContain('type="submit" disabled=""');
});
it("routes Workbench to repository continuation rather than the New Workstream fallback", async () => {
  const source = await readFile(
    new URL("../src/world-entry/WorldEntryExperience.tsx", import.meta.url),
    "utf8",
  );
  expect(source).toContain("<RepositoryWorkbench");
  expect(source).toContain("<NewWorkstreamDialog");
  expect(source).not.toContain('action === "workbench" && normalWorkstream');
});

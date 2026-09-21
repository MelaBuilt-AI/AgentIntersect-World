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
it("explains uncommitted and committed starting points without silently choosing", () => {
  const html = renderToStaticMarkup(
    <NewWorkstreamDialog
      repositoryId="repo"
      agentName="Hermes"
      sourceWorkstream={{
        workstreamId: "beans-work",
        revision: 2,
        title: "Beans website",
      }}
      startPoint="HEAD"
      onStart={async () => {}}
      onClose={() => {}}
      onWorkbench={() => {}}
    />,
  );
  expect(html).toContain("Copy current uncommitted work");
  expect(html).toContain("Start from this Workstream’s last commit");
  expect(html).toContain("Beans website");
  expect(html).toContain("No commit is created");
  expect(html).toContain("Ignored files");
  expect(html).not.toContain('checked=""');
  expect(html).toContain('type="submit" disabled=""');
});

it("checks Git before offering commit choices and preserves ownership", async () => {
  const component =
    await import("../src/world-entry/AgentChangeWorkDialog.js").catch(
      () => null,
    );
  expect(component?.AgentChangeWorkDialog).toBeTypeOf("function");
  if (!component) return;
  const Dialog = component.AgentChangeWorkDialog;
  const html = renderToStaticMarkup(
    <Dialog
      repositoryId="repo"
      source={{ workstreamId: "beans-work", title: "Beans website" }}
      agentName="Beans"
      onContinue={() => {}}
      onCancel={() => {}}
    />,
  );
  expect(html).toContain("Checking Workstream Git status");
  expect(html).not.toContain("Review local commit");
  expect(html).not.toContain("Change without committing");
  expect(html).toContain("Cancel");
  expect(html).toContain("new Workstream");
  expect(html).not.toContain("All changes committed");
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

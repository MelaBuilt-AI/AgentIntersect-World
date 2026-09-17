import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RepositoryIntakeDialog } from "../src/world-entry/RepositoryIntakeDialog.js";

describe("RepositoryIntakeDialog", () => {
  it("defaults to last opened rather than pinned order and renders one project card for a large library", () => {
    const projects = Array.from({ length: 80 }, (_, index) => ({
      id: `project-${index}`,
      name: `Project ${index}`,
      rootPath: `/projects/${index}`,
      source: "local" as const,
      pinned: index === 0,
      lastOpenedAt:
        index === 79 ? "2026-09-17T12:00:00.000Z" : "2026-09-02T12:00:00.000Z",
    }));
    const html = renderToStaticMarkup(
      <RepositoryIntakeDialog
        projects={projects}
        busy={false}
        message="Choose a repository"
        onOpen={() => {}}
        onCreate={() => {}}
        onClone={() => {}}
        onPin={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html.match(/class="saved-project-card"/g)).toHaveLength(1);
    expect(html).toContain("Last opened");
    expect(html).toContain("Select Project");
    expect(html).toContain('value="project-79" selected=""');
    expect(html.match(/<option /g)).toHaveLength(80);
    expect(html).toContain("/projects/79");
    expect(html.indexOf("Last opened")).toBeLessThan(
      html.indexOf("Select Project"),
    );
  });
  it("presents recents plus local, create, and GitHub clone paths without admin chrome", () => {
    const html = renderToStaticMarkup(
      <RepositoryIntakeDialog
        projects={[
          {
            id: "project-notes",
            name: "Notes App",
            rootPath: "/projects/notes-app",
            source: "local",
            pinned: true,
            lastOpenedAt: "2026-09-02T12:00:00.000Z",
          },
        ]}
        busy={false}
        message="Choose a repository for this World."
        onOpen={() => undefined}
        onCreate={() => undefined}
        onClone={() => undefined}
        onPin={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("Repository Intake_");
    expect(html).toContain("Notes App");
    expect(html).toContain("Open project");
    expect(html).toContain("Saved project library");
    expect(html).toContain("/projects/notes-app");
    expect(html).toContain("Open local");
    expect(html).toContain("Create new");
    expect(html).toContain("Clone GitHub");
    expect(html).toContain("Close repository intake");
    expect(html).not.toMatch(/dashboard|diagnostics|connector/iu);
  });
});

it("offers real path discovery and a named project under an editable parent, not a fictional home", () => {
  const html = renderToStaticMarkup(
    <RepositoryIntakeDialog
      projects={[]}
      busy={false}
      message="Choose a repository"
      onOpen={() => {}}
      onCreate={() => {}}
      onClone={() => {}}
      onPin={() => {}}
      onClose={() => {}}
    />,
  );
  expect(html).toContain("Discover path");
  expect(html).toContain("Project parent folder");
  expect(html).toContain("Folder Name to Create");
  expect(html.match(/Friendly name \(optional\)/g)).toHaveLength(1);
  expect(html).not.toContain("/home/me/");
});

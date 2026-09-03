import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RepositoryIntakeDialog } from "../src/world-entry/RepositoryIntakeDialog.js";

describe("RepositoryIntakeDialog", () => {
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
    expect(html).toContain("Open recent");
    expect(html).toContain("Open local");
    expect(html).toContain("Create new");
    expect(html).toContain("Clone GitHub");
    expect(html).toContain("Close repository intake");
    expect(html).not.toMatch(/dashboard|diagnostics|connector/iu);
  });
});

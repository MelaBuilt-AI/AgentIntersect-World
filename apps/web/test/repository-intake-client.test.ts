import { describe, expect, it } from "vitest";

import {
  listRepositoryProjects,
  openRepositoryProject,
} from "../src/world-entry/repository-intake-client.js";

describe("repository intake client", () => {
  it("lists projects and opens the selected local path through the local API", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const project = {
      id: "project-notes",
      name: "Notes App",
      rootPath: "/projects/notes-app",
      source: "local" as const,
      pinned: false,
      lastOpenedAt: "2026-09-02T12:00:00.000Z",
    };
    const fetcher = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({ url: String(input), ...(init ? { init } : {}) });
      return new Response(
        JSON.stringify({
          ok: true,
          data: calls.length === 1 ? { projects: [project] } : { project },
        }),
        { status: calls.length === 1 ? 200 : 201 },
      );
    };

    expect(await listRepositoryProjects(fetcher as typeof fetch)).toEqual([
      project,
    ]);
    expect(
      await openRepositoryProject(
        { rootPath: project.rootPath, name: project.name },
        fetcher as typeof fetch,
      ),
    ).toEqual(project);
    expect(calls).toMatchObject([
      { url: "/api/repository-intake/projects" },
      {
        url: "/api/repository-intake/open",
        init: {
          method: "POST",
          body: JSON.stringify({
            rootPath: project.rootPath,
            name: project.name,
          }),
        },
      },
    ]);
  });
});

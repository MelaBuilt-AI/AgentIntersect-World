import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLocalServer } from "../src/server.js";
import { RepositoryIntakeService } from "../src/repository-intake.js";

const roots: string[] = [];
const servers: Array<ReturnType<typeof createLocalServer>> = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "aiw-repository-intake-"));
  roots.push(root);
  const repository = join(root, "notes-app");
  await mkdir(repository);
  await writeFile(join(repository, "index.ts"), "export const notes = true;\n");
  return {
    root,
    repository,
    config: {
      networkScope: "loopback" as const,
      host: "127.0.0.1",
      port: 3770,
      instanceName: "Repository Intake Test",
      demoOperationMaxMs: 500,
      repositoryMaxFiles: 2500,
      presentationSync: {
        dataDir: join(root, "state", "presentation"),
        allowedOrigin: "http://127.0.0.1:5173",
        allowedHost: "127.0.0.1:5173",
      },
    },
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("repository intake API", () => {
  it("keeps all saved projects across restart and reports missing folders without dropping them", async () => {
    const state = await fixture();
    const file = join(state.root, "library.json");
    const service = new RepositoryIntakeService(file);
    for (let i = 0; i < 52; i++) {
      const rootPath = join(state.root, `project-${i}`);
      await mkdir(rootPath);
      await service.openLocal({ rootPath });
    }
    await rm(join(state.root, "project-0"), { recursive: true });
    const saved = await new RepositoryIntakeService(file).list();
    expect(saved).toHaveLength(52);
    expect(saved.find((item) => item.name === "project-0")).toMatchObject({
      availability: "missing",
    });
    expect(saved.find((item) => item.name === "project-51")).toMatchObject({
      availability: "available",
    });
  });
  it("discovers the real configured home without writes and explicitly creates projects", async () => {
    const state = await fixture();
    const intake = new RepositoryIntakeService(
      join(state.root, "intake.json"),
      undefined,
      undefined,
      state.root,
    );
    const server = createLocalServer({
      config: state.config,
      repositoryIntakeService: intake,
    });
    servers.push(server);
    const discovered = await server.inject({
      method: "GET",
      url: "/repository-intake/discover-path",
    });
    expect(discovered.statusCode).toBe(200);
    expect(discovered.json().data).toEqual({
      homePath: state.root,
      projectsPath: join(state.root, "projects"),
      projectsExists: false,
    });
    await expect(readFile(join(state.root, "projects"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const created = await server.inject({
      method: "POST",
      url: "/repository-intake/projects-directory",
      payload: { confirm: true },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().data.projectsExists).toBe(true);
    const project = await server.inject({
      method: "POST",
      url: "/repository-intake/create",
      payload: {
        rootPath: join(state.root, "projects", "new-site"),
        name: "new-site",
      },
    });
    expect(project.statusCode).toBe(201);
    expect(
      await readFile(
        join(state.root, "projects", "new-site", ".git", "HEAD"),
        "utf8",
      ),
    ).toContain("refs/heads/");
  });
  it("opens a local repository and restores it from recent projects", async () => {
    const state = await fixture();
    let server = createLocalServer({ config: state.config });
    servers.push(server);

    const opened = await server.inject({
      method: "POST",
      url: "/repository-intake/open",
      payload: { rootPath: state.repository, name: "Notes App" },
    });

    expect(opened.statusCode).toBe(201);
    expect(opened.json().data.project).toMatchObject({
      name: "Notes App",
      rootPath: state.repository,
      source: "local",
      pinned: false,
    });

    const lastOpenedAt = opened.json().data.project.lastOpenedAt;
    expect(Number.isFinite(Date.parse(lastOpenedAt))).toBe(true);
    await server.close();
    servers.splice(servers.indexOf(server), 1);
    server = createLocalServer({ config: state.config });
    servers.push(server);

    const recent = await server.inject({
      method: "GET",
      url: "/repository-intake/projects",
    });
    expect(recent.statusCode).toBe(200);
    expect(recent.json().data.projects).toEqual([
      expect.objectContaining({
        name: "Notes App",
        rootPath: state.repository,
        source: "local",
        lastOpenedAt,
      }),
    ]);
  });

  it("creates a new Git repository without overwriting a non-empty destination", async () => {
    const state = await fixture();
    const server = createLocalServer({ config: state.config });
    servers.push(server);
    const destination = join(state.root, "new-project");

    const created = await server.inject({
      method: "POST",
      url: "/repository-intake/create",
      payload: { rootPath: destination, name: "New Project" },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().data.project).toMatchObject({
      name: "New Project",
      rootPath: destination,
      source: "created",
    });
    expect(await server.repositoryIntakeService.list()).toContainEqual(
      expect.objectContaining({ rootPath: destination }),
    );

    await writeFile(join(destination, "keep.txt"), "do not replace\n");
    const conflict = await server.inject({
      method: "POST",
      url: "/repository-intake/create",
      payload: { rootPath: destination, name: "Replacement" },
    });
    expect(conflict.statusCode).toBe(409);
    expect(await readFile(join(destination, "keep.txt"), "utf8")).toBe(
      "do not replace\n",
    );
  });

  it("clones a GitHub repository to an explicit destination and pins it", async () => {
    const state = await fixture();
    const gitCalls: string[][] = [];
    const intake = new RepositoryIntakeService(
      join(state.root, "intake.json"),
      () => new Date("2026-09-02T12:00:00.000Z"),
      async (arguments_) => {
        gitCalls.push([...arguments_]);
        await mkdir(arguments_.at(-1) as string, { recursive: true });
      },
    );
    const server = createLocalServer({
      config: state.config,
      repositoryIntakeService: intake,
    });
    servers.push(server);
    const destination = join(state.root, "cloned-project");

    const cloned = await server.inject({
      method: "POST",
      url: "/repository-intake/clone",
      payload: {
        repository: "MelaBuilt-AI/example-project",
        destination,
        name: "Example Project",
      },
    });

    expect(cloned.statusCode).toBe(201);
    expect(gitCalls).toEqual([
      [
        "clone",
        "--quiet",
        "--",
        "https://github.com/MelaBuilt-AI/example-project.git",
        destination,
      ],
    ]);
    expect(cloned.json().data.project).toMatchObject({
      name: "Example Project",
      source: "github",
      githubRepository: "MelaBuilt-AI/example-project",
      rootPath: destination,
    });

    const pinned = await server.inject({
      method: "POST",
      url: `/repository-intake/projects/${cloned.json().data.project.id}/pin`,
      payload: { pinned: true },
    });
    expect(pinned.statusCode).toBe(200);
    expect(pinned.json().data.project.pinned).toBe(true);
  });
});

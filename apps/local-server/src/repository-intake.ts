import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { homedir } from "node:os";

export type RepositoryProject = {
  readonly id: string;
  readonly name: string;
  readonly rootPath: string;
  readonly source: "local" | "created" | "github";
  readonly githubRepository?: string;
  readonly pinned: boolean;
  readonly lastOpenedAt: string;
};

type RepositoryIntakeStore = {
  readonly version: 1;
  readonly projects: readonly RepositoryProject[];
};

export class RepositoryIntakeError extends Error {
  constructor(
    readonly code: "validation" | "not-found" | "conflict" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "RepositoryIntakeError";
  }
}

function projectId(rootPath: string): string {
  return `project-${createHash("sha256").update(rootPath).digest("hex").slice(0, 24)}`;
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0)!;
    return code < 32 || code === 127;
  });
}

function githubRepository(input: string): {
  readonly slug: string;
  readonly url: string;
} {
  const slug = input
    .trim()
    .replace(/^https:\/\/github\.com\//iu, "")
    .replace(/\.git$/iu, "");
  if (!/^[A-Za-z0-9.-]+\/[A-Za-z0-9._-]+$/u.test(slug))
    throw new RepositoryIntakeError(
      "validation",
      "GitHub repository must be owner/repository or a GitHub HTTPS URL",
    );
  return { slug, url: `https://github.com/${slug}.git` };
}

export type RepositoryGitRunner = (
  arguments_: readonly string[],
) => Promise<void>;

const runGit: RepositoryGitRunner = async (arguments_) => {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("git", arguments_, {
      shell: false,
      stdio: ["ignore", "ignore", "ignore"],
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`git exited ${String(code)}`)),
    );
  });
};

export class RepositoryIntakeService {
  readonly #storePath: string;
  readonly #now: () => Date;
  readonly #runGit: RepositoryGitRunner;
  #projects: RepositoryProject[] | null = null;
  #mutation: Promise<void> = Promise.resolve();

  constructor(
    storePath: string,
    now: () => Date = () => new Date(),
    git: RepositoryGitRunner = runGit,
    readonly homePath: string = homedir(),
  ) {
    this.#storePath = storePath;
    this.#now = now;
    this.#runGit = git;
  }

  async discoverPath() {
    const homePath = await this.#existingDirectory(this.homePath);
    const projectsPath = resolve(homePath, "projects");
    let projectsExists = false;
    try {
      projectsExists = (await stat(projectsPath)).isDirectory();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new RepositoryIntakeError(
          "unavailable",
          "Projects folder is unavailable",
        );
    }
    return { homePath, projectsPath, projectsExists };
  }

  async createProjectsDirectory() {
    const paths = await this.discoverPath();
    try {
      await mkdir(paths.projectsPath, { recursive: true });
    } catch {
      throw new RepositoryIntakeError(
        "unavailable",
        "Could not create the projects folder",
      );
    }
    return this.discoverPath();
  }

  async list(): Promise<readonly RepositoryProject[]> {
    await this.#load();
    return structuredClone(
      [...this.#projects!].sort(
        (left, right) =>
          Number(right.pinned) - Number(left.pinned) ||
          right.lastOpenedAt.localeCompare(left.lastOpenedAt) ||
          left.name.localeCompare(right.name),
      ),
    );
  }

  async openLocal(input: {
    readonly rootPath: string;
    readonly name?: string;
  }): Promise<RepositoryProject> {
    return await this.#serialize(async () =>
      this.#remember(
        await this.#existingDirectory(input.rootPath),
        input.name,
        "local",
      ),
    );
  }

  async create(input: {
    readonly rootPath: string;
    readonly name: string;
  }): Promise<RepositoryProject> {
    return await this.#serialize(async () => {
      const requested = this.#requestedPath(input.rootPath);
      let created = false;
      try {
        const existing = await stat(requested);
        if (!existing.isDirectory() || (await readdir(requested)).length > 0)
          throw new RepositoryIntakeError(
            "conflict",
            "Create destination must be an empty directory",
          );
      } catch (error) {
        if (error instanceof RepositoryIntakeError) throw error;
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
          throw new RepositoryIntakeError(
            "unavailable",
            "Create destination is unavailable",
          );
        await mkdir(requested, { recursive: true });
        created = true;
      }
      try {
        await this.#runGit(["init", "--quiet", "--", requested]);
        return await this.#remember(
          await realpath(requested),
          input.name,
          "created",
        );
      } catch (error) {
        if (created) await rm(requested, { recursive: true, force: true });
        if (error instanceof RepositoryIntakeError) throw error;
        throw new RepositoryIntakeError(
          "unavailable",
          "Git could not initialize the repository",
        );
      }
    });
  }

  async cloneGitHub(input: {
    readonly repository: string;
    readonly destination: string;
    readonly name?: string;
  }): Promise<RepositoryProject> {
    return await this.#serialize(async () => {
      const github = githubRepository(input.repository);
      const destination = this.#requestedPath(input.destination);
      let restoreEmptyDirectory = false;
      try {
        const existing = await stat(destination);
        if (!existing.isDirectory() || (await readdir(destination)).length > 0)
          throw new RepositoryIntakeError(
            "conflict",
            "Clone destination must not contain files",
          );
        restoreEmptyDirectory = true;
        await rm(destination, { recursive: true });
      } catch (error) {
        if (error instanceof RepositoryIntakeError) throw error;
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
          throw new RepositoryIntakeError(
            "unavailable",
            "Clone destination is unavailable",
          );
      }
      await mkdir(dirname(destination), { recursive: true });
      try {
        await this.#runGit(["clone", "--quiet", "--", github.url, destination]);
        return await this.#remember(
          await realpath(destination),
          input.name,
          "github",
          github.slug,
        );
      } catch (error) {
        await rm(destination, { recursive: true, force: true });
        if (restoreEmptyDirectory)
          await mkdir(destination, { recursive: true });
        if (error instanceof RepositoryIntakeError) throw error;
        throw new RepositoryIntakeError(
          "unavailable",
          "GitHub repository could not be cloned",
        );
      }
    });
  }

  async pin(id: string, pinned: boolean): Promise<RepositoryProject> {
    return await this.#serialize(async () => {
      const index = this.#projects!.findIndex((project) => project.id === id);
      if (index === -1)
        throw new RepositoryIntakeError(
          "not-found",
          "Saved project was not found",
        );
      const project = { ...this.#projects![index]!, pinned };
      this.#projects![index] = project;
      await this.#save();
      return structuredClone(project);
    });
  }

  async #load(): Promise<void> {
    if (this.#projects !== null) return;
    try {
      const parsed = JSON.parse(
        await readFile(this.#storePath, "utf8"),
      ) as Partial<RepositoryIntakeStore>;
      this.#projects =
        parsed.version === 1 && Array.isArray(parsed.projects)
          ? (parsed.projects as RepositoryProject[])
          : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new RepositoryIntakeError(
          "unavailable",
          "Saved repository projects are unavailable",
        );
      this.#projects = [];
    }
  }

  async #save(): Promise<void> {
    await mkdir(dirname(this.#storePath), { recursive: true });
    const temporary = `${this.#storePath}.tmp`;
    await writeFile(
      temporary,
      `${JSON.stringify({ version: 1, projects: this.#projects }, null, 2)}\n`,
      "utf8",
    );
    await rename(temporary, this.#storePath);
  }

  async #remember(
    rootPath: string,
    requestedName: string | undefined,
    source: RepositoryProject["source"],
    githubRepository?: string,
  ): Promise<RepositoryProject> {
    const existing = this.#projects!.find(
      (project) => project.rootPath === rootPath,
    );
    const github = githubRepository ?? existing?.githubRepository;
    const project: RepositoryProject = {
      id: projectId(rootPath),
      name: this.#name(requestedName ?? existing?.name ?? basename(rootPath)),
      rootPath,
      source: existing?.source ?? source,
      ...(github ? { githubRepository: github } : {}),
      pinned: existing?.pinned ?? false,
      lastOpenedAt: this.#now().toISOString(),
    };
    this.#projects = [
      project,
      ...this.#projects!.filter((candidate) => candidate.id !== project.id),
    ].slice(0, 50);
    await this.#save();
    return structuredClone(project);
  }

  #requestedPath(input: string): string {
    const requested = input.trim();
    if (
      !requested ||
      requested.length > 4096 ||
      hasControlCharacters(requested)
    )
      throw new RepositoryIntakeError(
        "validation",
        "Repository path is invalid",
      );
    return resolve(requested);
  }

  async #existingDirectory(input: string): Promise<string> {
    const requested = this.#requestedPath(input);
    try {
      const rootPath = await realpath(requested);
      if (!(await stat(rootPath)).isDirectory())
        throw new RepositoryIntakeError(
          "validation",
          "Repository path must be a directory",
        );
      return rootPath;
    } catch (error) {
      if (error instanceof RepositoryIntakeError) throw error;
      throw new RepositoryIntakeError(
        "not-found",
        "Repository directory was not found",
      );
    }
  }

  #name(input: string): string {
    const name = input.trim();
    if (!name || name.length > 120 || hasControlCharacters(name))
      throw new RepositoryIntakeError("validation", "Project name is invalid");
    return name;
  }

  async #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#mutation;
    let release!: () => void;
    this.#mutation = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    await previous;
    try {
      await this.#load();
      return await operation();
    } finally {
      release();
    }
  }
}

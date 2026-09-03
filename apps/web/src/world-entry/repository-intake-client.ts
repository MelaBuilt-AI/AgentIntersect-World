import type { RepositoryProject } from "./RepositoryIntakeDialog.js";

type RepositoryIntakeEnvelope = {
  readonly ok: boolean;
  readonly data?: {
    readonly project?: RepositoryProject;
    readonly projects?: readonly RepositoryProject[];
  };
  readonly error?: { readonly message?: string };
};

async function result(response: Response): Promise<RepositoryIntakeEnvelope> {
  const payload = (await response.json()) as RepositoryIntakeEnvelope;
  if (!response.ok || !payload.ok)
    throw new Error(payload.error?.message ?? "Repository intake unavailable");
  return payload;
}

async function post(
  path: string,
  body: Readonly<Record<string, unknown>>,
  fetcher: typeof fetch,
): Promise<RepositoryProject> {
  const payload = await result(
    await fetcher(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  if (!payload.data?.project)
    throw new Error("Repository intake response was incomplete");
  return payload.data.project;
}

export async function listRepositoryProjects(
  fetcher: typeof fetch = fetch,
): Promise<readonly RepositoryProject[]> {
  const payload = await result(
    await fetcher("/api/repository-intake/projects"),
  );
  return payload.data?.projects ?? [];
}

export async function openRepositoryProject(
  input: { readonly rootPath: string; readonly name?: string },
  fetcher: typeof fetch = fetch,
): Promise<RepositoryProject> {
  return await post("/api/repository-intake/open", input, fetcher);
}

export async function createRepositoryProject(
  input: { readonly rootPath: string; readonly name: string },
  fetcher: typeof fetch = fetch,
): Promise<RepositoryProject> {
  return await post("/api/repository-intake/create", input, fetcher);
}

export async function cloneRepositoryProject(
  input: {
    readonly repository: string;
    readonly destination: string;
    readonly name?: string;
  },
  fetcher: typeof fetch = fetch,
): Promise<RepositoryProject> {
  return await post("/api/repository-intake/clone", input, fetcher);
}

export async function pinRepositoryProject(
  projectId: string,
  pinned: boolean,
  fetcher: typeof fetch = fetch,
): Promise<RepositoryProject> {
  return await post(
    `/api/repository-intake/projects/${encodeURIComponent(projectId)}/pin`,
    { pinned },
    fetcher,
  );
}

import type { RepositoryProject } from "./RepositoryIntakeDialog.js";

export type GitStatus = {
  head: string | null;
  branch: string;
  upstream: string | null;
  remotes: string[];
  changes: { path: string; status: string; originalPath?: string }[];
  commits: { sha: string; subject: string; date: string }[];
};
export type PullRequest = {
  number: number;
  url: string;
  title: string;
  state: string;
  isDraft: boolean;
  headRefName: string;
  headRefOid: string;
  baseRefName: string;
  statusCheckRollup:
    | {
        name?: string;
        context?: string;
        status?: string;
        conclusion?: string;
        state?: string;
      }[]
    | null;
};
export type GitAction = {
  action: "checkpoint" | "commit" | "fetch" | "pull" | "push" | "create-pr";
  message?: string;
  files?: string[];
  remote?: string;
  base?: string;
  title?: string;
  body?: string;
  draft?: boolean;
};
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(
    url,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = (await response.json()) as {
    ok: boolean;
    data: T;
    error?: { message?: string };
  };
  if (!response.ok || !result.ok)
    throw new Error(result.error?.message ?? "Workbench request unavailable");
  return result.data;
}
const root = (id: string) =>
  `/api/repository-intake/projects/${encodeURIComponent(id)}`;
const query = (workstreamId: string) =>
  workstreamId ? `?workstreamId=${encodeURIComponent(workstreamId)}` : "";
export const selectedRepositoryProject = (repositoryId: string) =>
  request<{ project: RepositoryProject | null }>(
    `/api/repository-intake/selected?repositoryId=${encodeURIComponent(repositoryId)}`,
  );
export const repositoryGitStatus = (projectId: string, workstreamId = "") =>
  request<GitStatus>(`${root(projectId)}/git${query(workstreamId)}`);
export const repositoryGitAction = (
  projectId: string,
  workstreamId: string,
  status: GitStatus,
  action: GitAction,
) =>
  request<{ message: string; status: GitStatus; pr?: PullRequest }>(
    `${root(projectId)}/git`,
    {
      ...action,
      confirm: true,
      expectedHead: status.head,
      expectedBranch: status.branch,
      ...(workstreamId ? { workstreamId } : {}),
    },
  );
export const repositoryGithubStatus = (
  projectId: string,
  workstreamId: string,
  remote: string,
) =>
  request<{ repository: string; branch: string; prs: PullRequest[] }>(
    `${root(projectId)}/github?${new URLSearchParams({ remote, ...(workstreamId ? { workstreamId } : {}) })}`,
  );

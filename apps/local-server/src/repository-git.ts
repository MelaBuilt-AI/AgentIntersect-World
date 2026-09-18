import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { devNull } from "node:os";
import { z } from "zod";
import {
  RepositoryIntakeError,
  type ProjectMilestone,
} from "./repository-intake.js";

const execute = promisify(execFile);
export async function workspaceCommand(
  cwd: string,
  executable: string,
  args: readonly string[],
): Promise<string> {
  try {
    const { stdout } = await execute(executable, [...args], {
      cwd,
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "never",
        GH_PROMPT_DISABLED: "1",
        LC_ALL: "C",
      },
    });
    return stdout;
  } catch (error) {
    const failure = error as { stderr?: string; code?: string };
    const message =
      failure.code === "ENOENT"
        ? `${executable} is not installed on this machine`
        : failure.stderr?.trim() || `${executable} failed or timed out`;
    throw new RepositoryIntakeError(
      "unavailable",
      message
        .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/g, "https://[redacted]@")
        .slice(0, 768),
    );
  }
}
const prFields =
  "number,url,state,isDraft,headRefName,headRefOid,baseRefName,title,statusCheckRollup";
const PullRequest = z.object({
  number: z.number().int().positive(),
  url: z
    .string()
    .url()
    .refine((url) => url.startsWith("https://github.com/")),
  state: z.enum(["OPEN", "CLOSED", "MERGED"]),
  isDraft: z.boolean(),
  headRefName: z.string(),
  headRefOid: z.string(),
  baseRefName: z.string(),
  title: z.string(),
  statusCheckRollup: z
    .array(
      z.object({
        name: z.string().optional(),
        context: z.string().optional(),
        status: z.string().optional(),
        conclusion: z.string().optional(),
        state: z.string().optional(),
      }),
    )
    .nullable(),
});
type PullRequest = z.infer<typeof PullRequest>;
const Mutation = z.strictObject({
  action: z.enum([
    "commit",
    "checkpoint",
    "fetch",
    "pull",
    "push",
    "create-pr",
  ]),
  confirm: z.literal(true),
  expectedHead: z
    .string()
    .regex(/^[a-f0-9]{40,64}$/)
    .nullable(),
  expectedBranch: z.string().max(256),
  workstreamId: z.string().min(1).max(128).optional(),
  message: z.string().trim().min(1).max(2000).optional(),
  files: z.array(z.string().min(1).max(4096)).min(1).max(256).optional(),
  remote: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
    .max(128)
    .optional(),
  base: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
    .max(128)
    .optional(),
  title: z.string().trim().min(1).max(256).optional(),
  body: z.string().max(8000).optional(),
  draft: z.boolean().optional(),
});
export class RepositoryGitService {
  #tail: Promise<unknown> = Promise.resolve();
  constructor(
    readonly directory: (
      projectId: string,
      workstreamId?: string,
    ) => Promise<string>,
    readonly run: typeof workspaceCommand = workspaceCommand,
    readonly recordMilestone: (
      projectId: string,
      milestone: ProjectMilestone,
    ) => Promise<void> = async () => {},
  ) {}
  readonly git = (cwd: string, args: readonly string[]) =>
    this.run(cwd, "git", [
      "-c",
      `core.hooksPath=${devNull}`,
      "-c",
      "core.fsmonitor=false",
      "-c",
      "protocol.ext.allow=never",
      ...args,
    ]);
  async status(projectId: string, workstreamId?: string) {
    return this.readStatus(await this.directory(projectId, workstreamId));
  }
  async readStatus(cwd: string) {
    const git = this.git;
    await git(cwd, ["rev-parse", "--show-toplevel"]);
    const branch = (
      await git(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch(
        () => "",
      )
    ).trim();
    const head =
      (
        await git(cwd, ["rev-parse", "--verify", "HEAD"]).catch(() => "")
      ).trim() || null;
    const porcelain = await git(cwd, [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ]);
    const entries = porcelain.split("\0").filter(Boolean);
    const changes: { path: string; status: string; originalPath?: string }[] =
      [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const status = entry.slice(0, 2);
      const path = entry.slice(3);
      const originalPath = /[RC]/.test(status) ? entries[++i] : undefined;
      changes.push({ path, status, ...(originalPath ? { originalPath } : {}) });
    }
    const commits = head
      ? (await git(cwd, ["log", "-30", "--format=%H%x00%s%x00%aI"]))
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [sha, subject, date] = line.split("\0");
            return { sha: sha!, subject: subject!, date: date! };
          })
      : [];
    const remotes = (await git(cwd, ["remote"]))
      .trim()
      .split("\n")
      .filter(Boolean);
    const upstream =
      (
        await git(cwd, ["rev-parse", "--abbrev-ref", "@{upstream}"]).catch(
          () => "",
        )
      ).trim() || null;
    return { head, branch, changes, commits, remotes, upstream };
  }
  async github(projectId: string, remote: string, workstreamId?: string) {
    const cwd = await this.directory(projectId, workstreamId);
    const status = await this.readStatus(cwd);
    if (!status.remotes.includes(remote))
      throw new RepositoryIntakeError(
        "validation",
        "Choose a configured GitHub remote",
      );
    const slug = await this.#githubRepository(cwd, remote);
    const prs = z
      .array(PullRequest)
      .parse(
        JSON.parse(
          await this.run(cwd, "gh", [
            "pr",
            "list",
            "--repo",
            slug,
            "--head",
            status.branch,
            "--state",
            "all",
            "--limit",
            "20",
            "--json",
            prFields,
          ]),
        ),
      );
    return { repository: slug, branch: status.branch, prs };
  }
  async #githubRepository(cwd: string, remote: string): Promise<string> {
    const url = (await this.git(cwd, ["remote", "get-url", remote])).trim();
    const match =
      /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+?)(?:\.git)?$/.exec(
        url,
      );
    if (!match)
      throw new RepositoryIntakeError(
        "unavailable",
        "This remote is not a supported GitHub URL. Local Git actions remain available.",
      );
    return match[1]!;
  }
  async mutate(
    projectId: string,
    input: unknown,
  ): Promise<{
    message: string;
    status: Awaited<ReturnType<RepositoryGitService["readStatus"]>>;
    pr?: PullRequest;
  }> {
    const git = this.git;
    const parsed = Mutation.safeParse(input);
    if (!parsed.success)
      throw new RepositoryIntakeError(
        "validation",
        parsed.error.issues[0]?.message ?? "Invalid Git action",
      );
    const action = parsed.data;
    const operation = this.#tail.then(async () => {
      const cwd = await this.directory(projectId, action.workstreamId);
      const before = await this.readStatus(cwd);
      if (
        before.head !== action.expectedHead ||
        before.branch !== action.expectedBranch
      )
        throw new RepositoryIntakeError(
          "conflict",
          "HEAD or branch changed. Refresh Workbench and review again.",
        );
      if (!before.branch)
        throw new RepositoryIntakeError(
          "conflict",
          "Detached HEAD: start a new Workstream branch first",
        );
      if (action.action === "create-pr") {
        const remote = action.remote;
        if (
          !remote ||
          !before.remotes.includes(remote) ||
          !action.base ||
          !action.title ||
          action.body === undefined ||
          action.draft === undefined
        )
          throw new RepositoryIntakeError(
            "validation",
            "Select a remote, base, title, description and draft state",
          );
        if (!before.head || before.changes.length)
          throw new RepositoryIntakeError(
            "conflict",
            "Commit reviewed changes before creating a PR",
          );
        if (action.base === before.branch)
          throw new RepositoryIntakeError(
            "conflict",
            "A PR needs a separate feature branch",
          );
        const slug = await this.#githubRepository(cwd, remote);
        const remoteHead = (
          await git(cwd, [
            "ls-remote",
            "--heads",
            remote,
            `refs/heads/${before.branch}`,
          ])
        )
          .trim()
          .split(/\s/)[0];
        if (remoteHead !== before.head)
          throw new RepositoryIntakeError(
            "conflict",
            "Push this exact branch and commit first. PR creation never pushes automatically.",
          );
        const existing = z
          .array(PullRequest)
          .parse(
            JSON.parse(
              await this.run(cwd, "gh", [
                "pr",
                "list",
                "--repo",
                slug,
                "--head",
                before.branch,
                "--base",
                action.base,
                "--state",
                "open",
                "--json",
                prFields,
              ]),
            ),
          );
        if (existing.length)
          return {
            message:
              "An open PR already exists for this branch and base; no duplicate created.",
            status: before,
            pr: existing[0]!,
          };
        const url = (
          await this.run(cwd, "gh", [
            "pr",
            "create",
            "--repo",
            slug,
            "--head",
            before.branch,
            "--base",
            action.base,
            "--title",
            action.title,
            "--body",
            action.body,
            "--no-maintainer-edit",
            ...(action.draft ? ["--draft"] : []),
          ])
        ).trim();
        if (!url.startsWith(`https://github.com/${slug}/pull/`))
          throw new RepositoryIntakeError(
            "unavailable",
            "PR creation returned an unexpected result. Check GitHub status before retrying.",
          );
        const pr = PullRequest.parse(
          JSON.parse(
            await this.run(cwd, "gh", [
              "pr",
              "view",
              url,
              "--repo",
              slug,
              "--json",
              prFields,
            ]),
          ),
        );
        if (
          pr.headRefOid !== before.head ||
          pr.headRefName !== before.branch ||
          pr.baseRefName !== action.base ||
          pr.isDraft !== action.draft
        )
          throw new RepositoryIntakeError(
            "unavailable",
            "PR was created but its exact branch/commit/draft state could not be verified. Check GitHub before retrying.",
          );
        return {
          message: `Verified ${pr.isDraft ? "draft " : ""}PR #${pr.number}. No merge performed.`,
          status: await this.readStatus(cwd),
          pr,
        };
      }
      if (action.action === "checkpoint") {
        if (before.head)
          throw new RepositoryIntakeError(
            "conflict",
            "This repository already has an initial commit",
          );
        if (
          before.changes.some(
            (file) => file.status[0] !== " " && file.status[0] !== "?",
          )
        )
          throw new RepositoryIntakeError(
            "conflict",
            "Review staged files and commit them explicitly first",
          );
        await git(cwd, [
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--allow-empty",
          "-m",
          "chore: initialize project",
        ]);
        const status = await this.readStatus(cwd);
        if (!status.head)
          throw new RepositoryIntakeError(
            "unavailable",
            "Initial checkpoint could not be verified",
          );
        await this.recordMilestone(projectId, {
          id: `git-${status.head}`,
          kind: "checkpoint",
          head: status.head,
          label: "Initial project checkpoint",
          occurredAt: new Date().toISOString(),
          ...(action.workstreamId ? { workstreamId: action.workstreamId } : {}),
        });
        return {
          message: `Initial checkpoint ${status.head}. No source files added and no push performed.`,
          status,
        };
      }
      if (["fetch", "pull", "push"].includes(action.action)) {
        const remote = action.remote;
        if (!remote || !before.remotes.includes(remote))
          throw new RepositoryIntakeError(
            "validation",
            "Choose a configured remote",
          );
        if (!before.head)
          throw new RepositoryIntakeError(
            "conflict",
            "Create an initial checkpoint first",
          );
        let message: string;
        if (action.action === "push") {
          await git(cwd, [
            "push",
            "--no-follow-tags",
            "--recurse-submodules=no",
            "--set-upstream",
            "--",
            remote,
            `${before.head}:refs/heads/${before.branch}`,
          ]);
          const remoteHead = (
            await git(cwd, [
              "ls-remote",
              "--heads",
              remote,
              `refs/heads/${before.branch}`,
            ])
          )
            .trim()
            .split(/\s/)[0];
          if (remoteHead !== before.head)
            throw new RepositoryIntakeError(
              "unavailable",
              "Push returned but the remote branch could not be verified. Refresh before retrying.",
            );
          message = `Verified ${remote}/${before.branch} at ${before.head}. No force push, tags or PR creation.`;
        } else {
          if (action.action === "pull" && before.changes.length)
            throw new RepositoryIntakeError(
              "conflict",
              "Commit or preserve local changes before pulling. No automatic stash or reset.",
            );
          await git(cwd, [
            "fetch",
            "--no-tags",
            "--recurse-submodules=no",
            "--",
            remote,
            `refs/heads/${before.branch}`,
          ]);
          if (action.action === "pull") {
            const fetched = (
              await git(cwd, ["rev-parse", "FETCH_HEAD"])
            ).trim();
            await git(cwd, ["merge", "--ff-only", "--no-edit", fetched]);
            message = `Fast-forward pull completed from ${remote}/${before.branch}.`;
          } else
            message = `Fetched ${remote}/${before.branch}; working files and HEAD unchanged.`;
        }
        return { message, status: await this.readStatus(cwd) };
      }
      if (!action.message || !action.files?.length)
        throw new RepositoryIntakeError(
          "validation",
          "Choose files and enter a commit message",
        );
      const changed = new Set(
        before.changes.flatMap((file) => [
          file.path,
          ...(file.originalPath ? [file.originalPath] : []),
        ]),
      );
      if (action.files.some((path) => !changed.has(path)))
        throw new RepositoryIntakeError(
          "validation",
          "Select only files shown in the current change list",
        );
      const selected = [
        ...new Set(
          action.files.flatMap((path) => {
            const file = before.changes.find((file) => file.path === path);
            return file?.originalPath ? [path, file.originalPath] : [path];
          }),
        ),
      ];
      await git(cwd, ["--literal-pathspecs", "add", "--", ...selected]);
      await git(cwd, [
        "--literal-pathspecs",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--only",
        "-m",
        action.message,
        "--",
        ...selected,
      ]);
      const status = await this.readStatus(cwd);
      if (!status.head || status.head === before.head)
        throw new RepositoryIntakeError(
          "unavailable",
          "Commit could not be verified",
        );
      await this.recordMilestone(projectId, {
        id: `git-${status.head}`,
        kind: "commit",
        head: status.head,
        label: action.message,
        occurredAt: new Date().toISOString(),
        ...(action.workstreamId ? { workstreamId: action.workstreamId } : {}),
      });
      return {
        message: `Committed ${status.head}. No push performed.`,
        status,
      };
    });
    this.#tail = operation.catch(() => undefined);
    return operation;
  }
}

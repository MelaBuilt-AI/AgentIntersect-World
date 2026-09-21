import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GitStatus } from "../src/world-entry/repository-workbench-client.js";

const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void)[],
  deps: [] as unknown[][],
  cleanups: [] as ((() => void) | void)[],
  effectCursor: 0,
  status: vi.fn(),
  github: vi.fn(),
  action: vi.fn(),
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] =
          typeof value === "function" ? value(hooks.values[index]) : value;
      },
    ];
  },
  useEffect: (effect: () => (() => void) | void, deps: unknown[]) => {
    const index = hooks.effectCursor++;
    if (
      !hooks.deps[index] ||
      deps.some((v, i) => v !== hooks.deps[index]![i])
    ) {
      hooks.deps[index] = deps;
      hooks.effects.push(() => {
        hooks.cleanups[index]?.();
        hooks.cleanups[index] = effect();
      });
    }
  },
}));
vi.mock("../src/world-entry/repository-workbench-client.js", () => ({
  repositoryGitStatus: hooks.status,
  repositoryGithubStatus: hooks.github,
  repositoryGitAction: hooks.action,
}));
import { RepositoryGitPanel } from "../src/world-entry/RepositoryGitPanel.js";

const status: GitStatus = {
  head: "a".repeat(40),
  branch: "feature",
  upstream: "origin/feature",
  changes: [],
  commits: [],
  remotes: ["origin"],
};
const pr = {
  number: 1,
  title: "Feature",
  url: "https://github.com/example/repo/pull/1",
  state: "OPEN",
  isDraft: true,
  headRefName: "feature",
  baseRefName: "main",
  headRefOid: status.head,
  statusCheckRollup: [{ name: "test", conclusion: "SUCCESS" }],
};
let tree: ReactElement;
function render(projectId = "project") {
  hooks.cursor = hooks.effectCursor = 0;
  tree = RepositoryGitPanel({
    projectId,
    workstreamId: "work",
    onNew: () => {},
  });
  return renderToStaticMarkup(tree);
}
type Element = ReactElement<{
  children?: unknown;
  disabled?: boolean;
  onClick?: () => unknown;
}>;
function elements(
  node: unknown,
  disabled = false,
): { element: Element; disabled: boolean }[] {
  if (Array.isArray(node))
    return node.flatMap((child) => elements(child, disabled));
  if (!isValidElement(node)) return [];
  const element = node as Element;
  const blocked = disabled || Boolean(element.props.disabled);
  return [
    { element, disabled: blocked },
    ...elements(element.props.children, blocked),
  ];
}
function button(label: string) {
  const found = elements(tree).find(
    ({ element }) =>
      element.type === "button" &&
      renderToStaticMarkup(element).replace(/<[^>]*>/g, "") === label,
  );
  expect(found, label).toBeDefined();
  return found!;
}
async function click(label: string) {
  const found = button(label);
  expect(found.disabled, label).toBe(false);
  await found.element.props.onClick?.();
  return render();
}
async function settle() {
  hooks.effects.splice(0).forEach((effect) => effect());
  await Promise.resolve();
  await Promise.resolve();
  return render();
}
beforeEach(() => {
  hooks.cleanups.forEach((cleanup) => cleanup?.());
  hooks.values = [];
  hooks.effects = [];
  hooks.deps = [];
  hooks.cleanups = [];
  hooks.status.mockReset().mockResolvedValue(status);
  hooks.github.mockReset().mockResolvedValue({ prs: [pr] });
  hooks.action.mockReset();
});

it("marks failed Git refresh stale, blocks mutations while loading/failed, and recovers on retry", async () => {
  render();
  await settle();
  await click("Sync");
  expect(button("Review push").disabled).toBe(false);
  hooks.status.mockRejectedValueOnce(new Error("Worktree unavailable"));
  let html = await click("Refresh Git");
  expect(html).toContain("Refreshing Git");
  expect(button("Review push").disabled).toBe(true);
  html = await settle();
  expect(html).toContain("Git status is stale");
  expect(html).toContain("Worktree unavailable");
  expect(button("Review push").disabled).toBe(true);
  expect(hooks.action).not.toHaveBeenCalled();
  await click("Refresh Git");
  html = await settle();
  expect(html).not.toContain("stale");
  expect(html).not.toContain("Worktree unavailable");
  expect(button("Review push").disabled).toBe(false);
});

it("does not expose another project's cached Git status while its initial request is pending", async () => {
  render();
  await settle();
  const html = render("other-project");
  expect(html).toContain("Reading repository");
  expect(html).not.toContain("origin/feature");
});

it("labels retained GitHub checks stale after failure and clears the error on retry", async () => {
  render();
  await settle();
  await click("GitHub / PR");
  let html = await click("Check GitHub status");
  expect(html).toContain("SUCCESS");
  hooks.github.mockRejectedValueOnce(new Error("GitHub offline"));
  html = await click("Check GitHub status");
  expect(html).toContain("GitHub results are stale");
  expect(html).toContain("GitHub offline");
  expect(html).toContain("SUCCESS");
  hooks.github.mockResolvedValue({ prs: [{ ...pr, state: "CLOSED" }] });
  html = await click("Check GitHub status");
  expect(html).toContain("CLOSED");
  expect(html).not.toContain("stale");
  expect(html).not.toContain("GitHub offline");
});

it("invalidates old GitHub checks when refreshing Git even if the local HEAD is unchanged", async () => {
  render();
  await settle();
  await click("GitHub / PR");
  await click("Check GitHub status");
  await click("Refresh Git");
  const html = await settle();
  expect(html).not.toContain("SUCCESS");
  expect(html).toContain("GitHub status not checked");
});

it("shows a pending GitHub check without presenting retained results as current", async () => {
  render();
  await settle();
  await click("GitHub / PR");
  await click("Check GitHub status");
  let resolve!: (value: { prs: (typeof pr)[] }) => void;
  hooks.github.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const html = await click("Check GitHub status");
  expect(html).toContain("Checking GitHub… Previous results are not current.");
  expect(button("Check GitHub status").disabled).toBe(true);
  expect(html).toContain("SUCCESS");
  resolve({ prs: [] });
  await Promise.resolve();
  expect(render()).toContain("No PRs found for this branch.");
  expect(button("Check GitHub status").disabled).toBe(false);
});

it("distinguishes an unavailable first GitHub check from a successful empty result", async () => {
  render();
  await settle();
  await click("GitHub / PR");
  hooks.github.mockRejectedValueOnce(new Error("GitHub unavailable"));
  const html = await click("Check GitHub status");
  expect(html).toContain("GitHub status unavailable.");
  expect(html).not.toContain("No PRs found");
  expect(html).not.toContain("GitHub results are stale");
});

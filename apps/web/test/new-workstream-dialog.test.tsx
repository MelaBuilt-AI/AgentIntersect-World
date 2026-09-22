import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GitStatus } from "../src/world-entry/repository-workbench-client.js";

const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void)[],
  deps: [] as unknown[][],
  cleanups: [] as ((() => void) | void)[],
  effectCursor: 0,
  selected: vi.fn(),
  status: vi.fn(),
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
  selectedRepositoryProject: hooks.selected,
  repositoryGitStatus: hooks.status,
}));
import { NewWorkstreamDialog } from "../src/world-entry/NewWorkstreamDialog.js";

const clean: GitStatus = {
  head: "a".repeat(40),
  branch: "source-feature",
  changes: [],
  commits: [],
  remotes: [],
  upstream: null,
};
const dirty: GitStatus = {
  ...clean,
  changes: [{ path: "index.html", status: "??" }],
};
const start = vi.fn();
let source = {
  workstreamId: "claude-work",
  revision: 4,
  title: "Claude homepage",
};
type Element = ReactElement<{
  children?: unknown;
  disabled?: boolean;
  type?: string;
  "aria-label"?: string;
  onClick?: () => void;
  onChange?: (event: { target: { value?: string; checked?: boolean } }) => void;
  onSubmit?: (event: { preventDefault: () => void }) => void;
}>;
let tree: ReactElement;
function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const e = node as Element;
  return [e, ...elements(e.props.children)];
}
function render() {
  hooks.cursor = hooks.effectCursor = 0;
  tree = NewWorkstreamDialog({
    repositoryId: "repo",
    agentName: "Beans",
    startPoint: "HEAD",
    sourceWorkstream: source,
    onStart: start,
    onClose: () => {},
    onWorkbench: () => {},
  });
  return renderToStaticMarkup(tree);
}
function input(label: string) {
  const wrapper = elements(tree).find(
    (e) => e.type === "label" && renderToStaticMarkup(e).includes(label),
  );
  expect(wrapper, label).toBeDefined();
  return elements(wrapper).find((e) => e.type === "input")!;
}
function button(label: string) {
  const result = elements(tree).find(
    (e) => e.type === "button" && renderToStaticMarkup(e).includes(label),
  );
  expect(result, label).toBeDefined();
  return result!;
}
async function settle() {
  hooks.effects.splice(0).forEach((effect) => effect());
  await new Promise((resolve) => setTimeout(resolve, 0));
  return render();
}
async function load() {
  render();
  return settle();
}
function prepare(mode: string) {
  elements(tree).find((e) => e.type === "textarea")!.props.onChange!({
    target: { value: "Update visible homepage heading" },
  });
  input(mode).props.onChange!({ target: {} });
  input("Create this isolated worktree").props.onChange!({
    target: { checked: true },
  });
  render();
}
function capture(name: string, html: string) {
  const dir = process.env.AIW_COMPONENT_EVIDENCE_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${name}.html`),
    `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/repository-workbench.css"><style>body{margin:0;background:#101827;color:#e8f1ff;font-family:Consolas,monospace;padding:24px;box-sizing:border-box}section.repository-workbench{margin:auto;max-height:calc(100vh - 48px)}</style>${html}`,
  );
}
beforeEach(() => {
  hooks.cleanups.forEach((cleanup) => cleanup?.());
  hooks.values = [];
  hooks.deps = [];
  hooks.effects = [];
  hooks.cleanups = [];
  source = {
    workstreamId: "claude-work",
    revision: 4,
    title: "Claude homepage",
  };
  start.mockReset().mockResolvedValue(undefined);
  hooks.selected.mockReset().mockResolvedValue({ project: { id: "project" } });
  hooks.status
    .mockReset()
    .mockImplementation(async (_project, workstream) =>
      workstream ? clean : { ...clean, branch: "main", head: "b".repeat(40) },
    );
});
it("shows the exact Workstream clean state and disables copying nonexistent edits", async () => {
  const html = await load();
  expect(hooks.status).toHaveBeenCalledWith("project", "claude-work");
  expect(html).toContain("All changes committed");
  expect(html).toContain("source-feature");
  expect(html).toContain(clean.head!.slice(0, 12));
  expect(html).toContain("No uncommitted changes to copy");
  expect(input("Copy current uncommitted work").props.disabled).toBe(true);
  capture("clean", html);
});
it("shows new files as uncommitted even when the project checkout is clean", async () => {
  hooks.status.mockImplementation(async (_project, workstream) =>
    workstream ? dirty : clean,
  );
  const html = await load();
  expect(html).toContain("Uncommitted changes");
  expect(html).toContain("1 file");
  expect(html).toContain("index.html");
  expect(html).toContain("not included");
  expect(html).not.toContain("All changes committed");
  expect(input("Copy current uncommitted work").props.disabled).toBe(false);
  capture("dirty", html);
  prepare("Copy current uncommitted work");
  expect(button("Start Workstream").props.disabled).toBe(false);
  elements(tree).find((e) => e.type === "form")!.props.onSubmit!({
    preventDefault: () => {},
  });
  await Promise.resolve();
  expect(start).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceWorkstream: {
        workstreamId: source.workstreamId,
        expectedRevision: source.revision,
        expectedHead: clean.head,
        mode: "uncommitted",
      },
    }),
  );
});
it("makes last-commit continuation explicit for clean work", async () => {
  await load();
  prepare("Start from this Workstream’s last commit");
  expect(button("Start Workstream").props.disabled).toBe(false);
  elements(tree).find((e) => e.type === "form")!.props.onSubmit!({
    preventDefault: () => {},
  });
  await Promise.resolve();
  expect(start).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceWorkstream: expect.objectContaining({
        mode: "last-commit",
        expectedHead: clean.head,
      }),
    }),
  );
});
it("does not assume clean or enable source choices before the Git read", () => {
  const html = render();
  expect(html).toContain("Checking Workstream Git status");
  expect(html).not.toContain("All changes committed");
  expect(input("Copy current uncommitted work").props.disabled).toBe(true);
  expect(input("Start from this Workstream’s last commit").props.disabled).toBe(
    true,
  );
});
it("invalidates old Git state while refreshing and recovers from a failed read", async () => {
  await load();
  prepare("Start from this Workstream’s last commit");
  hooks.status.mockRejectedValue(new Error("Source Workstream unavailable"));
  button("Refresh Git status").props.onClick!();
  expect(render()).not.toContain("All changes committed");
  expect(button("Start Workstream").props.disabled).toBe(true);
  const failed = await settle();
  expect(failed).toContain("Git status unavailable");
  expect(failed).toContain("No commit state assumed");
  capture("unavailable", failed);
  hooks.status.mockResolvedValue(dirty);
  button("Retry Git status").props.onClick!();
  render();
  expect(await settle()).toContain("Uncommitted changes");
});
it("never reuses Git status from another Workstream or revision", async () => {
  await load();
  prepare("Start from this Workstream’s last commit");
  source = { ...source, workstreamId: "different-work", revision: 5 };
  const html = render();
  expect(html).not.toContain("All changes committed");
  expect(button("Start Workstream").props.disabled).toBe(true);
  await settle();
  expect(hooks.status).toHaveBeenCalledWith("project", "different-work");
});
it("keeps task input and a useful retry instruction after an unexpected start failure", async () => {
  start.mockRejectedValue(new Error("Internal server error"));
  await load();
  prepare("Start from this Workstream’s last commit");
  elements(tree).find((e) => e.type === "form")!.props.onSubmit!({
    preventDefault: () => {},
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const html = render();
  expect(html).not.toContain("Internal server error");
  expect(html).toContain("Could not start this Workstream");
  expect(html).toContain("Refresh Git status");
  expect(html).toContain("Update visible homepage heading");
  expect(button("Start Workstream").props.disabled).toBe(false);
});

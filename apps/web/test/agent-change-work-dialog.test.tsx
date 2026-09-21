import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  deps: [] as unknown[][],
  effectCursor: 0,
  selected: vi.fn(),
  status: vi.fn(),
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useRef: () => ({ current: null }),
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
  useEffect: (effect: () => unknown, deps: unknown[]) => {
    const index = hooks.effectCursor++;
    if (
      !hooks.deps[index] ||
      deps.some((v, i) => v !== hooks.deps[index]![i])
    ) {
      hooks.deps[index] = deps;
      hooks.effects.push(effect);
    }
  },
}));
vi.mock("../src/world-entry/repository-workbench-client.js", () => ({
  selectedRepositoryProject: hooks.selected,
  repositoryGitStatus: hooks.status,
}));
import { AgentChangeWorkDialog } from "../src/world-entry/AgentChangeWorkDialog.js";
const props = {
  repositoryId: "repo",
  source: { workstreamId: "beans-work", title: "Beans website" },
  agentName: "Beans",
  onContinue: vi.fn(),
  onCancel: vi.fn(),
};
function render() {
  hooks.cursor = 0;
  hooks.effectCursor = 0;
  return renderToStaticMarkup(AgentChangeWorkDialog(props));
}
async function load() {
  render();
  hooks.effects.splice(0).forEach((effect) => effect());
  await vi.waitFor(() =>
    expect(hooks.status).toHaveBeenCalledWith("project", "beans-work"),
  );
  await Promise.resolve();
  return render();
}
beforeEach(() => {
  hooks.values = [];
  hooks.deps = [];
  hooks.effects = [];
  hooks.selected.mockReset().mockResolvedValue({ project: { id: "project" } });
  hooks.status
    .mockReset()
    .mockResolvedValue({ head: "a".repeat(40), changes: [] });
});
it("recognizes a manual commit on the exact source Workstream without requesting another", async () => {
  const html = await load();
  expect(html).toContain("All changes committed");
  expect(html).toContain("Continue to Change Agent");
  expect(html).not.toContain("Review local commit");
  expect(html).not.toContain("Change without committing");
});
it("keeps commit review and skip for remaining changes after an earlier commit", async () => {
  hooks.status.mockResolvedValue({
    head: "b".repeat(40),
    changes: [{ path: "index.html", status: " M" }],
  });
  const html = await load();
  expect(html).toContain("Review local commit");
  expect(html).toContain("Change without committing");
  expect(html).not.toContain("All changes committed");
});
it("does not assume a commit state before the Git read completes", () => {
  const html = render();
  expect(html).toContain("Checking Workstream Git status");
  expect(html).toMatch(
    /<button[^>]*disabled=""[^>]*>Continue to Change Agent<\/button>/,
  );
  expect(html).not.toContain("All changes committed");
});
it("offers retry rather than a false clean state when Git status fails", async () => {
  hooks.status.mockRejectedValue(new Error("Worktree unavailable"));
  const html = await load();
  expect(html).toContain("Git status unavailable");
  expect(html).toContain("Retry Git status");
  expect(html).not.toContain("All changes committed");
  expect(html).not.toContain("Change without committing");
});
it("does not advertise a saved commit for an empty unborn repository", async () => {
  hooks.status.mockResolvedValue({ head: null, changes: [] });
  const html = await load();
  expect(html).toContain("Working tree is clean. No changes to commit.");
  expect(html).not.toContain("All changes committed");
});

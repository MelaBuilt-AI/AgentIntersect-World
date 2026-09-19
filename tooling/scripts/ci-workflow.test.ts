import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = resolve(import.meta.dirname, "../..");
const workflow = parse(
  readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8"),
);

describe("proportional CI routing", () => {
  it("keeps full browser lanes behind explicit full scope and a final merge gate", () => {
    expect(workflow.jobs.scope).toBeDefined();
    for (const name of ["measurements", "e2e-flagged", "e2e-unflagged"]) {
      expect(workflow.jobs[name].needs).toBe("scope");
      expect(workflow.jobs[name].if).toBe("needs.scope.outputs.mode == 'full'");
    }
    expect(workflow.jobs.core.if).toBe("needs.scope.outputs.mode != 'docs'");
    expect(workflow.jobs.docs.if).toBe("needs.scope.outputs.mode == 'docs'");
    expect(workflow.jobs["merge-gate"].needs).toEqual([
      "scope",
      "docs",
      "core",
      "measurements",
      "e2e-flagged",
      "e2e-unflagged",
    ]);
    expect(workflow.jobs["merge-gate"].if).toContain("always()");
    expect(workflow.jobs["merge-gate"].if).toContain(
      "github.event_name != 'push'",
    );
    expect(workflow.on.pull_request.types).toContain("ready_for_review");
    expect(workflow.concurrency.group).toContain("github.event_name");
  });

  it("never gives skipped feature/draft jobs the required merge-check name", () => {
    // This expression uses only shared JS/Actions boolean/string operators.
    const expression = workflow.jobs["merge-gate"].name.slice(3, -2);
    for (const [event, ref, draft, expected] of [
      ["push", "refs/heads/feature", false, "merge-gate-not-applicable"],
      ["pull_request", "refs/pull/18/merge", true, "merge-gate-not-applicable"],
      ["pull_request", "refs/pull/18/merge", false, "merge-gate"],
      ["push", "refs/heads/main", false, "merge-gate"],
      ["workflow_dispatch", "refs/heads/feature", false, "merge-gate"],
    ] as const) {
      expect(
        runInNewContext(expression, {
          github: {
            event_name: event,
            ref,
            event: { pull_request: { draft } },
          },
          startsWith: (value: string, prefix: string) =>
            value.startsWith(prefix),
        }),
      ).toBe(expected);
    }
  });

  it("classifies real Git diffs including mixed changes, renames and new branches", () => {
    const result = execFileSync(
      "python3",
      [
        "-m",
        "unittest",
        "discover",
        "-s",
        ".github/scripts",
        "-p",
        "test_ci_scope.py",
        "-v",
      ],
      { cwd: root, encoding: "utf8", stdio: "pipe" },
    );
    expect(result).toContain("CI scope fixtures exercised");
  });
});

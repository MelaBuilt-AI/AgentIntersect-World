import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  repositoryProjectionLimit,
  supportedRepositoryProjection,
} from "../src/repository/repository-render-policy.js";
import { compactAvatarPreviewUses3d } from "../src/avatar/avatar-preview-policy.js";

describe("Phase 18.5 full-gate regression policies", () => {
  it("bounds a requested graph lane before its query resolves", () => {
    expect(repositoryProjectionLimit(false, false)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(repositoryProjectionLimit(true, false)).toBe(2_000);
    expect(repositoryProjectionLimit(true, true)).toBe(160);
    const panelSource = readFileSync(
      new URL("../src/repository/RepositoryWorldPanel.tsx", import.meta.url),
      "utf8",
    );
    expect(panelSource).toMatch(
      /repositoryProjectionLimit\(graphRequested, fallbackReason !== null\)/u,
    );
  });

  it("collects only supported repository objects up to the projection limit", () => {
    const objects = [
      { ref: "repo", kind: "repository" },
      { ref: "pkg", kind: "package" },
      { ref: "symbol", kind: "symbol" },
      { ref: "dir", kind: "directory" },
      { ref: "file", kind: "file" },
    ] as const;
    expect(
      supportedRepositoryProjection(objects, 2).map(({ ref }) => ref),
    ).toEqual(["pkg", "dir"]);
    expect(
      supportedRepositoryProjection(objects, Number.POSITIVE_INFINITY).map(
        ({ ref }) => ref,
      ),
    ).toEqual(["pkg", "dir", "file"]);
  });

  it("keeps compact dashboard avatars static instead of mounting optional WebGL", () => {
    expect(compactAvatarPreviewUses3d(false)).toBe(true);
    expect(compactAvatarPreviewUses3d(true)).toBe(false);
  });

  it("runs the strict Phase 18.5 performance journey once in an isolated CI browser", () => {
    const tag = "@phase18-5-performance";
    const workflow = readFileSync(
      new URL("../../../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    );
    const journey = readFileSync(
      new URL("../e2e/world-entry-single-agent.spec.ts", import.meta.url),
      "utf8",
    );
    type WorkflowStep = { readonly run?: unknown };
    type WorkflowJob = { readonly steps?: readonly WorkflowStep[] };
    const jobs = (
      parse(workflow) as {
        readonly jobs?: Readonly<Record<string, WorkflowJob>>;
      }
    ).jobs;
    expect(jobs).toBeDefined();
    if (!jobs) return;
    const runs = (jobName: string) =>
      (jobs[jobName]?.steps ?? []).flatMap((step) =>
        typeof step.run === "string" ? [step.run] : [],
      );
    const flaggedRuns = runs("e2e-flagged");
    const dedicatedRuns = runs("e2e-phase18-5");
    const unflaggedRuns = runs("e2e-unflagged");
    const dedicatedBrowserRun = dedicatedRuns.find((run) =>
      run.includes("playwright test"),
    );

    expect(journey.split(tag)).toHaveLength(2);
    expect(
      flaggedRuns.filter((run) => run.includes(`--grep-invert ${tag}`)),
    ).toHaveLength(1);
    expect(dedicatedRuns).toContain("pnpm build");
    expect(dedicatedBrowserRun).toContain("VITE_AIW_LOCAL_DEVELOPER_UI=1");
    expect(dedicatedBrowserRun).toContain("xvfb-run -a");
    expect(dedicatedBrowserRun).toContain(
      "apps/web/e2e/world-entry-single-agent.spec.ts",
    );
    expect(dedicatedBrowserRun).toContain("--config playwright.config.ts");
    expect(dedicatedBrowserRun).toContain("--workers=1");
    expect(dedicatedBrowserRun).toContain(`--grep ${tag}`);
    expect(unflaggedRuns.join(" ")).not.toContain(tag);

    const taggedWorkflowRuns = Object.entries(jobs).flatMap(([jobName, job]) =>
      (job.steps ?? []).flatMap((step) =>
        typeof step.run === "string" && step.run.includes(tag)
          ? [{ jobName, run: step.run }]
          : [],
      ),
    );
    expect(taggedWorkflowRuns.map(({ jobName }) => jobName).sort()).toEqual([
      "e2e-flagged",
      "e2e-phase18-5",
    ]);
  });
});

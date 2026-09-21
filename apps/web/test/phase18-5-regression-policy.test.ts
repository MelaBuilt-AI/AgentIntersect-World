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

  it("binds the current journey to imported readiness and truthful model identity", () => {
    const journey = readFileSync(
      new URL("../e2e/world-entry-single-agent.spec.ts", import.meta.url),
      "utf8",
    );
    expect(journey).not.toContain(".avatar-kit-canvas");
    expect(journey).toContain(
      '.imported-avatar-canvas[data-avatar-render-ready="true"][data-avatar-imported-id="cat-agent-01"]',
    );
    expect(journey).toMatch(/"data-agent-avatar-source"\s*,\s*"imported"/u);
    expect(journey).toMatch(
      /"data-agent-avatar-imported-id"\s*,\s*"cat-agent-01"/u,
    );
  });

  it("separates automatic current-input proof from manual historical native evidence", () => {
    const tag = "@phase18-5-performance";
    const workflow = readFileSync(
      new URL("../../../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    );
    const journey = readFileSync(
      new URL("../e2e/world-entry-single-agent.spec.ts", import.meta.url),
      "utf8",
    );
    const rootPackage = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    ) as { readonly scripts?: Readonly<Record<string, string>> };
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
    const unflaggedRuns = runs("e2e-unflagged");
    const allAutomaticRuns = Object.values(jobs).flatMap((job) =>
      (job.steps ?? []).flatMap((step) =>
        typeof step.run === "string" ? [step.run] : [],
      ),
    );

    expect(journey.split(tag)).toHaveLength(2);
    expect(flaggedRuns).toEqual([]);
    expect(unflaggedRuns).toEqual([]);
    expect(jobs["measurements"]).toBeUndefined();
    expect(runs("core")).toContain(
      "pnpm verify:imported-avatar-current-inputs",
    );
    expect(runs("core")).toContain("pnpm avatar:verify:compatibility");
    expect(jobs["e2e-phase18-5"]).toBeUndefined();
    expect(allAutomaticRuns).not.toContain("pnpm avatar:verify");
    expect(allAutomaticRuns.join(" ")).not.toContain("pnpm measure:phase18.5");
    expect(rootPackage.scripts?.["measure:phase18.5"]).toContain(
      "@phase18-5-performance",
    );
    expect(unflaggedRuns.join(" ")).not.toContain(tag);

    const taggedWorkflowRuns = Object.entries(jobs).flatMap(([jobName, job]) =>
      (job.steps ?? []).flatMap((step) =>
        typeof step.run === "string" && step.run.includes(tag)
          ? [{ jobName, run: step.run }]
          : [],
      ),
    );
    expect(taggedWorkflowRuns).toEqual([]);
  });
});

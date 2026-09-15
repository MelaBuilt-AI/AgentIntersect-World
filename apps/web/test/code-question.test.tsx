import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as prompts from "../src/world-entry/repository-explain-prompt.js";
import { RepositoryCodeScreen } from "../src/world-entry/RepositoryCodeScreen.js";
import { createWorkstreamSlab } from "../src/world-entry/workstream-embodiment.js";
import type { Workstream } from "../src/world-entry/workstream-tracer.js";

const work = {
  workstreamId: "work-one",
  title: "Homepage",
  status: "working",
  authority: {
    repository: { repositoryId: "repo-one" },
    authority: { branch: "feat/home" },
    worktreeState: "current",
  },
} as Workstream;

describe("contextual code questions", () => {
  it("offers Ask about this with the exact Workstream branch, not generic repository copy", () => {
    const html = renderToStaticMarkup(
      <RepositoryCodeScreen
        instance={createWorkstreamSlab(work, [])!}
        workstream={work}
        openingYaw={0}
        reducedMotion
        onClose={() => {}}
        onInspectionChange={() => {}}
        onAskAgent={() => {}}
      />,
    );
    expect(html).toContain("Ask about this");
    expect(html).toContain("Workstream source");
    expect(html).toContain("feat/home");
  });
  it("uses the fetched nested-file path and bounded literal source in the question", () => {
    const build = (prompts as Record<string, unknown>)
      .buildCodeQuestionPrompt as (input: unknown) => string;
    expect(build).toBeTypeOf("function");
    const question = build({
      path: "src/nested.ts",
      repositoryRef: "repo-one",
      content: "export const answer = 42;",
      workstream: work,
    });
    expect(question).toContain("src/nested.ts");
    expect(question).toContain("work-one");
    expect(question).toContain("feat/home");
    expect(question).toContain("export const answer = 42;");
    expect(question).toContain("Do not edit");
    expect(
      build({
        path: "large.ts",
        repositoryRef: "repo-one",
        content: "a".repeat(10000),
      }).length,
    ).toBeLessThan(7000);
  });
});

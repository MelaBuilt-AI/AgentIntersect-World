import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import {
  EmptyRepositoryState,
  RepositoryApiError,
} from "../src/phase5.stories.js";
import { RepositoryWorldErrorState } from "../src/repository/RepositoryWorldPanel.js";

describe("Phase 5 Storybook states", () => {
  it("has a real production API error story distinct from the empty state", () => {
    expect(RepositoryApiError.render).toBeTypeOf("function");
    expect(EmptyRepositoryState.render).toBeTypeOf("function");
    expect(RepositoryApiError.render).not.toBe(EmptyRepositoryState.render);

    const rendered = (
      RepositoryApiError.render as unknown as () => ReactElement<{
        message: string;
      }>
    )();
    expect(rendered.type).toBe(RepositoryWorldErrorState);
    expect(rendered.props.message).toContain("Invalid local server response");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IntegrationPanel } from "../src/integration/IntegrationPanel.js";
import { integrationFixture } from "../src/integration/integration-fixtures.js";

describe("Phase 6 integration projection UI", () => {
  it.each(["ready", "offline", "mismatch", "replayed", "hostile"] as const)(
    "renders an accessible %s observation-only state",
    (fixture) => {
      const state = integrationFixture(fixture);
      const html = renderToStaticMarkup(
        <IntegrationPanel
          state={state}
          readiness={{
            schema: "aiw.harness-readiness/0.6",
            harness: "codex",
            status: state.status,
            observationOnly: true,
            executionEnabled: false,
            diagnostic: `${state.status} fixture`,
          }}
        />,
      );
      expect(html).toContain(`data-integration-status="${state.status}"`);
      expect(html).toContain("Phase 6 observation-only");
      expect(html).toContain("disabled");
      expect(html).not.toContain("secret-value");
      expect(html).not.toContain("/home/operator");
      for (const marker of [
        "/var/private/key",
        "operator\\secret.txt",
        "c2VjcmV0",
        "session-secret",
        "my-secret",
      ])
        expect(html).not.toContain(marker);
    },
  );
});

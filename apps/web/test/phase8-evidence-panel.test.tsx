import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EvidencePanel } from "../src/evidence/EvidencePanel.js";
import { PHASE8_EVIDENCE_FIXTURE } from "../src/evidence/evidence-fixtures.js";

describe("Phase 8 authoritative Evidence panel", () => {
  it("renders current/previous identity, bounds, attribution, test truth, and link semantics", () => {
    const html = renderToStaticMarkup(
      <EvidencePanel
        evidence={PHASE8_EVIDENCE_FIXTURE}
        onSelectObject={vi.fn()}
      />,
    );
    for (const value of [
      "Current evidence",
      "Previous evidence",
      "670774c6-d71f-48b7-8936-8bd54a6cc520",
      "job-phase8",
      "run-phase8",
      "observed-in-window",
      "reported-and-confirmed",
      "reported-unverified",
      "verified · passed",
      "256 paths",
      "1 MiB total text diff",
      "128 KiB per file",
      "[REDACTED: secret-like content]",
    ])
      expect(html).toContain(value);
    expect(html).toContain('data-evidence-outcome="modified"');
    expect(html).toContain("Select src/main.ts in repository");
    expect(html).toContain("Reported path has no repository object");
    expect(html).toContain("disabled");
    expect(html).not.toContain("world-phase8-secret-canary");
    expect(html).not.toContain("/home/operator");
    expect(html).not.toContain("Export");
  });
});
